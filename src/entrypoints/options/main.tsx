import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { DEFAULT_BLOCKLIST } from "../../collector/filter";
import { getRemoteSettings, setRemoteEnabled, getOwSettings, setOwEnabled, setOwToken } from "../../storage/remoteConfig";
import { DEFAULT_HOST, probeDesktopHub } from "../../storage/remote";
import { probeOpenWhispr, OW_HOST } from "../../storage/openwhispr";

/**
 * 设置页：DesktopHub 接入(推送)/ 黑名单 / 存储后端。
 * 推送默认开启、端口自动发现、勾选即存(无保存按钮),整体无感。配置仅存本机。
 */
function Options() {
  const [enabled, setEnabled] = useState(true);
  const [port, setPort] = useState<number | null | undefined>(null);

  const [owEnabled, setOwEnabledState] = useState(true);
  const [owPort, setOwPort] = useState<number | null | undefined>(null);
  const [owToken, setOwTokenState] = useState("");

  useEffect(() => {
    getRemoteSettings().then((s) => setEnabled(s.enabled));
    refreshStatus();
    getOwSettings().then((s) => {
      setOwEnabledState(s.enabled);
      setOwTokenState(s.token ?? "");
    });
    refreshOwStatus();
  }, []);

  const refreshStatus = (): void => {
    setPort(null);
    probeDesktopHub().then(setPort);
  };

  const refreshOwStatus = (): void => {
    setOwPort(null);
    probeOpenWhispr().then(setOwPort);
  };

  const onToggle = async (next: boolean): Promise<void> => {
    setEnabled(next);
    await setRemoteEnabled(next);
    if (next) refreshStatus();
  };

  const onOwToggle = async (next: boolean): Promise<void> => {
    setOwEnabledState(next);
    await setOwEnabled(next);
    if (next) refreshOwStatus();
  };

  const onOwTokenBlur = async (): Promise<void> => {
    await setOwToken(owToken);
  };

  const status =
    port === null ? (
      <span style={{ color: "#888" }}>检测中…</span>
    ) : port === undefined ? (
      <span style={{ color: "#b45309" }}>
        未发现 DesktopHub(确认桌面端已启动)
        <button onClick={refreshStatus} style={{ marginLeft: 8 }}>重试</button>
      </span>
    ) : (
      <span style={{ color: "green" }}>已连接 {DEFAULT_HOST}:{port}</span>
    );

  const owStatus =
    owPort === null ? (
      <span style={{ color: "#888" }}>检测中…</span>
    ) : owPort === undefined ? (
      <span style={{ color: "#b45309" }}>
        未发现 OpenWhispr(确认桌面应用已启动)
        <button onClick={refreshOwStatus} style={{ marginLeft: 8 }}>重试</button>
      </span>
    ) : (
      <span style={{ color: "green" }}>已连接 {OW_HOST}:{owPort}</span>
    );

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>ViewMind 设置</h1>

      <section>
        <h2>DesktopHub 接入(推送)</h2>
        <p style={{ color: "#666", fontSize: 13 }}>
          开启后把记录与正文单向推送到<strong>本机</strong> DesktopHub，由它完成总结/聚合。端口自动发现，默认开启。
        </p>
        <label style={{ display: "block", marginBottom: 8, fontSize: 15 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => void onToggle(e.target.checked)} />{" "}
          启用推送到 DesktopHub
        </label>
        <p style={{ fontSize: 13, margin: "4px 0 0" }}>连接状态：{status}</p>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>OpenWhispr 接入(Chat Overlay 上下文)</h2>
        <p style={{ color: "#666", fontSize: 13 }}>
          开启后每次采集到页面正文时，同步推送到本机 OpenWhispr Chat Overlay，
          按快捷键唤起时自动注入当前页上下文。端口自动发现(8200-8219)，默认开启。
        </p>
        <label style={{ display: "block", marginBottom: 8, fontSize: 15 }}>
          <input type="checkbox" checked={owEnabled} onChange={(e) => void onOwToggle(e.target.checked)} />{" "}
          启用推送到 OpenWhispr
        </label>
        <p style={{ fontSize: 13, margin: "4px 0 8px" }}>连接状态：{owStatus}</p>
        <label style={{ display: "block", fontSize: 13, color: "#555" }}>
          CLI Bridge Token（可选，留空则不带认证）
          <input
            type="password"
            value={owToken}
            onChange={(e) => setOwTokenState(e.target.value)}
            onBlur={() => void onOwTokenBlur()}
            placeholder="owk_live_…"
            style={{ display: "block", marginTop: 4, width: "100%", padding: "4px 8px", fontSize: 13, boxSizing: "border-box" }}
          />
        </label>
        <p style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
          Token 在 OpenWhispr → 设置 → 系统 → CLI Bridge Token 里获取（本地使用通常不需要）。
        </p>
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
