# TXCer 终态凭证安全摘要修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 已转成 UTXO 或已消费的历史 TXCer 不再被统计为当前隔离项，同时保留其历史审计结果。

**Architecture:** 以 TXCer 生命周期作为第一层筛选：只有 `Active` 凭证能够影响“可立即支付、暂停支付、后台审计”摘要。历史终态继续出现在凭证明细中，但不会升级为当前钱包安全告警。

**Tech Stack:** Vue 3、TypeScript、Pinia、Vitest。

## Global Constraints

- 只修改 `PanguPay-Web`。
- 不修改 TXCer、CFAA、GQNC、后端接口、数据库或协议 wire。
- 不删除历史凭证，也不把真实验签失败改写为成功。
- 不新增依赖、数据迁移、后台任务或兼容层。

---

### Task 1: 用失败测试固定生命周期语义

**Files:**

- Modify: `src/__tests__/dashboard.spec.ts`
- Modify: `src/__tests__/credentials.spec.ts`

**Interfaces:**

- Consumes: `buildDashboardSnapshot(...)`、`WalletCredentialSummary.lifecycle`、`fastEvidenceStatus`。
- Produces: “只有 Active 失败凭证会隔离”的回归约束。

- [ ] **Step 1: 在 dashboard 测试中加入历史终态失败凭证**

在现有聚合测试的 `txCers` 中加入：

```ts
{
  id: 'converted-history',
  value: '90',
  lifecycle: 'ConvertedToUTXO',
  fastEvidence: 'Failed',
}
```

保留现有 `Active + Failed` 用例，并新增独立断言：仅有历史终态失败时，`isolatedCount === 0`，该 TXCer 不进入 `txCerSpendable`。

- [ ] **Step 2: 为当前凭证摘要补充状态组合测试**

覆盖以下组合：

```text
Active + Failed                    → 当前隔离
Active + Pending/Unavailable CFAA → 当前后台审计
ConvertedToUTXO + Failed          → 历史异常，不隔离
Consumed + Failed                 → 历史异常，不隔离
ConvertedToUTXO + Verified        → 历史正常，不影响摘要
```

- [ ] **Step 3: 运行定向测试并确认旧实现失败**

```powershell
npx vitest run src/__tests__/dashboard.spec.ts src/__tests__/credentials.spec.ts
```

Expected: `ConvertedToUTXO + Failed` 当前仍被计入隔离，测试失败。

---

### Task 2: 修复当前安全摘要与历史凭证展示

**Files:**

- Modify: `src/wallet/dashboard.ts`
- Modify: `src/stores/dashboard.ts`
- Modify: `src/wallet/credentials.ts`
- Modify: `src/views/wallet/WalletSecurityView.vue`

**Interfaces:**

- Produces: `isActiveCredentialFailure(credential): boolean`。
- Consumes: `WalletCredentialSummary.lifecycle`、`WalletCredentialSummary.fastEvidenceStatus`。

- [ ] **Step 1: 增加唯一的当前隔离判定**

在 `src/wallet/credentials.ts` 增加并导出：

```ts
export function isActiveCredentialFailure(
  credential: Pick<WalletCredentialSummary, 'lifecycle' | 'fastEvidenceStatus'>,
): boolean {
  return credential.lifecycle === 'Active' && credential.fastEvidenceStatus === 'Failed'
}
```

- [ ] **Step 2: 修复缓存快照聚合**

将 `src/wallet/dashboard.ts` 中 TXCer 循环调整为先判断生命周期：

```ts
if (txCer.lifecycle === 'Active') {
  if (txCer.fastEvidence === 'Failed') isolatedCount += 1
  else {
    spendable += parseAmount(txCer.value)
    if (txCer.fastEvidence === 'Pending') pendingAudits += 1
  }
}
```

终态凭证既不增加隔离数，也不进入可支付余额。

- [ ] **Step 3: 修复权威同步后的摘要覆盖**

在 `src/stores/dashboard.ts` 中：

```ts
next.security.isolatedCount = credentials.filter(isActiveCredentialFailure).length
next.security.pendingAudits = credentials.filter(
  (item) =>
    item.lifecycle === 'Active' && ['Pending', 'Unavailable'].includes(item.cfaaAuditStatus),
).length
```

继续根据新的 `isolatedCount` 设置 `credentialStatus`。

- [ ] **Step 4: 区分当前隔离和历史审计异常**

在 `WalletSecurityView.vue` 中：

- 顶部“存在隔离项”和“暂停支付”只读取 Active 隔离数。
- `Active + Failed` 使用 danger 状态。
- `ConvertedToUTXO/Consumed + Failed` 使用 neutral 状态，生命周期仍原样显示。
- 历史错误文案改为 `历史凭证验证记录：FastEvidence verification failed`，不再暗示当前资产被冻结。
- 5 PGC 已验证凭证及其他正常记录保持不变。

- [ ] **Step 5: 运行定向测试**

```powershell
npx vitest run src/__tests__/dashboard.spec.ts src/__tests__/credentials.spec.ts
```

Expected: all PASS。

---

### Task 3: 回归与真实页面确认

**Files:**

- Test only; no production file changes expected.

**Interfaces:**

- Consumes: 当前测试账户的 90 PGC 历史凭证、5 PGC 已验证凭证和 95 PGC UTXO 快照。
- Produces: 页面与真实数据一致的验收证据。

- [ ] **Step 1: 运行前端门禁**

```powershell
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

Expected: exit code 0。

- [ ] **Step 2: 部署前端后重新同步测试账户**

打开 `/wallet/security`，触发一次同步，确认：

```text
可立即支付：0 PGC
安全凭证：状态正常
暂停支付：0 项
90 PGC：ConvertedToUTXO，保留历史 FastEvidence 失败说明
5 PGC：ConvertedToUTXO，三项证据仍为 Verified
钱包总览：95 PGC UTXO 可正常发送
```

- [ ] **Step 3: 验证真正的 Active 失败仍会隔离**

使用测试 fixture 构造 `Active + FastEvidence Failed`，确认安全摘要仍显示 1 项隔离，自动选币不使用该 TXCer。

- [ ] **Step 4: 清理测试资源**

关闭临时浏览器 Profile 和前端测试进程；不清除测试账户、历史凭证或服务器业务数据。

## Acceptance Criteria

- 终态历史凭证不会触发当前隔离或暂停支付。
- Active 验签失败仍然 fail closed。
- 历史验签异常仍可审计，不被隐藏或伪造成 Verified。
- 当前 95 PGC UTXO 状态、余额和发送能力不受影响。
- 不需要后端发布或数据修复。
