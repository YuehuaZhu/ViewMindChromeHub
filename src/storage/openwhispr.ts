import type { ContextRecord } from "../models/context";

export const OW_HOST = "127.0.0.1";
/** cliBridge 候选端口范围，与 VoxEdit/OpenWhispr cliBridge.js 同序。 */
export const OW_PORTS = Array.from({ length: 20 }, (_, i) => 8200 + i);

export interface OwContextPayload {
  source: "chromehub-autopush";
  url: string;
  title: string;
  markdown?: string;
}

/** 探测候选端口，返回第一个 /health 通的端口。 */
export async function probeOpenWhispr(
  host: string = OW_HOST,
  ports: number[] = OW_PORTS,
): Promise<number | undefined> {
  for (const port of ports) {
    try {
      const res = await fetch(`http://${host}:${port}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return port;
    } catch {
      // 该端口未开放或超时，继续探测
    }
  }
  return undefined;
}

/**
 * 单向把当前页上下文推送到本机 OpenWhispr Chat Overlay。
 * 端口自动发现（8200-8219）；token 可选（cliBridge Bearer auth）。
 * best-effort：失败只 warn，不影响本地采集。
 */
export class OpenWhisprAdapter {
  private token?: string;
  private livePort?: number;

  constructor(config: { token?: string } = {}) {
    this.token = config.token;
  }

  updateToken(token?: string): void {
    this.token = token;
  }

  private headers(): HeadersInit {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    return h;
  }

  async resolvePort(): Promise<number | undefined> {
    if (this.livePort !== undefined) return this.livePort;
    this.livePort = await probeOpenWhispr();
    return this.livePort;
  }

  async pushContext(record: ContextRecord, markdown?: string): Promise<void> {
    const port = await this.resolvePort();
    if (port === undefined) throw new Error("未发现本机 OpenWhispr（8200-8219 均无响应）");

    const payload: OwContextPayload = {
      source: "chromehub-autopush",
      url: record.url,
      title: record.title,
      markdown,
    };

    try {
      const res = await fetch(`http://${OW_HOST}:${port}/chat-context`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`OpenWhispr 推送失败: ${res.status}`);
    } catch (e) {
      this.livePort = undefined; // 失败清缓存，下次重探
      throw e;
    }
  }
}
