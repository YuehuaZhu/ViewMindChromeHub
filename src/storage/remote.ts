import type { ContextRecord } from "../models/context";
import type { ContextQuery, OwnerContext, StorageAdapter } from "./adapter";

export interface RemoteConfig {
  /** DesktopHub 聚合收口的 HTTP 端点。 */
  endpoint: string;
  apiKey?: string;
}

/**
 * 远程 HTTP 存储 adapter —— 把 ContextRecord 上报到 DesktopHub 聚合收口。
 * 必须由用户在 options 显式配置 + 二次确认才能启用。
 * TODO(M0): 协议细节等服务器端形态确定后补齐（见 PLAN「待实施时再定」）。
 */
export class RemoteStorageAdapter implements StorageAdapter {
  readonly name = "remote";

  constructor(private config: RemoteConfig) {}

  private headers(): HeadersInit {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.config.apiKey) h.Authorization = `Bearer ${this.config.apiKey}`;
    return h;
  }

  async put(record: ContextRecord): Promise<void> {
    await this.bulkPut([record]);
  }

  async bulkPut(records: ContextRecord[]): Promise<void> {
    await fetch(`${this.config.endpoint}/records`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ records }),
    });
  }

  async query(_q: ContextQuery): Promise<ContextRecord[]> {
    throw new Error("RemoteStorageAdapter.query 未实现（MVP 远程仅上报）");
  }

  async get(_ctx: OwnerContext, _id: string): Promise<ContextRecord | undefined> {
    throw new Error("RemoteStorageAdapter.get 未实现（MVP 远程仅上报）");
  }

  async clear(_ctx: OwnerContext): Promise<void> {
    throw new Error("RemoteStorageAdapter.clear 未实现（MVP 远程仅上报）");
  }
}
