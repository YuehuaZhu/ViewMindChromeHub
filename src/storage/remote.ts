import type { ContextRecord } from "../models/context";

/** DesktopHub 默认在本机这些候选端口之一监听(与 DesktopHub 的候选表同序)。 */
export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORTS = [7777, 7778, 7779];

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
 * 探测候选端口,返回第一个 `GET /health` 通的端口;都不通返回 undefined。
 * 设置页与 adapter 共用,用户无感地自动发现本机 DesktopHub。
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

  /** 推送一次访问(记录 + 正文 + 设备身份)。未发现 DesktopHub 或推送失败则抛出。 */
  async pushVisit(
    record: ContextRecord,
    markdown?: string,
    deviceId?: string,
    deviceLabel?: string,
  ): Promise<void> {
    const port = await this.resolvePort();
    if (port === undefined) {
      throw new Error("未发现本机 DesktopHub(候选端口 /health 均无响应)");
    }
    const payload: PushPayload = { record, markdown, deviceId, deviceLabel };
    try {
      const res = await fetch(`http://${this.host}:${port}/records`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ records: [payload] }),
      });
      if (!res.ok) throw new Error(`DesktopHub 推送失败:${res.status}`);
    } catch (e) {
      this.livePort = undefined; // 失败可能是端口变了,下次重新发现
      throw e;
    }
  }
}
