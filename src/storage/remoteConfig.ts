import type { RemoteConfig } from "./remote";

/** DesktopHub 接入配置在 chrome.storage.local 的键。 */
export const REMOTE_KEYS = {
  enabled: "remoteEnabled",
  endpoint: "remoteEndpoint",
  apiKey: "remoteApiKey",
} as const;

export interface RemoteSettings extends RemoteConfig {
  enabled: boolean;
}

/** 读取 DesktopHub 推送配置。未启用或没填端点 → enabled=false。 */
export async function getRemoteSettings(): Promise<RemoteSettings> {
  const v = (await chrome.storage.local.get([
    REMOTE_KEYS.enabled,
    REMOTE_KEYS.endpoint,
    REMOTE_KEYS.apiKey,
  ])) as Record<string, unknown>;
  const endpoint = (v[REMOTE_KEYS.endpoint] as string)?.trim() ?? "";
  return {
    enabled: Boolean(v[REMOTE_KEYS.enabled]) && endpoint.length > 0,
    endpoint,
    apiKey: (v[REMOTE_KEYS.apiKey] as string) || undefined,
  };
}
