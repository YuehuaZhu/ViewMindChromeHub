import Dexie, { type Table } from "dexie";
import type { ContextRecord, RawContent } from "../models/context";
import type { ContextQuery, OwnerContext, StorageAdapter } from "./adapter";

class ViewMindDB extends Dexie {
  records!: Table<ContextRecord, string>;
  contents!: Table<RawContent, string>;

  constructor() {
    super("viewmind-hub");
    this.version(1).stores({
      // 主键 id；按 ownerId+timestamp 复合索引支撑时间线查询。
      records: "id, ownerId, timestamp, [ownerId+timestamp]",
    });
    // v2：正文独立表，按需懒加载，不进时间线查询。
    this.version(2).stores({
      contents: "id, ownerId",
    });
  }
}

/** 默认存储后端：浏览器内 IndexedDB（Dexie 封装），全本地。 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly name = "local";
  private db = new ViewMindDB();

  async put(record: ContextRecord): Promise<void> {
    await this.db.records.put(record);
  }

  async bulkPut(records: ContextRecord[]): Promise<void> {
    await this.db.records.bulkPut(records);
  }

  async query(q: ContextQuery): Promise<ContextRecord[]> {
    let coll = this.db.records
      .where("[ownerId+timestamp]")
      .between(
        [q.ownerId, q.since ?? Dexie.minKey],
        [q.ownerId, q.until ?? Dexie.maxKey],
      );
    if (q.unsummarizedOnly) {
      coll = coll.filter((r) => r.contentSummary === undefined);
    }
    const rows = await coll.reverse().toArray();
    return q.limit ? rows.slice(0, q.limit) : rows;
  }

  async get(ctx: OwnerContext, id: string): Promise<ContextRecord | undefined> {
    const r = await this.db.records.get(id);
    return r?.ownerId === ctx.ownerId ? r : undefined;
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
}
