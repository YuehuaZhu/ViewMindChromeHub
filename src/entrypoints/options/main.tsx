import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { DEFAULT_BLOCKLIST } from "../../collector/filter";
import { REMOTE_KEYS } from "../../storage/remoteConfig";

/**
 * 设置页：DesktopHub 接入(推送)/ 黑名单 / 存储后端。
 * 配置存 chrome.storage.local，UI 明示不上传第三方。总结/聚合在 DesktopHub 完成,插件不含 LLM。
 */
function Options() {
  const [endpoint, setEndpoint] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.local
      .get([REMOTE_KEYS.endpoint, REMOTE_KEYS.apiKey, REMOTE_KEYS.enabled])
      .then((raw) => {
        const v = raw as Record<string, unknown>;
        setEndpoint((v[REMOTE_KEYS.endpoint] as string) ?? "");
        setApiKey((v[REMOTE_KEYS.apiKey] as string) ?? "");
        setEnabled(Boolean(v[REMOTE_KEYS.enabled]));
      });
  }, []);

  // 启用推送需二次确认(隐私红线:远程上报必须显式同意)。
  const onToggleEnabled = (next: boolean) => {
    if (next && !confirm("启用后,采集到的网页记录与正文将被推送到你配置的 DesktopHub 端点。确认启用?")) {
      return;
    }
    setEnabled(next);
  };

  const save = async () => {
    await chrome.storage.local.set({
      [REMOTE_KEYS.endpoint]: endpoint,
      [REMOTE_KEYS.apiKey]: apiKey,
      [REMOTE_KEYS.enabled]: enabled,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>ViewMind 设置</h1>

      <section>
        <h2>DesktopHub 接入(推送)</h2>
        <p style={{ color: "#666", fontSize: 13 }}>
          插件只负责采集;开启后把记录与正文推送到本地 DesktopHub,由它完成总结/聚合。
          配置仅存本机,默认关闭。
        </p>
        <label style={{ display: "block", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggleEnabled(e.target.checked)}
          />{" "}
          启用推送到 DesktopHub
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          端点 URL
          <input
            value={endpoint}
            placeholder="http://127.0.0.1:8765"
            onChange={(e) => setEndpoint(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          API key(可选)
          <input
            type="password"
            value={apiKey}
            placeholder="DesktopHub 若需鉴权则填"
            onChange={(e) => setApiKey(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <button onClick={save}>保存</button>
        {saved && <span style={{ marginLeft: 8, color: "green" }}>已保存</span>}
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
