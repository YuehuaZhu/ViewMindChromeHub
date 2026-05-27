/** 正文预览：折叠空白、截断到 max 字符，超出补省略号。供时间线懒加载展示。 */
export function contentPreview(markdown: string, max = 200): string {
  const collapsed = markdown.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? collapsed.slice(0, max) + "…" : collapsed;
}
