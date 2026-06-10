/**
 * 内容指纹：对文本计算 SHA-256，返回 hex string。
 * 供 content script 给 copy 事件打标，Pipeline 用于跨源匹配"复制→粘贴"关联。
 */
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
