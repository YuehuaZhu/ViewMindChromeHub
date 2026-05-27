import { describe, expect, it } from "vitest";
import { formatDuration, toExportRecord } from "../src/storage/file";
import { DEFAULT_OWNER_ID, type ContextRecord } from "../src/models/context";

describe("formatDuration", () => {
  it("formats hours/minutes", () => {
    expect(formatDuration(4810298)).toBe("1h20m");
  });
  it("formats minutes/seconds", () => {
    expect(formatDuration(572000)).toBe("9m32s");
  });
  it("formats seconds only", () => {
    expect(formatDuration(29076)).toBe("29s");
  });
  it("clamps negatives to 0s", () => {
    expect(formatDuration(-5)).toBe("0s");
  });
});

describe("toExportRecord", () => {
  it("adds readable time/dwell while keeping raw epoch/ms", () => {
    const rec: ContextRecord = {
      id: "1",
      ownerId: DEFAULT_OWNER_ID,
      timestamp: 1779871739310,
      url: "https://a.com",
      title: "A",
      interactions: [],
      dwellMs: 572000,
      tags: [],
      source: {},
    };
    const out = toExportRecord(rec);
    expect(out.timestamp).toBe(1779871739310); // 原始保留
    expect(out.dwellMs).toBe(572000);
    expect(out.dwell).toBe("9m32s");
    expect(typeof out.time).toBe("string");
    expect(out.time.length).toBeGreaterThan(0);
  });
});
