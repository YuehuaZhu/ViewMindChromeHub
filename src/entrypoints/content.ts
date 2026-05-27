import { defineContentScript } from "wxt/utils/define-content-script";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";

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
 * Content script：页面加载后与后台建立长连接 port。
 * 端口存活 = 页面存活;离开页面时 port 自动断开,由后台据此计算停留并落库。
 * 不再在页面卸载时 sendMessage(那在同标签跳转/关页时常丢失)。
 */
export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    const port = chrome.runtime.connect({ name: "visit" });

    port.postMessage({
      kind: "meta",
      url: location.href,
      title: document.title,
      rawContent: extractMarkdown(),
      referrer: document.referrer || undefined,
    });

    document.addEventListener("copy", () => {
      const value = window.getSelection()?.toString();
      if (value) {
        port.postMessage({ kind: "interaction", interaction: { type: "copy", value, ts: Date.now() } });
      }
    });
  },
});
