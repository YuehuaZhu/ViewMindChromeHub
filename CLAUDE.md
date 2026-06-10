# ViewMindChromeHub — 浏览中枢:Tab 管理 + 浏览 Context 采集(数字分身底座)

Chromium(Chrome/Edge)MV3 扩展。双视图主控台(扩展页 `hub.html`,点扩展图标直接打开;**不接管新标签页**):**Tab 仪表盘**(此刻开着什么)+ **Context 时间线**(浏览过什么)。后台智能过滤采集网页正文与关键交互,存到本地;可选启用后**单向推送到本机 ViewMindPipeline ingest-server**。**本地优先**,最终喂养数字分身。

> **职责边界(老大 2026-05-27)**:ChromeHub 只做**采集 + 暴露**,**不含 AI 总结**。总结/聚合在 ViewMindPipeline pipeline/extraction 层完成(ChromeHub 经 HTTP 推送把 context 喂给 ingest-server 写入 pipeline.db)。`contentSummary`/`tags` 字段保留在共享 schema 但插件不再填。

完整产品背景、决策、里程碑见 [PLAN.md](PLAN.md)。

## 本项目在 ViewMind 总体中的定位

本项目是 ViewMind 的**浏览器采集前端**,直接对接 ViewMindPipeline ingest-server（`127.0.0.1:8787`）作为浏览 context 的上报入口。采集到的 `ContextRecord` 经 remote adapter 写入 `pipeline.db` L0_browser_events 表，由 ViewMindPipeline 的处理层继续加工。

**每个 session 开工前必读:**
[PLAN.md](PLAN.md) —— 功能范围、验证方式与里程碑。

## 开发规范

每次代码改动前,根据复杂程度自动选择轨道:

- **小修 / Hotfix**(≤30 分钟,不需要讨论追踪)→ `+quick` 开 `hotfix/<slug>` 分支,改完 `+pr` → `+merge`
- **功能 / 重大 Bug / 需要讨论的改动** → `+issue` 创建 GitHub Issue,再 `+branch`,改完 `+pr` → `+merge`

无需用户每次提醒,Claude 根据改动规模主动判断并执行。使用 team-collab skill 管理完整开发链路。

## 快速上手

```bash
pnpm install              # 装依赖(postinstall 自动跑 wxt prepare 生成 .wxt 类型)
pnpm dev                  # 启动开发(Chrome,带 HMR);pnpm dev:firefox 跑 Firefox
pnpm build                # 生产构建 → .output/chrome-mv3/
pnpm compile              # 类型检查(wxt prepare && tsc --noEmit)
pnpm test                 # Vitest 单测
```

**加载到浏览器**:`pnpm dev` 会自动开一个装好扩展的浏览器;或手动到 `chrome://extensions` 开开发者模式 → 「加载已解压」选 `.output/chrome-mv3/`。点扩展图标即直接打开双视图主控台。

## 架构

```
┌──────── 主控台 hub.html (src/entrypoints/hub,点图标打开) ────────┐
│  视图 A TabDashboard   当前 tab → 域名分组·重复检测·跳转·关闭 │
│  视图 B ContextTimeline 历史浏览结构化沉淀 → 正文预览·导出·批量关标签 │
└───────────────────────┬──────────────────────────────────┘
                        ▼ 共享 tab/导航监听 + 存储层
┌──────── 后台引擎 (方案 C 四层) ───────────────────────────┐
│ Collector  实时 tab 状态(→视图A) / 历史采集(→视图B)+ 智能过滤 │
│ Processor  preview(正文预览截断);总结/聚合在 ViewMindPipeline pipeline/extraction 层 │
│ Storage    local(IndexedDB,默认) / file(导出) / remote(推送) │
│ Consumer   未来三里程碑(本计划不实现)                        │
└────────────────────────────────────────────────────────────┘
```

**数据模型是设计灵魂**:每条 [`ContextRecord`](src/models/context.ts) 保持「原始 + 结构化」,带 `ownerId`(多租户预留,单人期填 `DEFAULT_OWNER_ID`),不为单一分身特化 → 三个里程碑都能复用。实时 tab 状态([`LiveTab`](src/models/tab.ts))是独立轻量内存结构,MVP 不持久化为 ContextRecord。

## 目录结构

```
src/
  entrypoints/      WXT 入口(WXT 约定必须放这里,不是 PLAN 里写的 src/background 等)
    background.ts   service worker:收 VisitSignal → 过滤 → 写本地存储
    content.ts      content script:加载后等 SETTLE_MS(~2s)仍存活则抽正文(Readability+Turndown)+ 上报 VisitSignal(页面活着时发,可靠)
    hub/            双视图主控台 hub.html(App + HubActions[导出/设置/清除] + views/TabDashboard + ContextTimeline)
    options/        设置:Pipeline 接入(单开关,默认开,勾选即存,端口自动发现)/ 黑名单 / 存储后端
  collector/        filter(黑名单+噪音) · tabState(分组/去重) · history(组装 Record) · timelineSelection(时间线区间选择+URL匹配标签)
  processor/        preview(正文预览截断) · sanitize(双阶段正文过滤:gateContent 抽取前把关 + sanitizeMarkdown 清洗，规则数组可逐条扩展)
  storage/          adapter(接口) · local(IndexedDB/Dexie:records 表 + 独立 contents 正文表) · file(导出) · remote(HTTP 推送 pushVisit) · remoteConfig(读推送配置)
  models/           context(ContextRecord + RawContent) · tab(LiveTab)
tests/              Vitest:纯函数逻辑(filter / tabState / history / timelineSelection / preview / sanitize)
wxt.config.ts       srcDir=src,React 模块,manifest 权限 + action(无 popup,点图标开 hub)
```

