import { describe, expect, it } from "vitest";
import { toExportRecord } from "../src/storage/file";
import { DEFAULT_OWNER_ID, type ContextRecord } from "../src/models/context";

describe("toExportRecord", () => {
  it("adds readable time while keeping raw epoch timestamp", () => {
    const rec: ContextRecord = {
      id: "1",
      ownerId: DEFAULT_OWNER_ID,
      timestamp: 1779871739310,
      url: "https://a.com",
      title: "A",
      interactions: [],
      tags: [],
      source: {},
    };
    const out = toExportRecord(rec);
    expect(out.timestamp).toBe(1779871739310); // 原始保留
    expect(typeof out.time).toBe("string");
    expect(out.time.length).toBeGreaterThan(0);
  });
});
