import { DEFAULT_OWNER_ID, type ContextRecord, type Interaction } from "../models/context";
import { shouldCapture } from "./filter";

/** 一次页面访问的原始信号，由 content script + background 计时器汇总。 */
export interface VisitSignal {
  url: string;
  title: string;
  /** content script 抽取的正文 Markdown；由 background 存入独立内容表后回填 rawContentRef。 */
  rawContent?: string;
  interactions: Interaction[];
  referrer?: string;
  fromUrl?: string;
}

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
  // 瞬时中转页由 content script 的存活定时器(SETTLE_MS)过滤:没活够时间就不会上报。

  return {
    id: crypto.randomUUID(),
    ownerId,
    timestamp: Date.now(),
    url: signal.url,
    title: cleanTitle(signal.title, signal.url),
    rawContentRef: undefined, // 由 background 存入正文后回填。
    interactions: signal.interactions,
    visitCount: 1,
    tags: [],
    source: { referrer: signal.referrer, fromUrl: signal.fromUrl },
  };
}

/**
 * 同 URL 去重边界 = 本地自然日零点:当天内的重访合并进同一条,次日重新计数。
 * 返回 now 所在本地日的 00:00:00.000 时间戳(用作合并查询的 since 下界)。
 */
export function startOfLocalDay(now: number = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * 把一次新访问合并进时间窗内的已有记录：合并交互、时间戳置顶、访问次数自增。
 * 保留 existing 的 id/ownerId/url/source/摘要/标签;标题取最新清理后的。纯函数便于单测。
 */
export function mergeVisit(existing: ContextRecord, incoming: ContextRecord): ContextRecord {
  return {
    ...existing,
    title: incoming.title,
    timestamp: Math.max(existing.timestamp, incoming.timestamp),
    interactions: [...existing.interactions, ...incoming.interactions],
    visitCount: (existing.visitCount ?? 1) + 1,
  };
}
