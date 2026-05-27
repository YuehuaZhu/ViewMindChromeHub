# ViewMindChromeHub — 浏览中枢:Tab 管理 + Context 采集(数字分身底座)

> **在 ViewMind 总体中的定位(老大 2026-05-27)**:本项目是 ViewMind 的**附属项目 + 第一个落地**(数据飞轮启动器),充当 DesktopHub 的**浏览器 context 采集源**——采集到的 `ContextRecord` 经「远程 HTTP 存储 adapter」上报到 DesktopHub 聚合收口。跨项目总纲见 `../ViewMindDesktopHub/MASTER_PLAN.md`。
>
> **重大调整(老大 2026-05-27)**:ChromeHub **只做采集 + 暴露,不含 AI 总结**。总结/聚合移到 DesktopHub;插件经 HTTP 推送把 `ContextRecord`+正文喂给本地 DesktopHub。下文涉及"在插件内 LLM 总结"的段落(架构图 Processor、借鉴的 LLM 接入、数据模型 `contentSummary` 等)按此调整理解:这些字段/能力归 DesktopHub。
>
> **商业化预留**:本插件长期要作为产品。架构上现在只留一道缝——`ContextRecord` 增加 `ownerId` 字段(单人期填固定默认值),`StorageAdapter` 接口携带 owner 上下文;鉴权/云多租户/上架 Chrome Web Store 等推迟到商业化阶段。详见 `MASTER_PLAN.md`「商业化与多租户」。

## Context(为什么做)

