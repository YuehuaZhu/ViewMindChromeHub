import { describe, expect, it } from "vitest";
import { canonicalUrl, groupTabs, toLiveTabs } from "../src/collector/tabState";
import type { LiveTab } from "../src/models/tab";

function tab(id: number, url: string): LiveTab {
  return { id, windowId: 1, url, title: url, active: false };
}

describe("toLiveTabs", () => {
  it("drops tabs without id or url and falls back title to url", () => {
    const raw = [
      { id: 1, windowId: 1, url: "https://a.com", title: "A", active: true },
      { id: 2, windowId: 1, url: "https://b.com", title: "  ", active: false },
      { id: undefined, windowId: 1, url: "https://c.com", active: false },
      { id: 4, windowId: 1, url: undefined, active: false },
    ] as chrome.tabs.Tab[];

    const live = toLiveTabs(raw);
    expect(live.map((t) => t.id)).toEqual([1, 2]);
    expect(live[1].title).toBe("https://b.com"); // 空白标题回退到 url
  });
});

describe("canonicalUrl", () => {
  it("strips hash and trailing slash for dedup", () => {
    expect(canonicalUrl("https://a.com/x/#frag")).toBe(canonicalUrl("https://a.com/x"));
  });
});

describe("groupTabs", () => {
  it("groups by domain and flags duplicates", () => {
    const groups = groupTabs([
      tab(1, "https://a.com/1"),
      tab(2, "https://a.com/1#dup"),
      tab(3, "https://b.com/x"),
    ]);

    const a = groups.find((g) => g.domain === "a.com")!;
    expect(a.tabs).toHaveLength(2);
    expect(a.duplicateTabIds).toEqual([2]);

    const b = groups.find((g) => g.domain === "b.com")!;
    expect(b.duplicateTabIds).toEqual([]);
  });

  it("sorts groups by tab count descending", () => {
    const groups = groupTabs([
      tab(1, "https://a.com/1"),
      tab(2, "https://a.com/2"),
      tab(3, "https://b.com/x"),
    ]);
    expect(groups[0].domain).toBe("a.com");
  });
});
