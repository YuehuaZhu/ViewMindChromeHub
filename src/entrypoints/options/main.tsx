import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { DEFAULT_BLOCKLIST } from "../../collector/filter";
import { getRemoteSettings, setRemoteEnabled } from "../../storage/remoteConfig";
import { DEFAULT_HOST, probeDesktopHub } from "../../storage/remote";

/**
 * 设置页：DesktopHub 接入(推送)/ 黑名单 / 存储后端。
 * 推送默认开启、端口自动发现、勾选即存(无保存按钮),整体无感。配置仅存本机。
 */
function Options() {
  const [enabled, setEnabled] = useState(true);
  // null = 检测中;number = 已连端口;undefined = 未发现
  const [port, setPort] = useState<number | null | undefined>(null);

  useEffect(() => {
    getRemoteSettings().then((s) => setEnabled(s.enabled));
    refreshStatus();
  }, []);

  const refreshStatus = (): void => {
    setPort(null);
    probeDesktopHub().then(setPort);
  };

  // 勾选即存(无保存按钮);开启后顺手刷新连接状态。
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
        未发现 DesktopHub(确认桌面端已启动)<button onClick={refreshStatus} style={{ marginLeft: 8 }}>重试</button>
      </span>
    ) : (
      <span style={{ color: "green" }}>
        已连接 {DEFAULT_HOST}:{port}
      </span>
    );

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>ViewMind 设置</h1>

      <section>
        <h2>DesktopHub 接入(推送)</h2>
        <p style={{ color: "#666", fontSize: 13 }}>
          插件只负责采集;开启后把记录与正文单向推送到<strong>本机</strong> DesktopHub(数据不离开本机),
          由它完成总结/聚合。端口自动发现,无需配置。默认开启。
        </p>
        <label style={{ display: "block", marginBottom: 8, fontSize: 15 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => void onToggle(e.target.checked)} />{" "}
          启用推送到 DesktopHub
        </label>
        <p style={{ fontSize: 13, margin: "4px 0 0" }}>连接状态:{status}</p>
      </section>

      <section>
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

      <section>
        <h2>存储后端</h2>
        <p style={{ color: "#666", fontSize: 13 }}>默认本地 IndexedDB;推送为额外的单向上报,不替代本地。</p>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>,
);
