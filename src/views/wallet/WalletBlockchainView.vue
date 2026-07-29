<script setup lang="ts">
import {
  PhArrowClockwise as ArrowClockwise,
  PhCheckCircle as CheckCircle,
  PhCube as Cube,
  PhShieldCheck as ShieldCheck,
} from '@phosphor-icons/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import AppButton from '@/components/AppButton.vue'
import StatusLabel from '@/components/StatusLabel.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import { GatewayClient } from '@/services/gatewayClient'
import {
  normalizeGQNCBlock,
  normalizeGQNCStatus,
  recentCertifiedHeights,
  type GQNCBlockView,
  type GQNCStatusView,
} from '@/wallet/gqncExplorer'

const client = new GatewayClient()
const status = ref<GQNCStatusView>()
const blocks = ref<GQNCBlockView[]>([])
const selectedHeight = ref<number>()
const loading = ref(false)
const error = ref('')
const pulseHeight = ref<number>()
const cache = new Map<number, GQNCBlockView>()
let timer: ReturnType<typeof setInterval> | undefined

const selected = computed(() => blocks.value.find((block) => block.height === selectedHeight.value))

async function loadBlock(height: number): Promise<GQNCBlockView> {
  const cached = cache.get(height)
  if (cached) return cached
  const block = normalizeGQNCBlock(await client.gqncCertifiedBlock(height))
  cache.set(height, block)
  return block
}

async function loadBlocks(heights: number[]): Promise<GQNCBlockView[]> {
  const output: GQNCBlockView[] = []
  for (let index = 0; index < heights.length; index += 4) {
    output.push(...(await Promise.all(heights.slice(index, index + 4).map(loadBlock))))
  }
  return output
}

