import { useEffect, useState } from "react";
import { DEFAULT_OWNER_ID, type ContextRecord } from "../../../models/context";
import { LocalStorageAdapter } from "../../../storage/local";
import { matchTabsToClose, selectThisAndNewer } from "../../../collector/timelineSelection";
import "./ContextTimeline.css";

const storage = new LocalStorageAdapter();

/** 视图 B：历史浏览结构化沉淀时间线 + 按时间点批量关闭对应仍打开的标签。 */
export function ContextTimeline() {
  const [records, setRecords] = useState<ContextRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    storage.query({ ownerId: DEFAULT_OWNER_ID, limit: 100 }).then(setRecords);
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setStatus(null);
  };

  const pickThisAndNewer = (id: string) => {
    setSelected((prev) => new Set([...prev, ...selectThisAndNewer(records, id)]));
    setStatus(null);
  };

  const closeSelected = async () => {
    const selectedRecords = records.filter((r) => selected.has(r.id));
    const tabs = await chrome.tabs.query({});
    const openTabs = tabs
      .filter((t) => t.id !== undefined && t.url)
      .map((t) => ({ id: t.id!, url: t.url! }));

    const { tabIds, unmatchedRecordCount } = matchTabsToClose(selectedRecords, openTabs);
    if (tabIds.length) await chrome.tabs.remove(tabIds);

    setStatus(
      `已关闭 ${tabIds.length} 个标签` +
        (unmatchedRecordCount > 0 ? `,${unmatchedRecordCount} 条记录对应的页已不在打开状态` : ""),
    );
    setSelected(new Set());
  };

  if (records.length === 0) {
    return <p>暂无采集记录。浏览几个网页后回来看看。</p>;
  }

  return (
    <>
      <ul className="timeline">
        {records.map((r) => (
          <li
            key={r.id}
            className={`timeline-item${selected.has(r.id) ? " timeline-item--selected" : ""}`}
          >
            <input
              type="checkbox"
              className="timeline-item__check"
              checked={selected.has(r.id)}
              onChange={() => toggle(r.id)}
              aria-label="选择此记录"
            />
            <div className="timeline-item__body">
              <a
                className="timeline-item__title"
                href={r.url}
                target="_blank"
                rel="noreferrer"
              >
                {r.title}
              </a>
              <div className="timeline-item__meta">
                {new Date(r.timestamp).toLocaleString()} · 停留 {Math.round(r.dwellMs / 1000)}s
              </div>
              <div className="timeline-item__summary">
                {r.contentSummary ?? <em>尚未总结</em>}
              </div>
              {r.tags.length > 0 && (
                <div className="timeline-item__tags">{r.tags.map((t) => `#${t}`).join(" ")}</div>
              )}
            </div>
            <button
              className="timeline-item__pick"
              onClick={() => pickThisAndNewer(r.id)}
              title="勾选此条及所有更新的记录"
            >
              选此条及之后
            </button>
          </li>
        ))}
      </ul>

      <div className="timeline-bar">
        {status && <span className="timeline-bar__status">{status}</span>}
        <button
          className="timeline-bar__close"
          disabled={selected.size === 0}
          onClick={closeSelected}
        >
          关闭选中的 {selected.size} 个标签
        </button>
      </div>
    </>
  );
}
