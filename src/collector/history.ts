import { DEFAULT_OWNER_ID, type ContextRecord, type Interaction } from "../models/context";
import { shouldCapture } from "./filter";

/** 一次页面访问的原始信号，由 content script + background 计时器汇总。 */
export interface VisitSignal {
  url: string;
  title: string;
  /** content script 抽取的正文 Markdown；由 background 存入独立内容表后回填 rawContentRef。 */
  rawContent?: string;
  interactions: Interaction[];
  dwellMs: number;
  referrer?: string;
  fromUrl?: string;
}

/** 停留低于此阈值且无交互的页视为中转/未真正阅读，不入库。按真机观感可调。 */
export const MIN_DWELL_MS = 2000;

/** 把 URL 收成可读形式：hostname + 路径（去掉 query/hash），解析失败原样返回。 */
export function readableUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return url;
  }
}

/** 标题清理：空标题或标题本身是 URL → 回退到可读 URL；否则用去空白的原标题。 */
export function cleanTitle(title: string, url: string): string {
  const t = title.trim();
  if (!t || /^https?:\/\//i.test(t)) return readableUrl(url);
  return t;
}

/**
 * 历史采集编排：过滤 → 组装 ContextRecord（摘要/标签留空，待 processor 惰性填充）。
 * 命中黑名单/噪音/瞬时中转页返回 null（不写入历史）。
 */
export function buildRecord(
  signal: VisitSignal,
  blocklist?: string[],
  ownerId: string = DEFAULT_OWNER_ID,
): ContextRecord | null {
  if (!shouldCapture(signal.url, blocklist)) return null;
  // 瞬时中转页（重定向链等）：停留过短且无交互，未真正阅读 → 跳过。
  if (signal.dwellMs < MIN_DWELL_MS && signal.interactions.length === 0) return null;

  return {
    id: crypto.randomUUID(),
    ownerId,
    timestamp: Date.now(),
    url: signal.url,
    title: cleanTitle(signal.title, signal.url),
    rawContentRef: undefined, // 由 background 存入正文后回填。
    interactions: signal.interactions,
    dwellMs: signal.dwellMs,
    tags: [],
    source: { referrer: signal.referrer, fromUrl: signal.fromUrl },
  };
}
