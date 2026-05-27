import { describe, expect, it } from "vitest";
import { buildRecord, cleanTitle, mergeVisit, readableUrl } from "../src/collector/history";
import { DEFAULT_OWNER_ID, type ContextRecord, type Interaction } from "../src/models/context";

const base = { title: "T", interactions: [] as Interaction[] };

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

  it("returns null for noise/interstitial urls", () => {
    expect(buildRecord({ ...base, url: "https://www.baidu.com/link?url=abc" })).toBeNull();
  });

  it("builds a record with cleaned title, default ownerId, empty summary/tags, visitCount 1", () => {
    const r = buildRecord({ ...base, title: "", url: "https://example.com/post" });
    expect(r).not.toBeNull();
    expect(r!.title).toBe("example.com/post"); // 空标题回退
    expect(r!.ownerId).toBe(DEFAULT_OWNER_ID);
    expect(r!.contentSummary).toBeUndefined();
    expect(r!.tags).toEqual([]);
    expect(r!.visitCount).toBe(1);
    expect(r!.id).toMatch(/[0-9a-f-]{36}/);
  });
});

describe("mergeVisit", () => {
  const existing: ContextRecord = {
    id: "keep-me",
    ownerId: DEFAULT_OWNER_ID,
    timestamp: 100,
    url: "https://a.com/p",
    title: "旧标题",
    contentSummary: "已有摘要",
    interactions: [{ type: "click", value: "x", ts: 1 }],
    visitCount: 1,
    tags: ["t"],
    source: { referrer: "https://ref" },
  };
  const incoming = buildRecord({
    url: "https://a.com/p",
    title: "新标题",
    interactions: [{ type: "copy", value: "y", ts: 2 }],
  })!;

  it("keeps existing id/summary/tags/source, merges interactions, bumps time, counts up", () => {
    const m = mergeVisit(existing, incoming);
    expect(m.id).toBe("keep-me");
    expect(m.contentSummary).toBe("已有摘要");
    expect(m.tags).toEqual(["t"]);
    expect(m.source.referrer).toBe("https://ref");
    expect(m.title).toBe("新标题"); // 取最新标题
    expect(m.interactions).toHaveLength(2);
    expect(m.timestamp).toBe(incoming.timestamp); // 置顶为最新
    expect(m.visitCount).toBe(2);
  });
});
