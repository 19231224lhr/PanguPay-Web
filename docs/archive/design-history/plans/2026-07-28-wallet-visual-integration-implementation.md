# Wallet Visual Integration Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with tests before implementation. This task is intentionally scoped to one frontend repository and does not require parallel agents.

**Goal:** 让收款、普通/快速/跨链转账、活动、安全凭证和担保组织在真实后端语义下可读、可视、可测试。

**Architecture:** 保留现有 Pinia、GatewayClient、protocol-v2 和 Ledger Plane。新增的可视化组件只接收已经归一化的前端类型，不直接访问网络；页面继续由现有 store 提供真实状态。后端生产代码保持只读。

**Tech Stack:** Vue 3、TypeScript、Pinia、CSS Variables、Web Animations/CSS transitions、Vitest、Vue Test Utils、Playwright。

## Global Constraints

- 只修改 `PanguPay-Web`，后端生产代码只读。
- 不新增动画框架、图表库或远程二维码服务。
- 不伪造价格、信用评分、手续费、QC 或凭证状态。
- 金额计算继续使用 protocol-v2 的精确十进制与 bigint。
- reduced-motion 下关闭路径绘制和位移动效，保留短暂颜色/透明度反馈。
- 保留当前 dirty 工作树，不 reset、不覆盖既有修改。

---

### Task 1: 修复测试漂移并强化后端契约矩阵

**Files:**

- Modify: `e2e/phase2.spec.ts`
- Modify: `scripts/check-backend-contract.mjs`
- Test: `src/__tests__/gatewayClient.spec.ts`

**Interfaces:**

- Consumes: `GatewayClient` 的公开 method + path。
- Produces: 对所有生产调用的显式后端 route 检查。

- [ ] 将 E2E 的旧按钮名称改为当前可见文案 `暂不加入`。
- [ ] 在契约脚本中建立 method/path/file 矩阵，覆盖 Gateway、Assign、Aggregation 和 Committee 的实际调用。
- [ ] 运行 `npm run check:backend-contract`，确认缺少任一 method/path 时门禁失败。

### Task 2: 收款二维码

**Files:**

- Create: `src/components/ReceiveAddressQR.vue`
- Modify: `src/views/wallet/WalletReceiveView.vue`
- Test: `src/__tests__/ReceiveAddressQR.spec.ts`

**Interfaces:**

- Consumes: `address: string`。
- Produces: 本地生成的二维码 SVG/data URL、空地址状态和可访问说明。

- [ ] 先写测试：地址变化时输出随之变化，空地址不生成二维码。
- [ ] 使用本地二维码实现生成可扫描图形，不调用网络服务。
- [ ] 收款页改为二维码、完整地址、地址选择和复制组成的连续平面。
- [ ] 地址切换使用一次 `160ms` 交叉淡化；reduced-motion 只改变内容。

### Task 3: 三种转账路径可视化

**Files:**

- Create: `src/components/TransferRoutePreview.vue`
- Modify: `src/views/wallet/WalletSendView.vue`
- Test: `src/__tests__/TransferRoutePreview.spec.ts`

**Interfaces:**

- Consumes: `mode: TransferMode`、`isMember: boolean`。
- Produces: 与后端真实流程一致的节点、连接和用户说明。

- [ ] 测试普通散户、普通成员、快速和跨链四种分支的节点与文案。
- [ ] 快速路径展示 Wallet → 担保组织 → TXCer 可用，并单独标注后台结算。
- [ ] 普通路径区分散户直达委员会和成员经担保组织提交。
- [ ] 跨链路径展示当前 PGC、单轻计算地址、整数金额约束。
- [ ] 模式切换只播放一次不超过 `220ms` 的连接揭示，不持续循环。

### Task 4: 活动记录详情与状态时间线

**Files:**

- Create: `src/components/ActivityProgress.vue`
- Modify: `src/views/wallet/WalletActivityView.vue`
- Test: `src/__tests__/ActivityProgress.spec.ts`

**Interfaces:**

- Consumes: 活动 status、timestamp、direction、txID。
- Produces: 可展开的完整 ID、时间、方向、路径和真实进度说明。

- [ ] 测试已接收、TXCer 可用、后台已结算和失败状态。
- [ ] 列表首行保留金额、状态和时间，详情中展示完整 TXID 和状态路径。
- [ ] 详情展开使用 `180ms` opacity/translate 过渡，不为整个列表做 stagger。

### Task 5: 凭证信任链与 ExposureShares

**Files:**

- Create: `src/components/CredentialTrustPath.vue`
- Create: `src/components/ExposureShareBar.vue`
- Modify: `src/views/wallet/WalletSecurityView.vue`
- Test: `src/__tests__/CredentialTrustPath.spec.ts`
- Test: `src/__tests__/ExposureShareBar.spec.ts`

**Interfaces:**

- Consumes: `WalletCredentialSummary` 和精确 amount 字符串。
- Produces: FastEvidence/AssignAck/LiabilityReceipt/CFAA 状态链与责任份额比例。

- [ ] 测试 Verified/Pending/Failed/Unavailable 的全部映射。
- [ ] 证据链不把 CFAA Pending/Unavailable 显示为阻塞 TXCer 可用。
- [ ] 责任份额按 bigint 最小单位计算比例，原始金额和 RootID 始终可读。
- [ ] 状态变化仅在 `180ms` 内变色；不使用持续流光。

### Task 6: 组织页复用入口页详情

**Files:**

- Modify: `src/views/wallet/WalletOrganizationView.vue`
- Reuse: `src/components/OrganizationDetailDialog.vue`
- Test: `src/__tests__/walletOrganizationView.spec.ts`

**Interfaces:**

- Consumes: 现有 organization list/detail/join gateway。
- Produces: 与 `/wallet/entry` 一致的组织选择、详情和加入反馈。

- [ ] 将原生 radio 列表改为安静的选择行和独立“查看详情”按钮。
- [ ] 复用真实担保额度、担保节点、审计节点和服务可用性，不增加虚构指标。
- [ ] 已加入状态继续显示归属和真实能力，不重复加入。

### Task 7: 联测、视觉复核与知识图谱

**Files:**

- Modify: `README.md`
- Modify: `DESIGN.md`
- Modify: `docs/testing/frontend-ui-operation-atlas.md`（若存在）

**Interfaces:**

- Consumes: 前述全部组件与现有真实 Gateway。
- Produces: 可复现的功能验收记录与最新图谱。

- [ ] 用当前后端运行 health、groups、group detail 和前端 route 契约检查。
- [ ] 运行组件、页面、protocol-v2、E2E、lint、format、typecheck 和 build 门禁。
- [ ] 在桌面/移动、深色/浅色下复核收款、发送、活动、安全和组织页面。
- [ ] 重新运行 Impeccable detector，处理实际命中的质量问题。
- [ ] 增量更新 PanguPay-Web 与后端跨仓知识图谱。

## Motion budget

- **Focal moment:** 转账模式改变时，真实路径关系被一次性揭示。
- **Continuity:** 活动详情、组织详情和二维码切换避免内容瞬移。
- **Feedback:** 复制、状态改变和错误保持短促反馈。
- **Budget:** 所有钱包内常规动效不超过 220ms；无持续装饰动效；二维码生成不阻塞主线程交互。
