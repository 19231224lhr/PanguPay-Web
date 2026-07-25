<script setup lang="ts">
import {
  PhArrowClockwise as ArrowClockwise,
  PhArrowDown as ArrowDown,
  PhPaperPlaneTilt as PaperPlaneTilt,
} from '@phosphor-icons/vue'
import { computed, ref, watch } from 'vue'

import AppButton from '@/components/AppButton.vue'
import StatusLabel from '@/components/StatusLabel.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import { useDashboardStore } from '@/stores/dashboard'

const dashboard = useDashboardStore()
const sweep = ref(false)
const total = computed(() => dashboard.current.assets[0]?.total ?? '0')
const primaryAsset = computed(() => dashboard.current.assets[0])

watch(
  () => dashboard.revision,
  (next, previous) => {
    if (next > 0 && next !== previous) {
      sweep.value = false
      requestAnimationFrame(() => (sweep.value = true))
    }
  },
)

async function refresh(): Promise<void> {
  await dashboard.sync(true)
}
</script>

<template>
  <div class="wallet-page overview">
    <WalletPageHeader
      :eyebrow="dashboard.offline ? '离线快照' : '流动账本'"
      :title="`你好，${dashboard.current.displayName}`"
      description="快速可用与后台结算各自清晰，资产状态保持安静、准确。"
    >
      <AppButton variant="ghost" :loading="dashboard.loading" @click="refresh">
        <ArrowClockwise :size="18" />
        同步
      </AppButton>
    </WalletPageHeader>

    <section
      class="value-field"
      :class="{ 'value-field--sweep': sweep }"
      aria-labelledby="total-assets"
    >
      <div class="value-field__content">
        <p id="total-assets">总资产</p>
        <strong class="tabular">{{ total }} <small>PGC</small></strong>
        <div class="value-field__composition">
          <span
            >UTXO 可用 <b class="tabular">{{ primaryAsset?.utxoAvailable ?? '0' }}</b></span
          >
          <span
            >TXCer 可支付 <b class="tabular">{{ primaryAsset?.txCerSpendable ?? '0' }}</b></span
          >
        </div>
        <small>
          {{
            dashboard.current.updatedAt
              ? `最后同步 ${new Date(dashboard.current.updatedAt).toLocaleTimeString()}`
              : '尚未取得真实账户快照'
          }}
        </small>
      </div>
      <div class="value-field__actions">
        <AppButton to="/wallet/send" size="large">
          <PaperPlaneTilt :size="18" weight="bold" />
          发送
        </AppButton>
        <AppButton to="/wallet/receive" size="large" variant="secondary">
          <ArrowDown :size="18" weight="bold" />
          收款
        </AppButton>
      </div>
      <i class="value-field__sweep" aria-hidden="true" @animationend="sweep = false" />
    </section>

    <section
      class="funds-summary"
      :class="{ 'funds-summary--warning': dashboard.current.security.isolatedCount > 0 }"
    >
      <span
        ><small>可立即支付</small
        ><strong>{{ dashboard.current.security.spendReady }} PGC</strong></span
      >
      <span>
        <small>安全凭证</small>
        <strong>{{
          dashboard.current.security.credentialStatus === 'normal' ? '正常' : '存在异常'
        }}</strong>
      </span>
      <span
        ><small>后台审计</small
        ><strong>{{ dashboard.current.security.pendingAudits }} 项处理中</strong></span
      >
      <RouterLink to="/wallet/security">查看详情</RouterLink>
    </section>

    <div class="overview-grid">
      <section class="wallet-surface assets" aria-labelledby="assets-heading">
        <div class="wallet-surface__heading">
          <h2 id="assets-heading">资产</h2>
          <StatusLabel :tone="dashboard.offline ? 'warning' : 'success'">
            {{ dashboard.offline ? '离线' : '已同步' }}
          </StatusLabel>
        </div>
        <div class="asset-head"><span>资产</span><span>可用组成</span><span>总额</span></div>
        <div v-for="asset in dashboard.current.assets" :key="asset.symbol" class="asset-row">
          <span class="asset-identity"
            ><i>{{ asset.symbol.slice(0, 1) }}</i
            ><span
              ><b>{{ asset.symbol }}</b
              ><small>{{ asset.name }}</small></span
            ></span
          >
          <span
            ><small>UTXO {{ asset.utxoAvailable }}</small
            ><small>TXCer {{ asset.txCerSpendable }}</small></span
          >
          <b class="tabular">{{ asset.total }}</b>
        </div>
      </section>

      <section class="wallet-surface activity" aria-labelledby="activity-heading">
        <div class="wallet-surface__heading">
          <h2 id="activity-heading">最近活动</h2>
          <RouterLink to="/wallet/activity">全部</RouterLink>
        </div>
        <ul v-if="dashboard.current.activities.length">
          <li v-for="item in dashboard.current.activities.slice(0, 5)" :key="item.id">
            <ArrowDown :size="17" />
            <span
              ><b>{{ item.title }}</b
              ><small>{{ item.status }}</small></span
            >
            <b class="tabular">{{ item.amount }}</b>
          </li>
        </ul>
        <div v-else class="wallet-empty">这里会显示真实账户活动。当前没有可展示记录。</div>
      </section>
    </div>

    <p v-if="dashboard.error" class="wallet-notice wallet-notice--warning">
      无法取得最新快照：{{ dashboard.error }}。当前显示内容会明确保留缓存时间。
    </p>
  </div>
