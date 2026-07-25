# PanguPay Web Phase 1 真实 UI 操作图谱

## 适用范围

本图谱对应 Phase 1：钱包身份、加密 keystore、真实只读账户数据、正式导航、收款和安全详情。
发送页不会签名或提交交易。

## 首页入口

| 前置状态                    | 操作               | 目标             |
| --------------------------- | ------------------ | ---------------- |
| 本机没有 keystore           | 首页点击“进入钱包” | `/wallet/setup`  |
| 本机已有 keystore，但未解锁 | 首页点击“进入钱包” | `/wallet/unlock` |
| 本次页面会话已解锁          | 首页点击“进入钱包” | `/wallet`        |

入口使用价值折叠场收拢和空间遮罩过渡；减少动态效果下为短交叉淡化。

## 创建钱包

1. 在“建立你的钱包”选择“创建”。
2. 输入至少 12 个 UTF-8 字节的密码并再次确认。
3. 点击“创建并下载备份”。
4. 浏览器下载 `wallet.json`。此时钱包只保存在当前内存，尚未写入 IndexedDB。
5. 勾选“我已将 wallet.json 安全保存”。
6. 点击“进入钱包”。只有此时才原子保存加密 envelope 并进入 `/wallet`。

预期：

- 备份确认前“进入钱包”不可点击。
- IndexedDB 中只有 Argon2id + AES-256-GCM envelope，不含明文私钥或 RootSeed。
- LocalStorage 只包含主题和语言偏好。

## 导入钱包

1. 在 `/wallet/setup` 选择“导入”。
2. 选择正式 `wallet.json`。
3. 输入该文件的密码。
4. 点击“验证并导入”。

错误密码、密文/AAD 篡改、账户 ID 不匹配、RootSeed 无法派生记录地址时均停留在当前页并报错。

“迁移旧钱包”要求同时输入 32 字节账户私钥和 32 字节 Address RootSeed；缺少 RootSeed
时明确拒绝恢复旧地址。

## 解锁与锁定

- 刷新页面后，内存秘密被清除，路由进入 `/wallet/unlock`。
- 输入密码并点击“解锁钱包”恢复同一账户和地址。
- 点击侧栏账户入口或设置页“锁定”，立即清除内存秘密。
- 连续 15 分钟没有指针、键盘或触摸活动时自动锁定。

## 钱包总览

页面从 Gateway 同步：

- 地址与 UTXO 可用余额；
- TXCer 生命周期与可支付余额；
- 担保组织；
- 账户活动；
- TXCer issuance detail、FastEvidence、AssignAck、LiabilityReceipt、CFAA proof 和 ExposureShares。

总览只展示用户摘要。余额光带仅在首次真实快照、手动刷新或余额真实变化时运行一次。
后端不可用时显示离线快照和缓存时间。

## 收款

1. 点击侧栏或总览中的“收款”。
2. 从下拉框选择一个由当前 RootSeed 确定性恢复的地址。
3. 点击“复制地址”。

页面只复制公开地址，不读取或展示 RootSeed。

## 发送

发送页允许选择来源地址、快速 / 普通 / 跨链模式、收款地址与精确金额，但按钮保持禁用：

```text
Phase 1：不签名、不提交
Phase 2：接入 protocol-v2 交易构造、签名和提交
```

浏览器网络中不应出现 `submit-tx`、`submit-noguargroup-tx` 或 `/committee/gqnc/*`。

## 凭证与安全

总览的安全摘要点击“查看详情”进入 `/wallet/security`：

- `Verified`：具有权威 signer 快照且完整验签成功；
- `Pending`：等待 FastEvidence、Ack、责任收据或权威上下文；
- `Failed`：完整证据存在但验证失败，TXCer 被计入隔离项；
- `Unavailable`：CFAA proof 或 Certifier 权威上下文暂不可用。

技术字段默认折叠，可展开查看 TXCerID、RecordID、RootID、LeafID 与 ExposureShare 金额。
普通钱包不会直接查询 GQNC 运维状态。

## 响应式导航

- 桌面端：左侧导航包含总览、发送、活动、凭证与安全、担保组织、设置。
- 移动端：底部保留前四个高频入口；其他能力后续归入“我的”。
- 所有交互目标至少为 44×44px，并支持键盘焦点和减少动态效果。
