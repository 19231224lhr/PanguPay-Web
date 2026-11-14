<script setup lang="ts">
import { wt, wl } from '@/i18n/walletText'

import { PhCaretRight as CaretRight } from '@phosphor-icons/vue'
import { computed, onMounted, ref, watch } from 'vue'

import AppButton from '@/components/AppButton.vue'
import InlineNotice from '@/components/InlineNotice.vue'
import OrganizationDetailDialog from '@/components/OrganizationDetailDialog.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import WalletFigure from '@/components/WalletFigure.vue'
import StatusLabel from '@/components/StatusLabel.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useWalletStore } from '@/stores/wallet'
import { loadTransferJournal } from '@/transfer/journal'
import { loadTransferReservations } from '@/transfer/reservations'
import {
  getWalletEntryService,
  type WalletEntryOrganization,
  type WalletEntryOrganizationDetail,
  type WalletEntryOrganizationNodeRole,
} from '@/wallet/entryService'
import { evaluateOrganizationExit } from '@/wallet/organizationExit'

const dashboard = useDashboardStore()
const wallet = useWalletStore()
const organizations = ref<WalletEntryOrganization[]>([])
const selected = ref('')
const loading = ref(false)
const error = ref('')
const detailOpen = ref(false)
const detailOrganization = ref<WalletEntryOrganization>()
const organizationDetail = ref<WalletEntryOrganizationDetail>()
const detailBusy = ref(false)
const detailError = ref('')
const exitStage = ref<'idle' | 'confirm'>('idle')
const exitBusy = ref(false)
const exitError = ref('')
const exitDecision = ref<{ allowed: boolean; reasons: string[] }>({ allowed: false, reasons: [] })

const nodeGroupDefinitions: Array<{
  role: WalletEntryOrganizationNodeRole
  title: string
  description: string
}> = [
  {
    role: 'assign',
    get title() {
      return wt('w67')
    },
    get description() {
      return wt('w68')
    },
  },
  {
    role: 'aggregation',
    get title() {
      return wt('w69')
    },
    get description() {
      return wt('w70')
    },
  },
  {
    role: 'txcer',
    get title() {
      return wt('w71')
    },
    get description() {
      return wt('w72')
    },
  },
  {
    role: 'guarantor',
    title: 'GuarNode',
    get description() {
      return wt('w73')
    },
  },
]

const nodeGroups = computed(() =>
  nodeGroupDefinitions.map((group) => ({
    ...group,
    nodes: (organizationDetail.value?.nodes ?? []).filter((node) => node.role === group.role),
  })),
)

