import { defineBackground } from "wxt/utils/define-background";
import { buildRecord, mergeVisit, DEDUP_WINDOW_MS, type VisitSignal } from "../collector/history";
import type { Interaction } from "../models/context";
import { LocalStorageAdapter } from "../storage/local";

interface ActiveVisit {
  startedAt: number;
  url: string;
  title: string;
  rawContent?: string;
  referrer?: string;
  interactions: Interaction[];
}

/**
 * 后台 service worker：每个页面经长连接 port 上报;port 断开(离开页面)时由后台计算停留并落库。
 * 同 URL 时间窗内合并;有正文则存入独立内容表并回填 rawContentRef。
 */
export default defineBackground(() => {
  const storage = new LocalStorageAdapter();

  const save = async (signal: VisitSignal): Promise<void> => {
    try {
      const fresh = buildRecord(signal);
      if (!fresh) {
        console.info("[ViewMind] 过滤跳过", signal.url, "dwell=", signal.dwellMs);
        return;
      }
      const target = await storage.findMergeTarget(fresh.ownerId, fresh.url, DEDUP_WINDOW_MS);
      const record = target ? mergeVisit(target, fresh) : fresh;
      if (signal.rawContent) record.rawContentRef = record.id;

      await storage.put(record); // 先存记录,正文失败不丢记录。
      if (signal.rawContent) {
        try {
          await storage.putContent({
            id: record.id,
            ownerId: record.ownerId,
            markdown: signal.rawContent,
            capturedAt: record.timestamp,
          });
        } catch (e) {
          console.warn("[ViewMind] 正文存储失败(记录已存)", e);
        }
      }
      console.info("[ViewMind] 已存记录", record.url, target ? "(合并)" : "(新增)");
    } catch (e) {
      console.error("[ViewMind] 落库出错", signal?.url, e);
    }
  };

  // 长连接采集:端口存活=页面存活,断开时算停留落库(不依赖将死页面发消息)。
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "visit") return;
    const visit: ActiveVisit = { startedAt: Date.now(), url: "", title: "", interactions: [] };

    port.onMessage.addListener((msg) => {
      if (msg?.kind === "meta") {
        visit.url = msg.url ?? "";
        visit.title = msg.title ?? "";
        visit.rawContent = msg.rawContent;
        visit.referrer = msg.referrer;
      } else if (msg?.kind === "interaction" && msg.interaction) {
        visit.interactions.push(msg.interaction);
      }
    });

    port.onDisconnect.addListener(() => {
      if (!visit.url) return;
      void save({
        url: visit.url,
        title: visit.title,
        rawContent: visit.rawContent,
        interactions: visit.interactions,
        dwellMs: Date.now() - visit.startedAt,
        referrer: visit.referrer,
      });
    });
  });

  // 点扩展图标(无 popup)→ 直接打开主控台。
  chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL("hub.html") });
  });

  // TODO(M0+): 用 chrome.tabs/visibility 把 dwell 精确到前台活跃时间;chrome.alarms 触发批量总结。
});
