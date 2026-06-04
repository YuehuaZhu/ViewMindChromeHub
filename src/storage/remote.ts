import type { ContextRecord } from "../models/context";

/** ViewMindPipeline ingest-server 默认端口（可用 PORT 环境变量覆盖）。 */
export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORTS = [8787, 8788, 8789];

export interface RemoteConfig {
  host?: string;
  /** 候选端口,按序探测;默认 DEFAULT_PORTS。 */
  ports?: number[];
  apiKey?: string;
}

/** 推送给 DesktopHub 的载荷:一条 ContextRecord + 正文 + 设备身份。 */
export interface PushPayload {
  record: ContextRecord;
  markdown?: string;
  deviceId?: string;
  deviceLabel?: string;
}

/**
 * 探测候选端口，返回第一个 `GET /health` 通的端口；都不通返回 undefined。
 * 设置页与 adapter 共用，用户无感地自动发现本机 ingest-server。
 */
export async function probeDesktopHub(
  host: string = DEFAULT_HOST,
  ports: number[] = DEFAULT_PORTS,
): Promise<number | undefined> {
  for (const port of ports) {
    try {
      const res = await fetch(`http://${host}:${port}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return port;
    } catch {
      // 该端口没起服务或超时,试下一个
    }
  }
  return undefined;
}

/**
 * 远程 HTTP 上报 —— 把采集到的 context 单向推送到本机 DesktopHub。
 * 端口自动发现(无需手填端点);失败 best-effort,由调用方处理。总结/聚合在 DesktopHub 完成。
 *
 * 契约:POST http://host:port/records,body = { records: PushPayload[] }。
 */
export class RemoteStorageAdapter {
  readonly name = "remote";
  private host: string;
  private ports: number[];
  private apiKey?: string;
  /** 缓存已发现的活端口,避免每次推送都重探;失败时清空重探。 */
  private livePort?: number;

  constructor(config: RemoteConfig = {}) {
    this.host = config.host ?? DEFAULT_HOST;
    this.ports = config.ports?.length ? config.ports : DEFAULT_PORTS;
    this.apiKey = config.apiKey;
  }

  private headers(): HeadersInit {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) h.Authorization = `Bearer ${this.apiKey}`;
    return h;
  }

  /** 解析目标端口:有缓存用缓存,否则探测候选表。 */
  async resolvePort(): Promise<number | undefined> {
    if (this.livePort !== undefined) return this.livePort;
    this.livePort = await probeDesktopHub(this.host, this.ports);
    return this.livePort;
  }

  /** 推送一次访问（记录 + 正文 + 设备身份）。未发现 ingest-server 或推送失败则抛出。 */
  async pushVisit(
    record: ContextRecord,
    markdown?: string,
    deviceId?: string,
    deviceLabel?: string,
  ): Promise<void> {
    const port = await this.resolvePort();
    if (port === undefined) {
      throw new Error("未发现本机 ingest-server（候选端口 /health 均无响应）");
    }
    const payload: PushPayload = { record, markdown, deviceId, deviceLabel };
    try {
      const res = await fetch(`http://${this.host}:${port}/ingest/browser`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ records: [payload] }),
      });
      if (!res.ok) throw new Error(`ingest-server 推送失败：${res.status}`);
    } catch (e) {
      this.livePort = undefined; // 失败可能是端口变了，下次重新发现
      throw e;
    }
  }

  /**
   * 推送 dwell 终值。content script 在 visibilitychange→hidden / pagehide 时发起；
   * ingest 端 max-merge 单调递增（旧 ingest 没这个端点会返 404，吃掉静默忽略）。
   * 设计成静默 best-effort：dwell 是派生测度，失败不应阻断主流程。
   */
  async pushDwell(recordId: string, dwellMs: number): Promise<void> {
    const port = await this.resolvePort();
    if (port === undefined) return; // 没有 ingest，静默忽略
    try {
      const res = await fetch(`http://${this.host}:${port}/ingest/browser/dwell`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ recordId, dwellMs }),
      });
      if (!res.ok && res.status >= 500) {
        // 5xx 才认为是基础设施问题，需要重探端口
        this.livePort = undefined;
      }
      // 4xx (旧 ingest 返 404 / 校验 400) 不重试，dwell 是 nice-to-have
    } catch {
      this.livePort = undefined;
    }
  }
}
