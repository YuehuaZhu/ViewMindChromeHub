import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { DEFAULT_BLOCKLIST } from "../../collector/filter";
import { getRemoteSettings, setRemoteEnabled } from "../../storage/remoteConfig";
import { DEFAULT_HOST, probeIngestServer } from "../../storage/remote";
import { getOrCreateDeviceId, getDeviceLabel, setDeviceLabel } from "../../storage/deviceIdentity";

/**
 * 设置页：Pipeline 接入(推送)/ 黑名单 / 存储后端。
 * 推送默认开启、端口自动发现、勾选即存(无保存按钮),整体无感。配置仅存本机。
 */
function Options() {
  const [enabled, setEnabled] = useState(true);
  const [port, setPort] = useState<number | null | undefined>(null);

  const [deviceId, setDeviceIdState] = useState("");
  const [deviceLabel, setDeviceLabelState] = useState("");

  useEffect(() => {
    getRemoteSettings().then((s) => setEnabled(s.enabled));
    refreshStatus();
    getOrCreateDeviceId().then(setDeviceIdState);
    getDeviceLabel().then(setDeviceLabelState);
  }, []);

  const refreshStatus = (): void => {
    setPort(null);
    probeIngestServer().then(setPort);
  };

  const onToggle = async (next: boolean): Promise<void> => {
    setEnabled(next);
    await setRemoteEnabled(next);
    if (next) refreshStatus();
  };

  const status =
    port === null ? (
      <span style={{ color: "#888" }}>检测中…</span>
    ) : port === undefined ? (
      <span style={{ color: "#b45309" }}>
        未发现 ingest-server（确认 ViewMindPipeline 已启动）
        <button onClick={refreshStatus} style={{ marginLeft: 8 }}>重试</button>
      </span>
    ) : (
      <span style={{ color: "green" }}>已连接 {DEFAULT_HOST}:{port}</span>
    );

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>ViewMind 设置</h1>

      <section>
        <h2>Pipeline 接入(推送)</h2>
        <p style={{ color: "#666", fontSize: 13 }}>
          开启后把记录与正文单向推送到<strong>本机</strong> ViewMind Pipeline ingest-server，实时写入 pipeline.db。端口自动发现，默认开启。
        </p>
        <label style={{ display: "block", marginBottom: 8, fontSize: 15 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => void onToggle(e.target.checked)} />{" "}
          启用推送到 ViewMind Pipeline
        </label>
        <p style={{ fontSize: 13, margin: "4px 0 0" }}>连接状态：{status}</p>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>设备身份</h2>
        <p style={{ color: "#666", fontSize: 13 }}>
          用于 Pipeline 记录多设备来源。deviceId 首次生成后不变；设备名称可自定义（如"工作 MacBook"）。
        </p>
        <p style={{ fontSize: 13, margin: "4px 0 8px" }}>
          设备 ID：<code style={{ userSelect: "all", fontSize: 12, color: "#555" }}>{deviceId || "生成中…"}</code>
        </p>
        <label style={{ display: "block", fontSize: 13, color: "#555" }}>
          设备名称
          <input
            type="text"
            value={deviceLabel}
            onChange={(e) => setDeviceLabelState(e.target.value)}
            onBlur={() => void setDeviceLabel(deviceLabel)}
            placeholder="MacBook-Chrome"
            style={{ display: "block", marginTop: 4, width: "100%", padding: "4px 8px", fontSize: 13, boxSizing: "border-box" }}
          />
        </label>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>敏感域名黑名单</h2>
        <p style={{ color: "#666", fontSize: 13 }}>
          命中以下域名不写入历史 context(也不会推送);仪表盘仍可显示。
        </p>
        <ul>
          {DEFAULT_BLOCKLIST.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>存储后端</h2>
        <p style={{ color: "#666", fontSize: 13 }}>默认本地 IndexedDB；推送为额外的单向上报，不替代本地。</p>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>,
);
