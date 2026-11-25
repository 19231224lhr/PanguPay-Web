<script setup lang="ts">
import { wt } from '@/i18n/walletText'

import {
  PhArrowLeft as ArrowLeft,
  PhArrowRight as ArrowRight,
  PhCheckCircle as CheckCircle,
  PhWarningCircle as WarningCircle,
  PhPaperPlaneTilt as PaperPlaneTilt,
  PhShieldCheck as ShieldCheck,
} from '@phosphor-icons/vue'
import { computed, nextTick, ref, watch } from 'vue'

import AmountField from '@/components/AmountField.vue'
import AppButton from '@/components/AppButton.vue'
import AppSelect from '@/components/AppSelect.vue'
import CurveMark from '@/components/CurveMark.vue'
import FormField from '@/components/FormField.vue'
import InlineNotice from '@/components/InlineNotice.vue'
import ProgressTimeline from '@/components/ProgressTimeline.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import WalletFigure from '@/components/WalletFigure.vue'
import WalletPaymentFigure from '@/components/WalletPaymentFigure.vue'
import { AMOUNT_SCALE, parseAmount } from '@/protocol-v2/amount'
import { useDashboardStore } from '@/stores/dashboard'
import { useTransferStore } from '@/stores/transfer'
import { useWalletStore } from '@/stores/wallet'
import {
  buildTransferTimeline,
  transferModeLabel,
  transferResultTitle,
  type TransferMode,
} from '@/transfer'
import { describeTransferIssue } from '@/transfer/errors'

const wallet = useWalletStore()
const dashboard = useDashboardStore()
const transfer = useTransferStore()
const mode = ref<TransferMode>('quick')
const source = ref(wallet.addresses[0]?.address ?? '')
const recipient = ref('')
const amount = ref('')
const composeForm = ref<HTMLFormElement>()
const validateFields = ref(false)

const sourceRecord = computed(() => wallet.addresses.find((item) => item.address === source.value))
const coinType = computed(() => Number(sourceRecord.value?.type ?? 0))
const asset = computed(() =>
  dashboard.current.assets.find((item) => {
    const symbol = ['CAL', 'BTC', 'ETH'][coinType.value] ?? `Asset ${coinType.value}`
    return item.symbol === symbol
  }),
)
const available = computed(() => asset.value?.total ?? '0')
const organization = computed(() => dashboard.current.organization)
const isMember = computed(() => !!organization.value && !['0', '1'].includes(organization.value.id))
const sourceOptions = computed(() =>
  wallet.addresses.map((address, index) => ({
    description: address.address,
    label: wt('w137', [
      ['CAL', 'BTC', 'ETH'][Number(address.type)] ?? `Asset ${address.type}`,
      index + 1,
    ]),
    monospace: true,
    value: address.address,
  })),
)
const modeOptions = computed(() => [
  { label: transferModeLabel('quick'), value: 'quick', disabled: !isMember.value },
  { label: transferModeLabel('normal'), value: 'normal' },
  { label: transferModeLabel('cross'), value: 'cross', disabled: !isMember.value },
])
const transferIssue = computed(() =>
  transfer.error ? describeTransferIssue(transfer.error) : undefined,
)
const recipientLooksCapsule = computed(() => recipient.value.trim().includes('@'))
const recipientError = computed(() => {
  if (validateFields.value) {
    const value = recipient.value.trim()
    if (mode.value === 'cross' && !/^0x[0-9a-f]{40}$/i.test(value)) return wt('w402')
    if (mode.value !== 'cross' && !recipientLooksCapsule.value && !/^[0-9a-f]{40}$/i.test(value))
      return wt('transferRecipientFormat')
  }
  if (transferIssue.value?.code === 'recipient-invalid')
    return mode.value === 'cross' ? wt('w402') : wt('transferRecipientFormat')
  return ''
})
const amountError = computed(() => {
  if (validateFields.value) {
    try {
      const units = parseAmount(amount.value)
      if (units <= 0n) return wt('w406')
      if (mode.value === 'cross' && units % AMOUNT_SCALE !== 0n) return wt('w404')
    } catch {
      return wt('w406')
    }
  }
  return transferIssue.value?.code === 'amount-invalid' ? transferIssue.value.message : ''
})
const composeIssue = computed(() =>
  recipientError.value || amountError.value ? undefined : transferIssue.value,
)

