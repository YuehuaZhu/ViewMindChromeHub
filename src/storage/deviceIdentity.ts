/**
 * Device Identity — 首装生成 UUID，存 chrome.storage.local（绝不用 sync，
 * 否则同 Chrome 账号的 mac/win 会共享同一 deviceId，失去多设备区分能力）。
 */

const KEY_DEVICE_ID = "viewmind_deviceId";
const KEY_DEVICE_LABEL = "viewmind_deviceLabel";

/** 读或生成 deviceId（UUID v4）。首次调用后写入 local storage，后续复用。 */
export async function getOrCreateDeviceId(): Promise<string> {
  const result = await chrome.storage.local.get(KEY_DEVICE_ID);
  if (result[KEY_DEVICE_ID]) return result[KEY_DEVICE_ID] as string;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ [KEY_DEVICE_ID]: id });
  return id;
}

/**
 * 从 User-Agent 推断可读标签，格式如 "MacBook-Chrome" / "Windows-Edge"。
 * 仅用于初始默认值，用户可在设置页覆盖。
 */
function inferDeviceLabel(): string {
  const ua = navigator.userAgent;
  let os = "Unknown";
  if (/Macintosh/.test(ua)) os = "Mac";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Linux/.test(ua)) os = "Linux";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad/.test(ua)) os = "iOS";

  let browser = "Browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";

  return `${os}-${browser}`;
}

/** 读设备标签；未设置时返回 UA 推断的默认值（不写入，只在用户确认时才持久化）。 */
export async function getDeviceLabel(): Promise<string> {
  const result = await chrome.storage.local.get(KEY_DEVICE_LABEL);
  return (result[KEY_DEVICE_LABEL] as string | undefined) ?? inferDeviceLabel();
}

/** 持久化用户手动设置的设备标签。 */
export async function setDeviceLabel(label: string): Promise<void> {
  await chrome.storage.local.set({ [KEY_DEVICE_LABEL]: label.trim() });
}
