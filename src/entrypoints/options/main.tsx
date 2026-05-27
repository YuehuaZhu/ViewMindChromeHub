import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { DEFAULT_BLOCKLIST } from "../../collector/filter";

/**
 * 设置页：API key / 黑名单 / 存储后端选择。
 * API key 存 chrome.storage.local，UI 明示不上传。骨架仅做读写示意。
 */
function Options() {
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    chrome.storage.local
      .get("llmApiKey")
      .then((v) => setApiKey((v as Record<string, string>).llmApiKey ?? ""));
  }, []);

  const save = () => chrome.storage.local.set({ llmApiKey: apiKey });

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>ViewMind 设置</h1>

      <section>
        <h2>LLM 账号</h2>
        <p style={{ color: "#666", fontSize: 13 }}>
          API key 仅存于本机 chrome.storage.local，不会上传到任何服务器。
        </p>
        <input
          type="password"
          value={apiKey}
          placeholder="OpenAI 兼容 API key"
          onChange={(e) => setApiKey(e.target.value)}
          style={{ width: "100%" }}
        />
        <button onClick={save}>保存</button>
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
