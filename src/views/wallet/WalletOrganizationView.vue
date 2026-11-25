<script setup lang="ts">
import { groupedPledgeAmount } from '@/i18n/pledgeAmount'
import { smoothDetails as vSmoothDetails } from '@/directives/smoothDetails'
import { wCount, organizationLabel, wt, wl } from '@/i18n/walletText'

import {
  PhArrowClockwise as ArrowClockwise,
  PhArrowsSplit,
  PhBracketsCurly,
  PhCaretDown as CaretDown,
  PhShieldCheck,
  PhStack,
  PhUsersThree,
} from '@phosphor-icons/vue'
import { computed, onBeforeUnmount, ref, shallowRef, watch, type Component } from 'vue'

import AppButton from '@/components/AppButton.vue'
import InlineNotice from '@/components/InlineNotice.vue'
import OrganizationChooser from '@/components/OrganizationChooser.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import WalletPagedRows from '@/components/WalletPagedRows.vue'
import WalletFigure from '@/components/WalletFigure.vue'
import StatusLabel from '@/components/StatusLabel.vue'
import { useWalletNetwork } from '@/composables/useWalletNetwork'
import { useDashboardStore } from '@/stores/dashboard'
import { useWalletStore } from '@/stores/wallet'
import { loadTransferJournal } from '@/transfer/journal'
import { loadTransferReservations } from '@/transfer/reservations'
import {
  getWalletEntryService,
  WalletEntryConfirmationPending,
  type WalletEntryOrganizationNodeRole,
} from '@/wallet/entryService'
import { evaluateOrganizationExit } from '@/wallet/organizationExit'

const dashboard = useDashboardStore()
const wallet = useWalletStore()
const { directory, organization } = useWalletNetwork()
const organizations = computed(() => directory.data.value ?? [])
const directoryLoading = directory.loading
const selected = ref('')
const hasSelection = computed(() => organizations.value.some((item) => item.id === selected.value))
const joining = ref(false)
const pendingJoin = ref<(() => Promise<void>) | 'sync'>()
const error = ref('')
const directoryError = computed(() => error.value || directory.error.value)
const detailQuery = computed(() => {
  const current = dashboard.current.organization
  return current && organization(current)
})
const organizationDetail = computed(() => detailQuery.value?.data.value)
const detailBusy = computed(() => detailQuery.value?.loading.value ?? false)
const detailError = computed(() => detailQuery.value?.error.value ?? '')
const exitStage = ref<'idle' | 'confirm'>('idle')
const exitBusy = ref(false)
const exitError = ref('')
const pendingExit = ref<(() => Promise<void>) | 'sync'>()
const exitDecision = ref<{ allowed: boolean; reasons: string[] }>({ allowed: false, reasons: [] })

interface MembershipResult {
  action: 'join' | 'leave'
  organization: { id: string; name?: string }
}

const awaitingMembership = shallowRef<MembershipResult>()
const membershipNotice = shallowRef<MembershipResult>()
let noticeTimer: ReturnType<typeof setTimeout> | undefined

function dismissMembershipNotice(): void {
  clearTimeout(noticeTimer)
  membershipNotice.value = undefined
}

watch([awaitingMembership, () => dashboard.snapshot], ([result, snapshot]) => {
  if (!result || snapshot?.source !== 'live' || snapshot.accountId !== wallet.accountId) return
  if (result.action === 'join') {
    if (snapshot.organization?.id !== result.organization.id) return
    pendingJoin.value = undefined
  } else {
    if (snapshot.organization) return
    pendingExit.value = undefined
    exitStage.value = 'idle'
    selected.value = ''
    void directory.refresh()
  }
  awaitingMembership.value = undefined
  dismissMembershipNotice()
  membershipNotice.value = result
  noticeTimer = setTimeout(dismissMembershipNotice, 6500)
})

onBeforeUnmount(dismissMembershipNotice)

