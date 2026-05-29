import { defineBackground } from "wxt/utils/define-background";
import { buildRecord, mergeVisit, startOfLocalDay, type VisitSignal } from "../collector/history";
import { LocalStorageAdapter } from "../storage/local";
import { RemoteStorageAdapter } from "../storage/remote";
import { OpenWhisprAdapter } from "../storage/openwhispr";
import { getRemoteSettings, getOwSettings } from "../storage/remoteConfig";
import { getOrCreateDeviceId, getDeviceLabel } from "../storage/deviceIdentity";
import type { ContextRecord } from "../models/context";

/**
 * 后台 service worker：接收 content script 在页面存活满 ~2s 时上报的 VisitSignal → 落库。
 * 同 URL 当天内合并(次日重新计数);有正文则存入独立内容表并回填 rawContentRef。
 * 落库后双向推送(均 best-effort)：
 *   1. DesktopHub（7777-7779）：AI 总结/聚合
 *   2. OpenWhispr（8200-8219）：全局 Chat Overlay 上下文注入
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
  chrome.storage.onChanged.addListener(() =>
    getRemoteSettings().then((s) => (remoteEnabled = s.enabled)),
  );

  const pushRemote = (record: ContextRecord, markdown?: string): void => {
    if (!remoteEnabled) return;
    remoteAdapter
      .pushVisit(record, markdown, deviceId, deviceLabel)
      .catch((e) => console.warn("[ViewMind] DesktopHub 推送失败(本地已存)", e));
  };

  // ── OpenWhispr 推送 ────────────────────────────────────────────────────────
  const owAdapter = new OpenWhisprAdapter();
  let owEnabled = true;
  getOwSettings().then((s) => {
    owEnabled = s.enabled;
    owAdapter.updateToken(s.token);
  });
  chrome.storage.onChanged.addListener(() =>
    getOwSettings().then((s) => {
      owEnabled = s.enabled;
      owAdapter.updateToken(s.token);
    }),
  );

  const pushOpenWhispr = (record: ContextRecord, markdown?: string): void => {
    if (!owEnabled) return;
    owAdapter
      .pushContext(record, markdown)
      .catch((e) => console.warn("[ViewMind] OpenWhispr 推送失败(本地已存)", e));
  };

  const save = async (signal: VisitSignal): Promise<{ saved: boolean; reason?: string }> => {
    try {
      const fresh = buildRecord(signal);
      if (!fresh) return { saved: false, reason: "filtered" };

      const target = await storage.findMergeTarget(fresh.ownerId, fresh.url, startOfLocalDay());
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
      pushRemote(record, signal.rawContent);       // → DesktopHub
      pushOpenWhispr(record, signal.rawContent);   // → OpenWhispr Chat Overlay
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

  // TODO(M0+): 需要精确停留时长时,用 chrome.tabs/visibility 后台计时;chrome.alarms 触发批量总结。
});
