# ChromeHub — collector 标准能力对齐(R2.5 联动)

> 挂靠:配合 DesktopHub R2.5 开放采集协议。主文档见 `../ViewMindDesktopHub/PLAN-collector-protocol.md`。
> 与 `PLAN.md` 关系:不重复 M0-M3 里程碑;本文只补"作为标准 collector 需对齐的能力 + 服务融合的数据增强"。

## 背景

DesktopHub 把内部 `SourceAdapter` 升级为对外开放协议,并定义了所有 collector 的标准能力契约(Outbox + Device Identity)。ChromeHub 作为**第一个真实 collector**,需对齐这两项,并补一个为"多源融合"服务的数据增强(复制粘贴链)。

## 一、Outbox 离线缓冲(落地 PLAN.md 的"零丢失")

现状:ChromeHub 已用 IndexedDB(Dexie)全量存 record,推送是 best-effort one-way → Desktop 离线丢数据。

改动:
- record 加 `syncState: pending | synced`(或独立 sync queue 表)
- 推送成功才标 `synced`;失败/离线留 `pending`
- 探测 Desktop 上线:正常 push 时顺带探 `GET /health` + `chrome.alarms` 每 1-2min 低频兜底 → 在线则 flush 所有 `pending`
- 幂等:补传靠 record id(Desktop 端 upsert)
- 队列上限,超限淘汰最老

## 二、Device Identity(多设备识别)

- 首装生成 `deviceId`(UUID),**存 `chrome.storage.local`,绝不用 `chrome.storage.sync`**(否则同 Chrome 账号下 mac/win 串号成同一设备)
- `label`:OS+浏览器自动推断(如 "MacBook-Chrome"),设置页可改名
- 推送 payload 的 `source` 带上 `deviceId` + `label`
- 首次连 Desktop 时注册设备

## 三、复制粘贴链增强(服务融合金矿)

现状:已采 copy 事件(interactions type="copy")。
增强:
- `mouseup` 检测非空 `getSelection()` → 在 record 增加 `selection` 字段
- copy 事件保留内容指纹(hash),供 Desktop 端跨源匹配"复制→粘贴"关联
- 这是最便宜的强关联信号,服务 DesktopHub R4 融合

## 四、推送端点对齐(协议泛化后,可选)

DesktopHub 通用 `/ingest` 上线后,ChromeHub 可从 `/records` 迁移到 `/ingest`(统一 envelope)。
**MVP 阶段保持 `/records` 不变**(向后兼容),待通用端点稳定再切。

## 验证

1. Desktop 关闭时浏览多页 → record 入 IndexedDB 标 pending;开 Desktop → 自动补传落库,无重复
2. 同账号 mac/win 两浏览器 → Desktop 设备表显示两个不同 deviceId
3. 复制网页片段 → record 带 selection + 指纹;粘贴到终端(终端 collector 上线后)→ Desktop 能关联为"同一件事"
4. 回归:既有 M0-M2 推送链路(DesktopHub 7777-7779 + OpenWhispr 8200-8219)不受影响
