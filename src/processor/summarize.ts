import { DEFAULT_OWNER_ID } from "../models/context";
import type { StorageAdapter } from "../storage/adapter";
import type { LLMProvider } from "./llm";

export interface SummarizeProgress {
  done: number;
  failed: number;
}

/**
 * 批量总结：拉未摘要记录 → 取正文(独立内容表)→ 调 LLM → 回写 summary + tags。
 * 手动触发,带上限省 token;逐条容错,单条失败跳过不中断。
 */
export async function runBatchSummarize(
  storage: StorageAdapter,
  llm: LLMProvider,
  loadContent: (id: string) => Promise<string | undefined>,
  opts: { ownerId?: string; limit?: number } = {},
): Promise<SummarizeProgress> {
  const ownerId = opts.ownerId ?? DEFAULT_OWNER_ID;
  const pending = await storage.query({
    ownerId,
    unsummarizedOnly: true,
    limit: opts.limit ?? 20,
  });

  let done = 0;
  let failed = 0;
  for (const record of pending) {
    try {
      const content = (await loadContent(record.id)) ?? record.title;
      const { summary, tags } = await llm.summarize(record.title, content);
      await storage.put({ ...record, contentSummary: summary, tags });
      done++;
    } catch (e) {
      console.warn("[ViewMind] 总结失败,跳过", record.url, e);
      failed++;
    }
  }
  return { done, failed };
}
