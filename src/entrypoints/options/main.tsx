import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { DEFAULT_BLOCKLIST } from "../../collector/filter";
import { LLM_DEFAULTS, LLM_KEYS } from "../../processor/config";

/**
 * 设置页：LLM 账号(base/key/model) / 黑名单 / 存储后端。
 * 配置存 chrome.storage.local，UI 明示不上传。
 */
function Options() {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.local
      .get([LLM_KEYS.baseUrl, LLM_KEYS.apiKey, LLM_KEYS.model])
      .then((raw) => {
        const v = raw as Record<string, string>;
        setBaseUrl(v[LLM_KEYS.baseUrl] ?? "");
        setApiKey(v[LLM_KEYS.apiKey] ?? "");
        setModel(v[LLM_KEYS.model] ?? "");
      });
  }, []);

  const save = async () => {
    await chrome.storage.local.set({
      [LLM_KEYS.baseUrl]: baseUrl,
      [LLM_KEYS.apiKey]: apiKey,
      [LLM_KEYS.model]: model,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>ViewMind 设置</h1>

      <section>
        <h2>LLM 账号</h2>
        <p style={{ color: "#666", fontSize: 13 }}>
          仅存于本机 chrome.storage.local，不会上传到任何第三方;调用时直接请求你填的服务地址。
        </p>
        <label style={{ display: "block", marginBottom: 8 }}>
          服务地址 (OpenAI 兼容 base URL)
          <input
            value={baseUrl}
            placeholder={LLM_DEFAULTS.baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          API key
          <input
            type="password"
            value={apiKey}
            placeholder="sk-..."
            onChange={(e) => setApiKey(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          模型
          <input
            value={model}
            placeholder={LLM_DEFAULTS.model}
            onChange={(e) => setModel(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <button onClick={save}>保存</button>
        {saved && <span style={{ marginLeft: 8, color: "green" }}>已保存</span>}
      </section>

      <section>
        <h2>敏感域名黑名单</h2>
        <p style={{ color: "#666", fontSize: 13 }}>命中以下域名不写入历史 context（仪表盘仍可显示）。</p>
        <ul>
          {DEFAULT_BLOCKLIST.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>存储后端</h2>
        <p style={{ color: "#666", fontSize: 13 }}>
          默认本地 IndexedDB。远程 HTTP 上报需显式配置 + 二次确认（M0 待接服务器形态）。
        </p>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>,
);