</template>

<style scoped>
.value-field {
  position: relative;
  display: grid;
  min-height: 250px;
  align-items: end;
  overflow: hidden;
  grid-template-columns: 1fr auto;
  gap: 2rem;
  padding: clamp(1.5rem, 4vw, 2.7rem);
  border-radius: var(--radius-xl);
  background:
    radial-gradient(circle at 82% 8%, var(--hero-halo), transparent 48%),
    linear-gradient(
      145deg,
      var(--surface),
      color-mix(in srgb, var(--surface) 86%, var(--accent) 4%)
    );
  box-shadow: var(--shadow-soft);
}

.value-field__content {
  display: grid;
  gap: 0.7rem;
}

.value-field__content > p,
.value-field__content > small {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.value-field__content > strong {
  font-size: clamp(3rem, 7.5vw, 5.7rem);
  font-weight: 590;
  letter-spacing: -0.075em;
  line-height: 0.92;
}

.value-field__content > strong small {
  color: var(--text-muted);
  font-size: 0.2em;
  letter-spacing: 0.03em;
}

.value-field__composition {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem 1.25rem;
  color: var(--text-muted);
  font-size: 0.76rem;
}

.value-field__composition b {
  margin-left: 0.3rem;
  color: var(--text);
}

.value-field__actions {
  display: grid;
  width: min(310px, 32vw);
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
}

.value-field__actions :deep(.app-button) {
  min-width: 0;
}

.value-field__sweep {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -30%;
  width: 28%;
  opacity: 0;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--accent) 14%, transparent),
    transparent
  );
  filter: blur(8px);
  pointer-events: none;
}

.value-field--sweep .value-field__sweep {
  animation: balance-sweep 650ms var(--ease-standard) both;
}

@keyframes balance-sweep {
  20% {
    opacity: 0.8;
  }
  100% {
    left: 110%;
    opacity: 0;
  }
}

.funds-summary {
  display: grid;
  align-items: center;
  grid-template-columns: repeat(3, 1fr) auto;
  gap: 1rem;
  padding: 0.9rem 1.05rem;
  border-radius: var(--radius-md);
  background: var(--surface-subtle);
}

.funds-summary span {
  display: grid;
  gap: 0.22rem;
}

.funds-summary small {
  color: var(--text-muted);
  font-size: 0.69rem;
}

.funds-summary strong,
.funds-summary a {
  font-size: 0.78rem;
}

.funds-summary a {
  min-height: 44px;
  align-content: center;
  color: var(--accent);
}

.funds-summary--warning {
  background: color-mix(in srgb, var(--warning) 10%, var(--surface));
}

.overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(300px, 5fr);
  gap: 1rem;
}

.asset-head,
.asset-row {
  display: grid;
  align-items: center;
  grid-template-columns: 1fr 1fr 0.7fr;
  gap: 1rem;
}

.asset-head {
  min-height: 32px;
  color: var(--text-faint);
  font-size: 0.68rem;
}

.asset-row {
  min-height: 72px;
  border-top: 1px solid var(--border);
}

.asset-row > span:nth-child(2),
.asset-identity > span {
  display: grid;
  gap: 0.15rem;
}

.asset-row small {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.asset-identity {
  display: flex !important;
  align-items: center;
  gap: 0.7rem;
}

.asset-identity > i {
  display: grid;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  font-style: normal;
  font-weight: 720;
  place-items: center;
}

.activity ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.activity li {
  display: grid;
  min-height: 62px;
  align-items: center;
  grid-template-columns: auto 1fr auto;
  gap: 0.7rem;
  border-top: 1px solid var(--border);
}

.activity li > span {
  display: grid;
}

.activity li small {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.wallet-surface__heading a {
  color: var(--accent);
  font-size: 0.78rem;
}

@media (max-width: 900px) {
  .overview-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .value-field {
    min-height: 310px;
    grid-template-columns: 1fr;
  }

  .value-field__actions {
    width: 100%;
  }

  .funds-summary {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 440px) {
  .value-field__content > strong {
    font-size: 2.75rem;
  }

  .funds-summary {
    grid-template-columns: 1fr;
  }

  .asset-head {
    display: none;
  }

  .asset-row {
    grid-template-columns: 1fr auto;
  }

  .asset-row > span:nth-child(2) {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .value-field--sweep .value-field__sweep {
    animation: none;
  }
}
</style>
