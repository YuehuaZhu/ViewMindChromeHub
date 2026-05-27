import { defineBackground } from "wxt/utils/define-background";
import { buildRecord, mergeVisit, DEDUP_WINDOW_MS, type VisitSignal } from "../collector/history";
import { LocalStorageAdapter } from "../storage/local";

/**
 * 后台 service worker：接收 content script 上报的 VisitSignal → 过滤 → 写入本地存储；
 * 同 URL 时间窗内合并;有正文则存入独立内容表并回填 rawContentRef。
 */
export default defineBackground(() => {
  const storage = new LocalStorageAdapter();

  const handle = async (signal: VisitSignal): Promise<{ saved: boolean; reason?: string }> => {
    try {
      const fresh = buildRecord(signal);
      if (!fresh) {
        console.info("[ViewMind] 过滤跳过", signal.url, "dwell=", signal.dwellMs);
        return { saved: false, reason: "filtered" };
      }

      // 时间窗内同 URL → 合并进已有记录(沿用其 id),否则新增。
      const target = await storage.findMergeTarget(fresh.ownerId, fresh.url, DEDUP_WINDOW_MS);
      const record = target ? mergeVisit(target, fresh) : fresh;
      if (signal.rawContent) record.rawContentRef = record.id;

      // 先存记录,保证不因正文存储失败而丢记录。
      await storage.put(record);

      if (signal.rawContent) {
        try {
          await storage.putContent({
            id: record.id,
            ownerId: record.ownerId,
            markdown: signal.rawContent,
            capturedAt: record.timestamp,
          });
        } catch (e) {
          console.warn("[ViewMind] 正文存储失败(记录已存)", e);
        }
      }
      console.info("[ViewMind] 已存记录", record.url, target ? "(合并)" : "(新增)");
      return { saved: true };
    } catch (e) {
      console.error("[ViewMind] 处理 visit-signal 出错", signal?.url, e);
      return { saved: false, reason: "error" };
    }
  };

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "visit-signal") {
      console.info("[ViewMind] 收到 visit-signal", msg.signal?.url);
      handle(msg.signal as VisitSignal).then(sendResponse);
      return true; // 异步响应。
    }
    return false;
  });

  // 点扩展图标(无 popup)→ 直接打开主控台。
  chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL("hub.html") });
  });

  // TODO(M0): chrome.tabs / chrome.webNavigation 监听 → 停留计时；
  //           chrome.alarms 空闲触发 runBatchSummarize。
});
