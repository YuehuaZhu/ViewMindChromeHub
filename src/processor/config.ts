import type { LLMConfig } from "./llm";

/** LLM 配置在 chrome.storage.local 的键。 */
export const LLM_KEYS = {
  baseUrl: "llmBaseUrl",
  apiKey: "llmApiKey",
  model: "llmModel",
} as const;

export const LLM_DEFAULTS = {
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
};

/** 读取 LLM 配置;未填 API key 返回 null(调用方据此提示去设置)。 */
export async function getLLMConfig(): Promise<LLMConfig | null> {
  const v = (await chrome.storage.local.get([
    LLM_KEYS.baseUrl,
    LLM_KEYS.apiKey,
    LLM_KEYS.model,
  ])) as Record<string, string>;
  if (!v[LLM_KEYS.apiKey]) return null;
  return {
    baseUrl: v[LLM_KEYS.baseUrl]?.trim() || LLM_DEFAULTS.baseUrl,
    apiKey: v[LLM_KEYS.apiKey],
    model: v[LLM_KEYS.model]?.trim() || LLM_DEFAULTS.model,
  };
}