async function refresh(manual = false): Promise<void> {
  if (loading.value) return
  loading.value = true
  if (manual) error.value = ''
  try {
    const nextStatus = normalizeGQNCStatus(await client.gqncStatus())
    const previousTip = status.value?.certifiedHeight
    status.value = nextStatus
    blocks.value = await loadBlocks(recentCertifiedHeights(nextStatus.certifiedHeight))
    selectedHeight.value ??= blocks.value[0]?.height
    if (previousTip != null && nextStatus.certifiedHeight > previousTip) {
      pulseHeight.value = nextStatus.certifiedHeight
      window.setTimeout(() => (pulseHeight.value = undefined), 900)
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '无法读取认证链。'
  } finally {
    loading.value = false
  }
}

function time(timestamp: number): string {
  if (!timestamp) return '未提供'
  const milliseconds = timestamp < 10_000_000_000 ? timestamp * 1_000 : timestamp
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(milliseconds)
}

onMounted(() => {
  void refresh()
  timer = setInterval(() => void refresh(), 3_000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="wallet-page chain-page">
    <WalletPageHeader
      title="本地认证链"
      description="查看担保委员会已认证的 GQNC 区块、交易与 3-of-4 BlockQC。"
    />

    <section class="chain-status" aria-label="委员会状态">
      <div>
        <span>认证高度</span>
        <strong class="tabular">{{ status?.certifiedHeight ?? '—' }}</strong>
      </div>
      <div>
        <span>法定人数</span>
        <strong>{{ status ? `${status.quorum}-of-${status.validatorCount}` : '—' }}</strong>
      </div>
      <div>
        <span>当前视图</span>
        <strong class="tabular">{{ status?.currentView ?? '—' }}</strong>
      </div>
      <div class="chain-status__safety">
        <StatusLabel :tone="status?.safetyStatus === 'NORMAL' ? 'success' : 'warning'">
          {{ status?.safetyStatus || '读取中' }}
        </StatusLabel>
        <AppButton variant="ghost" :loading="loading" @click="refresh(true)">
          <ArrowClockwise :size="17" />刷新
        </AppButton>
      </div>
    </section>

    <p v-if="error" class="wallet-notice wallet-notice--warning">{{ error }}</p>

    <section class="chain-ledger" aria-labelledby="chain-ledger-title">
      <header>
        <div>
          <span>认证序列</span>
          <h2 id="chain-ledger-title">最近区块</h2>
        </div>
        <small>{{ status?.protocolVersion || 'GQNC' }}</small>
      </header>
      <div v-if="blocks.length" class="chain-flow">
        <button
          v-for="block in blocks"
          :key="block.height"
          type="button"
          :class="{
            selected: block.height === selectedHeight,
            pulse: block.height === pulseHeight,
          }"
          @click="selectedHeight = block.height"
        >
          <span class="chain-flow__node"><Cube :size="18" weight="duotone" /></span>
          <span
            ><b>#{{ block.height }}</b
            ><small>{{ block.transactionCount }} 笔交易</small></span
          >
          <CheckCircle :size="17" weight="fill" aria-hidden="true" />
        </button>
      </div>
      <div v-else-if="!loading" class="wallet-empty">当前没有可展示的认证区块。</div>
    </section>

    <section v-if="selected" class="block-detail" aria-labelledby="block-detail-title">
      <header>
        <div>
          <span>区块详情</span>
          <h2 id="block-detail-title">高度 #{{ selected.height }}</h2>
        </div>
        <span class="block-detail__qc"
          ><ShieldCheck :size="17" />{{ selected.qcSigners.length }} 个签名</span
        >
      </header>
      <dl>
        <div>
          <dt>区块哈希</dt>
          <dd>{{ selected.hash || '未提供' }}</dd>
        </div>
        <div>
          <dt>提案者</dt>
          <dd>{{ selected.proposerId || '未提供' }}</dd>
        </div>
        <div>
          <dt>认证时间</dt>
          <dd>{{ time(selected.timestamp) }}</dd>
        </div>
        <div>
          <dt>QC ID</dt>
          <dd>{{ selected.qcId || '未提供' }}</dd>
        </div>
      </dl>
      <div class="block-transactions">
        <h3>区块内交易</h3>
        <ol v-if="selected.transactionIds.length">
          <li v-for="txID in selected.transactionIds" :key="txID">{{ txID }}</li>
        </ol>
        <p v-else>该区块未返回可展示的交易 ID。</p>
      </div>
      <details>
        <summary>查看 QC 签名者</summary>
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
.chain-status {
  display: grid;
  grid-template-columns: repeat(3, minmax(120px, 1fr)) 1.25fr;
  border-block: 1px solid var(--hairline);
}
.chain-status > div {
  display: grid;
  gap: 0.35rem;
  padding: 1rem;
}
.chain-status > div + div {
  border-left: 1px solid var(--hairline);
}
.chain-status span,
.chain-ledger span,
.block-detail span {
  color: var(--text-muted);
  font-size: 0.72rem;
}
.chain-status strong {
  font-size: 1.2rem;
}
.chain-status__safety {
  grid-template-columns: 1fr auto;
  align-items: center;
}
.chain-ledger,
.block-detail {
  display: grid;
  gap: 1rem;
}
.chain-ledger > header,
.block-detail > header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}
.chain-ledger h2,
.block-detail h2 {
  margin: 0.15rem 0 0;
  font-size: 1.3rem;
}
.chain-flow {
  display: grid;
  grid-template-columns: repeat(6, minmax(120px, 1fr));
  gap: 0.45rem;
  overflow-x: auto;
  scrollbar-width: none;
}
.chain-flow::-webkit-scrollbar {
  display: none;
}
.chain-flow button {
  position: relative;
  display: grid;
  min-width: 120px;
  min-height: 112px;
  align-content: space-between;
  gap: 0.55rem;
  padding: 0.8rem;
  border: 1px solid var(--hairline);
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface-raised) 68%, transparent);
  color: var(--text);
  cursor: pointer;
  text-align: left;
  transition:
    background 180ms var(--ease-standard),
    transform 180ms var(--ease-standard);
}
.chain-flow button::after {
  position: absolute;
  top: 25px;
  right: -8px;
  width: 15px;
  height: 1px;
  background: var(--hairline);
  content: '';
}
.chain-flow button:last-child::after {
  display: none;
}
.chain-flow button.selected {
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
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
.block-detail {
  padding-top: 1rem;
  border-top: 1px solid var(--hairline);
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
  border-top: 1px solid var(--hairline);
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
  min-height: 44px;
  cursor: pointer;
  color: var(--text-muted);
}
@keyframes certified-pulse {
  45% {
    box-shadow: 0 0 0 8px color-mix(in srgb, var(--accent) 10%, transparent);
    transform: translateY(-2px);
  }
}
@media (max-width: 760px) {
  .chain-status {
    grid-template-columns: repeat(2, 1fr);
  }
  .chain-status > div:nth-child(3) {
    border-left: 0;
    border-top: 1px solid var(--hairline);
  }
  .chain-status > div:nth-child(4) {
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
@media (prefers-reduced-motion: reduce) {
  .chain-flow button.pulse {
    animation: none;
  }
}
</style>
