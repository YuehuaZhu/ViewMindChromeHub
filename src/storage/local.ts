import Dexie, { type Table } from "dexie";
import type { ContextRecord, RawContent } from "../models/context";
import { canonicalUrl } from "../collector/tabState";
import type { ContextQuery, OwnerContext, StorageAdapter } from "./adapter";

class ViewMindDB extends Dexie {
  records!: Table<ContextRecord, string>;
  contents!: Table<RawContent, string>;

  constructor(name = "viewmind-hub") {
    super(name);
    this.version(1).stores({
      // 主键 id；按 ownerId+timestamp 复合索引支撑时间线查询。
      records: "id, ownerId, timestamp, [ownerId+timestamp]",
    });
    // v2：正文独立表，按需懒加载，不进时间线查询。
    this.version(2).stores({
      contents: "id, ownerId",
    });
    // v3：records 表加 syncState 索引，支撑 Outbox pending 查询。
    this.version(3).stores({
      records: "id, ownerId, timestamp, syncState, [ownerId+timestamp]",
      contents: "id, ownerId",
    });
  }
}

/** 默认存储后端：浏览器内 IndexedDB（Dexie 封装），全本地。dbName 供测试隔离用。 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly name = "local";
  private db: ViewMindDB;

  constructor(dbName?: string) {
    this.db = new ViewMindDB(dbName);
  }

  async put(record: ContextRecord): Promise<void> {
    await this.db.records.put(record);
  }

  async bulkPut(records: ContextRecord[]): Promise<void> {
    await this.db.records.bulkPut(records);
  }

  async query(q: ContextQuery): Promise<ContextRecord[]> {
    const coll = this.db.records
      .where("[ownerId+timestamp]")
      .between(
        [q.ownerId, q.since ?? Dexie.minKey],
        [q.ownerId, q.until ?? Dexie.maxKey],
      );
    const rows = await coll.reverse().toArray();
    return q.limit ? rows.slice(0, q.limit) : rows;
  }

  async get(ctx: OwnerContext, id: string): Promise<ContextRecord | undefined> {
    const r = await this.db.records.get(id);
    return r?.ownerId === ctx.ownerId ? r : undefined;
  }

  /** 找 since 起同规范化 URL 的记录作为合并目标（采集去重，since = 当天零点）。 */
  async findMergeTarget(
    ownerId: string,
    url: string,
    since: number,
  ): Promise<ContextRecord | undefined> {
    const recent = await this.db.records
      .where("[ownerId+timestamp]")
      .between([ownerId, since], [ownerId, Dexie.maxKey])
      .toArray();
    const cu = canonicalUrl(url);
    return recent.find((r) => canonicalUrl(r.url) === cu);
  }

  /** 存正文（独立表）。 */
  async putContent(content: RawContent): Promise<void> {
    await this.db.contents.put(content);
  }

  /** 按需取正文，owner 校验。 */
  async getContent(ctx: OwnerContext, id: string): Promise<RawContent | undefined> {
    const c = await this.db.contents.get(id);
    return c?.ownerId === ctx.ownerId ? c : undefined;
  }

  /** 一键清除：records 与 contents 同时按 ownerId 清空。 */
  async clear(ctx: OwnerContext): Promise<void> {
    await this.db.records.where("ownerId").equals(ctx.ownerId).delete();
    await this.db.contents.where("ownerId").equals(ctx.ownerId).delete();
  }

  // ── Outbox 方法 ──────────────────────────────────────────────────────────────

  /** 标记一条记录为已同步。 */
  async markSynced(id: string): Promise<void> {
    await this.db.records.update(id, { syncState: "synced" });
  }

  /**
   * 取最多 `limit` 条待推送记录（syncState === 'pending'），按 timestamp 升序（最老先推）。
   * 用于 Outbox flush。
   */
  async getPending(limit: number): Promise<ContextRecord[]> {
    const rows = await this.db.records
      .where("syncState")
      .equals("pending")
      .sortBy("timestamp");
    return rows.slice(0, limit);
  }

  /**
   * 如果 pending 记录数超过 `maxCount`，淘汰最老的（按 timestamp asc），
   * 只保留最新的 maxCount 条。防止离线期间队列无限膨胀。
   */
  async evictOldestPending(maxCount: number): Promise<void> {
    const pending = await this.db.records
      .where("syncState")
      .equals("pending")
      .sortBy("timestamp");
    if (pending.length <= maxCount) return;
    const toEvict = pending.slice(0, pending.length - maxCount).map((r) => r.id);
    await this.db.records.bulkDelete(toEvict);
  }
}
