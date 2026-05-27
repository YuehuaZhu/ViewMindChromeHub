/** LLM Provider 抽象：MVP 用 fetch 调 OpenAI 兼容 API（用户填自己账号）。 */

export interface LLMConfig {
  /** OpenAI 兼容 base URL，例如 https://api.openai.com/v1 */
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface SummarizeResult {
  summary: string;
  tags: string[];
}

export interface LLMProvider {
  summarize(title: string, content: string): Promise<SummarizeResult>;
}

/** OpenAI 兼容 chat/completions 实现。敏感页本地总结（WebLLM）作为 M0+ 可选兜底，暂不实现。 */
export class OpenAICompatibleProvider implements LLMProvider {
  constructor(private config: LLMConfig) {}

  async summarize(title: string, content: string): Promise<SummarizeResult> {
    const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: "system",
            content:
              "你是网页内容结构化助手。输出 JSON：{summary: 中文摘要(<=120字), tags: 语义标签数组(<=5)}。",
          },
          { role: "user", content: `标题：${title}\n\n正文：\n${content}` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`LLM 请求失败：${res.status}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    return { summary: parsed.summary ?? "", tags: parsed.tags ?? [] };
  }
}
