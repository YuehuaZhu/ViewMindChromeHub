# ViewMindChromeHub

> 浏览中枢:Chromium MV3 扩展。接管新标签页为 **Tab 仪表盘 + Context 时间线** 双视图主控台,自动采集浏览 context、惰性总结、本地优先存储,喂养你的数字分身。

## 快速上手

```bash
# 安装(自动生成 WXT 类型)
pnpm install

# 开发(自动打开装好扩展的 Chrome,带热更新)
pnpm dev

# 生产构建 → .output/chrome-mv3/
pnpm build
```

手动加载:`chrome://extensions` → 开启开发者模式 → 「加载已解压的扩展程序」→ 选 `.output/chrome-mv3/`。打开新标签页即见双视图主控台。

配置:点扩展图标 → 设置,填入 OpenAI 兼容 API key(仅存本机,不上传)。

## 功能

- **Tab 仪表盘**:当前所有标签页按域名分组、重复检测、点击跳转、一键关闭。
- **Context 时间线**:历史浏览结构化沉淀,LLM 惰性生成摘要与语义标签。
- **本地优先 + 可插拔存储**:默认 IndexedDB;支持 JSON/Markdown 导出与远程 HTTP 上报。
- **隐私内建**:敏感域名黑名单不入库、噪音过滤、一键清除全部数据。

## 文档

- [架构 & 开发指南](CLAUDE.md)
- [产品背景 & 路线图](PLAN.md)

## 依赖要求

- Node.js ≥ 20、pnpm ≥ 9
- 技术栈:WXT + TypeScript + React + Dexie(IndexedDB)+ Vitest
