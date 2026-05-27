import { describe, expect, it } from "vitest";
import { matchTabsToClose, selectThisAndNewer } from "../src/collector/timelineSelection";

describe("selectThisAndNewer", () => {
  const records = [
    { id: "c", timestamp: 300 }, // 最新在上
    { id: "b", timestamp: 200 },
    { id: "a", timestamp: 100 },
  ];

  it("selects the anchor and all newer records", () => {
    expect(selectThisAndNewer(records, "b").sort()).toEqual(["b", "c"]);
  });

  it("anchor being newest selects only itself", () => {
    expect(selectThisAndNewer(records, "c")).toEqual(["c"]);
  });

  it("anchor being oldest selects everything", () => {
    expect(selectThisAndNewer(records, "a").sort()).toEqual(["a", "b", "c"]);
  });

  it("unknown anchor selects nothing", () => {
    expect(selectThisAndNewer(records, "zzz")).toEqual([]);
  });
});

describe("matchTabsToClose", () => {
  it("matches records to open tabs by canonical url and dedupes tab ids", () => {
    const selected = [{ url: "https://a.com/x#frag" }, { url: "https://gone.com/y" }];
    const openTabs = [
      { id: 1, url: "https://a.com/x" }, // 匹配第一条(忽略 hash)
      { id: 2, url: "https://a.com/x/" }, // 同一规范化 url,另一个标签
      { id: 3, url: "https://other.com" },
    ];
    const { tabIds, unmatchedRecordCount } = matchTabsToClose(selected, openTabs);
    expect(tabIds.sort()).toEqual([1, 2]);
    expect(unmatchedRecordCount).toBe(1); // gone.com 没有打开的标签
  });

  it("counts all as unmatched when nothing is open", () => {
    const { tabIds, unmatchedRecordCount } = matchTabsToClose(
      [{ url: "https://a.com" }, { url: "https://b.com" }],
      [],
    );
    expect(tabIds).toEqual([]);
    expect(unmatchedRecordCount).toBe(2);
  });
});
