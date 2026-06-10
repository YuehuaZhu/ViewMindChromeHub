/**
 * 浏览正文清洗：把 Readability + Turndown 抽出的原始 markdown、以及待抽取的 document，
 * 过一遍规则，去除已知污染（base64 图、loading 占位、非文章页 UI 标签堆叠、验证墙…）。
 *
 * 设计为可持续扩展：日常质量审查每排查出一条新污染源，就写一个规则对象 push 进下面
 * 对应的数组（CONTENT_GATES 或 MARKDOWN_SANITIZERS），主流程 content.ts 不用动。
 * 与 collector/filter.ts 平级互补：filter 管「该不该采这个 URL」，本模块管「抽出的正文怎么净化」。
 *
 * 规则的判断逻辑尽量抽成纯函数（接受 string），便于 node 环境单测；gate 外壳只负责从
 * document 取文本再调纯函数。每条规则带 name，便于日志统计哪条命中了多少。
 */
import { isProbablyReaderable } from "@mozilla/readability";

// ════════════════ 阶段一：抽取前的 document 闸门（决定要不要抽正文） ════════════════

export interface ContentGate {
  name: string;
  /** 返回拒绝原因 = 否决抽取；返回 undefined = 放行。 */
  reject(doc: Document): string | undefined;
}

/**
 * 验证墙 / 反爬中间页的文本特征。英文短语收紧到具体/行锚定形态，避免短英文博客里
 * 偶现 "Just a moment" 之类被整篇误判（再叠加下方 length<600 双保险）。
 */
const VERIFICATION_WALL_PATTERNS: RegExp[] = [
  /正在验证连接安全/,
  /请勾选下方复选框/,
  /Verifying you are human/i,
  /Checking your browser before accessing/i,
  /^\s*Just a moment\.{0,3}\s*$/im,
  /Attention Required.*Cloudflare/i,
];

/** 是否为验证墙文本。长正文里偶含这些词不算（验证墙正文通常极短）。 */
export function isVerificationWallText(text: string): boolean {
  const t = text.trim();
  return t.length < 600 && VERIFICATION_WALL_PATTERNS.some((re) => re.test(t));
}

/** SPA 未水合时的占位 / 骨架屏文本特征（行锚定，叠加下方 length<400 双保险，避免短真文误杀）。 */
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^loading[.…\s]*$/i,
  /^正在加载/m,
  /^\s*在此处拖放文件/m,
  /^\s*拖拽到[^，。]*区域/m,
];

/** 是否为未就绪的占位/骨架文本：整页空，或极短且命中占位特征。 */
export function isLoadingPlaceholder(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return true;
  return t.length < 400 && PLACEHOLDER_PATTERNS.some((re) => re.test(t));
}

/** #4 非文章页（后台/列表/表单）强抽会吐 UI 标签堆叠 → 用 readability 自带门槛挡掉。 */
const rejectNonArticle: ContentGate = {
  name: "non-article",
  reject: (doc) => (isProbablyReaderable(doc) ? undefined : "not-readerable"),
};

/** #5 验证墙 / 反爬中间页。 */
const rejectVerificationWall: ContentGate = {
  name: "verification-wall",
  reject: (doc) =>
    isVerificationWallText(doc.body?.innerText ?? "") ? "verification-wall" : undefined,
};

/** #2/#3 SPA 未水合的 loading / 占位骨架（检测端；重试调度在 content.ts）。 */
const rejectLoadingPlaceholder: ContentGate = {
  name: "loading-placeholder",
  reject: (doc) =>
    isLoadingPlaceholder(doc.body?.innerText ?? "") ? "loading-placeholder" : undefined,
};

/** ⬇️ 新增抽取前闸门，往这里加一条 ContentGate 即可，主流程不动。 */
export const CONTENT_GATES: ContentGate[] = [
  rejectNonArticle,
  rejectVerificationWall,
  rejectLoadingPlaceholder,
];

