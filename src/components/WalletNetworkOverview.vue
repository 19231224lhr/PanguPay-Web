<script setup lang="ts">
import { wt, walletLocale } from '@/i18n/walletText'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { PhArrowClockwise, PhArrowUpRight } from '@phosphor-icons/vue'
import { GatewayClient } from '@/services/gatewayClient'
import { getWalletEntryService, type WalletEntryOrganization } from '@/wallet/entryService'
import { normalizeGQNCStatus, type GQNCStatusView } from '@/wallet/gqncExplorer'
import type { OrganizationSummary } from '@/wallet/types'
import StatusLabel from './StatusLabel.vue'
import WalletFigure from './WalletFigure.vue'

const props = defineProps<{ organization?: OrganizationSummary; offline: boolean }>()
const client = new GatewayClient()
const status = ref<GQNCStatusView>()
const loading = ref(false)
const error = ref('')
const checkedAt = ref('')
const organizations = ref<WalletEntryOrganization[]>([])
const organizationError = ref('')
const organizationsLoading = ref(true)
let disposed = false
let timer: ReturnType<typeof setInterval> | undefined
const chainLabel = computed(() => {
  if (error.value) return wt('w315')
  if (!status.value) return wt('w19')
  if (!status.value.enabled) return wt('refinement13')
  return status.value.safetyStatus === 'NORMAL'
    ? wt('w181')
    : status.value.safetyStatus || wt('refinement14')
})

async function refresh(): Promise<void> {
  if (loading.value) return
  loading.value = true
  try {
    const next = normalizeGQNCStatus(await client.gqncStatus())
    if (!next.protocolVersion || !next.safetyStatus) throw new Error(wt('refinement15'))
    if (disposed) return
    status.value = next
    error.value = ''
    checkedAt.value = new Date().toLocaleTimeString(walletLocale())
  } catch {
    if (disposed) return
    status.value = undefined
    error.value = wt('refinement16')
  } finally {
    if (!disposed) loading.value = false
  }
}

async function loadOrganizations(): Promise<void> {
  organizationsLoading.value = true
  try {
    const service = getWalletEntryService()
    if (!service) throw new Error('Unavailable')
    const result = await service.listOrganizations()
    if (!disposed) {
      organizations.value = result
      organizationError.value = ''
    }
  } catch {
    if (!disposed) organizationError.value = wt('refinement17')
  } finally {
    if (!disposed) organizationsLoading.value = false
  }
}

watch(
  () => props.organization?.id,
  () => void loadOrganizations(),
)
onMounted(() => {
  void refresh()
  void loadOrganizations()
  timer = setInterval(() => {
    if (!document.hidden) void refresh()
  }, 30_000)
})
onBeforeUnmount(() => {
  disposed = true
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="network-overview overview-pair">
    <section class="overview-panel" aria-labelledby="overview-organization">
      <header class="overview-panel__heading">
        <h2 id="overview-organization">
          <RouterLink to="/wallet/organization">{{ wt('w86') }}</RouterLink>
        </h2>
        <StatusLabel :tone="offline ? 'warning' : 'neutral'">{{
          offline ? wt('refinement18') : organization ? wt('refinement19') : wt('refinement20')
        }}</StatusLabel>
      </header>
      <div class="overview-panel__body">
        <dl class="overview-rows">
          <div>
            <dt>{{ wt('refinement21') }}</dt>
            <dd>{{ organization?.name || (offline ? wt('refinement22') : wt('refinement23')) }}</dd>
          </div>
          <div v-if="organization">
            <dt>{{ wt('refinement24') }}</dt>
            <dd>{{ organization.role }}</dd>
          </div>
          <div>
            <dt>{{ wt('refinement25') }}</dt>
            <dd>
              {{
                organizationsLoading
                  ? wt('w19')
                  : organizationError
                    ? '—'
                    : wt('refinement59', [organizations.length])
              }}
            </dd>
          </div>
        </dl>
        <WalletFigure kind="settle" :intensity="0.3" />
      </div>
      <p v-if="organizationError" class="network-error" role="status">
        {{ organizationError }} <button @click="loadOrganizations">{{ wt('refinement26') }}</button>
      </p>
      <RouterLink class="network-detail" to="/wallet/organization">
        {{ wt('refinement27') }} <PhArrowUpRight :size="15" aria-hidden="true" />
      </RouterLink>
    </section>

    <section class="overview-panel" aria-labelledby="overview-chain">
      <header class="overview-panel__heading">
        <h2 id="overview-chain">
          <RouterLink to="/wallet/blockchain">{{ wt('refinement28') }}</RouterLink>
        </h2>
        <div class="chain-actions">
          <StatusLabel :tone="chainLabel === wt('w181') ? 'success' : 'warning'">{{
            chainLabel
          }}</StatusLabel
          ><button
            :aria-label="wt('refinement29')"
            :disabled="loading"
            :aria-busy="loading"
            @click="refresh"
          >
            <PhArrowClockwise :size="17" />
          </button>
        </div>
      </header>
      <div class="overview-panel__body">
        <dl class="overview-metrics">
          <div>
            <dt>{{ wt('w16') }}</dt>
            <dd class="tabular">{{ status?.certifiedHeight ?? '—' }}</dd>
          </div>
          <div>
            <dt>{{ wt('w17') }}</dt>
            <dd class="tabular">
              {{ status ? `${status.quorum} / ${status.validatorCount}` : '—' }}
            </dd>
          </div>
          <div>
            <dt>{{ wt('w18') }}</dt>
            <dd class="tabular">{{ status?.currentView ?? '—' }}</dd>
          </div>
        </dl>
        <WalletFigure kind="branches" :intensity="0.3" />
      </div>
      <p v-if="error" class="network-error" role="status">{{ error }}</p>
      <div class="network-footer">
        <RouterLink class="network-detail" to="/wallet/blockchain">
          {{ wt('refinement30') }} <PhArrowUpRight :size="15" aria-hidden="true" />
        </RouterLink>
        <span v-if="checkedAt">{{ checkedAt }} {{ wt('refinement31') }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.chain-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.chain-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  min-height: 36px;
  border-radius: 8px;
  color: var(--text-muted);
  background: transparent;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: wait;
}
button:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text);
}
h2 a {
  color: inherit;
}
h2 a:hover,
.network-detail:hover {
  color: var(--accent);
}
.network-detail {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 44px;
  margin-top: auto;
  color: var(--text-muted);
  font-size: 0.75rem;
  align-self: flex-start;
}
.network-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 0.5rem;
  margin-top: auto;
}
.network-footer span {
  color: var(--text-muted);
  font-size: 0.65rem;
}
p {
  font-size: 0.75rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.network-error {
  color: var(--warning);
}
@media (pointer: coarse) {
  .chain-actions button {
    min-width: 44px;
    min-height: 44px;
  }
}
</style>
