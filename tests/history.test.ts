import { describe, expect, it } from "vitest";
import { buildRecord, cleanTitle, readableUrl } from "../src/collector/history";
import { DEFAULT_OWNER_ID, type Interaction } from "../src/models/context";

// 默认停留超过阈值，确保 buildRecord 不被噪音过滤挡掉。
const base = { title: "T", interactions: [] as Interaction[], dwellMs: 3000 };

describe("readableUrl", () => {
  it("keeps hostname + path, drops query and hash", () => {
    expect(readableUrl("https://www.google.com/search?q=x#y")).toBe("www.google.com/search");
  });
  it("drops bare trailing slash path", () => {
    expect(readableUrl("https://a.com/")).toBe("a.com");
  });
});

describe("cleanTitle", () => {
  it("falls back to readable url when title is empty", () => {
    expect(cleanTitle("   ", "https://a.com/p")).toBe("a.com/p");
  });
  it("falls back when title is itself a url", () => {
    expect(cleanTitle("https://www.google.com/search?q=baidu", "https://www.google.com/search?q=baidu")).toBe(
      "www.google.com/search",
    );
  });
  it("keeps a normal trimmed title", () => {
    expect(cleanTitle("  百度一下  ", "https://baidu.com")).toBe("百度一下");
  });
});

describe("buildRecord", () => {
  it("returns null for blocked urls", () => {
    expect(buildRecord({ ...base, url: "https://mail.google.com/x" })).toBeNull();
  });

  it("returns null for transient pages (short dwell, no interaction)", () => {
    expect(buildRecord({ ...base, url: "https://example.com/x", dwellMs: 800 })).toBeNull();
  });

  it("keeps short-dwell page if there was an interaction", () => {
    const interactions: Interaction[] = [{ type: "click", value: "x", ts: 1 }];
    const r = buildRecord({ ...base, url: "https://example.com/x", dwellMs: 800, interactions });
    expect(r).not.toBeNull();
  });

  it("builds a record with cleaned title, default ownerId, empty summary/tags", () => {
    const r = buildRecord({ ...base, title: "", url: "https://example.com/post" });
    expect(r).not.toBeNull();
    expect(r!.title).toBe("example.com/post"); // 空标题回退
    expect(r!.ownerId).toBe(DEFAULT_OWNER_ID);
    expect(r!.contentSummary).toBeUndefined();
    expect(r!.tags).toEqual([]);
    expect(r!.id).toMatch(/[0-9a-f-]{36}/);
  });
});
