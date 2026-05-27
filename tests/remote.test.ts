import { describe, it, expect, afterEach, vi } from "vitest";
import { RemoteStorageAdapter, probeDesktopHub } from "../src/storage/remote";
import type { ContextRecord } from "../src/models/context";

const record: ContextRecord = {
  id: "r1",
  ownerId: "local-default",
  timestamp: 1,
  url: "https://x.test",
  title: "t",
  interactions: [],
  dwellMs: 0,
  tags: [],
  source: {},
};

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** 假 fetch:只有 livePort 的 /health 与 /records 通,其余端口连不上。 */
function fakeFetch(livePort: number, calls: { url: string; method: string; body?: unknown }[]) {
  return vi.fn(async (url: string | URL, init?: { method?: string; body?: unknown }) => {
    const u = new URL(String(url));
    calls.push({ url: String(url), method: init?.method ?? "GET", body: init?.body });
    if (Number(u.port) !== livePort) throw new Error("ECONNREFUSED");
    return { ok: true } as Response;
  });
}

describe("probeDesktopHub", () => {
  it("returns the first candidate whose /health responds", async () => {
    const calls: { url: string; method: string }[] = [];
    globalThis.fetch = fakeFetch(7778, calls) as unknown as typeof fetch;
    expect(await probeDesktopHub("127.0.0.1", [7777, 7778, 7779])).toBe(7778);
  });

  it("returns undefined when no candidate responds", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("down");
    }) as unknown as typeof fetch;
    expect(await probeDesktopHub("127.0.0.1", [7777, 7778])).toBeUndefined();
  });
});

describe("RemoteStorageAdapter", () => {
  it("discovers a port, posts PushPayload shape, and caches the port", async () => {
    const calls: { url: string; method: string; body?: unknown }[] = [];
    globalThis.fetch = fakeFetch(7779, calls) as unknown as typeof fetch;

    const adapter = new RemoteStorageAdapter();
    await adapter.pushVisit(record, "md body");

    const post = calls.find((c) => c.url.includes("/records"));
    expect(post?.url).toBe("http://127.0.0.1:7779/records");
    expect(JSON.parse(post?.body as string)).toEqual({ records: [{ record, markdown: "md body" }] });

    // 第二次推送应命中端口缓存,不再探测 /health
    calls.length = 0;
    await adapter.pushVisit(record);
    expect(calls.filter((c) => c.url.includes("/health"))).toHaveLength(0);
  });

  it("throws when no DesktopHub is found", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("down");
    }) as unknown as typeof fetch;
    await expect(new RemoteStorageAdapter().pushVisit(record)).rejects.toThrow(/未发现/);
  });
});
