/** 统一数据模型 —— 三个数字分身里程碑共享的底座结构。 */

export type InteractionType = "search" | "click" | "copy" | "select";

export interface Interaction {
  type: InteractionType;
  value: string;
  ts: number;
  /** SHA-256 hex 指纹，仅 copy 事件填充，供 Pipeline 跨源匹配复制→粘贴关联。 */
  fingerprint?: string;
}

export interface ContextRecord {
  id: string;
  /** 多租户预留：单人期填 DEFAULT_OWNER_ID。商业化阶段才接鉴权/云多租户。 */
  ownerId: string;
  timestamp: number;
  url: string;
  title: string;
  /** LLM 生成摘要，惰性填充，未总结前为 undefined。 */
  contentSummary?: string;
  /** 正文 Markdown 引用（可选保留，便于二次加工）。 */
  rawContentRef?: string;
  interactions: Interaction[];
  /** 停留时长（毫秒）。早期不采集(见 PLAN);保留字段供未来后台精确计时再用。 */
  dwellMs?: number;
  /** 同 URL 时间窗内被合并的访问次数，默认 1。 */
  visitCount?: number;
  /** 页面最大滚动深度（0-100%）。*/
  scrollDepthPct?: number;
  /** 本次访问期间 tab 被重新激活的次数（visibilitychange hidden→visible）。*/
  tabSwitchCount?: number;
  /** LLM 生成的语义标签。 */
  tags: string[];
  source: {
    referrer?: string;
    fromUrl?: string;
  };
  /**
   * Outbox 同步状态：pending = 待推送到 Pipeline ingest-server；synced = 已成功推送。
   * undefined 表示旧数据（向后兼容，不重推）。
   */
  syncState?: "pending" | "synced";
}

/** 单人期固定 ownerId；商业化多租户时由鉴权上下文注入。 */
export const DEFAULT_OWNER_ID = "local-default";

/** 正文存独立表，与 ContextRecord 一对一（id 相同）。时间线查询不连带它，按需懒加载。 */
export interface RawContent {
  /** = 对应 ContextRecord.id。 */
  id: string;
  ownerId: string;
  /** 正文 Markdown（Readability + Turndown 产出）。 */
  markdown: string;
  capturedAt: number;
}