const timeline = computed(() => buildTransferTimeline(transfer.currentProgress))
const resultFailed = computed(() => {
  const progress = transfer.currentProgress
  return progress?.phase === 'failed' || (progress?.phase !== 'settled' && Boolean(progress?.crossChainError))
})
const checkingSubmission = computed(() =>
  transfer.currentProgress?.phase === 'submitting' && Boolean(transfer.currentProgress.error),
)
const resultTitle = computed(() => {
  if (resultFailed.value) return wt(transfer.currentProgress?.crossChainError ? 'w428' : 'w314')
  if (checkingSubmission.value) return wt('transferCheckingSubmission')
  return transferResultTitle(transfer.review?.mode ?? mode.value, transfer.currentProgress?.phase)
})

watch(
  isMember,
  (member) => {
    if (!member && mode.value !== 'normal') mode.value = 'normal'
  },
  { immediate: true },
)

watch([mode, source, recipient, amount], () => transfer.dismissError())

async function focusInvalidField(): Promise<void> {
  await nextTick()
  composeForm.value?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')?.focus()
}

async function prepareReview(): Promise<void> {
  if (transfer.busy) return
  transfer.dismissError()
  validateFields.value = true
  if (recipientError.value || amountError.value) {
    await focusInvalidField()
    return
  }
  validateFields.value = false
  try {
    await transfer.prepare({
      mode: mode.value,
      source: source.value,
      recipient: recipient.value,
      amount: amount.value,
      coinType: coinType.value,
    })
  } catch {
    if (recipientError.value || amountError.value) await focusInvalidField()
  }
}

async function submit(): Promise<void> {
  try {
    await transfer.submit()
  } catch {
    // Keep the signed review visible so the user can understand or retry.
  }
}

function startAnother(): void {
  transfer.startAnother()
  validateFields.value = false
  recipient.value = ''
  amount.value = ''
}
</script>

