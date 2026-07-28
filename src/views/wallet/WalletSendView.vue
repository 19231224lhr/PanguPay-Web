<script setup lang="ts">
import {
  PhArrowLeft as ArrowLeft,
  PhArrowRight as ArrowRight,
  PhCheckCircle as CheckCircle,
  PhPaperPlaneTilt as PaperPlaneTilt,
} from '@phosphor-icons/vue'
import { computed, ref, watch } from 'vue'

import AmountField from '@/components/AmountField.vue'
import AppButton from '@/components/AppButton.vue'
import AppSelect from '@/components/AppSelect.vue'
import FormField from '@/components/FormField.vue'
import InlineNotice from '@/components/InlineNotice.vue'
import ProgressTimeline, { type TimelineItem } from '@/components/ProgressTimeline.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useTransferStore } from '@/stores/transfer'
import { useWalletStore } from '@/stores/wallet'
import type { TransferMode } from '@/transfer'

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
    const symbol = ['PGC', 'BTC', 'ETH'][coinType.value] ?? `Asset ${coinType.value}`
    return item.symbol === symbol
  }),
)
const available = computed(() => asset.value?.total ?? '0')
const organization = computed(() => dashboard.current.organization)
const isMember = computed(() => !!organization.value && !['0', '1'].includes(organization.value.id))
const sourceOptions = computed(() =>
  wallet.addresses.map((address, index) => ({
    description: address.address,
    label: `${['PGC', 'BTC', 'ETH'][Number(address.type)] ?? `资产 ${address.type}`} · 地址 ${index + 1}`,
    monospace: true,
    value: address.address,
  })),
)
const modeOptions = computed(() => [
  { label: '快速', value: 'quick', disabled: !isMember.value },
  { label: '普通', value: 'normal' },
  { label: '跨链', value: 'cross', disabled: !isMember.value },
])

const timeline = computed<TimelineItem[]>(() => {
  const progress = transfer.currentProgress
  const failed = progress?.phase === 'failed'
  const settled = Boolean(progress?.settledAt) || progress?.phase === 'settled'
  const spendReady = Boolean(progress?.spendReadyAt)
  const accepted =
    Boolean(progress?.acceptedAt) ||
    (!!progress && ['accepted', 'spend-ready', 'settled'].includes(progress.phase))
  const items: TimelineItem[] = [
    {
      label: '交易已被接收',
      detail: accepted ? '提交体和签名已通过入口校验。' : '正在等待入口确认。',
      state: failed ? 'error' : accepted ? 'complete' : 'active',
    },
  ]
  if (transfer.review?.mode === 'quick') {
    items.push({
      label: '收款方 TXCer Active',
      detail: spendReady
        ? '收款方已依据 Assign 权威状态确认 TXCer 可继续支付。'
        : '由收款方钱包独立确认；本设备不会用后台结算冒充 TXCer Active。',
      state: failed ? 'error' : spendReady ? 'complete' : accepted ? 'active' : 'pending',
    })
  }
  items.push({
    label: '后台本地结算',
    detail: failed
      ? progress.error || '交易未能继续推进。'
      : settled
        ? '交易已完成后台认证与结算。'
        : 'GQNC 在后台认证，不阻塞快速可用。',
    state: failed ? 'error' : settled ? 'complete' : 'pending',
  })
  return items
})

