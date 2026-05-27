import { defineConfig } from "wxt";

// WXT 配置：srcDir=src，React 模块，MV3 manifest（newtab 由 newtab 入口自动接管）。
export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "ViewMind 浏览中枢",
    description: "Tab 管理 + 浏览 context 采集，喂养你的数字分身。本地优先。",
    permissions: ["tabs", "storage", "alarms", "scripting"],
    host_permissions: ["<all_urls>"],
  },
});
