import { describe, expect, it } from "vitest";
import { buildRecord } from "../src/collector/history";
import { DEFAULT_OWNER_ID } from "../src/models/context";

const base = { title: "T", interactions: [], dwellMs: 1000 };

describe("buildRecord", () => {
  it("returns null for blocked urls", () => {
    expect(buildRecord({ ...base, url: "https://mail.google.com/x" })).toBeNull();
  });

  it("builds a record with default ownerId and empty summary/tags", () => {
    const r = buildRecord({ ...base, url: "https://example.com/post" });
    expect(r).not.toBeNull();
    expect(r!.ownerId).toBe(DEFAULT_OWNER_ID);
    expect(r!.contentSummary).toBeUndefined();
    expect(r!.tags).toEqual([]);
    expect(r!.id).toMatch(/[0-9a-f-]{36}/);
  });
});
