import { defineBackground } from "wxt/utils/define-background";
import { buildRecord, type VisitSignal } from "../collector/history";
import { LocalStorageAdapter } from "../storage/local";

/**
 * 后台 service worker：监听 tab/导航事件、停留计时、批量总结调度。
 * MVP 骨架：接收 content script 上报的 VisitSignal → 过滤 → 写入默认本地存储。
 */
export default defineBackground(() => {
  const storage = new LocalStorageAdapter();

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "visit-signal") {
      const record = buildRecord(msg.signal as VisitSignal);
      if (record) {
        storage.put(record).then(() => sendResponse({ saved: true }));
      } else {
        sendResponse({ saved: false, reason: "filtered" });
      }
      return true; // 异步响应。
    }
    return false;
  });

  // TODO(M0): chrome.tabs / chrome.webNavigation 监听 → 停留计时；
  //           chrome.alarms 空闲触发 runBatchSummarize。
});
