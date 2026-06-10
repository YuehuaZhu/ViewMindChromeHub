import { defineBackground } from "wxt/utils/define-background";
import { buildRecord, type VisitSignal } from "../collector/history";
import { isNoise } from "../collector/filter";
import { LocalStorageAdapter } from "../storage/local";
import { RemoteStorageAdapter } from "../storage/remote";
import { getRemoteSettings } from "../storage/remoteConfig";
import { getOrCreateDeviceId, getDeviceLabel } from "../storage/deviceIdentity";
import type { ContextRecord } from "../models/context";

/** Outbox 参数 */
const OUTBOX_MAX_PENDING = 500;  // pending 队列上限，超限淘汰最老
const OUTBOX_FLUSH_LIMIT = 50;   // 每次 alarm 最多推送条数
const OUTBOX_ALARM = "viewmind-outbox-flush";

/**
 * 后台 service worker：接收 content script 在页面存活满 ~2s 时上报的 VisitSignal → 落库。
 * 同 URL 当天内合并(次日重新计数);有正文则存入独立内容表并回填 rawContentRef。
 * 落库后单向推送到 ViewMind Pipeline ingest-server（best-effort，失败进 Outbox 补传）。
 */
export default defineBackground(async () => {
  // 首次安装：写入默认配置 + 批量注入所有当前已打开的 tab
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
      void chrome.storage.local.set({ remoteEnabled: true });
      // 对安装前已打开的 tab 补注一次 content script，捕获现有上下文快照
      void chrome.tabs.query({}).then((tabs) => {
        for (const tab of tabs) {
          if (tab.id && tab.url && !isNoise(tab.url)) {
            void chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["content-scripts/content.js"],
            }).catch(() => {});
          }
        }
      });
    }
  });

  // SPA 导航检测：URL 变化但页面不重载（YouTube/GitHub 等单页应用）
  // changeInfo.url 有值 = URL 发生了变化（pushState/replaceState），主动补注 content script
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!changeInfo.url || isNoise(changeInfo.url)) return;
    void chrome.scripting.executeScript({
      target: { tabId },
      files: ["content-scripts/content.js"],
    }).catch(() => {});
  });

  const storage = new LocalStorageAdapter();

  // ── Device Identity ────────────────────────────────────────────────────────
  const deviceId = await getOrCreateDeviceId();
  const deviceLabel = await getDeviceLabel();

  // ── Pipeline 推送 ─────────────────────────────────────────────────────────
  const remoteAdapter = new RemoteStorageAdapter();
  let remoteEnabled = true;
  getRemoteSettings().then((s) => (remoteEnabled = s.enabled));
  chrome.storage.onChanged.addListener((changes) => {
    if ("remoteEnabled" in changes) {
      getRemoteSettings().then((s) => (remoteEnabled = s.enabled));
    }
  });

  /**
   * 尝试推送一条记录到 ViewMind Pipeline ingest-server。
   * 成功 → markSynced；失败 → 保持 pending，等下次 alarm 重试。
   */
  const pushRemote = (record: ContextRecord, markdown?: string): void => {
    if (!remoteEnabled) return;
    remoteAdapter
      .pushVisit(record, markdown, deviceId, deviceLabel)
      .then(() => storage.markSynced(record.id))
      .catch((e) => console.warn("[ViewMind] Pipeline 推送失败，将在下次 flush 重试", e));
  };

  // ── Outbox flush（chrome.alarms 每 90s 低频补传）─────────────────────────
  const flushPending = async (): Promise<void> => {
    if (!remoteEnabled) return;
    const pending = await storage.getPending(OUTBOX_FLUSH_LIMIT);
    if (!pending.length) return;
    for (const record of pending) {
      try {
        // 补传时尝试取正文（best-effort，无正文也推）
        const content = await storage.getContent({ ownerId: record.ownerId }, record.id);
        await remoteAdapter.pushVisit(record, content?.markdown, deviceId, deviceLabel);
        await storage.markSynced(record.id);
      } catch {
        // 某条失败跳过，保持 pending，等下次
      }
    }
  };

  chrome.alarms.create(OUTBOX_ALARM, { periodInMinutes: 1.5 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === OUTBOX_ALARM) void flushPending();
  });

  const save = async (
    signal: VisitSignal,
  ): Promise<{ saved: boolean; reason?: string; recordId?: string }> => {
    try {
      const fresh = buildRecord(signal);
      if (!fresh) return { saved: false, reason: "filtered" };

      // 不合并同日同 URL 访问——每次访问独立一条记录，保留最细粒度的正文和上下文
      const record = fresh;
      if (signal.rawContent) record.rawContentRef = record.id;

      // 落库前标 pending，推送成功后改为 synced；失败留 pending 等 alarm 补传。
      record.syncState = "pending";
      await storage.put(record);

      // 队列溢出保护：超限淘汰最老 pending
      await storage.evictOldestPending(OUTBOX_MAX_PENDING);

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
      pushRemote(record, signal.rawContent);   // → Pipeline ingest-server（成功后 markSynced）
      return { saved: true, recordId: record.id };
    } catch (e) {
      console.error("[ViewMind] 落库出错", signal?.url, e);
      return { saved: false, reason: "error" };
    }
  };

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "visit") {
      save(msg.signal as VisitSignal).then(sendResponse);
      return true; // 异步响应。
    }
    if (msg?.type === "dwellFinal") {
      // content script 在 visibilitychange→hidden / pagehide 时上报最终 dwell。
      // 用 best-effort 推到 ingest，失败静默吞掉——dwell 是 nice-to-have，不阻断主流程。
      const { recordId, dwellMs } = msg as { recordId?: string; dwellMs?: number };
      if (remoteEnabled && recordId && typeof dwellMs === "number" && dwellMs > 0) {
        void remoteAdapter.pushDwell(recordId, dwellMs);
      }
      return false; // 不需要 sendResponse
    }
    return false;
  });

  // 点扩展图标 → 弹出 hub.html popup（wxt.config.ts 已设置 default_popup）
  // 无需 onClicked 监听器：有 popup 时 Chrome 不触发该事件。
});
