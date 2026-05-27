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

/** 页面存活满 SETTLE_MS 才算"真正打开过";一闪而过的页定时器随上下文销毁不触发,天然过滤。 */
const SETTLE_MS = 2000;

/**
 * Content script：页面加载后等 SETTLE_MS,若仍存活则抽正文 + 上报一次 VisitSignal。
 * 在页面"还活着"时发送 → 可靠;不再等离开页面(那在同标签跳转/关页时常丢)。
 */
export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    const interactions: Interaction[] = [];
    const record = (type: InteractionType, value: string) => {
      if (value) interactions.push({ type, value, ts: Date.now() });
    };
    document.addEventListener("copy", () => {
      record("copy", window.getSelection()?.toString() ?? "");
    });

    setTimeout(() => {
      const signal: VisitSignal = {
        url: location.href,
        title: document.title,
        rawContent: extractMarkdown(),
        interactions,
        referrer: document.referrer || undefined,
      };
      chrome.runtime.sendMessage({ type: "visit", signal }, () => void chrome.runtime.lastError);
    }, SETTLE_MS);
  },
});
