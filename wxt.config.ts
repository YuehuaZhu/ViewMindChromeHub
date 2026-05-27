import { defineConfig } from "wxt";

// WXT 配置：srcDir=src，React 模块，MV3 manifest。
// 主控台是普通扩展页 hub.html（不接管新标签页），由 popup「打开主控台」用 getURL 打开。
export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "ViewMind 浏览中枢",
    description: "Tab 管理 + 浏览 context 采集，喂养你的数字分身。本地优先。",
    permissions: ["tabs", "storage", "alarms", "scripting"],
    host_permissions: ["<all_urls>"],
    // 无 default_popup：点图标直接触发 background 的 action.onClicked → 打开主控台。
    action: { default_title: "打开 ViewMind 浏览中枢" },
  },
});
