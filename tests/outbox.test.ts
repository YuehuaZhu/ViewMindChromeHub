import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { LocalStorageAdapter } from "../src/storage/local";
import type { ContextRecord } from "../src/models/context";

function makeRecord(id: string, ts: number, syncState?: ContextRecord["syncState"]): ContextRecord {
  return {
    id,
    ownerId: "local-default",
    timestamp: ts,
    url: `https://example.com/${id}`,
    title: id,
    interactions: [],
    tags: [],
    source: {},
    syncState,
  };
}

// 每个 it 用独立 DB 名，避免 fake-indexeddb 全局状态污染
let dbIdx = 0;
function freshAdapter(): LocalStorageAdapter {
  return new LocalStorageAdapter(`test-db-${++dbIdx}`);
}

describe("Outbox: markSynced", () => {
  it("updates syncState to synced", async () => {
    const adapter = freshAdapter();
    const r = makeRecord("r1", 1000, "pending");
    await adapter.put(r);
    await adapter.markSynced("r1");
    const updated = await adapter.get({ ownerId: "local-default" }, "r1");
    expect(updated?.syncState).toBe("synced");
  });
});

describe("Outbox: getPending", () => {
  it("returns only pending records, sorted by timestamp asc", async () => {
    const adapter = freshAdapter();
    await adapter.put(makeRecord("a", 3000, "pending"));
    await adapter.put(makeRecord("b", 1000, "pending"));
    await adapter.put(makeRecord("c", 2000, "synced"));
    await adapter.put(makeRecord("d", 500, "pending"));

    const pending = await adapter.getPending(10);
    expect(pending.map((r) => r.id)).toEqual(["d", "b", "a"]); // oldest first
  });

  it("respects limit", async () => {
    const adapter = freshAdapter();
    for (let i = 0; i < 10; i++) {
      await adapter.put(makeRecord(`r${i}`, i * 100, "pending"));
    }
    const pending = await adapter.getPending(3);
    expect(pending).toHaveLength(3);
  });

  it("returns empty when no pending records", async () => {
    const adapter = freshAdapter();
    await adapter.put(makeRecord("x", 1000, "synced"));
    expect(await adapter.getPending(10)).toHaveLength(0);
  });
});

describe("Outbox: evictOldestPending", () => {
  it("keeps only the newest N pending records", async () => {
    const adapter = freshAdapter();
    for (let i = 1; i <= 5; i++) {
      await adapter.put(makeRecord(`r${i}`, i * 1000, "pending"));
    }
    await adapter.evictOldestPending(3);
    const remaining = await adapter.getPending(10);
    expect(remaining).toHaveLength(3);
    // 保留最新的 3 条（r3, r4, r5）
    expect(remaining.map((r) => r.id).sort()).toEqual(["r3", "r4", "r5"]);
  });

  it("no-op when count is within limit", async () => {
    const adapter = freshAdapter();
    await adapter.put(makeRecord("a", 1000, "pending"));
    await adapter.put(makeRecord("b", 2000, "pending"));
    await adapter.evictOldestPending(5);
    expect(await adapter.getPending(10)).toHaveLength(2);
  });

  it("does not touch synced records", async () => {
    const adapter = freshAdapter();
    for (let i = 1; i <= 3; i++) {
      await adapter.put(makeRecord(`p${i}`, i * 1000, "pending"));
    }
    await adapter.put(makeRecord("s1", 500, "synced"));
    await adapter.evictOldestPending(1);
    // 只保留 1 条 pending；synced 的不变
    expect(await adapter.getPending(10)).toHaveLength(1);
    const s = await adapter.get({ ownerId: "local-default" }, "s1");
    expect(s?.syncState).toBe("synced");
  });
});
