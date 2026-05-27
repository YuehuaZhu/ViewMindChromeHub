import type { ContextRecord } from "../models/context";

export interface RemoteConfig {
  /** DesktopHub 聚合收口的 HTTP 端点（本地,如 http://127.0.0.1:8765）。 */
  endpoint: string;
  apiKey?: string;
}

/** 推送给 DesktopHub 的载荷:一条 ContextRecord + 其正文 Markdown。 */
export interface PushPayload {
  record: ContextRecord;
  markdown?: string;
}

/**
 * 远程 HTTP 上报 —— 把采集到的 context 单向推送到本地 DesktopHub。
 * 由用户在 options 显式配置 + 二次确认后启用(隐私红线)。总结/聚合在 DesktopHub 完成。
 *
 * 契约:POST {endpoint}/records,body = { records: PushPayload[] }。
 */
export class RemoteStorageAdapter {
  readonly name = "remote";

  constructor(private config: RemoteConfig) {}

  private headers(): HeadersInit {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.config.apiKey) h.Authorization = `Bearer ${this.config.apiKey}`;
    return h;
  }

  /** 推送一次访问(记录 + 正文)。失败抛出,由调用方 best-effort 处理。 */
  async pushVisit(record: ContextRecord, markdown?: string): Promise<void> {
    const payload: PushPayload = { record, markdown };
    const res = await fetch(`${this.config.endpoint.replace(/\/$/, "")}/records`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ records: [payload] }),
    });
    if (!res.ok) throw new Error(`DesktopHub 推送失败:${res.status}`);
  }
}
