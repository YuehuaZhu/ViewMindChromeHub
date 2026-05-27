import React from "react";
import ReactDOM from "react-dom/client";
import { DEFAULT_OWNER_ID } from "../../models/context";
import { LocalStorageAdapter } from "../../storage/local";
import { exportAsJson, downloadFile } from "../../storage/file";

const storage = new LocalStorageAdapter();

/** 快捷面板：状态 / 手动触发总结 / 导出 / 清除。骨架仅接通导出与清除。 */
function Popup() {
  const exportJson = async () => {
    const records = await storage.query({ ownerId: DEFAULT_OWNER_ID });
    downloadFile("viewmind-export.json", exportAsJson(records), "application/json");
  };

  const clearAll = async () => {
    if (confirm("确认清除全部本地采集数据？此操作不可撤销。")) {
      await storage.clear({ ownerId: DEFAULT_OWNER_ID });
    }
  };

  const openHub = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("hub.html") });
  };

  return (
    <div style={{ fontFamily: "system-ui", padding: 12, minWidth: 220 }}>
      <h3 style={{ marginTop: 0 }}>ViewMind 浏览中枢</h3>
      <button
        onClick={openHub}
        style={{
          display: "block",
          width: "100%",
          marginBottom: 10,
          padding: "8px 0",
          fontWeight: 600,
          color: "#fff",
          background: "#2563eb",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        打开主控台
      </button>
      <button onClick={exportJson}>导出 JSON</button>
      <button onClick={() => chrome.runtime.openOptionsPage()}>设置</button>
      <button onClick={clearAll} style={{ color: "crimson" }}>
        清除全部数据
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