<template>
  <div class="wallet-page send-page">
    <WalletPageHeader :inline-target="$slots['header-action'] ? '#intro-send' : undefined"
      :title="wt('w210')"
      :description="
        transfer.stage === 'compose'
          ? wt('refinement51')
          : transfer.stage === 'review'
            ? wt('w212')
            : wt('w213')
      "
    ><slot name="header-action" /></WalletPageHeader>

    <form
      v-if="transfer.stage === 'compose'"
      ref="composeForm"
      class="send-form"
      @submit.prevent="prepareReview"
    >
      <div class="send-compose">
        <section class="send-panel send-addresses" aria-labelledby="send-address-heading">
          <header class="send-panel-heading">
            <div>
              <div class="send-heading-line">
                <h2 id="send-address-heading">{{ wt('refinement53') }}</h2>
                <AppSelect
                  id="send-mode"
                  v-model="mode"
                  inline
                  :label="wt('refinement52')"
                  :options="modeOptions"
                />
              </div>
              <p>{{ isMember ? wt('refinement54') : wt('w224') }}</p>
            </div>
            <WalletFigure kind="settle" />
          </header>
          <AppSelect
            id="send-source"
            v-model="source"
            :label="wt('w215')"
            :options="sourceOptions"
            :empty-label="wt('w145')"
          />
          <FormField
            id="send-recipient"
            v-model="recipient"
            :label="mode === 'cross' ? wt('w216') : wt('w144')"
            :placeholder="mode === 'cross' ? '0x…' : wt('w217')"
            :error="recipientError"
          />
          <div
            v-if="recipientLooksCapsule && !recipientError"
            class="capsule-input-status"
            :data-busy="transfer.busy || undefined"
            role="status"
          >
            <span class="capsule-input-status__icon" aria-hidden="true">
              <ShieldCheck v-if="!transfer.busy" :size="15" weight="fill" />
            </span>
            {{ mode === 'cross' ? wt('w218') : transfer.busy ? wt('w219') : wt('w220') }}
          </div>
        </section>
        <section class="send-panel send-payment" aria-labelledby="send-payment-heading">
          <header class="send-panel-heading">
            <div>
              <h2 id="send-payment-heading">{{ wt('refinement55') }}</h2>
              <p>{{ asset?.symbol ?? 'CAL' }}</p>
            </div>
            <WalletPaymentFigure />
          </header>
          <AmountField
            id="send-amount"
            v-model="amount"
            :label="wt('w221')"
            :currency="asset?.symbol ?? 'CAL'"
            placeholder="0.00"
            :error="amountError"
          />
          <div class="send-available">
            <span>{{ wt('refinement56') }}</span
            ><strong class="tabular"
              >{{ available }} <small>{{ asset?.symbol ?? 'CAL' }}</small></strong
            >
          </div>
          <InlineNotice
            v-if="composeIssue"
            class="transfer-error-notice"
            :title="composeIssue.title"
            :tone="composeIssue.tone"
          >
            {{ composeIssue.message }}
          </InlineNotice>
          <AppButton
            class="send-review-button"
            type="submit"
            :title="wt('refinement57')"
            :loading="transfer.busy"
          >
            {{ wt('w225') }} <template #icon><ArrowRight :size="16" aria-hidden="true" /></template>
          </AppButton>
        </section>
      </div>
    </form>

    <section v-else-if="transfer.stage === 'review' && transfer.review" class="review-plane">
      <div v-if="transfer.review.capsule" class="capsule-review-mark">
        <ShieldCheck :size="17" weight="fill" aria-hidden="true" />
        <span> {{ wt('w226') }} </span>
        <small> {{ wt('w227') }} {{ transfer.review.capsuleOrgID }}</small>
      </div>
      <div class="review-amount">
        <span> {{ wt('w228') }} </span>
        <strong class="tabular">{{ transfer.review.amount }}</strong>
        <b>{{ asset?.symbol ?? 'CAL' }}</b>
      </div>
      <dl class="review-details">
        <div>
          <dt>{{ wt('w229') }}</dt>
          <dd>
            {{ transferModeLabel(transfer.review.mode) }}
          </dd>
        </div>
        <div>
          <dt>{{ transfer.review.capsule ? wt('w135') : wt('w144') }}</dt>
          <dd class="mono">{{ transfer.review.recipientInput }}</dd>
        </div>
        <div v-if="transfer.review.capsule">
          <dt>{{ wt('w230') }}</dt>
          <dd class="mono">{{ transfer.review.recipient }}</dd>
        </div>
        <div>
          <dt>{{ wt('w231') }}</dt>
          <dd>{{ transfer.review.selection.utxos.length }}</dd>
        </div>
        <div>
          <dt>{{ wt('w232') }}</dt>
          <dd>{{ transfer.review.selection.txCers.length }}</dd>
        </div>
        <div>
          <dt>{{ wt('w233') }}</dt>
          <dd class="tabular">
            {{ transfer.review.selection.change }} {{ asset?.symbol ?? 'CAL' }}
          </dd>
        </div>
        <div>
          <dt>{{ wt('w234') }}</dt>
          <dd class="mono">{{ transfer.review.built.txID }}</dd>
        </div>
      </dl>
      <InlineNotice
        v-if="transferIssue"
        class="transfer-error-notice"
        :title="transferIssue.code === 'unknown' ? wt('w418') : transferIssue.title"
        :tone="transferIssue.tone"
      >
        {{ transferIssue.message }}
      </InlineNotice>
      <div class="review-actions">
        <AppButton variant="secondary" :disabled="transfer.busy" @click="transfer.cancelReview">
          <ArrowLeft :size="18" /> {{ wt('w235') }}
        </AppButton>
        <AppButton
          :loading="transfer.busy"
          @click="submit"
        >
          <PaperPlaneTilt :size="18" /> {{ wt('w236') }}
        </AppButton>
      </div>
    </section>

    <section v-else-if="transfer.stage === 'result' && transfer.review" class="result-plane">
      <header class="result-heading">
        <CheckCircle v-if="transfer.currentProgress?.phase === 'settled'" class="result-success" :size="30" weight="fill" aria-hidden="true" />
        <span v-else-if="resultFailed" class="result-error" aria-hidden="true">
          <WarningCircle :size="20" />
        </span>
        <CurveMark v-else class="result-wait" variant="link" :size="30" />
        <div role="status">
          <h2>{{ resultTitle }}</h2>
          <p class="mono">{{ transfer.review.built.txID }}</p>
          <p v-if="checkingSubmission" class="result-status-detail">{{ wt('w515') }}</p>
        </div>
      </header>
      <div class="result-body">
        <ProgressTimeline :items="timeline" />
        <div class="result-illustration" aria-hidden="true">
          <WalletFigure kind="branches" :intensity="0.4" />
        </div>
      </div>
      <div class="result-actions">
        <AppButton variant="secondary" to="/wallet#activity"> {{ wt('w237') }} </AppButton>
        <AppButton @click="startAnother"> {{ wt('w238') }} </AppButton>
      </div>
    </section>
  </div>
