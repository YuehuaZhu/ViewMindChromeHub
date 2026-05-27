import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveTab, TabGroup } from "../../../models/tab";
import { groupTabs, toLiveTabs } from "../../../collector/tabState";
import "./TabDashboard.css";

/** 视图 A：读当前所有 tab → 按域名分组 + 重复检测 + 跳转 + 关闭，随 tab 事件实时刷新。 */
export function TabDashboard() {
  const [groups, setGroups] = useState<TabGroup[]>([]);

  const refresh = useCallback(async () => {
    const tabs = await chrome.tabs.query({});
    setGroups(groupTabs(toLiveTabs(tabs)));
  }, []);

  // tab 增删/更新/切换都触发刷新，合并到一次 query 避免抖动。
  const debounced = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scheduleRefresh = useCallback(() => {
    clearTimeout(debounced.current);
    debounced.current = setTimeout(refresh, 120);
  }, [refresh]);

  useEffect(() => {
    refresh();
    const events = [
      chrome.tabs.onCreated,
      chrome.tabs.onRemoved,
      chrome.tabs.onUpdated,
      chrome.tabs.onActivated,
      chrome.tabs.onMoved,
      chrome.tabs.onAttached,
      chrome.tabs.onDetached,
    ];
    events.forEach((e) => e.addListener(scheduleRefresh));
    return () => {
      clearTimeout(debounced.current);
      events.forEach((e) => e.removeListener(scheduleRefresh));
    };
  }, [refresh, scheduleRefresh]);

  const focusTab = (tab: LiveTab) => {
    chrome.tabs.update(tab.id, { active: true });
    chrome.windows.update(tab.windowId, { focused: true });
  };

  const closeTab = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    chrome.tabs.remove(id);
  };

  const closeTabs = (ids: number[]) => {
    if (ids.length) chrome.tabs.remove(ids);
  };

  if (groups.length === 0) {
    return <p className="tabdash-empty">没有可显示的标签页。</p>;
  }

  return (
    <section>
      {groups.map((g) => {
        const dupSet = new Set(g.duplicateTabIds);
        return (
          <div key={g.domain} className="tabdash-group">
            <div className="tabdash-group__header">
              <span>{g.domain}</span>
              <span className="tabdash-group__count">{g.tabs.length} 个标签</span>
              <div className="tabdash-group__actions">
                {g.duplicateTabIds.length > 0 && (
                  <button
                    className="tabdash-group__btn tabdash-group__btn--dedup"
                    onClick={() => closeTabs(g.duplicateTabIds)}
                  >
                    关闭 {g.duplicateTabIds.length} 个重复
                  </button>
                )}
                <button
                  className="tabdash-group__btn"
                  onClick={() => closeTabs(g.tabs.map((t) => t.id))}
                >
                  全部关闭
                </button>
              </div>
            </div>
            {g.tabs.map((tab) => (
              <div
                key={tab.id}
                className={`tabdash-item${tab.active ? " tabdash-item--active" : ""}`}
                onClick={() => focusTab(tab)}
                title={tab.url}
              >
                {tab.favIconUrl ? (
                  <img className="tabdash-item__favicon" src={tab.favIconUrl} alt="" />
                ) : (
                  <span className="tabdash-item__favicon" />
                )}
                <span className="tabdash-item__title">{tab.title}</span>
                {dupSet.has(tab.id) && <span className="tabdash-item__dup">重复</span>}
                <button
                  className="tabdash-item__close"
                  aria-label="关闭标签页"
                  onClick={(e) => closeTab(e, tab.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}
