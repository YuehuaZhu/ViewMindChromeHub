import type { LiveTab, TabGroup } from "../models/tab";
import { normalizeDomain } from "./filter";

/** 规范化 URL 用于重复检测：去掉 hash 与尾部斜杠。 */
export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

/** chrome.tabs.Tab → LiveTab：丢弃无 id / 无 url 的 tab（如尚未加载完）。纯函数便于单测。 */
export function toLiveTabs(tabs: chrome.tabs.Tab[]): LiveTab[] {
  const out: LiveTab[] = [];
  for (const t of tabs) {
    if (t.id === undefined || !t.url) continue;
    out.push({
      id: t.id,
      windowId: t.windowId,
      url: t.url,
      title: t.title?.trim() || t.url,
      favIconUrl: t.favIconUrl,
      active: t.active,
      lastAccessed: t.lastAccessed,
    });
  }
  return out;
}

/** 按域名分组 + 重复检测 —— 视图 A（Tab 仪表盘）核心逻辑，纯函数便于单测。 */
export function groupTabs(tabs: LiveTab[]): TabGroup[] {
  const byDomain = new Map<string, LiveTab[]>();
  for (const tab of tabs) {
    const domain = normalizeDomain(tab.url) || "(其他)";
    (byDomain.get(domain) ?? byDomain.set(domain, []).get(domain)!).push(tab);
  }

  const groups: TabGroup[] = [];
  for (const [domain, groupTabsList] of byDomain) {
    const seen = new Map<string, number>();
    const duplicateTabIds: number[] = [];
    for (const tab of groupTabsList) {
      const key = canonicalUrl(tab.url);
      if (seen.has(key)) {
        duplicateTabIds.push(tab.id);
      } else {
        seen.set(key, tab.id);
      }
    }
    groups.push({ domain, tabs: groupTabsList, duplicateTabIds });
  }

  // 域名按 tab 数降序，方便仪表盘聚焦最活跃域名。
  return groups.sort((a, b) => b.tabs.length - a.tabs.length);
}
