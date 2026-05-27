import { defineBackground } from "wxt/utils/define-background";
import { buildRecord, mergeVisit, startOfLocalDay, type VisitSignal } from "../collector/history";
import { LocalStorageAdapter } from "../storage/local";
import { RemoteStorageAdapter } from "../storage/remote";
import { getRemoteSettings } from "../storage/remoteConfig";
import type { ContextRecord } from "../models/context";

/**
 * 后台 service worker：接收 content script 在页面存活满 ~2s 时上报的 VisitSignal → 落库。
 * 同 URL 当天内合并(次日重新计数);有正文则存入独立内容表并回填 rawContentRef。
 * 若启用 DesktopHub 推送,落库后额外把 record+正文单向上报(best-effort)。
 */
export default defineBackground(() => {
  const storage = new LocalStorageAdapter();

  // 长生命周期单例:缓存自动发现的 DesktopHub 端口,避免每次采集都重探。
  const remoteAdapter = new RemoteStorageAdapter();
  // 推送开关:启动读一次(默认开启),变更时刷新,避免每次采集都读 storage。
  let remoteEnabled = true;
  getRemoteSettings().then((s) => (remoteEnabled = s.enabled));
  chrome.storage.onChanged.addListener(() => getRemoteSettings().then((s) => (remoteEnabled = s.enabled)));

  const pushRemote = (record: ContextRecord, markdown?: string): void => {
    if (!remoteEnabled) return;
    remoteAdapter
      .pushVisit(record, markdown)
      .catch((e) => console.warn("[ViewMind] DesktopHub 推送失败(本地已存)", e));
  };

  const save = async (signal: VisitSignal): Promise<{ saved: boolean; reason?: string }> => {
    try {
      const fresh = buildRecord(signal);
      if (!fresh) return { saved: false, reason: "filtered" };

      const target = await storage.findMergeTarget(fresh.ownerId, fresh.url, startOfLocalDay());
      const record = target ? mergeVisit(target, fresh) : fresh;
      if (signal.rawContent) record.rawContentRef = record.id;

      await storage.put(record); // 先存记录,正文失败不丢记录。
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
      pushRemote(record, signal.rawContent); // 启用时单向推送到 DesktopHub。
      return { saved: true };
    } catch (e) {
      console.error("[ViewMind] 落库出错", signal?.url, e);
      return { saved: false, reason: "error" };
    }
  };

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "visit") {
      save(msg.signal as VisitSignal).then(sendResponse);
      return true; // 异步响应。
    }
    return false;
  });

  // 点扩展图标(无 popup)→ 直接打开主控台。
  chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL("hub.html") });
  });

  // TODO(M0+): 需要精确停留时长时,用 chrome.tabs/visibility 后台计时;chrome.alarms 触发批量总结。
});
