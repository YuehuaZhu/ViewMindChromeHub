import { defineContentScript } from "wxt/utils/define-content-script";
import type { Interaction, InteractionType } from "../models/context";
import type { VisitSignal } from "../collector/history";

/**
 * Content script：正文抽取（@mozilla/readability + turndown）+ 关键交互监听。
 * MVP 骨架：记录交互、页面卸载时上报 VisitSignal。正文抽取与敏感字段过滤待补。
 */
export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    const start = Date.now();
    const interactions: Interaction[] = [];

    const record = (type: InteractionType, value: string) => {
      if (value) interactions.push({ type, value, ts: Date.now() });
    };

    // 选中复制片段（TODO: 过敏感正则后再记录）。
    document.addEventListener("copy", () => {
      record("copy", window.getSelection()?.toString() ?? "");
    });

    // 页面隐藏时上报，避免 service worker 提前回收丢数据。
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "hidden") return;
      const signal: VisitSignal = {
        url: location.href,
        title: document.title,
        // TODO(M0): rawContentRef = turndown(Readability(document).parse()).
        interactions,
        dwellMs: Date.now() - start,
        referrer: document.referrer || undefined,
      };
      chrome.runtime.sendMessage({ type: "visit-signal", signal });
    });
  },
});
