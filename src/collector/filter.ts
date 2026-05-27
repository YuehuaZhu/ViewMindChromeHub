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

/** 验证/中转/重定向类中间页，本身无阅读价值，视为噪音。 */
const NOISE_URL_PATTERNS: RegExp[] = [
  /:\/\/wappass\.baidu\.com\//i, // 百度安全验证
  /:\/\/[^/]+\/sorry\//i, // google.com/sorry 等验证/限流页
  /:\/\/www\.baidu\.com\/link\?/i, // 百度搜索结果跳转中转
  /\/captcha/i, // 通用 captcha 页
];

/** 噪音过滤：about:/chrome:/扩展页/空标签 + 验证/中转中间页等不值得采集。 */
export function isNoise(url: string): boolean {
  if (
    !url ||
    url.startsWith("about:") ||
    url.startsWith("chrome:") ||
    url.startsWith("chrome-extension:") ||
    url.startsWith("edge:") ||
    url === "chrome://newtab/"
  ) {
    return true;
  }
  return NOISE_URL_PATTERNS.some((re) => re.test(url));
}

/** 是否应写入历史 context。 */
export function shouldCapture(url: string, blocklist?: string[]): boolean {
  return !isNoise(url) && !isBlocked(url, blocklist);
}
