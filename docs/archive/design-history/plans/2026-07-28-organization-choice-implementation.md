# Organization Choice Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve wallet organization selection with real on-demand details, clearer actions, and consistent Ledger Plane styling.

**Architecture:** Extend the existing wallet-entry service with one typed detail query backed by the existing Gateway group endpoint. Keep selection state in `WalletEntryView` and isolate accessible native-dialog behavior in a focused component.

**Tech Stack:** Vue 3, TypeScript, native HTML dialog, Vitest, Playwright, existing Gateway client and CSS tokens.

## Global Constraints

- Modify only `PanguPay-Web`.
- Add no route, dependency, backend endpoint, or fabricated organization metric.
- Preserve existing join, no-group, recovery, and wallet-transition behavior.
- Run only targeted tests plus typecheck for this focused change.

---

### Task 1: Typed organization details

**Files:**

- Modify: `src/wallet/entryService.ts`
- Modify: `src/services/walletEntryGateway.ts`
- Test: `src/__tests__/walletEntryGateway.spec.ts`

**Interfaces:**

- Add `WalletEntryOrganizationDetail` with pledge, node-count, availability, and technical fields.
- Add `WalletEntryService.organization(groupId)` and `WalletEntryGatewayPort.group(groupId)`.

- [ ] Write a failing normalization test using an authoritative `GuarGroupTable` response.
- [ ] Verify the test fails because `organization` does not exist.
- [ ] Normalize only real response fields and keep unsafe integer strings exact.
- [ ] Verify the adapter test passes.

### Task 2: Accessible detail dialog and selection layout

**Files:**

- Create: `src/components/OrganizationDetailDialog.vue`
- Modify: `src/views/wallet/WalletEntryView.vue`
- Test: `e2e/phase2.spec.ts`

**Interfaces:**

- `OrganizationDetailDialog` consumes `open`, `organization`, `detail`, `busy`, and `error`; emits `close` and `retry`.
- `WalletEntryView` loads details only after “查看详情” and leaves radio selection unchanged.

- [ ] Add a failing browser test for opening details, truthful values, closing, and unchanged selection.
- [ ] Build the native dialog with Escape, backdrop close, loading, failure, desktop modal, and mobile sheet states.
- [ ] Replace the old radio row and uneven actions with selectable rows and aligned action buttons.
- [ ] Run the Phase 2 entry test.

### Task 3: Copy cleanup and focused verification

**Files:**

- Modify: `src/views/wallet/WalletSetupView.vue`
- Modify: `e2e/phase1.spec.ts`

- [ ] Assert the redundant “用途不同，请分别保存。” copy is absent after wallet creation.
- [ ] Remove only that sentence; retain the two concrete backup explanations.
- [ ] Run targeted Phase 1 and Phase 2 browser tests, unit tests, typecheck, and the design detector.