watch(
  isMember,
  (member) => {
    if (!member && mode.value !== 'normal') mode.value = 'normal'
  },
  { immediate: true },
)

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
      title="发送"
      :description="
        transfer.stage === 'compose'
          ? '选择转账路径；签名前会展示真实输入、找零和完整交易 ID。'
          : transfer.stage === 'review'
            ? '签名已经在本机生成，提交前请再次核对。'
            : '入口确认、快速可用与后台结算是三个独立状态。'
      "
    />

    <form
      v-if="transfer.stage === 'compose'"
      class="wallet-form-plane send-form"
      @submit.prevent="prepareReview"
    >
      <SegmentedControl v-model="mode" label="转账模式" :options="modeOptions" />
      <p class="mode-explanation">
        <template v-if="mode === 'quick'"
          >优先使用 Active TXCer；不足部分由普通 UTXO 补足。</template
        >
        <template v-else-if="mode === 'cross'">仅支持 PGC、单一轻计算地址和整数金额。</template>
        <template v-else-if="isMember">只使用普通 UTXO，通过当前担保组织提交。</template>
        <template v-else>散户交易直接提交委员会，不依赖担保组织。</template>
      </p>
      <AppSelect
        id="send-source"
        v-model="source"
        label="来源地址"
        :options="sourceOptions"
        empty-label="钱包中没有可用地址"
      />
      <FormField
        id="send-recipient"
        v-model="recipient"
        :label="mode === 'cross' ? '轻计算收款地址' : '收款地址'"
        :placeholder="mode === 'cross' ? '0x…' : '输入完整地址'"
      />
      <AmountField
        id="send-amount"
        v-model="amount"
        label="金额"
        :currency="asset?.symbol ?? 'PGC'"
        :help="`当前可支付 ${available} ${asset?.symbol ?? 'PGC'}`"
      />
      <InlineNotice v-if="!isMember" title="当前为独立账户" tone="info">
        你仍可使用普通转账；快速和跨链功能需要先在“担保组织”中加入组织。
      </InlineNotice>
      <InlineNotice v-if="transfer.error" title="无法生成交易" tone="danger">
        {{ transfer.error }}
      </InlineNotice>
      <AppButton type="submit" size="large" :loading="transfer.busy">
        审核交易
        <template #icon><ArrowRight :size="18" weight="bold" /></template>
      </AppButton>
    </form>

    <section v-else-if="transfer.stage === 'review' && transfer.review" class="review-plane">
      <div class="review-amount">
        <span>将发送</span>
        <strong class="tabular">{{ transfer.review.amount }}</strong>
        <b>{{ asset?.symbol ?? 'PGC' }}</b>
      </div>
      <dl class="review-details">
        <div>
          <dt>转账路径</dt>
          <dd>
            {{
              transfer.review.mode === 'quick'
                ? '快速'
                : transfer.review.mode === 'cross'
                  ? '跨链'
                  : '普通'
            }}
          </dd>
        </div>
        <div>
          <dt>收款地址</dt>
          <dd class="mono">{{ transfer.review.recipient }}</dd>
        </div>
        <div>
          <dt>普通输入</dt>
          <dd>{{ transfer.review.selection.utxos.length }} 个</dd>
        </div>
        <div>
          <dt>TXCer 输入</dt>
          <dd>{{ transfer.review.selection.txCers.length }} 个</dd>
        </div>
        <div>
          <dt>找零</dt>
          <dd class="tabular">
            {{ transfer.review.selection.change }} {{ asset?.symbol ?? 'PGC' }}
          </dd>
        </div>
        <div>
          <dt>交易 ID</dt>
          <dd class="mono">{{ transfer.review.built.txID }}</dd>
        </div>
      </dl>
      <InlineNotice v-if="transfer.error" title="提交未完成" tone="danger">
        {{ transfer.error }}
      </InlineNotice>
      <div class="review-actions">
        <AppButton variant="secondary" :disabled="transfer.busy" @click="transfer.cancelReview">
          <ArrowLeft :size="18" /> 返回修改
        </AppButton>
        <AppButton :loading="transfer.busy" @click="submit">
          <PaperPlaneTilt :size="18" /> 确认并提交
        </AppButton>
      </div>
    </section>

    <section v-else-if="transfer.stage === 'result' && transfer.review" class="result-plane">
      <header class="result-heading">
        <CheckCircle :size="30" weight="fill" aria-hidden="true" />
        <div>
          <h2>交易已进入处理流程</h2>
          <p class="mono">{{ transfer.review.built.txID }}</p>
        </div>
      </header>
      <ProgressTimeline :items="timeline" />
      <div class="result-actions">
        <AppButton variant="secondary" to="/wallet/activity">查看活动</AppButton>
        <AppButton @click="startAnother">继续发送</AppButton>
      </div>
    </section>
  </div>
</template>

<style scoped>
.send-page {
  width: min(760px, 100%);
}
.send-form {
  display: grid;
  gap: 1.05rem;
}
.mode-explanation {
  min-height: 1.35rem;
  margin: -0.35rem 0 0;
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1.5;
}
.review-plane,
.result-plane {
  display: grid;
  gap: 1.35rem;
  width: min(760px, 100%);
  padding: clamp(1.1rem, 2.4vw, 1.6rem);
  border-radius: var(--radius-lg);
  background: var(--surface);
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
</style>
