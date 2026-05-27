import { useEffect, useState } from "react";
import { DEFAULT_OWNER_ID, type ContextRecord } from "../../../models/context";
import { LocalStorageAdapter } from "../../../storage/local";

const storage = new LocalStorageAdapter();

/** 视图 B：历史浏览结构化沉淀时间线（摘要 / 标签 / 导出 / 触发总结）。 */
export function ContextTimeline() {
  const [records, setRecords] = useState<ContextRecord[]>([]);

  useEffect(() => {
    storage.query({ ownerId: DEFAULT_OWNER_ID, limit: 100 }).then(setRecords);
  }, []);

  if (records.length === 0) {
    return <p>暂无采集记录。浏览几个网页后回来看看。</p>;
  }

  return (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {records.map((r) => (
        <li key={r.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
          <a href={r.url} target="_blank" rel="noreferrer">
            {r.title}
          </a>
          <div style={{ fontSize: 12, color: "#666" }}>
            {new Date(r.timestamp).toLocaleString()} · 停留 {Math.round(r.dwellMs / 1000)}s
          </div>
          <div>{r.contentSummary ?? <em>尚未总结</em>}</div>
          {r.tags.length > 0 && <div>{r.tags.map((t) => `#${t}`).join(" ")}</div>}
        </li>
      ))}
    </ul>
  );
}
