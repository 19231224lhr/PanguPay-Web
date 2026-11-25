<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { activityAssetSymbol } from '@/composables/useWalletActivities'
import { wt } from '@/i18n/walletText'
import { GatewayClient } from '@/services/gatewayClient'
import {
  formatTransactionReference,
  readTransactionConstruction,
  type TransactionConstruction,
} from '@/transfer/construction'
import type { TransferProgress } from '@/transfer/journal'
import { certifiedGQNCTransactions } from '@/transfer/workflow'

const props = defineProps<{
  txId: string
  active: boolean
  progress?: TransferProgress
  observed?: TransactionConstruction
  highlightedOutput?: number
  asset: string
}>()

const certified = shallowRef<TransactionConstruction>()
const construction = computed(() => props.progress?.construction ?? certified.value ?? props.observed)
const loading = ref(false)
const attempted = ref(false)

async function loadConstruction() {
  const height = props.progress?.certifiedHeight
  if (!props.active || construction.value || !height || loading.value) return
  loading.value = true
  attempted.value = true
  try {
    const response = await new GatewayClient().gqncCertifiedBlock(height)
    const transaction = certifiedGQNCTransactions(response).find((candidate) =>
      String(candidate.TXID ?? candidate.txID ?? '').toLowerCase() === props.txId.toLowerCase(),
    )
    certified.value = readTransactionConstruction(transaction)
  } catch {
    // The journal can still show the known recipient while chain data is unavailable.
  } finally {
    loading.value = false
  }
}

watch(() => props.active ? props.progress?.certifiedHeight : undefined, loadConstruction, {
  immediate: true,
})

function outputLabel(address: string, index: number): string {
  if (index === 0 && props.progress?.recipient.toLowerCase() === address.toLowerCase())
    return wt('w144')
  if (props.progress && index > 0 && construction.value?.inputs.some(
    (input) => input.address?.toLowerCase() === address.toLowerCase(),
  )) return wt('w233')
  return `#${index}`
}

function utxoQuery(txId: string, outputIndex?: number, height?: number) {
  return {
    tx: formatTransactionReference({ txId, outputIndex }),
    height: height == null ? undefined : String(height),
  }
}
</script>

<template>
  <div class="transaction-construction">
    <h3>{{ wt('activityConstruction') }}</h3>
    <div v-if="construction" class="construction-grid">
      <div>
        <h4>{{ wt('activityInputs') }} <span>{{ construction.inputs.length }}</span></h4>
        <ol>
          <li v-for="(input, index) in construction.inputs" :key="index">
            <div class="construction-line">
              <strong>{{ input.kind === 'utxo' ? 'UTXO' : 'TXCer' }}</strong>
              <span v-if="input.amount != null" class="tabular">{{ input.amount }} {{ asset }}</span>
            </div>
            <code v-if="input.address">{{ input.address }}</code>
            <small v-if="input.reference">
              <RouterLink
                v-if="input.kind === 'utxo' && /^[0-9a-f]{64}$/i.test(input.reference)"
                class="construction-reference"
                :to="{ path: '/wallet', hash: '#blockchain', query: utxoQuery(input.reference, input.outputIndex, input.sourceHeight) }"
              >
                <code>{{ formatTransactionReference({ txId: input.reference, outputIndex: input.outputIndex }) }}</code>
              </RouterLink>
              <template v-else>
                <code>{{ input.reference }}</code>
                <span v-if="input.outputIndex != null" class="output-index">#{{ input.outputIndex }}</span>
              </template>
            </small>
          </li>
        </ol>
      </div>
      <div>
        <h4>{{ wt('activityOutputs') }} <span>{{ construction.outputs.length }}</span></h4>
        <ol>
          <li
            v-for="(output, index) in construction.outputs"
            :key="output.index ?? index"
            :data-highlighted-output="highlightedOutput === (output.index ?? index) || undefined"
          >
            <div class="construction-line">
              <strong>{{ outputLabel(output.address, output.index ?? index) }}</strong>
              <span class="tabular">
                {{ output.amount }} {{ output.coinType == null ? asset : activityAssetSymbol(output.coinType) }}
              </span>
            </div>
            <code>{{ output.address }}</code>
          </li>
        </ol>
      </div>
    </div>
    <template v-else>
      <dl v-if="progress" class="construction-recipient">
        <dt>{{ wt('w144') }}</dt>
        <dd><code>{{ progress.recipient }}</code></dd>
        <dd class="tabular">{{ progress.amount }} {{ asset }}</dd>
      </dl>
      <p v-if="loading" role="status">{{ wt('activityConstructionLoading') }}</p>
      <p v-else-if="attempted || !progress?.certifiedHeight" class="construction-feedback">
        {{ wt('activityConstructionUnavailable') }}
        <button v-if="attempted" type="button" @click="loadConstruction">{{ wt('refinement26') }}</button>
      </p>
    </template>
  </div>
</template>

<style scoped>
.transaction-construction {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding-inline: 12px;
  overflow-wrap: anywhere;
}

h3,
h4,
p,
dl,
dd,
ol {
  margin: 0;
}

h3 {
  font-size: 0.86rem;
  font-weight: 620;
}

.construction-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  gap: 16px 24px;
}

h4,
.construction-line,
.construction-recipient {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 8px;
}

h4 {
  padding-bottom: 8px;
  border-bottom: 1px solid var(--hairline);
  font-size: 0.75rem;
}

h4 span,
small,
p,
dt {
  color: var(--text-muted);
}

ol {
  padding: 0;
  list-style: none;
}

li {
  display: grid;
  gap: 4px;
  padding-block: 8px;
}

li + li {
  border-top: 1px solid var(--hairline);
}

.construction-line {
  justify-content: space-between;
}

li,
.construction-recipient,
p {
  font-size: 0.75rem;
}

code {
  font-family: var(--font-mono);
  user-select: all;
}

.output-index {
  margin-inline-start: 6px;
}

.construction-reference {
  color: var(--wallet-selection-ink, var(--accent));
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

.construction-reference code {
  user-select: auto;
}

li[data-highlighted-output] {
  padding-inline: 8px;
  border-radius: var(--radius-sm);
  background: var(--selection-rail);
}

.construction-feedback button {
  min-height: 32px;
  margin-inline-start: 4px;
  padding-inline: 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--wallet-selection-ink, var(--accent));
  cursor: pointer;
}

.construction-feedback button:hover {
  background: var(--surface-hover);
}
</style>
