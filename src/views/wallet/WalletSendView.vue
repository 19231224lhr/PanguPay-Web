<script setup lang="ts">
import { wt, wl } from '@/i18n/walletText'

import {
  PhArrowLeft as ArrowLeft,
  PhArrowRight as ArrowRight,
  PhCheckCircle as CheckCircle,
  PhPaperPlaneTilt as PaperPlaneTilt,
  PhShieldCheck as ShieldCheck,
} from '@phosphor-icons/vue'
import { computed, ref, watch } from 'vue'

import AmountField from '@/components/AmountField.vue'
import AppButton from '@/components/AppButton.vue'
import AppSelect from '@/components/AppSelect.vue'
import FormField from '@/components/FormField.vue'
import InlineNotice from '@/components/InlineNotice.vue'
import ProgressTimeline from '@/components/ProgressTimeline.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import WalletFigure from '@/components/WalletFigure.vue'
import WalletMoneyFigure from '@/components/WalletMoneyFigure.vue'
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
  { label: wt('w208'), value: 'quick', disabled: !isMember.value },
  { label: wt('w209'), value: 'normal' },
  { label: wt('w49'), value: 'cross', disabled: !isMember.value },
])
const transferIssue = computed(() =>
  transfer.error ? describeTransferIssue(transfer.error) : undefined,
)
const recipientLooksCapsule = computed(() => recipient.value.trim().includes('@'))

const timeline = computed(() => buildTransferTimeline(transfer.currentProgress))
const resultTitle = computed(() =>
  transferResultTitle(transfer.review?.mode ?? mode.value, transfer.currentProgress?.phase),
)

watch(
  isMember,
  (member) => {
    if (!member && mode.value !== 'normal') mode.value = 'normal'
  },
  { immediate: true },
)

watch([mode, source, recipient, amount], () => transfer.dismissError())