老大想做一款浏览器扩展,**自动记录不同时刻打开了哪些网页、总结网页内容、记录在网页上做了什么**,把这些 context 结构化保存到本地或自己的服务器,最终**喂养自己的数字分身**。在头脑风暴中进一步决定:把 [tab-out](https://github.com/zarazhangrui/tab-out) 的**标签页管理**能力也集成进来,使扩展升级为"浏览中枢"。

关键背景:
- "数字分身"是递进的三个里程碑:① 对话型分身 → ② 第二大脑/知识库 → ③ 行动型 Agent。三者共享同一个底座:浏览 context 采集 + 结构化存储引擎。**本计划做这个底座的 MVP**。
- **集成 tab 管理是战略级决策,不只是加功能**:
  1. **Tab 管理是日常留存钩子,Context 采集是长期价值**。长期采集喂分身的最大风险是"装了不常开、数据攒不起来";tab 管理每天高频使用,给了天天打开扩展的理由,context 在背后悄悄积累——这是数据飞轮的启动器。
  2. **同一份数据的两个面**:Tab 仪表盘看"此刻开着什么"(实时面),Context 时间线看"浏览过什么"(历史面),底层共享同一套 tab/导航监听 + 同一存储层。
  3. 当前打开的 tab 快照本身是一种 context 信号("此刻注意力在哪"),对分身理解"你现在关心什么"有价值(M1+ 再持久化,MVP 仅服务仪表盘)。

预期结果:Chromium(Chrome/Edge)MV3 扩展,双视图主控台为独立扩展页(点图标打开;不接管新标签页)(Tab 仪表盘 + Context 时间线),后台默认全本地,智能过滤采集网页+关键交互,惰性批量调用用户 LLM 账号生成结构化摘要,存到可插拔后端,可导出。

## 已确认决策

| 决策点 | 结论 |
|---|---|
| 数字分身形态 | 三个递进里程碑都要 → 本计划做共享底座 |
| 架构方向 | 方案 C:Local-first + 可插拔 adapter |
| **Tab 管理集成** | **集成,核心子集:域名分组 + 重复检测 + 点击跳转 + 一键关闭** |
| **UI 融合** | 双视图主控台为独立扩展页 `hub.html`,**点扩展图标直接打开**。~~接管新标签页~~(实测每开新页都弹出太烦,2026-05-27 废弃 override;主控台头部带导出/设置/清除工具区) |
| 采集范围 | 智能过滤自动记录(敏感域名黑名单 + 噪音过滤) |
| 行为粒度 | 中等:搜索词 / 点击链接 / 选中复制片段 |
| 存储 | 可插拔:① 本地 IndexedDB(默认) ② 文件导出 ③ 远程 HTTP |
| 目标浏览器 | Chrome/Edge 优先(Chromium MV3),Firefox 后置 |
| LLM 总结时机 | ~~惰性/批量~~ → **移交 DesktopHub**(2026-05-27);插件不含 LLM,只推送原始 context |
| MVP 边界 | Tab 仪表盘 + 采集 + 正文抽取 + 可插拔存储 + 导出 + 推送 DesktopHub;总结/RAG/分身在 DesktopHub 或下一里程碑 |

## 架构(双视图前台 + 四层引擎)

```
┌──────────── 主控台 hub.html (统一入口,点图标打开) ────────────┐
│  视图 A:Tab 仪表盘 (借 tab-out 核心子集)          │
│   当前 tab → 按域名分组 · 重复检测 · 跳转 · 关闭    │
│  视图 B:Context 时间线 (采集器)                   │
│   历史浏览结构化沉淀 → 摘要 · 标签 · 导出 · 触发总结 │
└──────────────────────┬─────────────────────────────┘
                       ▼ 共享底层 tab/导航监听 + 存储层
┌──────────── 后台引擎 (方案 C 四层) ───────────────┐
│ 采集 Collector  ── 实时 tab 状态(→视图A,内存)     │
│                    历史采集(→视图B):正文+关键交互  │
│                    → 智能过滤(黑名单+噪音)         │
│        ▼                                            │
│ 处理 Processor  ── LLM Provider 抽象(填账号)       │
│                    惰性/批量总结 → ContextRecord     │
│                    敏感页可选 WebLLM 本地总结        │
│        ▼                                            │
│ 存储 Storage    ── StorageAdapter 接口,3 实现:     │
│   (可插拔)        ① IndexedDB ② 文件导出 ③ 远程HTTP │
│        ▼                                            │
│ 消费 Consumer   ── 未来三里程碑(本计划不实现)      │
└─────────────────────────────────────────────────────┘
```

### 统一数据模型(设计灵魂)
每条 `ContextRecord`:
```
{
  id, ownerId,           // ownerId:多租户预留,单人期填固定默认值
  timestamp, url, title,
  contentSummary,        // 摘要(由 DesktopHub 生成;插件不填,保留字段)
  rawContentRef,         // 正文 Markdown 引用(可选保留)
  interactions: [ { type: "search"|"click"|"copy", value, ts } ],
  dwellMs,               // 停留时长(早期暂不采集,字段保留;改为打开~2s 即记一条)
  tags: [],              // 语义标签(由 DesktopHub 生成;插件不填,保留字段)
  source: { referrer, fromUrl }
}
```
保持"原始+结构化",不为单一分身特化 → 三个里程碑都能复用。
(实时 tab 状态是独立的轻量内存结构,MVP 不持久化为 ContextRecord。)

## 借鉴地图

| 层 | 借鉴项目 | 借鉴点 |
|---|---|---|
| Tab 仪表盘 + tab 采集 | [zarazhangrui/tab-out](https://github.com/zarazhangrui/tab-out)(1.4k) | `chrome.tabs` 读所有 tab、按域名/homepages 分组 + 重复检测的 MV3 写法;new tab override + 纯本地 `chrome.storage.local` 范式;`AGENTS.md` "丢给 coding agent install this" 分发方式 |
| 架构骨架 + 隐私 | [ActivityWatch](https://github.com/ActivityWatch/activitywatch) / [aw-watcher-web](https://github.com/ActivityWatch/aw-watcher-web) | watcher + 本地 server 分离 = 采集层 + 可插拔后端;隐私优先设计 |
| 本地实现 | [marswangyang/personal-ai-memory](https://github.com/marswangyang/personal-ai-memory) | local-first Chrome 扩展 + IndexedDB + 浏览器内 RAG(向量+BM25)+ WASM |
| 正文抽取 | [LLMFeeder](https://github.com/jatinkrmalik/LLMFeeder) | Readability.js 抽正文 + Turndown 转 Markdown |
| 记忆结构 | [mem0](https://github.com/mem0ai/mem0) / [OpenMemory](https://github.com/CaviraOSS/OpenMemory) | 分层记忆(episodic/semantic/procedural);可作远程存储 adapter 后端 |
| 内容加工管线 | [zarazhangrui/follow-builders](https://github.com/zarazhangrui/follow-builders)(4.7k) | "采集→remix→周期 digest 摘要"对应 processor 周期性批量总结 |
| 消费插件 | [screenpipe](https://github.com/screenpipe/screenpipe)(18.8k) | 本地捕获 + REST + pipes,对应三分身作为底座消费者 |
| LLM 接入 | [nanobrowser](https://github.com/nanobrowser/nanobrowser)(13k) / [WebLLM](https://github.com/mlc-ai/web-llm) | 填自己 API key 多 provider 的 MV3 范本;敏感页浏览器内本地总结 |
| 主动投喂 / 分享归档 | [Karakeep(原 Hoarder)](https://github.com/karakeep-app/karakeep) | share-to-app + RSS 自动收 + AI 标签摘要(支持 Ollama)+ 网页高亮 + Readability 全文归档 + REST/webhook;近乎现成的"移动端一键分享 / 专属投喂"管线,可借其管线或作 remote adapter 后端。同类:Linkwarden / Wallabag / Shiori |

## 技术栈

- Manifest V3 + TypeScript
- 构建框架:WXT(内置 MV3/HMR/多浏览器/new tab override)
- UI:轻量 React 或 Preact(双视图主控台需组件化)
- 存储:IndexedDB(Dexie.js 封装)
- 正文抽取:@mozilla/readability + turndown
- LLM:fetch 调 OpenAI 兼容 API;可选 @mlc-ai/web-llm 本地兜底
- 测试:Vitest

## 建议项目结构

```
ViewMindChromeHub/
  wxt.config.ts
  src/
    background/    # service worker:tab/导航事件监听、停留计时、批量调度
    content/       # content script:正文抽取 + 交互监听
    collector/
      tabState.ts  # 实时 tab 状态(分组/去重)→ 视图 A
      history.ts   # 历史采集编排 + 智能过滤(黑名单/噪音)→ 视图 B
    processor/     # LLM Provider 抽象 + 批量总结 + 标签生成
    storage/       # StorageAdapter 接口 + local/file/remote 三实现
    models/        # ContextRecord schema + 类型
    hub/           # 主控台扩展页 hub.html:双视图(TabDashboard / ContextTimeline)+ HubActions 工具区
    popup/         # 快捷:状态、手动触发总结、导出/清除
    options/       # 设置:API key、黑名单、存储后端选择
  tests/
```

## 隐私与安全(MVP 必须内建)

- 默认敏感域名黑名单(网银/支付/邮箱/社交私信/医疗),命中不采(注:tab 仪表盘仍可显示这些 tab,但**不写入历史 context**)。
- 敏感字段过滤:密码框、表单输入默认不采;复制片段过敏感正则。
- API key 存 `chrome.storage.local`,UI 明示不上传。
- 本地优先;远程 adapter 必须显式配置 + 二次确认。
- 一键清除全部数据。

## 里程碑路线

- **M0(本计划 MVP)✅ 端到端跑通(2026-05-27)**:双视图主控台 + Tab 仪表盘(核心子集)+ 历史采集 + 正文抽取 + 智能过滤 + 可插拔存储(local/file)+ 导出 + **HTTP 推送 DesktopHub**。已真机验收。~~插件内总结~~ 已移交 DesktopHub。遗留待打磨:停留时长(后台精确计时)、SPA 路由采集、DesktopHub 真正接收端(R2)。
- **M1**:浏览器内语义检索(RAG,借 personal-ai-memory)+ 当前 tab 快照入 context → 第二大脑雏形。
- **M2**:对话型分身。
- **M3**:行动型 Agent(借 nanobrowser/screenpipe pipe)。

## 验证方式(MVP 端到端)

1. `chrome://extensions` 开发者模式加载未打包扩展;点扩展图标 → 打开双视图主控台(hub.html)。
2. **Tab 仪表盘**:打开多个 tab(含同页重复、多域名)→ 确认按域名分组、重复检测标记、点击跳转到对应 tab、一键关闭生效。
3. **历史采集**:访问 5~10 个网页(每页停 >2s)→ 视图 B/IndexedDB 确认生成 ContextRecord(早期不含停留时长)。
4. 访问黑名单域名 → 确认**未**写入历史 context(但仪表盘可显示)。
5. options 配 DesktopHub 端点 + 启用 → 浏览网页 → 确认端点收到 `POST /records`(record+正文);未启用不推送、端点挂了不影响本地采集。
6. 一键导出 JSON / Markdown → 检查结构符合 ContextRecord schema。
7. 配本地 mock HTTP endpoint → 切远程 adapter → 确认数据被 POST。
8. Vitest 跑过滤规则、数据模型、StorageAdapter、tab 分组/去重逻辑单测。
9. 一键清除 → 确认本地数据清空。

## 待实施时再定的次要项

- WXT vs Vite+CRXJS 最终选型(实施第一步快速验证后定)。
- UI 框架 React vs Preact(体积敏感选 Preact)。
- 远程 adapter 协议细节(等服务器端形态确定);是否首版即接 mem0。
