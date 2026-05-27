import { DEFAULT_OWNER_ID, type ContextRecord, type Interaction } from "../models/context";
import { shouldCapture } from "./filter";

/** 一次页面访问的原始信号，由 content script + background 计时器汇总。 */
export interface VisitSignal {
  url: string;
  title: string;
  rawContentRef?: string;
  interactions: Interaction[];
  dwellMs: number;
  referrer?: string;
  fromUrl?: string;
}

/**
 * 历史采集编排：过滤 → 组装 ContextRecord（摘要/标签留空，待 processor 惰性填充）。
 * 命中黑名单/噪音返回 null（不写入历史）。
 */
export function buildRecord(
  signal: VisitSignal,
  blocklist?: string[],
  ownerId: string = DEFAULT_OWNER_ID,
): ContextRecord | null {
  if (!shouldCapture(signal.url, blocklist)) return null;

  return {
    id: crypto.randomUUID(),
    ownerId,
    timestamp: Date.now(),
    url: signal.url,
    title: signal.title,
    rawContentRef: signal.rawContentRef,
    interactions: signal.interactions,
    dwellMs: signal.dwellMs,
    tags: [],
    source: { referrer: signal.referrer, fromUrl: signal.fromUrl },
  };
}