</template>

<style scoped>
.send-page {
  width: 100%;
  gap: 20px;
  --send-surface: color-mix(in srgb, var(--surface) 55%, var(--background));
  container-type: inline-size;
}
.send-form {
  display: grid;
  border: 1px solid var(--hairline);
  border-radius: 16px;
  background: var(--send-surface);
  --figure-plate: var(--send-surface);
}
.send-heading-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
}
.send-compose {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.send-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 12px 24px 16px;
}
.send-panel + .send-panel {
  border-left: 1px solid var(--hairline);
}
.send-panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 64px;
}
.send-panel-heading h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}
.send-panel-heading p {
  margin: 8px 0 0;
  font-size: 0.75rem;
  color: var(--text-muted);
}
.send-panel-heading .wallet-figure {
  width: 80px;
}
.send-payment :deep(.form-field__control) {
  min-height: 56px;
}
.send-payment :deep(input) {
  font-size: 1.5rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
}
.send-available {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.75rem;
  color: var(--text-muted);
}
.send-available strong {
  color: var(--text);
  font-weight: 500;
  font-size: 0.95rem;
}
.send-available small {
  color: var(--text-muted);
  font-size: 0.75rem;
}
.send-review-button {
  margin-block-start: auto;
}
#app .send-review-button {
  align-self: flex-end;
  min-height: 44px;
  padding: 0.6rem 1.125rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--action-primary);
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  box-shadow: none;
  backdrop-filter: none;
}
#app .send-review-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
@media (hover: hover) and (pointer: fine) {
  #app .send-review-button:hover:not(:disabled) {
    background: var(--action-primary-hover);
  }
}
@container (max-width: 640px) {
  .send-compose {
    grid-template-columns: 1fr;
  }
  .send-panel + .send-panel {
    border-left: 0;
    border-top: 1px solid var(--hairline);
  }
  .send-panel {
    padding: 12px 16px 20px;
    gap: 16px;
  }
  .send-panel-heading {
    min-height: 64px;
  }
  .send-panel-heading .wallet-figure {
    width: 80px;
  }
  .send-review-button {
    width: 100%;
  }
}
.capsule-input-status {
  display: flex;
  align-items: center;
  min-height: 24px;
  gap: 0.48rem;
  margin-top: -0.55rem;
  color: var(--text-muted);
  font-size: 0.72rem;
  line-height: 1.45;
}
.capsule-input-status__icon {
  display: grid;
  width: 16px;
  height: 16px;
  color: var(--accent);
  place-items: center;
}
.capsule-input-status[data-busy] .capsule-input-status__icon {
  border: 1.5px solid color-mix(in srgb, var(--accent) 28%, transparent);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: capsule-spin 720ms linear infinite;
}
.send-page :deep(.transfer-error-notice.inline-notice) {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 10px;
  min-height: auto;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--notice-color) 5%, var(--send-surface));
}
.send-page :deep(.transfer-error-notice .inline-notice__icon) {
  width: 16px;
  height: 16px;
  padding: 4px;
}
.send-page :deep(.transfer-error-notice .inline-notice__body) {
  overflow-wrap: anywhere;
}
.send-page :deep(.form-field--error .form-field__control) {
  box-shadow: none;
  animation: none;
}
.send-page :deep(.form-field--error .form-field__control:focus-within) {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--danger) 45%, transparent);
}
.send-page :deep(.form-field__error) {
  padding-inline: 2px;
}
.review-plane,
.result-plane {
  display: grid;
  gap: 1.35rem;
  width: 100%;
  padding: clamp(1.1rem, 2.4vw, 1.6rem);
  border: 1px solid var(--hairline);
  border-radius: 16px;
  background: var(--send-surface);
}
.capsule-review-mark {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--accent);
  font-size: 0.78rem;
  font-weight: 650;
}
.capsule-review-mark small {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 0.7rem;
  font-weight: 500;
}
.review-amount {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: end;
  gap: 0.15rem 0.65rem;
  padding-bottom: 1.1rem;
  border-bottom: 1px solid var(--hairline);
}
.review-amount span {
  grid-column: 1 / -1;
  color: var(--text-muted);
  font-size: 0.78rem;
}
.review-amount strong {
  font-size: clamp(2.5rem, 7vw, 4.5rem);
  font-weight: 560;
  letter-spacing: -0.065em;
  line-height: 0.95;
}
.review-amount b {
  color: var(--text-muted);
  font-size: 0.9rem;
}
.review-details {
  display: grid;
  margin: 0;
}
.review-details > div {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  gap: 1rem;
  padding-block: 0.8rem;
  border-bottom: 1px solid var(--hairline);
}
.review-details dt {
  color: var(--text-muted);
  font-size: 0.78rem;
}
.review-details dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 0.82rem;
  text-align: right;
}
.mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
.review-actions,
.result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
}
.review-actions { justify-content: flex-end; }
.review-plane > .transfer-error-notice {
  width: min(100%, 38rem);
  justify-self: end;
}
.result-actions { justify-content: flex-start; }
.result-body {
  display: grid;
  align-items: center;
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.65fr);
  gap: clamp(1.25rem, 5cqi, 3.75rem);
}
.result-illustration {
  display: grid;
  place-items: center;
}
.result-illustration .wallet-figure {
  width: min(100%, clamp(9rem, 23cqi, 16rem));
}
@container (max-width: 560px) {
  .result-body { grid-template-columns: minmax(0, 1fr); }
  .result-illustration { display: none; }
}
.result-heading {
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
}
.result-heading > svg { flex: none; color: var(--accent); }
.result-heading > .result-wait { color: var(--text); }
.result-heading > .result-success { color: var(--success); }
.result-error {
  display: inline-grid;
  flex: none;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  color: var(--danger);
}
.result-heading h2 {
  margin: 0;
  font-size: 1.35rem;
  letter-spacing: -0.035em;
}
.result-heading p {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
  font-size: 0.72rem;
  overflow-wrap: anywhere;
}
.result-heading .result-status-detail {
  max-width: 55ch;
  font-size: 0.78rem;
  line-height: 1.55;
}
.result-body :deep(.timeline__item--error strong) {
  color: var(--danger);
}
@keyframes capsule-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 599px) {
  .review-actions,
  .result-actions {
    display: grid;
    grid-template-columns: 1fr;
  }
  .review-details > div {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }
  .review-details dd {
    text-align: left;
  }
}

@media (prefers-reduced-motion: reduce) {
  .capsule-input-status[data-busy] .capsule-input-status__icon {
    animation: none;
  }
}
</style>
