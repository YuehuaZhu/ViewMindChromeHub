import { defineBackground } from "wxt/utils/define-background";
import { buildRecord, mergeVisit, startOfLocalDay, type VisitSignal } from "../collector/history";
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
 * 落库后单向推送到 DesktopHub（7777-7779，best-effort，失败进 Outbox 补传）。
 * 下游消费方（OpenWhispr 等）通过 DesktopHub CLI 按需拉取，不在此直推。
 */
export default defineBackground(async () => {
  const storage = new LocalStorageAdapter();

  // ── Device Identity ────────────────────────────────────────────────────────
  const deviceId = await getOrCreateDeviceId();
  const deviceLabel = await getDeviceLabel();

  // ── DesktopHub 推送 ────────────────────────────────────────────────────────
  const remoteAdapter = new RemoteStorageAdapter();
  let remoteEnabled = true;
  getRemoteSettings().then((s) => (remoteEnabled = s.enabled));
  chrome.storage.onChanged.addListener((changes) => {
    if ("remoteEnabled" in changes) {
      getRemoteSettings().then((s) => (remoteEnabled = s.enabled));
    }
  });

  /**
   * 尝试推送一条记录到 DesktopHub。
   * 成功 → markSynced；失败 → 保持 pending，等下次 alarm 重试。
   */
  const pushRemote = (record: ContextRecord, markdown?: string): void => {
    if (!remoteEnabled) return;
    remoteAdapter
      .pushVisit(record, markdown, deviceId, deviceLabel)
      .then(() => storage.markSynced(record.id))
      .catch((e) => console.warn("[ViewMind] DesktopHub 推送失败，将在下次 flush 重试", e));
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

  const save = async (signal: VisitSignal): Promise<{ saved: boolean; reason?: string }> => {
    try {
      const fresh = buildRecord(signal);
      if (!fresh) return { saved: false, reason: "filtered" };

      const target = await storage.findMergeTarget(fresh.ownerId, fresh.url, startOfLocalDay());
      const record = target ? mergeVisit(target, fresh) : fresh;
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
      pushRemote(record, signal.rawContent);   // → DesktopHub（成功后 markSynced）
      return { saved: true };
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
    return false;
  });

  // 点扩展图标(无 popup)→ 直接打开主控台。
  chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL("hub.html") });
  });
});