async function prepareReview(): Promise<void> {
  try {
    await transfer.prepare({
      mode: mode.value,
      source: source.value,
      recipient: recipient.value,
      amount: amount.value,
      coinType: coinType.value,
    })
  } catch {
    // The store exposes a stable user-facing message.
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
  recipient.value = ''
  amount.value = ''
}
</script>

<template>
  <div class="wallet-page send-page">
    <WalletPageHeader
      :title="wt('w210')"
      :description="
        transfer.stage === 'compose'
          ? wt('refinement51')
          : transfer.stage === 'review'
            ? wt('w212')
            : wt('w213')
      "
    />

    <form v-if="transfer.stage === 'compose'" class="send-form" @submit.prevent="prepareReview">
      <div class="send-mode">
        <h2>{{ wt('refinement52') }}</h2>
        <SegmentedControl v-model="mode" :label="wt('w214')" :options="modeOptions" />
      </div>
      <div class="send-compose">
        <section class="send-panel send-addresses" aria-labelledby="send-address-heading">
          <header class="send-panel-heading">
            <div>
              <h2 id="send-address-heading">{{ wt('refinement53') }}</h2>
              <p>{{ wt('refinement54') }}</p>
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
          />
          <div
            v-if="recipientLooksCapsule"
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
            <WalletMoneyFigure />
          </header>
          <AmountField
            id="send-amount"
            v-model="amount"
            :label="wt('w221')"
            :currency="asset?.symbol ?? 'CAL'"
            placeholder="0.00"
          />
          <div class="send-available">
            <span>{{ wt('refinement56') }}</span
            ><strong class="tabular"
              >{{ available }} <small>{{ asset?.symbol ?? 'CAL' }}</small></strong
            >
          </div>
        </section>
      </div>
      <footer class="send-footer">
        <div class="send-footer-copy">
          <span>{{ transferModeLabel(mode) }}</span>
          <p v-if="!isMember">{{ wt('w224') }}</p>
          <p v-else>{{ wt('refinement57') }}</p>
        </div>
        <AppButton
          type="submit"
          size="large"
          :loading="transfer.busy"
          :status="transfer.error ? 'error' : 'idle'"
        >
          {{ wt('w225') }} <template #icon><ArrowRight :size="18" weight="bold" /></template>
        </AppButton>
      </footer>
      <InlineNotice
        v-if="transferIssue"
        class="transfer-error-notice"
        :title="wl(transferIssue.title)"
        tone="danger"
      >
        {{ wl(transferIssue.message) }}
      </InlineNotice>
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
          <dd>{{ transfer.review.selection.utxos.length }} {{ wt('w94') }}</dd>
        </div>
        <div>
          <dt>{{ wt('w232') }}</dt>
          <dd>{{ transfer.review.selection.txCers.length }} {{ wt('w94') }}</dd>
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
      <div class="review-actions">
        <AppButton variant="secondary" :disabled="transfer.busy" @click="transfer.cancelReview">
          <ArrowLeft :size="18" /> {{ wt('w235') }}
        </AppButton>
        <AppButton
          :loading="transfer.busy"
          :status="transfer.error ? 'error' : 'idle'"
          @click="submit"
        >
          <PaperPlaneTilt :size="18" /> {{ wt('w236') }}
        </AppButton>
      </div>
      <InlineNotice
        v-if="transferIssue"
        class="transfer-error-notice"
        :title="wl(transferIssue.title)"
        tone="danger"
      >
        {{ wl(transferIssue.message) }}
      </InlineNotice>
    </section>

    <section v-else-if="transfer.stage === 'result' && transfer.review" class="result-plane">
      <header class="result-heading">
        <CheckCircle :size="30" weight="fill" aria-hidden="true" />
        <div>
          <h2>{{ resultTitle }}</h2>
          <p class="mono">{{ transfer.review.built.txID }}</p>
        </div>
      </header>
      <ProgressTimeline :items="timeline" />
      <div class="result-actions">
        <AppButton variant="secondary" to="/wallet/activity"> {{ wt('w237') }} </AppButton>
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
.send-mode {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--hairline);
}
.send-mode > h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
}
.send-mode :deep(.segmented-control) {
  width: min(380px, 100%);
  min-height: 44px;
}
.send-compose {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
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
.send-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 12px 24px;
  border-top: 1px solid var(--hairline);
}
.send-footer-copy {
  min-width: 0;
}
.send-footer-copy > span {
  font-size: 0.8rem;
  font-weight: 600;
}
.send-footer-copy p {
  margin: 6px 0 0;
  color: var(--text-muted);
  font-size: 0.72rem;
  line-height: 1.6;
  max-width: 48ch;
}
.send-footer :deep(.app-button) {
  min-width: 176px;
  flex-shrink: 0;
}
.send-form > .transfer-error-notice {
  margin: 0 24px 20px;
}
@container (max-width: 640px) {
  .send-compose {
    grid-template-columns: 1fr;
  }
  .send-panel + .send-panel {
    border-left: 0;
    border-top: 1px solid var(--hairline);
  }
  .send-mode {
    gap: 12px;
    padding: 16px;
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
  .send-footer {
    padding: 16px;
    flex-wrap: wrap;
    gap: 16px;
  }
  .send-footer :deep(.app-button) {
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
  min-height: auto;
  padding: 0.95rem 1rem;
  border-color: color-mix(in srgb, var(--danger) 18%, transparent);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--danger) 11%, var(--surface-raised)) 0%,
    color-mix(in srgb, var(--danger) 5%, var(--surface)) 100%
  );
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 10%, transparent),
    0 18px 42px -34px color-mix(in srgb, var(--danger) 46%, transparent);
  backdrop-filter: blur(18px) saturate(112%);
}
.send-page :deep(.transfer-error-notice .inline-notice__icon) {
  padding: 0.34rem;
  background: color-mix(in srgb, var(--danger) 10%, transparent);
}
.send-page :deep(.transfer-error-notice .inline-notice__title) {
  color: color-mix(in srgb, var(--danger) 70%, var(--text));
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
  justify-content: flex-end;
  gap: 0.7rem;
}
.result-heading {
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
}
.result-heading > svg {
  color: var(--success);
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
