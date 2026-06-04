import { defineContentScript } from "wxt/utils/define-content-script";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import type { Interaction, InteractionType } from "../models/context";
import type { VisitSignal } from "../collector/history";
import { sha256Hex } from "../collector/fingerprint";

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

/** mouseup 后防抖，避免每个字符都触发。 */
const SELECT_DEBOUNCE_MS = 200;

/** 计算当前最大滚动深度（0-100，整数）。*/
function calcScrollDepth(): number {
  const scrolled = window.scrollY + window.innerHeight;
  const total = document.documentElement.scrollHeight;
  if (!total) return 0;
  return Math.min(100, Math.round((scrolled / total) * 100));
}

/**
 * Content script：页面加载后等 SETTLE_MS,若仍存活则抽正文 + 上报一次 VisitSignal。
 * 在页面"还活着"时发送 → 可靠;不再等离开页面(那在同标签跳转/关页时常丢)。
 */
export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    const interactions: Interaction[] = [];
    const record = (type: InteractionType, value: string, fingerprint?: string) => {
      if (value) interactions.push({ type, value, ts: Date.now(), fingerprint });
    };

    // ── 滚动深度：持续追踪最大值 ──────────────────────────────
    let maxScrollDepth = calcScrollDepth();
    const onScroll = () => {
      const d = calcScrollDepth();
      if (d > maxScrollDepth) maxScrollDepth = d;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // ── Tab 切换计数 + Dwell 累加 ─────────────────────────────
    // dwell 只算"页面真正可见时"的时长（hidden 状态不计），更接近"用户在看"的真值。
    // visibilitychange→hidden 时累加到 accumulatedDwellMs；→visible 时重置 visibleSince。
    let tabSwitchCount = 0;
    let accumulatedDwellMs = 0;
    let visibleSince: number | null = document.visibilityState === "visible" ? Date.now() : null;
    const computeDwell = (): number =>
      accumulatedDwellMs + (visibleSince ? Date.now() - visibleSince : 0);

    let recordId: string | undefined; // background.save() 落库后回填，dwellFinal 上报用
    let dwellFinalSent = false; // 避免多次 hidden / pagehide 重复推（远端 max-merge 已幂等，省一次网络）

    const sendDwellFinal = (): void => {
      if (!recordId) return; // 还没首次落库（< SETTLE_MS 离开），就没必要发了
      const dwellMs = computeDwell();
      if (dwellMs <= 0) return;
      dwellFinalSent = true;
      chrome.runtime
        .sendMessage({ type: "dwellFinal", recordId, dwellMs })
        .catch(() => void chrome.runtime.lastError); // service worker 已死的页面静默忽略
    };

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        // 进入 hidden：把到此为止的 visible 段累加进去，然后发一次最终 dwell（如果有 recordId）
        if (visibleSince) {
          accumulatedDwellMs += Date.now() - visibleSince;
          visibleSince = null;
        }
        sendDwellFinal();
      } else {
        // 回到 visible：重启计时，tabSwitchCount++（与原逻辑一致）
        tabSwitchCount++;
        visibleSince = Date.now();
        dwellFinalSent = false; // 重新可见后允许再次发一次 dwellFinal
      }
    });

    // pagehide 兜底：visibilitychange 在某些场景（强制关 tab）可能赶不上 service worker，
    // pagehide 是同步事件，sendMessage 仍可触达 background。
    window.addEventListener("pagehide", () => {
      if (visibleSince) {
        accumulatedDwellMs += Date.now() - visibleSince;
        visibleSince = null;
      }
      if (!dwellFinalSent) sendDwellFinal();
    });

    // mouseup：选中非空文本 → 记录 select 交互（防抖）
    let selectTimer: ReturnType<typeof setTimeout> | undefined;
    document.addEventListener("mouseup", () => {
      clearTimeout(selectTimer);
      selectTimer = setTimeout(() => {
        const text = window.getSelection()?.toString().trim() ?? "";
        if (text) record("select", text);
      }, SELECT_DEBOUNCE_MS);
    });

    // copy：记录复制文本 + SHA-256 指纹（异步算完后 patch 最后一条 copy）
    document.addEventListener("copy", () => {
      const text = window.getSelection()?.toString() ?? "";
      if (!text) return;
      const idx = interactions.length;
      record("copy", text);
      sha256Hex(text).then((fp) => {
        const target = interactions[idx];
        if (target?.type === "copy" && target.value === text) {
          target.fingerprint = fp;
        }
      });
    });

    setTimeout(() => {
      const signal: VisitSignal = {
        url: location.href,
        title: document.title,
        rawContent: extractMarkdown(),
        interactions,
        referrer: document.referrer || undefined,
        scrollDepthPct: maxScrollDepth,
        tabSwitchCount, // 始终上报（含 0），区分"0 次切换"与"未采集"
        dwellMs: computeDwell(), // 首次上报时 ≈ SETTLE_MS；真终值靠后续 dwellFinal
      };
      // 回调里拿到 background 落库后的 recordId，缓存供 dwellFinal 使用
      chrome.runtime.sendMessage(
        { type: "visit", signal },
        (response: { saved?: boolean; recordId?: string } | undefined) => {
          void chrome.runtime.lastError;
          if (response?.recordId) recordId = response.recordId;
        },
      );
    }, SETTLE_MS);
  },
});
