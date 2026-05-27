import { DEFAULT_OWNER_ID, type ContextRecord } from "../models/context";
import type { StorageAdapter } from "../storage/adapter";
import type { LLMProvider } from "./llm";

/**
 * 惰性/批量总结：拉取未摘要记录 → 逐条调 LLM → 回写 summary + tags。
 * 由 background 在空闲或手动触发时调度，省 token。
 * TODO(M0): 接入正文（rawContentRef 解引用）、失败重试、并发上限。
 */
export async function runBatchSummarize(
  storage: StorageAdapter,
  llm: LLMProvider,
  opts: { ownerId?: string; limit?: number } = {},
): Promise<number> {
  const ownerId = opts.ownerId ?? DEFAULT_OWNER_ID;
  const pending = await storage.query({
    ownerId,
    unsummarizedOnly: true,
    limit: opts.limit ?? 20,
  });

  let done = 0;
  for (const record of pending) {
    const content = record.rawContentRef ?? record.title;
    const { summary, tags } = await llm.summarize(record.title, content);
    const updated: ContextRecord = { ...record, contentSummary: summary, tags };
    await storage.put(updated);
    done++;
  }
  return done;
}
