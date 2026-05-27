import { defineContentScript } from "wxt/utils/define-content-script";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import type { Interaction, InteractionType } from "../models/context";
import type { VisitSignal } from "../collector/history";

/** 在 document 克隆上跑 Readability（会改 DOM），抽正文转 Markdown；失败返回 undefined。 */
function extractMarkdown(): string | undefined {
  try {
    const article = new Readability(document.cloneNode(true) as Document).parse();
    if (!article?.content) return undefined;
    const md = new TurndownService({ headingStyle: "atx" }).turndown(article.content);
    return md.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Content script：正文抽取（Readability + Turndown）+ 关键交互监听。
 * 页面隐藏时连同正文一起上报 VisitSignal。
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

    document.addEventListener("copy", () => {
      record("copy", window.getSelection()?.toString() ?? "");
    });

    let reported = false;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "hidden" || reported) return;
      reported = true;
      const signal: VisitSignal = {
        url: location.href,
        title: document.title,
        rawContent: extractMarkdown(),
        interactions,
        dwellMs: Date.now() - start,
        referrer: document.referrer || undefined,
      };
      chrome.runtime.sendMessage({ type: "visit-signal", signal });
    });
  },
});
