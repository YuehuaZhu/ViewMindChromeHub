import { useState } from "react";
import { TabDashboard } from "./views/TabDashboard";
import { ContextTimeline } from "./views/ContextTimeline";
import { HubActions } from "./HubActions";

type View = "tabs" | "context";

/** 主控台（扩展页 hub.html）：双视图统一入口（视图 A 仪表盘 / 视图 B 时间线）。 */
export function App() {
  const [view, setView] = useState<View>("tabs");

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <h1>ViewMind 浏览中枢</h1>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <nav style={{ display: "flex", gap: 8 }}>
          <button aria-pressed={view === "tabs"} onClick={() => setView("tabs")}>
            Tab 仪表盘
          </button>
          <button aria-pressed={view === "context"} onClick={() => setView("context")}>
            Context 时间线
          </button>
        </nav>
        <HubActions />
      </div>
      {view === "tabs" ? <TabDashboard /> : <ContextTimeline />}
    </main>
  );
}