const nodeGroupDefinitions: Array<{
  role: WalletEntryOrganizationNodeRole
  icon: Component
  title: string
  description: string
}> = [
  {
    role: 'assign',
    icon: PhArrowsSplit,
    get title() {
      return wt('w67')
    },
    get description() {
      return wt('w68')
    },
  },
  {
    role: 'aggregation',
    icon: PhStack,
    get title() {
      return wt('w69')
    },
    get description() {
      return wt('w70')
    },
  },
  {
    role: 'txcer',
    icon: PhShieldCheck,
    get title() {
      return wt('w71')
    },
    get description() {
      return wt('w72')
    },
  },
  {
    role: 'guarantor',
    icon: PhUsersThree,
    get title() {
      return wt('w93')
    },
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


function nodeStatus(status?: string): string {
  if (!status) return wt('w75')
  const normalized = status.toLowerCase()
  if (['active', 'online', 'ready'].includes(normalized)) return wt('w76')
  if (['standby', 'pending'].includes(normalized)) return wt('w77')
  if (['disabled', 'revoked', 'offline'].includes(normalized)) return wt('w78')
  return status
}

function loadOrganizations(): void {
  error.value = ''
  void directory.refresh()
}

async function join(): Promise<void> {
  const service = getWalletEntryService()
  if (!service || joining.value || (!pendingJoin.value && !hasSelection.value)) return
  const groupId = selected.value
  joining.value = true
  error.value = ''
  try {
    const pending = pendingJoin.value
    if (typeof pending === 'function') await pending()
    else if (!pending) await service.join(groupId)
    pendingJoin.value = 'sync'
    awaitingMembership.value = {
      action: 'join',
      organization: organizations.value.find((item) => item.id === groupId) ?? { id: groupId },
    }
    await dashboard.sync(true)
  } catch (cause) {
    if (cause instanceof WalletEntryConfirmationPending) pendingJoin.value = cause.confirm
    else error.value = cause instanceof Error ? cause.message : wt('w81')
  } finally {
    joining.value = false
  }
}

function loadOrganizationDetail(): void {
  void detailQuery.value?.refresh()
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
  if (!service || !current || exitBusy.value || (!pendingExit.value && !exitDecision.value.allowed)) return
  exitBusy.value = true
  exitError.value = ''
  try {
    const pending = pendingExit.value
    if (typeof pending === 'function') await pending()
    else if (!pending) await service.leave(current.id)
    pendingExit.value = 'sync'
    awaitingMembership.value = {
      action: 'leave',
      organization: current.name === current.id ? { id: current.id } : current,
    }
    await dashboard.sync(true)
  } catch (cause) {
    if (cause instanceof WalletEntryConfirmationPending) pendingExit.value = cause.confirm
    else exitError.value = cause instanceof Error ? cause.message : wt('w85')
  } finally {
    exitBusy.value = false
  }
}

</script>

<template>
  <div class="wallet-page wallet-refined organization-page">
    <Teleport v-if="$slots['header-action']" defer to="#intro-organization">
      <slot name="header-action" />
    </Teleport>
    <WalletPageHeader v-else :title="wt('w86')" :description="wt('w87')" />

    <Teleport to="body">
      <InlineNotice
        v-if="membershipNotice"
        class="organization-membership-notice"
        tone="success"
        :title="wt(membershipNotice.action === 'join' ? 'organizationJoinConfirmed' : 'organizationExitConfirmed')"
        :action-label="wt('organizationDismissNotice')"
        @action="dismissMembershipNotice"
      >
        {{ organizationLabel(membershipNotice.organization) }}
      </InlineNotice>
    </Teleport>

    <section v-if="dashboard.current.organization" class="member-organization">
      <header v-if="!$slots['header-action']" class="member-organization__hero">
        <div>
          <span> {{ wt('w88') }} </span>
          <h2>{{ organizationLabel(dashboard.current.organization) }}</h2>
          <p class="mono">{{ wt('w47') }} {{ dashboard.current.organization.id }}</p>
          <StatusLabel tone="success">{{ wt('w89') }}</StatusLabel>
        </div>
        <WalletFigure kind="settle" />
      </header>

      <div v-if="detailBusy && !organizationDetail" class="organization-loading" role="status">{{ wt('w90') }}</div>
      <InlineNotice v-if="detailError" :title="wt('w91')" :tone="organizationDetail ? 'warning' : 'danger'">
        {{ organizationDetail ? wt('networkCachedData') : wl(detailError) }}
      </InlineNotice>
      <AppButton v-if="detailError && !organizationDetail" variant="ghost" :loading="detailBusy"
        @click="loadOrganizationDetail">{{ wt('refinement26') }}</AppButton>
      <template v-if="organizationDetail">
        <dl class="organization-metrics">
          <div>
            <dt>{{ wt('w92') }}</dt>
            <dd class="tabular">{{ groupedPledgeAmount(organizationDetail.pledgeAmount) }}</dd>
          </div>
          <div>
            <dt>{{ wt('w93') }}</dt>
            <dd class="tabular">{{ organizationDetail.guarantorCount }} {{ wCount('w94', organizationDetail.guarantorCount) }}</dd>
          </div>
          <div>
            <dt>{{ wt('w95') }}</dt>
            <dd class="tabular">{{ organizationDetail.certifierCount }} {{ wCount('w94', organizationDetail.certifierCount) }}</dd>
          </div>
          <div v-if="!$slots['header-action']">
            <dt>{{ wt('w96') }}</dt>
            <dd>{{ dashboard.current.organization.role === 'member' ? wt('refinement35') : dashboard.current.organization.role }}</dd>
          </div>
        </dl>

        <section class="organization-roster" aria-labelledby="organization-roster-title">
          <div class="wallet-section__heading">
            <h2 id="organization-roster-title">{{ wt('w98') }}</h2>
            <AppButton variant="ghost" :disabled="detailBusy" :aria-busy="detailBusy" @click="loadOrganizationDetail">
              {{ wt('w99') }}
              <template #icon><ArrowClockwise :size="15" aria-hidden="true" /></template>
            </AppButton>
          </div>
          <div class="organization-roster__groups">
            <details v-for="group in nodeGroups" :key="group.role" v-smooth-details>
              <summary class="organization-disclosure">
                <span class="wallet-record-icon" aria-hidden="true">
                  <component :is="group.icon" :size="18" weight="duotone" />
                </span>
                <strong>{{ group.title }}</strong>
                <span class="organization-disclosure__count tabular">{{ group.nodes.length }}</span>
                <CaretDown class="organization-disclosure__caret" :size="14" aria-hidden="true" />
              </summary>
              <div class="organization-roster__detail">
                <p>{{ group.description }}</p>
                <WalletPagedRows v-if="group.nodes.length" v-slot="{ rows }" :items="group.nodes" :label="group.title">
                  <ul>
                    <li v-for="node in rows" :key="`${group.role}-${node.id || node.peerId}`">
                      <div>
                        <strong>{{ node.id || group.title }}</strong>
                        <small v-if="node.peerId" class="mono">Peer · {{ node.peerId }}</small>
                        <small v-if="node.endpoint" class="mono">API · {{ node.endpoint }}</small>
                      </div>
                      <span>{{ nodeStatus(node.status) }}</span>
                    </li>
                  </ul>
                </WalletPagedRows>
                <p v-else>{{ wt('w100') }}</p>
              </div>
            </details>
          </div>
        </section>

        <details v-smooth-details class="organization-technical">
          <summary class="organization-disclosure">
            <span class="wallet-record-icon" aria-hidden="true">
              <PhBracketsCurly :size="17" weight="duotone" />
            </span>
            <strong>{{ wt('w101') }}</strong>
            <CaretDown class="organization-disclosure__caret" :size="14" aria-hidden="true" />
          </summary>
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
        <div class="organization-exit__copy">
          <h2 id="organization-exit-title">{{ wt('w104') }}</h2>
          <div role="status">
            <p v-if="exitStage === 'idle'">{{ wt('w105') }}</p>
            <p v-else-if="pendingExit">{{ wt('organizationExitPending') }}</p>
            <ul v-else-if="exitDecision.reasons.length">
              <li v-for="reason in exitDecision.reasons" :key="reason">{{ reason }}</li>
            </ul>
            <p v-else>{{ wt('w107') }}</p>
          </div>
        </div>
        <AppButton v-if="exitStage === 'idle'" variant="danger" @click="inspectExit">
          {{ wt('w106') }}
        </AppButton>
        <div v-else class="organization-exit__actions">
          <AppButton variant="ghost" :disabled="exitBusy" @click="exitStage = 'idle'">
            {{ wt('w108') }}
          </AppButton>
          <AppButton
            :variant="pendingExit ? 'secondary' : 'danger'"
            :disabled="!pendingExit && !exitDecision.allowed"
            :loading="exitBusy"
            @click="leaveOrganization"
          >
            {{ wt(pendingExit ? 'organizationExitCheck' : 'w109') }}
          </AppButton>
        </div>
        <InlineNotice v-if="exitError" :title="wt('w110')" tone="danger">{{
          wl(exitError)
        }}</InlineNotice>
      </section>
    </section>

    <section v-else class="organization-chooser" aria-labelledby="available-organizations-heading">
      <div class="wallet-section__heading">
        <div class="organization-catalog-title">
          <h2 id="available-organizations-heading">{{ wt('w111') }}</h2>
          <span class="detail-page-caption">{{ wt('w112') }}</span>
        </div>
        <WalletFigure v-if="!$slots['header-action']" kind="settle" />
      </div>
      <p class="organization-copy">{{ wt('w113') }}</p>
      <OrganizationChooser v-if="organizations.length" v-model="selected" :organizations="organizations" :disabled="joining || !!pendingJoin" />
      <div v-else-if="directory.data.value && !directoryLoading" class="wallet-empty">{{ wt('w114') }}</div>
      <InlineNotice v-if="directoryError" :title="wt('w115')" :tone="organizations.length && !error ? 'warning' : 'danger'">
        {{ organizations.length && !error ? wt('networkCachedData') : wl(directoryError) }}
      </InlineNotice>
      <InlineNotice v-else-if="pendingJoin" :title="wt('organizationJoinAwaiting')">
        {{ wt('entryConfirmationPending') }}
      </InlineNotice>
      <div class="organization-actions">
        <AppButton variant="secondary" :disabled="directoryLoading || joining" :loading="directoryLoading && !organizations.length" @click="loadOrganizations">
          {{ wt('w116') }}
        </AppButton>
        <AppButton :disabled="!pendingJoin && !hasSelection" :loading="joining" @click="join">
          {{ wt(pendingJoin ? 'organizationJoinCheck' : 'w117') }}
        </AppButton>
      </div>
    </section>

  </div>
</template>

<style scoped>
.organization-page {
  width: min(1120px, 100%);
}
.organization-membership-notice {
  position: fixed;
  z-index: 90;
  inset-block-start: max(16px, env(safe-area-inset-top));
  inset-inline-end: max(16px, env(safe-area-inset-right));
  width: min(22rem, calc(100% - 32px));
  box-sizing: border-box;
}
.organization-chooser {
  display: grid;
  gap: 1rem;
}
.organization-catalog-title {
  display: grid;
  gap: 4px;
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
  align-items: center;
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
.organization-roster__groups {
  border-top: 1px solid var(--hairline);
}
.organization-roster__groups > details + details,
.organization-technical {
  border-top: 1px solid var(--hairline);
}
.organization-disclosure {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto 14px;
  align-items: center;
  gap: 10px;
  min-height: 50px;
  padding: 4px 2px;
  border-radius: 8px;
  list-style: none;
  cursor: pointer;
}
.organization-disclosure::-webkit-details-marker {
  display: none;
}
.organization-disclosure strong {
  font-size: 0.82rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.organization-disclosure__count,
.organization-disclosure__caret {
  color: var(--text-muted);
}
.organization-disclosure__count {
  font-size: 0.75rem;
}
.organization-disclosure__caret {
  grid-column: 4;
  transition: transform 180ms var(--ease-standard);
}
details[open] > .organization-disclosure .organization-disclosure__caret {
  transform: rotate(180deg);
}
.organization-roster__detail {
  padding: 4px 0 12px 43px;
}
.organization-roster__detail > p,
.organization-roster li small,
.organization-roster li > span {
  color: var(--text-muted);
  font-size: 0.72rem;
}
.organization-roster__detail > p {
  margin: 0;
  line-height: 1.5;
}
.organization-roster__detail > p + p {
  margin-top: 6px;
}
.organization-roster ul {
  margin: 0.45rem 0 0;
  padding: 0;
  list-style: none;
}
.organization-roster li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  padding-block: 0.5rem;
  border-top: 1px solid var(--hairline);
}
.organization-roster li > div {
  display: grid;
  gap: 0.2rem;
  overflow-wrap: anywhere;
}
.organization-technical {
  border-bottom: 1px solid var(--hairline);
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
  align-items: center;
  gap: 1rem;
  padding-top: 1.2rem;
  border-top: 1px solid var(--hairline);
}
.organization-exit__copy {
  display: grid;
  gap: 0.3rem;
}
.organization-exit__copy ul {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  padding-left: 1.1rem;
  color: var(--danger);
  font-size: 0.76rem;
}
.organization-exit__actions {
  display: flex;
  flex-wrap: wrap;
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
  .organization-technical dl {
    grid-template-columns: 1fr;
  }
  .organization-roster__detail {
    padding-inline-start: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .organization-disclosure__caret {
    transition: none;
  }
}
</style>
