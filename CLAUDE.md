# ViewMindChromeHub — 浏览中枢:Tab 管理 + 浏览 Context 采集(数字分身底座)

Chromium(Chrome/Edge)MV3 扩展。接管新标签页为双视图主控台:**Tab 仪表盘**(此刻开着什么)+ **Context 时间线**(浏览过什么)。后台智能过滤采集网页正文与关键交互,惰性批量调 LLM 生成结构化摘要,存到可插拔后端。**本地优先**,最终喂养数字分身。

完整产品背景、决策、里程碑见 [PLAN.md](PLAN.md)。

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

**加载到浏览器**:`pnpm dev` 会自动开一个装好扩展的浏览器;或手动到 `chrome://extensions` 开开发者模式 → 「加载已解压」选 `.output/chrome-mv3/`。打开新标签页即见双视图主控台。

## 架构

```
┌──────── 新标签页主控台 (src/entrypoints/newtab) ────────┐
│  视图 A TabDashboard   当前 tab → 域名分组·重复检测·跳转·关闭 │
│  视图 B ContextTimeline 历史浏览结构化沉淀 → 摘要·标签·导出  │
└───────────────────────┬──────────────────────────────────┘
                        ▼ 共享 tab/导航监听 + 存储层
┌──────── 后台引擎 (方案 C 四层) ───────────────────────────┐
│ Collector  实时 tab 状态(→视图A) / 历史采集(→视图B)+ 智能过滤 │
│ Processor  LLM Provider 抽象 → 惰性批量总结 → 填 summary/tags │
│ Storage    StorageAdapter 接口,3 实现:local / file / remote │
│ Consumer   未来三里程碑(本计划不实现)                        │
└────────────────────────────────────────────────────────────┘
```

**数据模型是设计灵魂**:每条 [`ContextRecord`](src/models/context.ts) 保持「原始 + 结构化」,带 `ownerId`(多租户预留,单人期填 `DEFAULT_OWNER_ID`),不为单一分身特化 → 三个里程碑都能复用。实时 tab 状态([`LiveTab`](src/models/tab.ts))是独立轻量内存结构,MVP 不持久化为 ContextRecord。

## 目录结构

```
src/
  entrypoints/      WXT 入口(WXT 约定必须放这里,不是 PLAN 里写的 src/background 等)
    background.ts   service worker:收 VisitSignal → 过滤 → 写本地存储
    content.ts      content script:交互监听 + 页面隐藏时上报 VisitSignal
    newtab/         双视图主控台(App + views/TabDashboard + views/ContextTimeline)
    popup/          快捷:导出 / 清除 / 打开设置
    options/        设置:API key / 黑名单 / 存储后端
  collector/        filter(黑名单+噪音) · tabState(分组/去重) · history(组装 Record)
  processor/        llm(OpenAI 兼容 Provider) · summarize(批量总结调度)
  storage/          adapter(接口) · local(IndexedDB/Dexie) · file(导出) · remote(HTTP 上报)
  models/           context(ContextRecord) · tab(LiveTab)
tests/              Vitest:纯函数逻辑(filter / tabState / history)
wxt.config.ts       srcDir=src,React 模块,manifest 权限 + newtab 由入口自动接管
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
- 一键清除全部数据(popup)。

## 常见问题 / 踩过的坑

> **WXT 0.20 的 import 路径**:`defineBackground` 来自 `wxt/utils/define-background`,`defineContentScript` 来自 `wxt/utils/define-content-script`。**不是** `wxt/sandbox`(那是旧版,0.20 已移除)。

> **`chrome` 全局类型找不到**:WXT 默认走 `browser` API,不引 `@types/chrome`。本项目用 `chrome.*`,所以装了 `@types/chrome` 并在 [tsconfig.json](tsconfig.json) 显式写 `"types": ["chrome"]` 强制注入。动这个字段前先想清楚会不会丢掉别的全局类型。

> **入口必须在 `src/entrypoints/`**:PLAN 里画的 `src/background/`、`src/newtab/` 是逻辑分层示意;WXT 实际要求所有入口集中在 `src/entrypoints/`,引擎层(collector/processor/storage/models)才是普通模块。

> **新标签页不生效**:WXT 靠 `newtab` 入口名自动写 `chrome_url_overrides.newtab`,不要手动在 wxt.config 里再写一遍。
