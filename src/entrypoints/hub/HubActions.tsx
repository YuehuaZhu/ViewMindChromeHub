import { DEFAULT_OWNER_ID } from "../../models/context";
import { LocalStorageAdapter } from "../../storage/local";
import { exportAsJson, downloadFile } from "../../storage/file";

const storage = new LocalStorageAdapter();

/** 主控台头部工具区：导出 / 设置 / 清除（原 popup 的动作，迁到中枢页右上）。 */
export function HubActions() {
  const exportJson = async () => {
    const records = await storage.query({ ownerId: DEFAULT_OWNER_ID });
    downloadFile("viewmind-export.json", exportAsJson(records), "application/json");
  };

  const clearAll = async () => {
    if (confirm("确认清除全部本地采集数据？此操作不可撤销。")) {
      await storage.clear({ ownerId: DEFAULT_OWNER_ID });
      location.reload();
    }
  };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={exportJson}>导出 JSON</button>
      <button onClick={() => chrome.runtime.openOptionsPage()}>设置</button>
      <button onClick={clearAll} style={{ color: "crimson" }}>
        清除全部数据
      </button>
    </div>
  );
}
