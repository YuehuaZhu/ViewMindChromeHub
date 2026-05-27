import { useEffect, useState } from "react";
import type { LiveTab, TabGroup } from "../../../models/tab";
import { groupTabs } from "../../../collector/tabState";

/** 视图 A：读当前所有 tab → 按域名分组 + 重复检测 + 跳转 + 关闭。 */
export function TabDashboard() {
  const [groups, setGroups] = useState<TabGroup[]>([]);

  const refresh = async () => {
    const tabs = await chrome.tabs.query({});
    const live: LiveTab[] = tabs
      .filter((t) => t.id !== undefined && t.url)
      .map((t) => ({
        id: t.id!,
        windowId: t.windowId,
        url: t.url!,
        title: t.title ?? t.url!,
        favIconUrl: t.favIconUrl,
        active: t.active,
        lastAccessed: t.lastAccessed,
      }));
    setGroups(groupTabs(live));
  };

  useEffect(() => {
    refresh();
  }, []);

  const focusTab = (tab: LiveTab) => {
    chrome.tabs.update(tab.id, { active: true });
    chrome.windows.update(tab.windowId, { focused: true });
  };

  const closeTab = async (id: number) => {
    await chrome.tabs.remove(id);
    refresh();
  };

  return (
    <section>
      {groups.map((g) => (
        <div key={g.domain} style={{ marginBottom: 16 }}>
          <h3>
            {g.domain} <small>({g.tabs.length})</small>
          </h3>
          <ul>
            {g.tabs.map((tab) => (
              <li key={tab.id}>
                <button onClick={() => focusTab(tab)}>{tab.title}</button>
                {g.duplicateTabIds.includes(tab.id) && <span title="重复"> [重复]</span>}
                <button onClick={() => closeTab(tab.id)} aria-label="关闭">
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
