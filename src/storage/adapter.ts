import type { ContextRecord } from "../models/context";

/** owner 上下文随接口下传，为商业化多租户预留缝隙。 */
export interface OwnerContext {
  ownerId: string;
}

export interface ContextQuery {
  ownerId: string;
  since?: number;
  until?: number;
  limit?: number;
}

/** 可插拔存储后端契约：local / file / remote 三实现都满足它。 */
export interface StorageAdapter {
  readonly name: string;
  put(record: ContextRecord): Promise<void>;
  bulkPut(records: ContextRecord[]): Promise<void>;
  query(q: ContextQuery): Promise<ContextRecord[]>;
  get(ctx: OwnerContext, id: string): Promise<ContextRecord | undefined>;
  /** 清空指定 owner 的全部数据（一键清除）。 */
  clear(ctx: OwnerContext): Promise<void>;
}