## 开发流程

```bash
git checkout -b issue-<N>-<slug>     # 或 hotfix/<slug>
pnpm compile && pnpm test            # 改完必须类型通过 + 单测绿
git push origin HEAD                 # 用 +pr 创建 PR,+merge 合并
```

新增纯逻辑(过滤规则、分组算法、数据组装)→ 抽成纯函数放 `collector/` 或 `processor/`,在 `tests/` 补单测。涉及 `chrome.*` 的代码放 entrypoints,靠浏览器手动验证(见 PLAN「验证方式」)。

## 隐私红线(MVP 必须内建)

- 敏感域名黑名单命中**不写入历史 context**(但仪表盘仍可显示该 tab)——逻辑在 [`collector/filter.ts`](src/collector/filter.ts)。
- API key 存 `chrome.storage.local`,UI 明示不上传;远程 adapter 必须显式配置 + 二次确认。
- 一键清除全部数据(主控台头部工具区 HubActions)。

## 常见问题 / 踩过的坑

> **WXT 0.20 的 import 路径**:`defineBackground` 来自 `wxt/utils/define-background`,`defineContentScript` 来自 `wxt/utils/define-content-script`。**不是** `wxt/sandbox`(那是旧版,0.20 已移除)。

> **`chrome` 全局类型找不到**:WXT 默认走 `browser` API,不引 `@types/chrome`。本项目用 `chrome.*`,所以装了 `@types/chrome` 并在 [tsconfig.json](tsconfig.json) 显式写 `"types": ["chrome"]` 强制注入。动这个字段前先想清楚会不会丢掉别的全局类型。

> **入口必须在 `src/entrypoints/`**:PLAN 里画的 `src/background/`、`src/hub/` 是逻辑分层示意;WXT 实际要求所有入口集中在 `src/entrypoints/`,引擎层(collector/processor/storage/models)才是普通模块。

> **ingest-server 推送契约**:**默认开启**(options 可关);端口**自动发现**——`probeIngestServer` 按序探测 `GET http://127.0.0.1:{8787,8788,8789}/health`,缓存第一个响应的端口(逻辑在 [`storage/remote.ts`](src/storage/remote.ts);background 用长生命周期单例缓存,避免每次采集重探,推失败清缓存重探)。每条采集落库后 `POST http://127.0.0.1:{port}/ingest/browser`,body = `{ "records": [{ "record": <ContextRecord>, "markdown": <正文,可选> }] }`;有 `apiKey` 则带 `Authorization: Bearer`。单向推送、best-effort(失败只 warn 不影响本地)。黑名单/噪音页不入库也不推送(ingest-server 端 `isSystemUrl` 还会兜底拦 Chrome `warmup.html` / `chrome://*` / `about:*`)。

> **主控台入口 / 点图标没反应**:主控台是普通扩展页 `hub.html`(入口目录 `entrypoints/hub`),**有意不接管新标签页**(早期接管过,老大反馈烦,已废)。manifest 不设 `default_popup`,点扩展图标由 background 的 `chrome.action.onClicked` 打开 `hub.html`。改回 popup 或加 onClicked 时注意二者互斥:有 `default_popup` 则 `onClicked` 不触发。

> **采集时机 / 快速浏览的页没进时间线**:记录在页面**打开满 `SETTLE_MS`(~2s,在 [`content.ts`](src/entrypoints/content.ts))时**上报一次——不依赖"离开页面"(那在同标签跳转/关页时常丢)。活不够 2s 的一闪而过页定时器不触发,天然过滤。

> **`dwellMs` 精确采集 (2026-06-05 上线,#43)**:content.ts 持续累加可见时长(`document.visibilityState==='visible'` 时计、hidden 不计);SETTLE_MS=2s 首次 visit 上报含初始 dwellMs(≈2000ms);在 `visibilitychange→hidden` / `pagehide` 时,通过 `chrome.runtime.sendMessage({type:'dwellFinal', recordId, dwellMs})` 二次推,background 调 `remoteAdapter.pushDwell` → `POST /ingest/browser/dwell`,服务端 **MAX-merge** 单调递增(不被更小值覆盖)。首次 visit 的回调里缓存 background 返回的 `recordId`,dwellFinal 没有 recordId 不发。pushDwell 静默失败(端口不通或旧 ingest 返 404)——dwell 是 nice-to-have,不阻断主流程。

> **同一页一天一条 / 显示「浏览 N 次」**:去重边界 = **本地自然日**(`startOfLocalDay`,在 `history.ts`)。当天内重访同 URL 合并进同一条(合并交互、置顶时间、`visitCount++`),**次日重新从 1 计数**(新增一条)。逻辑在 `history.ts` `mergeVisit` + `LocalStorageAdapter.findMergeTarget(ownerId, url, since)`(`since` = 当天零点)。
