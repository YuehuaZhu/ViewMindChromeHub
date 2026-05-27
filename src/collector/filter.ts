/** 智能过滤：敏感域名黑名单 + 噪音过滤。命中黑名单不写入历史 context（但 tab 仪表盘仍可显示）。 */

/** 默认敏感域名黑名单：网银 / 支付 / 邮箱 / 社交私信 / 医疗。可在 options 增删。 */
export const DEFAULT_BLOCKLIST: string[] = [
  "mail.google.com",
  "outlook.live.com",
  "web.whatsapp.com",
  "*.bank",
  "paypal.com",
  "stripe.com",
];

export function normalizeDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function matchesPattern(domain: string, pattern: string): boolean {
  if (pattern.startsWith("*.")) {
    return domain.endsWith(pattern.slice(1));
  }
  return domain === pattern;
}

export function isBlocked(url: string, blocklist: string[] = DEFAULT_BLOCKLIST): boolean {
  const domain = normalizeDomain(url);
  if (!domain) return true; // 无法解析的 URL 一律不采，保守。
  return blocklist.some((p) => matchesPattern(domain, p));
}

/** 噪音过滤：about:/chrome:/扩展页/空标签等不值得采集。 */
export function isNoise(url: string): boolean {
  return (
    !url ||
    url.startsWith("about:") ||
    url.startsWith("chrome:") ||
    url.startsWith("chrome-extension:") ||
    url.startsWith("edge:") ||
    url === "chrome://newtab/"
  );
}

/** 是否应写入历史 context。 */
export function shouldCapture(url: string, blocklist?: string[]): boolean {
  return !isNoise(url) && !isBlocked(url, blocklist);
}
