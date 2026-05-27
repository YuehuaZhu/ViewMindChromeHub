import type { ContextRecord } from "../models/context";

/** 文件导出（JSON / Markdown）。导出是单向操作，不实现 StorageAdapter 全部读写。 */

/** 导出 DTO：保留原始 epoch 供机器用，另加可读 time 供人看。 */
export function toExportRecord(r: ContextRecord) {
  return {
    ...r,
    time: new Date(r.timestamp).toLocaleString("zh-CN"),
  };
}

export function exportAsJson(records: ContextRecord[]): string {
  return JSON.stringify(records.map(toExportRecord), null, 2);
}

export function exportAsMarkdown(records: ContextRecord[]): string {
  return records
    .map((r) => {
      const date = new Date(r.timestamp).toISOString();
      const tags = r.tags.length ? ` \`${r.tags.join("` `")}\`` : "";
      const summary = r.contentSummary ?? "_(尚未总结)_";
      return `## [${r.title}](${r.url})\n\n- ${date}${tags}\n\n${summary}\n`;
    })
    .join("\n");
}

/** 触发浏览器下载。content/popup 上下文调用。 */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
