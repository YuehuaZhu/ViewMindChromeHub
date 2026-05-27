/** DesktopHub 接入配置在 chrome.storage.local 的键。 */
export const REMOTE_KEYS = {
  enabled: "remoteEnabled",
  apiKey: "remoteApiKey",
} as const;

export interface RemoteSettings {
  /** 是否推送到本机 DesktopHub。默认开启(无感);用户可在设置页关闭。 */
  enabled: boolean;
  apiKey?: string;
}

/** 读取推送配置。未设置过 enabled 时默认 true(默认开启)。 */
export async function getRemoteSettings(): Promise<RemoteSettings> {
  const v = (await chrome.storage.local.get([REMOTE_KEYS.enabled, REMOTE_KEYS.apiKey])) as Record<
    string,
    unknown
  >;
  const rawEnabled = v[REMOTE_KEYS.enabled];
  return {
    enabled: rawEnabled === undefined ? true : Boolean(rawEnabled),
    apiKey: (v[REMOTE_KEYS.apiKey] as string) || undefined,
  };
}

/** 写入开关(设置页勾选即存,无保存按钮)。 */
export async function setRemoteEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [REMOTE_KEYS.enabled]: enabled });
}
