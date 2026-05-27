import { defineBackground } from "wxt/utils/define-background";
import { buildRecord, type VisitSignal } from "../collector/history";
import { LocalStorageAdapter } from "../storage/local";

/**
 * 后台 service worker：接收 content script 上报的 VisitSignal → 过滤 → 写入本地存储；
 * 有正文则存入独立内容表并回填 rawContentRef。
 */
export default defineBackground(() => {
  const storage = new LocalStorageAdapter();

  const handle = async (signal: VisitSignal): Promise<{ saved: boolean; reason?: string }> => {
    const record = buildRecord(signal);
    if (!record) return { saved: false, reason: "filtered" };

    if (signal.rawContent) {
      await storage.putContent({
        id: record.id,
        ownerId: record.ownerId,
        markdown: signal.rawContent,
        capturedAt: record.timestamp,
      });
      record.rawContentRef = record.id;
    }
    await storage.put(record);
    return { saved: true };
  };

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "visit-signal") {
      handle(msg.signal as VisitSignal).then(sendResponse);
      return true; // 异步响应。
    }
    return false;
  });

  // TODO(M0): chrome.tabs / chrome.webNavigation 监听 → 停留计时；
  //           chrome.alarms 空闲触发 runBatchSummarize。
});
