import { useEffect, useState } from "react";
import { DEFAULT_OWNER_ID, type ContextRecord } from "../../../models/context";
import { LocalStorageAdapter } from "../../../storage/local";
import { matchTabsToClose, selectThisAndOlder } from "../../../collector/timelineSelection";
import { contentPreview } from "../../../processor/preview";
import { getLLMConfig } from "../../../processor/config";
import { OpenAICompatibleProvider } from "../../../processor/llm";
import { runBatchSummarize } from "../../../processor/summarize";
import "./ContextTimeline.css";

const storage = new LocalStorageAdapter();

/** 视图 B：历史浏览结构化沉淀时间线 + 手动批量总结 + 按时间点批量关闭对应仍打开的标签。 */
export function ContextTimeline() {
  const [records, setRecords] = useState<ContextRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [closeStatus, setCloseStatus] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [summarizing, setSummarizing] = useState(false);
  const [summaryStatus, setSummaryStatus] = useState<string | null>(null);

  const refresh = () => storage.query({ ownerId: DEFAULT_OWNER_ID, limit: 100 }).then(setRecords);

  useEffect(() => {
    refresh();
  }, []);

  const unsummarized = records.filter((r) => !r.contentSummary).length;

  const summarize = async () => {
    const config = await getLLMConfig();
    if (!config) {
      alert("请先点右上「设置」填写 LLM 服务地址与 API key。");
      return;
    }
    setSummarizing(true);
    setSummaryStatus(null);
    try {
      const provider = new OpenAICompatibleProvider(config);
      const loadContent = async (id: string) =>
        (await storage.getContent({ ownerId: DEFAULT_OWNER_ID }, id))?.markdown;
      const { done, failed } = await runBatchSummarize(storage, provider, loadContent);
      await refresh();
      setSummaryStatus(`总结完成:成功 ${done} 条${failed ? `,失败 ${failed} 条` : ""}`);
    } catch (e) {
      setSummaryStatus("总结出错,请检查设置或网络。");
      console.warn("[ViewMind] 批量总结出错", e);
    } finally {
      setSummarizing(false);
    }
  };

  const togglePreview = async (id: string) => {
    if (previews[id] !== undefined) {
      setPreviews((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
      return;
    }
    const content = await storage.getContent({ ownerId: DEFAULT_OWNER_ID }, id);
    setPreviews((p) => ({ ...p, [id]: content ? contentPreview(content.markdown) : "(正文为空)" }));
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setCloseStatus(null);
  };

  const pickThisAndOlder = (id: string) => {
    setSelected((prev) => new Set([...prev, ...selectThisAndOlder(records, id)]));
    setCloseStatus(null);
  };

  const closeSelected = async () => {
    const selectedRecords = records.filter((r) => selected.has(r.id));
    const tabs = await chrome.tabs.query({});
    const openTabs = tabs
      .filter((t) => t.id !== undefined && t.url)
      .map((t) => ({ id: t.id!, url: t.url! }));

    const { tabIds, unmatchedRecordCount } = matchTabsToClose(selectedRecords, openTabs);
    if (tabIds.length) await chrome.tabs.remove(tabIds);

    setCloseStatus(
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
      <div className="timeline-toolbar">
        <button onClick={summarize} disabled={summarizing || unsummarized === 0}>
          {summarizing ? "总结中…" : `立即总结 ${unsummarized} 条`}
        </button>
        {summaryStatus && <span className="timeline-toolbar__status">{summaryStatus}</span>}
      </div>

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
              <a className="timeline-item__title" href={r.url} target="_blank" rel="noreferrer">
                {r.title}
              </a>
              <div className="timeline-item__meta">
                {new Date(r.timestamp).toLocaleString()}
                {(r.visitCount ?? 1) > 1 && ` · 访问 ${r.visitCount} 次`}
                {r.contentSummary && <span className="timeline-item__badge">✓ 已总结</span>}
              </div>
              {r.contentSummary && <div className="timeline-item__summary">{r.contentSummary}</div>}
              {r.tags.length > 0 && (
                <div className="timeline-item__tags">{r.tags.map((t) => `#${t}`).join(" ")}</div>
              )}
              {r.rawContentRef && (
                <button className="timeline-item__content-toggle" onClick={() => togglePreview(r.id)}>
                  {previews[r.id] !== undefined ? "▾ 收起正文" : "📄 已存正文"}
                </button>
              )}
              {previews[r.id] !== undefined && (
                <div className="timeline-item__preview">{previews[r.id]}</div>
              )}
            </div>
            <button
              className="timeline-item__pick"
              onClick={() => pickThisAndOlder(r.id)}
              title="勾选此条及列表中更靠下(更旧)的所有记录"
            >
              选此条及之后
            </button>
          </li>
        ))}
      </ul>

      <div className="timeline-bar">
        {closeStatus && <span className="timeline-bar__status">{closeStatus}</span>}
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