function groupedAmount(value?: string): string {
  if (!value) return wt('w74')
  const [integer, fraction] = value.split('.', 2)
  const sign = integer?.startsWith('-') ? '-' : ''
  const digits = (integer ?? '').replace(/^-/, '')
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${
    fraction === undefined ? '' : `.${fraction}`
  } CAL`
}

function nodeStatus(status?: string): string {
  if (!status) return wt('w75')
  const normalized = status.toLowerCase()
  if (['active', 'online', 'ready'].includes(normalized)) return wt('w76')
  if (['standby', 'pending'].includes(normalized)) return wt('w77')
  if (['disabled', 'revoked', 'offline'].includes(normalized)) return wt('w78')
  return status
}

async function loadOrganizations(): Promise<void> {
  if (dashboard.current.organization || loading.value) return
  const service = getWalletEntryService()
  if (!service) {
    error.value = wt('w79')
    return
  }
  loading.value = true
  error.value = ''
  try {
    organizations.value = await service.listOrganizations()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : wt('w80')
  } finally {
    loading.value = false
  }
}

async function join(): Promise<void> {
  const service = getWalletEntryService()
  if (!service || !selected.value) return
  loading.value = true
  error.value = ''
  try {
    await service.join(selected.value)
    await dashboard.sync(true)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : wt('w81')
  } finally {
    loading.value = false
  }
}

async function loadOrganizationDetail(): Promise<void> {
  const service = getWalletEntryService()
  const organization = detailOrganization.value
  if (!service || !organization) return
  detailBusy.value = true
  detailError.value = ''
  organizationDetail.value = undefined
  try {
    organizationDetail.value = await service.organization(organization.id, organization.name)
  } catch (cause) {
    detailError.value = cause instanceof Error ? cause.message : wt('w82')
  } finally {
    detailBusy.value = false
  }
}

async function loadCurrentOrganization(): Promise<void> {
  const current = dashboard.current.organization
  if (!current) return
  detailOrganization.value = { id: current.id, name: current.name }
  await loadOrganizationDetail()
}

function showOrganizationDetail(organization: WalletEntryOrganization): void {
  detailOrganization.value = organization
  detailOpen.value = true
  void loadOrganizationDetail()
}

function inspectExit(): void {
  exitError.value = ''
  try {
    exitDecision.value = evaluateOrganizationExit({
      txCerSpendable: dashboard.current.security.spendReady,
      pendingAudits: dashboard.current.security.pendingAudits,
      reservationCount: Object.keys(loadTransferReservations(wallet.accountId)).length,
      transferPhases: loadTransferJournal(wallet.accountId).map((item) => item.phase),
    })
  } catch {
    exitDecision.value = {
      allowed: false,
      reasons: [wt('w83')],
    }
  }
  exitStage.value = 'confirm'
}

async function leaveOrganization(): Promise<void> {
  const service = getWalletEntryService()
  const current = dashboard.current.organization
  if (!service || !current || !exitDecision.value.allowed || exitBusy.value) return
  exitBusy.value = true
  exitError.value = ''
  try {
    await service.leave(current.id)
    await dashboard.sync(true)
    if (dashboard.current.organization) throw new Error(wt('w84'))
    exitStage.value = 'idle'
    organizationDetail.value = undefined
    await loadOrganizations()
  } catch (cause) {
    exitError.value = cause instanceof Error ? cause.message : wt('w85')
  } finally {
    exitBusy.value = false
  }
}

watch(
  () => dashboard.current.organization?.id,
  (next, previous) => {
    if (next) void loadCurrentOrganization()
    else if (previous) void loadOrganizations()
  },
  { immediate: true },
)

onMounted(() => void loadOrganizations())
</script>

<template>
  <div class="wallet-page wallet-refined organization-page">
    <WalletPageHeader :title="wt('w86')" :description="wt('w87')" />

    <section v-if="dashboard.current.organization" class="member-organization">
      <header class="member-organization__hero">
        <div>
          <span> {{ wt('w88') }} </span>
          <h2>{{ dashboard.current.organization.name }}</h2>
          <p class="mono">{{ wt('w47') }} {{ dashboard.current.organization.id }}</p>
          <StatusLabel tone="success">{{ wt('w89') }}</StatusLabel>
        </div>
        <WalletFigure kind="settle" />
      </header>

      <div v-if="detailBusy" class="organization-loading" role="status">{{ wt('w90') }}</div>
      <InlineNotice v-else-if="detailError" :title="wt('w91')" tone="danger">
        {{ detailError }}
      </InlineNotice>
      <template v-else-if="organizationDetail">
        <dl class="organization-metrics">
          <div>
            <dt>{{ wt('w92') }}</dt>
            <dd>{{ groupedAmount(organizationDetail.pledgeAmount) }}</dd>
          </div>
          <div>
            <dt>{{ wt('w93') }}</dt>
            <dd>{{ organizationDetail.guarantorCount }} {{ wt('w94') }}</dd>
          </div>
          <div>
            <dt>{{ wt('w95') }}</dt>
            <dd>{{ organizationDetail.certifierCount }} {{ wt('w94') }}</dd>
          </div>
          <div>
            <dt>{{ wt('w96') }}</dt>
            <dd>{{ dashboard.current.organization.role }}</dd>
          </div>
        </dl>

        <section class="organization-roster" aria-labelledby="organization-roster-title">
          <div class="wallet-section__heading">
            <div>
              <span> {{ wt('w97') }} </span>
              <h2 id="organization-roster-title">{{ wt('w98') }}</h2>
            </div>
            <AppButton variant="ghost" :loading="detailBusy" @click="loadCurrentOrganization">
              {{ wt('w99') }}
            </AppButton>
          </div>
          <div class="organization-roster__grid">
            <article v-for="group in nodeGroups" :key="group.role">
              <header>
                <div>
                  <h3>{{ group.title }}</h3>
                  <p>{{ group.description }}</p>
                </div>
                <b>{{ group.nodes.length }}</b>
              </header>
              <ul v-if="group.nodes.length">
                <li v-for="node in group.nodes" :key="`${group.role}-${node.id || node.peerId}`">
                  <div>
                    <strong>{{ node.id || group.title }}</strong>
                    <small v-if="node.peerId" class="mono">Peer · {{ node.peerId }}</small>
                    <small v-if="node.endpoint" class="mono">API · {{ node.endpoint }}</small>
                  </div>
                  <span>{{ nodeStatus(node.status) }}</span>
                </li>
              </ul>
              <p v-else class="organization-roster__empty">{{ wt('w100') }}</p>
            </article>
          </div>
        </section>

        <details class="organization-technical">
          <summary>{{ wt('w101') }}</summary>
          <dl>
            <div v-if="organizationDetail.peerGroupId">
              <dt>{{ wt('w102') }}</dt>
              <dd class="mono">{{ organizationDetail.peerGroupId }}</dd>
            </div>
            <div v-if="organizationDetail.pledgeAddress">
              <dt>{{ wt('w103') }}</dt>
              <dd class="mono">{{ organizationDetail.pledgeAddress }}</dd>
            </div>
            <div v-if="organizationDetail.assignEndpoint">
              <dt>Assign</dt>
              <dd class="mono">{{ organizationDetail.assignEndpoint }}</dd>
            </div>
            <div v-if="organizationDetail.aggregationEndpoint">
              <dt>Aggregation</dt>
              <dd class="mono">{{ organizationDetail.aggregationEndpoint }}</dd>
            </div>
          </dl>
        </details>
      </template>

      <section class="organization-exit" aria-labelledby="organization-exit-title">
        <div>
          <h2 id="organization-exit-title">{{ wt('w104') }}</h2>
          <p>{{ wt('w105') }}</p>
        </div>
        <AppButton v-if="exitStage === 'idle'" variant="danger" @click="inspectExit">
          {{ wt('w106') }}
        </AppButton>
        <div v-else class="organization-exit__confirmation">
          <ul v-if="exitDecision.reasons.length">
            <li v-for="reason in exitDecision.reasons" :key="reason">{{ reason }}</li>
          </ul>
          <p v-else>{{ wt('w107') }}</p>
          <div>
            <AppButton variant="ghost" :disabled="exitBusy" @click="exitStage = 'idle'">
              {{ wt('w108') }}
            </AppButton>
            <AppButton
              variant="danger"
              :disabled="!exitDecision.allowed"
              :loading="exitBusy"
              @click="leaveOrganization"
            >
              {{ wt('w109') }}
            </AppButton>
          </div>
        </div>
        <InlineNotice v-if="exitError" :title="wt('w110')" tone="danger">{{
          exitError
        }}</InlineNotice>
      </section>
    </section>

    <section v-else class="organization-chooser" aria-labelledby="available-organizations-heading">
      <div class="detail-page-intro">
        <div class="detail-page-intro__copy">
          <h2 id="available-organizations-heading">{{ wt('w111') }}</h2>
          <span class="detail-page-caption">{{ wt('w112') }}</span>
        </div>
        <WalletFigure kind="settle" />
      </div>
      <p class="organization-copy">{{ wt('w113') }}</p>
      <div v-if="organizations.length" class="organization-options" :aria-label="wt('w46')">
        <article
          v-for="item in organizations"
          :key="item.id"
          :data-selected="selected === item.id || undefined"
        >
          <label>
            <input v-model="selected" type="radio" name="wallet-organization" :value="item.id" />
            <span class="organization-option__indicator" aria-hidden="true" />
            <span class="organization-option__copy">
              <strong>{{ item.name }}</strong>
              <small> {{ wt('w47') }} {{ item.id }}</small>
              <span
                ><b> {{ wt('w48') }} </b><b> {{ wt('w49') }} </b></span
              >
            </span>
          </label>
          <button
            type="button"
            class="organization-option__detail"
            :aria-label="wt('w50', [item.name])"
            @click="showOrganizationDetail(item)"
          >
            {{ wt('w51') }} <CaretRight :size="15" />
          </button>
        </article>
      </div>
      <div v-else-if="!loading" class="wallet-empty">{{ wt('w114') }}</div>
      <InlineNotice v-if="error" :title="wt('w115')" tone="danger">{{ wl(error) }}</InlineNotice>
      <div class="organization-actions">
        <AppButton variant="secondary" :loading="loading" @click="loadOrganizations">
          {{ wt('w116') }}
        </AppButton>
        <AppButton :disabled="!selected" :loading="loading" @click="join">
          {{ wt('w117') }}
        </AppButton>
      </div>
    </section>

    <OrganizationDetailDialog
      :open="detailOpen"
      :organization="detailOrganization"
      :detail="organizationDetail"
      :busy="detailBusy"
      :error="detailError"
      @close="detailOpen = false"
      @retry="loadOrganizationDetail"
    />
  </div>
</template>

<style scoped>
.organization-page {
  width: min(1120px, 100%);
}
.organization-details {
  margin-bottom: 1rem;
}
.organization-chooser {
  display: grid;
  gap: 1rem;
}
.wallet-section__heading > span,
.organization-copy {
  color: var(--text-muted);
  font-size: 0.78rem;
}
.organization-copy {
  margin: 0;
  line-height: 1.55;
}
.organization-options {
  display: grid;
  border-block: 1px solid var(--hairline);
}
.organization-options article {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.25rem 0.35rem;
  border-bottom: 1px solid var(--hairline);
  border-radius: var(--radius-md);
  transition: background var(--duration-state) var(--ease-standard);
}
.organization-options article:last-child {
  border-bottom: 0;
}
.organization-options article[data-selected] {
  background: color-mix(in srgb, var(--accent) 7%, transparent);
}
.organization-options label {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.8rem;
  min-height: 80px;
  cursor: pointer;
}
.organization-options input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.organization-option__indicator {
  width: 20px;
  height: 20px;
  border: 1px solid var(--border-strong);
  border-radius: 50%;
  box-shadow: inset 0 0 0 5px transparent;
  transition:
    border-color var(--duration-state) var(--ease-standard),
    background var(--duration-state) var(--ease-standard),
    box-shadow var(--duration-state) var(--ease-standard);
}
.organization-options input:checked + .organization-option__indicator {
  border-color: var(--accent);
  background: var(--accent);
  box-shadow: inset 0 0 0 5px var(--surface);
}
.organization-options input:focus-visible + .organization-option__indicator {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
}
.organization-option__copy {
  display: grid;
  min-width: 0;
  gap: 0.16rem;
}
.organization-option__copy small {
  color: var(--text-muted);
  font-size: 0.74rem;
}
.organization-option__copy > span {
  display: flex;
  gap: 0.35rem;
  padding-top: 0.3rem;
}
.organization-option__copy > span b {
  padding: 0.18rem 0.42rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  color: var(--accent-strong);
  font-size: 0.66rem;
  font-weight: 650;
}
.organization-option__detail {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  gap: 0.2rem;
  padding: 0 0.55rem;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 620;
  transition: color var(--duration-state) var(--ease-standard);
}
@media (hover: hover) and (pointer: fine) {
  .organization-option__detail:hover {
    color: var(--accent);
  }
}
.organization-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.7rem;
}
.member-organization {
  display: grid;
  gap: 2rem;
}
.member-organization__hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.25rem;
  padding-block: 0.8rem 1.4rem;
  border-bottom: 1px solid var(--hairline);
}
.member-organization__hero > div:first-child {
  display: grid;
  gap: 0.2rem;
}
.member-organization__hero > div:first-child > span:not(.status-label),
.member-organization__hero p,
.organization-exit p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.76rem;
}
.member-organization__hero h2 {
  margin: 0;
  font-size: clamp(1.8rem, 4vw, 2.7rem);
  letter-spacing: -0.045em;
}
.organization-loading {
  min-height: 96px;
  color: var(--text-muted);
}
.organization-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0;
  border-block: 1px solid var(--hairline);
}
.organization-metrics > div {
  display: grid;
  gap: 0.4rem;
  padding: 1.1rem;
}
.organization-metrics > div + div {
  border-left: 1px solid var(--hairline);
}
.organization-metrics dt,
.organization-technical dt {
  color: var(--text-muted);
  font-size: 0.72rem;
}
.organization-metrics dd,
.organization-technical dd {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 0.9rem;
  font-weight: 650;
}
.organization-roster {
  display: grid;
  gap: 1rem;
}
.wallet-section__heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}
.wallet-section__heading > div {
  display: grid;
  gap: 0.18rem;
}
.wallet-section__heading h2,
.organization-exit h2 {
  margin: 0;
  font-size: 1.12rem;
  letter-spacing: -0.025em;
}
.wallet-section__heading span {
  color: var(--text-muted);
  font-size: 0.7rem;
}
.organization-roster__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-block: 1px solid var(--hairline);
}
.organization-roster__grid > article {
  min-width: 0;
  padding: 1rem;
}
.organization-roster__grid > article:nth-child(even) {
  border-left: 1px solid var(--hairline);
}
.organization-roster__grid > article:nth-child(n + 3) {
  border-top: 1px solid var(--hairline);
}
.organization-roster article > header,
.organization-roster li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
}
.organization-roster article > header h3,
.organization-roster article > header p {
  margin: 0;
}
.organization-roster article > header h3 {
  font-size: 0.95rem;
}
.organization-roster article > header p,
.organization-roster li small,
.organization-roster__empty {
  color: var(--text-muted);
  font-size: 0.68rem;
}
.organization-roster article > header > b {
  display: grid;
  width: 30px;
  height: 30px;
  flex: none;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 9%, transparent);
  color: var(--accent);
  place-items: center;
}
.organization-roster ul {
  display: grid;
  gap: 0;
  margin: 0.8rem 0 0;
  padding: 0;
  list-style: none;
}
.organization-roster li {
  padding-block: 0.65rem;
  border-top: 1px solid var(--hairline);
}
.organization-roster li > div {
  display: grid;
  min-width: 0;
  gap: 0.12rem;
}
.organization-roster li strong,
.organization-roster li small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.organization-roster li > span {
  flex: none;
  color: var(--success);
  font-size: 0.7rem;
  font-weight: 650;
}
.organization-roster__empty {
  margin: 0.8rem 0 0;
}
.organization-technical {
  border-block: 1px solid var(--hairline);
}
.organization-technical summary {
  min-height: 48px;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 48px;
}
.organization-technical dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  padding-bottom: 1rem;
}
.organization-technical dl > div {
  display: grid;
  gap: 0.3rem;
  padding: 0.7rem 0;
}
.organization-exit {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 1rem;
  padding-top: 1.2rem;
  border-top: 1px solid var(--hairline);
}
.organization-exit > div:first-child {
  display: grid;
  gap: 0.3rem;
}
.organization-exit__confirmation {
  display: grid;
  max-width: 520px;
  gap: 0.8rem;
}
.organization-exit__confirmation ul {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  padding-left: 1.1rem;
  color: var(--danger);
  font-size: 0.76rem;
}
.organization-exit__confirmation > div {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
.organization-exit > :deep(.inline-notice) {
  grid-column: 1 / -1;
}
.mono {
  font-family: var(--font-mono);
}
@media (max-width: 840px) {
  .organization-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .organization-metrics > div:nth-child(3) {
    border-top: 1px solid var(--hairline);
    border-left: 0;
  }
  .organization-metrics > div:nth-child(4) {
    border-top: 1px solid var(--hairline);
  }
}
@media (max-width: 599px) {
  .organization-options article {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .organization-option__detail {
    justify-self: end;
    margin-top: -0.5rem;
  }
  .organization-actions {
    display: grid;
    grid-template-columns: 1fr;
  }
  .member-organization__hero,
  .organization-exit {
    grid-template-columns: 1fr;
  }
  .member-organization__hero {
    align-items: start;
  }
  .organization-roster__grid,
  .organization-technical dl {
    grid-template-columns: 1fr;
  }
  .organization-roster__grid > article:nth-child(even) {
    border-left: 0;
  }
  .organization-roster__grid > article + article {
    border-top: 1px solid var(--hairline);
  }
  .organization-exit__confirmation > div {
    display: grid;
  }
}
</style>