/** 跑完所有闸门：任一否决即返回 { ok:false, reason }，全放行返回 { ok:true }。 */
export function gateContent(doc: Document): { ok: boolean; reason?: string } {
  for (const gate of CONTENT_GATES) {
    const reason = gate.reject(doc);
    if (reason) return { ok: false, reason };
  }
  return { ok: true };
}

// ════════════════ 阶段二：抽取后的 markdown 净化（链式纯函数 transform） ════════════════

export interface MarkdownSanitizer {
  name: string;
  apply(md: string): string;
}

/** 正文体积硬上限（剥图后仍可能极长，防极端长页）。 */
export const MAX_CONTENT_CHARS = 50_000;

/**
 * markdown 的 (URL) 片段：容忍 URL 内**一层**嵌套括号（如维基 `File:Foo_(bar).jpg`、
 * URL-encoded 的 svg data URI）。两个分支 `[^()]` 与 `\(...\)` 首字符不重叠，无灾难回溯。
 */
const PAREN_URL = String.raw`\((?:[^()]|\([^()]*\))*\)`;
const LINKED_IMG = new RegExp(String.raw`\[!\[([^\]]*)\]${PAREN_URL}\]${PAREN_URL}`, "g");
const IMG = new RegExp(String.raw`!\[([^\]]*)\](${PAREN_URL})`, "g");

/**
 * #1 剥图片（顺序：先拆链接图片，再处理普通图片）：
 * - 链接图片 `[![alt](src)](href)` → 只留 alt（去掉图片与外层链接，否则会歪曲成 alt→图片宿主页的链接）；
 * - data:URI 图（base64 二进制，撑爆体积）→ 整个删；
 * - http 图 → 保留 alt 文本（有语义）、去掉 src 链接；alt 为空则整个删。
 */
const stripDataUriImages: MarkdownSanitizer = {
  name: "strip-data-uri-images",
  apply: (md) =>
    md
      .replace(LINKED_IMG, (_m, alt: string) => alt)
      .replace(IMG, (_m, alt: string, paren: string) =>
        /^\(\s*<?data:/i.test(paren) ? "" : alt,
      ),
};

/**
 * #4 补强：折叠与上一非空行完全重复的行（后台/对比页常把 label 重复两遍）。
 * 豁免代码围栏（``` / ~~~）内与列表项（- * + / 有序）——那里相邻重复行是合法的，
 * 折叠会改写用户代码或吞掉列表项。
 */
const collapseDuplicateLines: MarkdownSanitizer = {
  name: "collapse-duplicate-lines",
  apply: (md) => {
    const out: string[] = [];
    let prev: string | undefined;
    let inFence = false;
    for (const line of md.split("\n")) {
      const key = line.trim();
      if (/^(```|~~~)/.test(key)) {
        inFence = !inFence;
        out.push(line);
        prev = undefined; // 围栏边界重置，不跨围栏比较
        continue;
      }
      const isListItem = /^([-*+]\s|\d+[.)]\s)/.test(key);
      if (!inFence && !isListItem && key && key === prev) continue;
      out.push(line);
      if (key) prev = key;
    }
    return out.join("\n");
  },
};

/** 体积兜底：剥图后仍超上限则截断。 */
const truncateOversize: MarkdownSanitizer = {
  name: "truncate-oversize",
  apply: (md) => (md.length > MAX_CONTENT_CHARS ? md.slice(0, MAX_CONTENT_CHARS) : md),
};

/** ⬇️ 新增 markdown 净化规则，往这里加一条 MarkdownSanitizer 即可，主流程不动。 */
export const MARKDOWN_SANITIZERS: MarkdownSanitizer[] = [
  stripDataUriImages,
  collapseDuplicateLines,
  truncateOversize,
];

/** 链式跑完所有 markdown 净化规则。 */
export function sanitizeMarkdown(md: string): string {
  return MARKDOWN_SANITIZERS.reduce((acc, s) => s.apply(acc), md);
}
