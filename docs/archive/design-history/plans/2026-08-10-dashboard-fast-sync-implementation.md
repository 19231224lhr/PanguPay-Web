# Dashboard Fast Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the wallet balance refresh finish after the address, organization, and lightweight TXCer lifecycle requests while credential and activity enrichment continues in the background.

**Architecture:** Keep `useDashboardStore` as the single synchronization boundary. Split its existing `sync()` body into a fast snapshot commit and a generation-guarded detail refresh; cache successful organization authority responses in two in-memory maps.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest.

## Global Constraints

- Modify only `PanguPay-Web` frontend behavior.
- Add no dependency, backend API, persistent cache schema, or protocol change.
- Preserve precise amounts, offline cache fallback, TXCer isolation rules, and current dirty worktree changes.

---

### Task 1: Lock the synchronization contract with tests

**Files:**

- Create: `src/__tests__/dashboardSync.spec.ts`

**Interfaces:**

- Consumes: `useDashboardStore().sync(manual?: boolean): Promise<void>`.
- Produces: regression coverage for fast completion, no health preflight, exact TXCer/UTXO accounting, and authority response reuse.

- [ ] **Step 1: Write the failing fast-completion test**

Mock `GatewayClient` so address, organization, and TXCer lifecycle queries resolve immediately while activity and credential detail requests remain pending. Start `sync(true)`, flush the fast promises, and assert that `loading` is already false, the live balance is visible, and `health()` was never called. Resolve pending requests before the test exits.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:unit -- src/__tests__/dashboardSync.spec.ts`

Expected: FAIL because the current `sync()` awaits `health()` and all detail requests.

- [ ] **Step 3: Add the authority-cache regression test**

Run two completed synchronizations for the same organization and assert `groupInfo('10000000')` and `certifiers('10000000')` are each called once.

- [ ] **Step 4: Add the conversion accounting regression test**

When an Active TXCer has converted into an address UTXO, the fast snapshot must use the current lifecycle response and count the amount only once.

### Task 2: Split fast and detailed synchronization

**Files:**

- Modify: `src/stores/dashboard.ts:34-166`

**Interfaces:**

- Produces: `sync(manual?: boolean): Promise<void>` that resolves after the fast snapshot commit.
- Internal: `refreshDetails(...)` applies only when its generation is still current.

- [ ] **Step 1: Implement the minimal fast phase**

Remove `client.health()`. Fetch addresses, group membership, and the known organization's TXCer lifecycle in parallel. Build a live snapshot with exact UTXO/TXCer accounting, preserve credential/activity detail until enrichment finishes, save it, clear `loading`, and return. On first organization discovery, fetch lifecycle once before publishing the balance.

- [ ] **Step 2: Move existing detail work behind a generation guard**

Start `refreshDetails` without awaiting it. Reuse the current normalization code, merge its result onto the latest balance snapshot, and skip application when a newer sync or `reset()` increments the generation.

- [ ] **Step 3: Cache successful authority responses**

Use one `Map<string, unknown>` for GroupInfo and one for Certifiers. Cache only successful values and clear both maps in `reset()`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm run test:unit -- src/__tests__/dashboardSync.spec.ts src/__tests__/dashboard.spec.ts src/__tests__/gatewayDashboard.spec.ts`

Expected: PASS.

- [ ] **Step 5: Run static gates and real timing**

Run: `npm run typecheck` and `npm run lint`.

Then click the real dashboard Sync button and measure button-start to button-ready in a single browser operation. Expected perceived completion for a returning member: one parallel address/organization/lifecycle round trip instead of four sequential rounds.
