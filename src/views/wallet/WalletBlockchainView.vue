<script setup lang="ts">
import { smoothDetails as vSmoothDetails } from '@/directives/smoothDetails'
import { wCount, wt, wl, walletLocale } from '@/i18n/walletText'

import {
  PhArrowClockwise as ArrowClockwise,
  PhCaretDown as CaretDown,
  PhCheckCircle as CheckCircle,
  PhCube as Cube,
  PhMagnifyingGlass as MagnifyingGlass,
  PhShieldCheck as ShieldCheck,
} from '@phosphor-icons/vue'
import { computed, inject, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { routeLocationKey, routerKey } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import StatusLabel from '@/components/StatusLabel.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import WalletPagedRows from '@/components/WalletPagedRows.vue'
import WalletCopyButton from '@/components/WalletCopyButton.vue'
import WalletTransactionConstruction from '@/components/WalletTransactionConstruction.vue'
import { useWalletNetwork } from '@/composables/useWalletNetwork'
import { GatewayClient } from '@/services/gatewayClient'
import {
  formatTransactionReference,
  parseTransactionReference,
  type TransactionReference,
} from '@/transfer/construction'
import { findCertifiedTransaction, type CertifiedTransactionView } from '@/wallet/gqncExplorer'

const {
  chainStatus: status,
  chainLoading: loading,
  chainError: error,
  blocks,
  missingBlocks: missingCount,
  refreshChain,
} = useWalletNetwork()
const selectedHeight = ref<number>()
const pulseHeight = ref<number>()
let pulseTimer: ReturnType<typeof setTimeout> | undefined

const route = inject(routeLocationKey, undefined)
const router = inject(routerKey, undefined)
const lookupSection = ref<HTMLElement>()
const lookupInput = ref('')
const lookupLoading = ref(false)
const lookupMessage = ref<'invalid' | 'missing' | 'error'>()
const lookupResult = shallowRef<CertifiedTransactionView>()
const lookupReference = shallowRef<TransactionReference>()
let lookupRequest = 0

const selected = computed(() => {
  const found = lookupResult.value?.block
  return blocks.value.find((block) => block.height === selectedHeight.value) ??
    (found?.height === selectedHeight.value ? found : undefined) ??
    blocks.value[0]
})
const selectedOutput = computed(() => {
  const outputIndex = lookupReference.value?.outputIndex
  return lookupResult.value?.construction?.outputs.find(
    (output, index) => (output.index ?? index) === outputIndex,
  )
})
const lookupStatusKey = {
  invalid: 'chainLookupInvalid',
  missing: 'chainLookupMissing',
  error: 'chainLookupError',
} as const

async function searchTransaction(heightHint?: number): Promise<void> {
  const request = ++lookupRequest
  const reference = parseTransactionReference(lookupInput.value)
  lookupMessage.value = reference ? undefined : 'invalid'
  lookupReference.value = reference
  lookupResult.value = undefined
  lookupLoading.value = Boolean(reference)
  if (!reference) return

  const knownHeight = blocks.value.find((block) => block.transactionIds.includes(reference.txId))?.height
  try {
    const found = await findCertifiedTransaction(
      new GatewayClient(),
      reference.txId,
      heightHint ?? knownHeight,
    )
    if (request !== lookupRequest) return
    if (found) {
      lookupResult.value = found
      selectedHeight.value = found.block.height
    } else {
      lookupMessage.value = 'missing'
    }
  } catch {
    if (request === lookupRequest) lookupMessage.value = 'error'
  } finally {
    if (request === lookupRequest) lookupLoading.value = false
  }
}

function openBlockTransaction(txId: string, height: number) {
  lookupInput.value = txId
  lookupSection.value?.scrollIntoView?.({ block: 'nearest' })
  submitLookup(height)
}

function submitLookup(height?: number) {
  const reference = parseTransactionReference(lookupInput.value)
  if (!reference || !router || !route) {
    void searchTransaction(height)
    return
  }
  const tx = formatTransactionReference(reference)
  const heightParam = height == null ? undefined : String(height)
  if (route.query.tx === tx && route.query.height === heightParam) {
    void searchTransaction(height)
    return
  }
  void router.replace({ query: { ...route.query, tx, height: heightParam }, hash: route.hash })
}

watch(
  [() => route?.query.tx, () => route?.query.height],
  ([value, rawHeight]) => {
    if (typeof value !== 'string') return
    lookupInput.value = value
    const height = typeof rawHeight === 'string' && /^\d+$/.test(rawHeight) ? Number(rawHeight) : undefined
    void searchTransaction(Number.isSafeInteger(height) ? height : undefined)
  },
  { immediate: true },
)

const safetyLabel = computed(() => {
  if (error.value) return wt('w315')
  const safety = status.value?.safetyStatus
  return safety === 'NORMAL' ? wt('w181') : safety || wt('w19')
})

watch(
  () => status.value?.certifiedHeight,
  (height, previous) => {
    if (height == null || previous == null || height <= previous) return
    pulseHeight.value = height
    clearTimeout(pulseTimer)
    pulseTimer = setTimeout(() => (pulseHeight.value = undefined), 900)
  },
)

function time(timestamp: number): string {
  if (!timestamp) return wt('w12')
  const milliseconds = timestamp < 10_000_000_000 ? timestamp * 1_000 : timestamp
  return new Intl.DateTimeFormat(walletLocale(), {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(milliseconds)
}

onBeforeUnmount(() => {
  clearTimeout(pulseTimer)
  lookupRequest += 1
})
</script>

<template>
  <div class="wallet-page wallet-refined chain-page">
    <Teleport v-if="$slots['header-action']" defer to="#intro-blockchain">
      <slot name="header-action" />
    </Teleport>
    <WalletPageHeader v-else :title="wt('w13')" :description="wt('w14')" />

    <Teleport defer to="#overview-chain-status" :disabled="!$slots['header-action']">
      <section
        class="chain-status"
        :class="{ 'overview-summary-metrics': $slots['header-action'] }"
        :aria-label="wt('w15')"
      >
        <div :class="{ 'overview-summary-metrics__primary': $slots['header-action'] }">
          <span> {{ wt('w16') }} </span>
          <strong class="tabular">{{ status?.certifiedHeight ?? '—' }}</strong>
        </div>
        <div>
          <span> {{ wt('w17') }} </span>
          <strong>{{ status ? `${status.quorum}-of-${status.validatorCount}` : '—' }}</strong>
        </div>
        <div>
          <span> {{ wt('w18') }} </span>
          <strong class="tabular">{{ status?.currentView ?? '—' }}</strong>
        </div>
        <Teleport defer to="#overview-chain-footer" :disabled="!$slots['header-action']">
          <div class="chain-status__safety" :class="{ 'chain-safety-inline': $slots['header-action'] }">
            <StatusLabel :tone="!error && status?.safetyStatus === 'NORMAL' ? 'success' : 'warning'">
              {{ safetyLabel }}
            </StatusLabel>
            <AppButton variant="ghost" :disabled="loading" :aria-busy="loading ? 'true' : undefined" @click="refreshChain()">
              <ArrowClockwise :size="15" aria-hidden="true" /> {{ wt('w20') }}
            </AppButton>
          </div>
        </Teleport>
      </section>
    </Teleport>

    <p v-if="error" class="wallet-notice wallet-notice--warning" role="status">
      {{ status ? wt('networkCachedData') : wl(error) }}
    </p>

    <section ref="lookupSection" class="chain-lookup" aria-labelledby="chain-lookup-title">
      <h2 id="chain-lookup-title">{{ wt('chainLookupTitle') }}</h2>
      <form @submit.prevent="submitLookup()">
        <label class="sr-only" for="chain-transaction-query">{{ wt('chainLookupPlaceholder') }}</label>
        <input
          id="chain-transaction-query"
          v-model="lookupInput"
          type="search"
          :placeholder="wt('chainLookupPlaceholder')"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :aria-invalid="lookupMessage === 'invalid' || undefined"
        />
        <AppButton type="submit" variant="secondary" :disabled="!lookupInput.trim()" :loading="lookupLoading">
          <MagnifyingGlass :size="17" aria-hidden="true" />
          {{ wt('chainLookupSubmit') }}
        </AppButton>
      </form>
      <p v-if="lookupMessage" class="chain-load-note" role="status">
        {{ wt(lookupStatusKey[lookupMessage]) }}
      </p>
      <div v-if="lookupResult && lookupReference" class="chain-lookup-result">
        <div class="wallet-section__heading">
          <h3>{{ selectedOutput ? 'UTXO' : wt('w234') }}</h3>
          <StatusLabel tone="success">{{ wt('chainLookupHeight', [lookupResult.block.height]) }}</StatusLabel>
        </div>
        <div class="chain-lookup-id">
          <code>{{ formatTransactionReference(lookupReference) }}</code>
          <WalletCopyButton
            class="chain-lookup-copy"
            :value="formatTransactionReference(lookupReference)"
            :label="selectedOutput ? 'UTXO' : wt('w234')"
          />
        </div>
        <p v-if="lookupReference.outputIndex != null && !selectedOutput" class="chain-load-note" role="status">
          {{ wt('chainLookupOutputMissing') }}
        </p>
        <WalletTransactionConstruction
          :key="lookupReference.txId"
          :tx-id="lookupReference.txId"
          :observed="lookupResult.construction"
          :highlighted-output="lookupReference.outputIndex"
          :active="true"
          asset="CAL"
        />
      </div>
    </section>

    <section class="chain-ledger" aria-labelledby="chain-ledger-title">
      <header class="wallet-section__heading">
        <h2 id="chain-ledger-title">{{ wt('w22') }}</h2>
        <small>{{ status?.protocolVersion || 'GQNC' }}</small>
      </header>
      <div v-if="blocks.length" class="chain-flow">
        <button
          v-for="block in blocks"
          :key="block.height"
          type="button"
          :aria-pressed="block.height === selected?.height"
          :class="{
            selected: block.height === selected?.height,
            pulse: block.height === pulseHeight,
          }"
          @click="selectedHeight = block.height"
        >
          <span class="chain-flow__node"><Cube :size="18" weight="duotone" /></span>
          <span>
            <b>#{{ block.height }}</b>
            <small :class="{ 'has-transactions': block.transactionCount }">
              {{ block.transactionCount }} {{ wCount('w23', block.transactionCount) }}
            </small>
          </span>
          <CheckCircle :size="17" weight="fill" aria-hidden="true" />
        </button>
      </div>
      <p v-if="(loading && !status) || missingCount" class="chain-load-note" role="status">
        {{ loading ? wt('chainBlocksLoading') : wt('chainBlocksMissing', [missingCount]) }}
      </p>
      <div v-else-if="!blocks.length && status" class="wallet-empty">{{ wt('w24') }}</div>
    </section>

    <section v-if="selected" class="block-detail" aria-labelledby="block-detail-title">
      <header class="wallet-section__heading">
        <h2 id="block-detail-title">{{ wt('w25') }} · #{{ selected.height }}</h2>
        <span class="block-detail__qc"
          ><ShieldCheck :size="17" />{{ selected.qcSigners.length }} {{ wCount('w27', selected.qcSigners.length) }}
        </span>
      </header>
      <dl>
        <div>
          <dt>{{ wt('w28') }}</dt>
          <dd>{{ selected.hash || wt('w12') }}</dd>
        </div>
        <div>
          <dt>{{ wt('w29') }}</dt>
          <dd>{{ selected.proposerId || wt('w12') }}</dd>
        </div>
        <div v-if="selected.proposalId">
          <dt>{{ wt('chainProposalId') }}</dt>
          <dd>{{ selected.proposalId }}</dd>
        </div>
        <div>
          <dt>{{ wt('w30') }}</dt>
          <dd>{{ time(selected.timestamp) }}</dd>
        </div>
        <div>
          <dt>QC ID</dt>
          <dd>{{ selected.qcId || wt('w12') }}</dd>
        </div>
        <div v-if="selected.qcThreshold">
          <dt>{{ wt('chainQcThreshold') }}</dt>
          <dd>{{ selected.qcThreshold }}</dd>
        </div>
      </dl>
      <div class="block-transactions">
        <h3>{{ wt('w31') }}</h3>
        <WalletPagedRows
          v-if="selected.transactionIds.length"
          :key="selected.height"
          v-slot="{ rows, offset }"
          :items="selected.transactionIds"
          :label="wt('w31')"
        >
          <ol :start="offset + 1">
            <li v-for="txID in rows" :key="txID">
              <button class="block-transaction-link" type="button" @click="openBlockTransaction(txID, selected.height)">
                {{ txID }}
              </button>
            </li>
          </ol>
        </WalletPagedRows>
        <p v-else>{{ wt(selected.transactionCount ? 'w32' : 'chainBlockNoTransactions') }}</p>
      </div>
      <details v-if="selected.qcSigners.length" :key="selected.height" v-smooth-details>
        <summary>
          <span>{{ wt('w33') }}</span>
          <CaretDown :size="14" aria-hidden="true" />
        </summary>
        <ul>
          <li v-for="signer in selected.qcSigners" :key="signer">{{ signer }}</li>
        </ul>
      </details>
    </section>
  </div>
</template>

<style scoped>
.chain-page {
  display: grid;
  gap: 1.5rem;
}
.chain-status:not(.overview-summary-metrics) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(0, 1.5fr);
  border-bottom: 1px solid var(--hairline);
}
.chain-status:not(.overview-summary-metrics) > div {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
  padding: 0.75rem clamp(0.4rem, 2cqi, 1rem);
  overflow-wrap: anywhere;
}
.chain-status:not(.overview-summary-metrics) > div + div {
  border-left: 1px solid var(--hairline);
}
.chain-status:not(.overview-summary-metrics) span,
.chain-ledger span,
.block-detail span {
  color: var(--text-muted);
  font-size: 0.72rem;
}
.chain-status:not(.overview-summary-metrics) strong {
  font-size: 1.2rem;
}
.chain-status__safety {
  grid-template-columns: 1fr auto;
  align-items: center;
}
.chain-safety-inline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 6px;
}
.chain-safety-inline .app-button {
  min-height: 36px;
  padding: 0 6px;
  font-size: 0.75rem;
}
.chain-ledger,
.block-detail,
.chain-lookup {
  display: grid;
  gap: 1rem;
}
.chain-lookup h2,
.chain-lookup h3 {
  margin: 0;
}
.chain-lookup form,
.chain-lookup-id {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}
.chain-lookup input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding-inline: 12px;
  border: 1px solid var(--hairline);
  border-radius: var(--radius-sm);
  background: var(--surface-subtle);
  color: var(--text);
}
.chain-lookup input:focus-visible,
.block-transaction-link:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
.chain-lookup-result {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--hairline);
  border-radius: var(--radius-md);
}
.chain-lookup-result h3 {
  font-size: 0.9rem;
}
.chain-lookup-id code {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}
.chain-lookup-copy {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 36px;
  padding-inline: 8px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--wallet-selection-ink, var(--accent));
  font-size: 0.75rem;
  cursor: pointer;
}
.chain-lookup-copy:hover {
  background: var(--surface-hover);
}
.block-transaction-link {
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: var(--wallet-selection-ink, var(--accent));
  cursor: pointer;
  font: inherit;
  text-align: start;
  text-decoration: underline;
  text-underline-offset: 0.2em;
  overflow-wrap: anywhere;
}
.chain-load-note {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.75rem;
}
.chain-flow {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.5rem;
}
.chain-flow button {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 88px;
  align-content: space-between;
  gap: 0.55rem;
  padding: 0.8rem;
  border: 1px solid var(--hairline);
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface-raised) 68%, transparent);
  color: var(--text);
  cursor: pointer;
  text-align: left;
  overflow-wrap: anywhere;
  transition:
    background 180ms var(--ease-standard),
    transform 180ms var(--ease-standard);
}
.chain-flow button.selected {
  border-color: color-mix(in srgb, var(--accent) 48%, var(--border));
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
}
.chain-flow button > svg {
  position: absolute;
  top: 0.8rem;
  right: 0.8rem;
  color: var(--success);
}
.chain-flow button > span:nth-child(2) {
  display: grid;
  gap: 0.15rem;
}
.chain-flow button small {
  color: var(--text-muted);
}
.chain-flow button .has-transactions {
  color: var(--wallet-selection-ink, var(--accent));
}
.chain-flow__node {
  display: grid;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  place-items: center;
}
.chain-flow button.pulse {
  animation: certified-pulse 850ms var(--ease-standard);
}
.block-detail__qc {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--success) !important;
}
.block-detail dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
}
.block-detail dl div {
  display: grid;
  gap: 0.35rem;
  padding: 0.9rem 0;
  border-bottom: 1px solid var(--hairline);
}
.block-detail dl div:nth-child(even) {
  padding-left: 1rem;
  border-left: 1px solid var(--hairline);
}
.block-detail dt {
  color: var(--text-muted);
  font-size: 0.72rem;
}
.block-detail dd {
  margin: 0;
  overflow-wrap: anywhere;
  font-family: var(--font-mono);
  font-size: 0.75rem;
}
.block-transactions h3 {
  font-size: 0.95rem;
}
.block-transactions ol,
.block-detail details ul {
  display: grid;
  gap: 0.4rem;
  padding-left: 1.25rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  overflow-wrap: anywhere;
}
.block-transactions p {
  color: var(--text-muted);
}
.block-detail summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
  cursor: pointer;
  color: var(--text-muted);
  list-style: none;
}
.block-detail summary::-webkit-details-marker {
  display: none;
}
.block-detail details[open] summary svg {
  transform: rotate(180deg);
}
@keyframes certified-pulse {
  45% {
    box-shadow: 0 0 0 8px color-mix(in srgb, var(--accent) 10%, transparent);
    transform: translateY(-2px);
  }
}
@container (max-width: 740px) {
  .chain-flow {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .chain-status:not(.overview-summary-metrics) {
    grid-template-columns: repeat(2, 1fr);
  }
  .chain-status:not(.overview-summary-metrics) > div:nth-child(3) {
    border-left: 0;
    border-top: 1px solid var(--hairline);
  }
  .chain-status:not(.overview-summary-metrics) > div:nth-child(4) {
    border-top: 1px solid var(--hairline);
  }
  .block-detail dl {
    grid-template-columns: 1fr;
  }
  .block-detail dl div:nth-child(even) {
    padding-left: 0;
    border-left: 0;
  }
}
@container (max-width: 390px) {
  .chain-status:not(.overview-summary-metrics) .chain-status__safety {
    grid-template-columns: minmax(0, 1fr);
    justify-items: start;
  }
  .chain-flow {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (prefers-reduced-motion: reduce) {
  .chain-flow button.pulse {
    animation: none;
  }
}
</style>
