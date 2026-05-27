import { canonicalUrl } from "./tabState";

interface TimedRecord {
  id: string;
  timestamp: number;
}

/**
 * 区间快选:选中锚点记录 + 所有时间更晚(更新)的记录 —— 对应「某时间点以后」。
 * 时间线默认最新在上,"之后" = timestamp >= 锚点。
 */
export function selectThisAndNewer<T extends TimedRecord>(records: T[], anchorId: string): string[] {
  const anchor = records.find((r) => r.id === anchorId);
  if (!anchor) return [];
  return records.filter((r) => r.timestamp >= anchor.timestamp).map((r) => r.id);
}

interface UrlRecord {
  url: string;
}
interface TabRef {
  id: number;
  url: string;
}

export interface CloseMatch {
  /** 当前打开、且 URL 匹配选中记录的标签 id(去重)。 */
  tabIds: number[];
  /** 选中记录里、找不到对应打开标签的条数(已关闭/未打开)。 */
  unmatchedRecordCount: number;
}

/**
 * 把选中的历史记录按规范化 URL 匹配到当前打开的标签 —— 关闭只作用于仍打开的标签。
 * 匹配不到的记录计入 unmatchedRecordCount,用于回报「M 个已不在打开」。
 */
export function matchTabsToClose(
  selectedRecords: UrlRecord[],
  openTabs: TabRef[],
): CloseMatch {
  const tabByUrl = new Map<string, number[]>();
  for (const t of openTabs) {
    const key = canonicalUrl(t.url);
    (tabByUrl.get(key) ?? tabByUrl.set(key, []).get(key)!).push(t.id);
  }

  const tabIds = new Set<number>();
  let unmatchedRecordCount = 0;
  for (const rec of selectedRecords) {
    const ids = tabByUrl.get(canonicalUrl(rec.url));
    if (ids && ids.length) {
      ids.forEach((id) => tabIds.add(id));
    } else {
      unmatchedRecordCount++;
    }
  }
  return { tabIds: [...tabIds], unmatchedRecordCount };
}
