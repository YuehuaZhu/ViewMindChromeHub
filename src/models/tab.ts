/** 实时 tab 状态 —— 轻量内存结构，服务 Tab 仪表盘（视图 A），MVP 不持久化为 ContextRecord。 */

export interface LiveTab {
  id: number;
  windowId: number;
  url: string;
  title: string;
  favIconUrl?: string;
  active: boolean;
  lastAccessed?: number;
}

export interface TabGroup {
  /** 分组键，MVP 用域名。 */
  domain: string;
  tabs: LiveTab[];
  /** 同一规范化 URL 出现多次时标记的重复 tab id。 */
  duplicateTabIds: number[];
}
