<script setup lang="ts">
import AnimatedNumber from '@/components/AnimatedNumber.vue'
import { addressLabel, wCount, wt, wl, walletLocale } from '@/i18n/walletText'
import {
  PhCaretDown as CaretDown,
  PhCaretUp as CaretUp,
  PhArrowDown as ArrowDown,
  PhArrowUpRight as ArrowUpRight,
  PhWallet,
} from '@phosphor-icons/vue'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import OverviewDetail from '@/components/OverviewDetail.vue'
import WalletOverviewEditor from '@/components/WalletOverviewEditor.vue'
import WalletWelcomeGuide from '@/components/WalletWelcomeGuide.vue'
import WalletOverviewCardControls from '@/components/WalletOverviewCardControls.vue'
import { useOverviewCardDrag } from '@/composables/useOverviewCardDrag'
import { overviewCards, overviewEditRequestKey, panelFromHash } from '@/wallet/overviewPanels'
import {
  defaultOverviewLayout, moveOverviewCard, overviewCardTitles, placeOverviewCards, readOverviewLayout, saveOverviewLayout,
  type OverviewCardId, type OverviewCardPreference,
} from '@/wallet/overviewLayout'
import WalletSendView from './WalletSendView.vue'
import '@/styles/wallet-overview.css'

import { useWalletStore } from '@/stores/wallet'
import { assetIdentityForType } from '@/wallet/dashboard'
import StatusLabel from '@/components/StatusLabel.vue'
import WalletBalanceField from '@/components/WalletBalanceField.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import WalletNetworkOverview from '@/components/WalletNetworkOverview.vue'
import WalletFigure from '@/components/WalletFigure.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useWalletActivities } from '@/composables/useWalletActivities'
import { unlockPhase } from '@/composables/useEntryUnlock'
import { takeWelcomeGuide } from '@/wallet/welcomeGuide'

const route = useRoute()
const router = useRouter()
const overviewEditRequested = inject(overviewEditRequestKey, undefined)
const active = ref(panelFromHash(route.hash))
const sendOpen = computed(() => active.value === 'send')
const sendVisited = ref(sendOpen.value)
const initialAddress = ref<string>()
const overview = ref<HTMLElement>()
let morph: ViewTransition | undefined
let returnSelector = ''
let returnToShell: HTMLElement | undefined

function toggleSend(open: boolean) {
  void router.push({ path: '/wallet', query: route.query, hash: open ? '#send' : '' })
}

function openAddress(address: string) {
  initialAddress.value = address
  void router.push({ path: '/wallet', query: route.query, hash: '#addresses' })
}

function visibleAccountTrigger(): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('[data-account-trigger]')]
    .find((button) => button.getClientRects().length)
}

watch(
  () => route.hash,
  async (hash) => {
    if (route.path !== '/wallet') return
    const panel = panelFromHash(hash)
    if (panel && editingLayout.value) {
      cardDrag.cancel()
      draftLayout.value = undefined
    }
    const previous = active.value
    if (panel === previous && !morph) return
    morph?.skipTransition()
    const origin = panel ?? previous
    if (!origin) return
    const card = overview.value?.querySelector<HTMLElement>(
      `[data-card="${overviewCards[origin]}"]`,
    )
    const trigger = origin === 'send' ? '[data-send-trigger], a[href$="#send"]' : `a[href$="#${origin}"]`
    if (panel) {
      const focused = document.activeElement as HTMLElement | null
      returnSelector =
        focused?.matches(trigger) && focused.classList.contains('text-action')
          ? '.text-action'
          : focused?.matches(trigger) && focused.classList.contains('network-detail')
            ? '.network-detail'
            : trigger
      returnToShell =
        focused?.matches(trigger) && !overview.value?.contains(focused) ? focused : undefined
    }
    const update = async () => {
      if (route.path !== '/wallet' || route.hash !== hash) return
      if (panel === 'send') sendVisited.value = true
      active.value = panel
      await nextTick()
      const visibleCard = card && card.style.display !== 'none' ? card : undefined
      const shellTrigger = returnToShell?.getClientRects().length ? returnToShell : undefined
      const menuTrigger = visibleAccountTrigger()
      const addressRow =
        origin === 'addresses'
          ? visibleCard?.querySelector<HTMLElement>('[data-initial-address-row]')
          : undefined
      const target =
        addressRow ??
        (panel
          ? visibleCard?.querySelector<HTMLElement>(panel === 'send' ? '[data-close-send]' : '[data-close-panel]')
          : shellTrigger ??
          visibleCard?.querySelector<HTMLElement>(returnSelector || trigger) ??
          [...document.querySelectorAll<HTMLElement>(trigger)].find(
            (link) => link.getClientRects().length > 0,
          ) ??
          menuTrigger)
      target?.focus({ preventScroll: true })
      if (addressRow) {
        const record = addressRow.closest('details') ?? addressRow
        const bounds = record.getBoundingClientRect()
        if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
          record.scrollIntoView({ block: 'nearest', behavior: 'instant' })
        }
      } else if (visibleCard) {
        const box = visibleCard.getBoundingClientRect()
        const summary = panel ? visibleCard.querySelector(':scope > .overview-summary') : null
        const visibleBottom = summary?.getBoundingClientRect().bottom ?? box.top
        if ((panel && shellTrigger) || box.top < 0 || visibleBottom >= window.innerHeight) {
          visibleCard.scrollIntoView({ block: 'start', behavior: 'instant' })
        }
      }
    }
    if (
      !document.startViewTransition ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      await update()
      return
    }
    document.documentElement.classList.add('wallet-send-morph')
    document.documentElement.dataset.morphCard = overviewCards[origin]
    document.documentElement.dataset.morphPanel = origin
    const current = document.startViewTransition(update)
    morph = current
    try {
      await current.finished
    } finally {
      if (morph === current) {
        morph = undefined
        document.documentElement.classList.remove('wallet-send-morph')
        delete document.documentElement.dataset.morphCard
        delete document.documentElement.dataset.morphPanel
      }
    }
  },
)
onMounted(() => {
  const initial = active.value
  if (initial)
    overview.value
      ?.querySelector<HTMLElement>(`[data-card="${overviewCards[initial]}"]`)
      ?.scrollIntoView({ block: 'start', behavior: 'instant' })
})
onBeforeUnmount(() => {
  morph?.skipTransition()
})

const dashboard = useDashboardStore()
const wallet = useWalletStore()
const layout = ref(readOverviewLayout(wallet.accountId))
const draftLayout = ref<OverviewCardPreference[]>()
const dragLayout = ref<OverviewCardPreference[]>()
const editingLayout = computed(() => !!draftLayout.value)
const editor = ref<InstanceType<typeof WalletOverviewEditor>>()
const hiddenCards = computed(() => draftLayout.value?.filter((card) => !card.visible) ?? [])
const layoutAnnouncement = ref('')
const layoutSaveError = ref(false)
const cards = computed(() => {
  const card = active.value ? overviewCards[active.value] : undefined
  return placeOverviewCards(dragLayout.value ?? draftLayout.value ?? layout.value, card)
})
const showEmptyLayout = computed(() => !cards.value.some((card) => card.visible))

watch(() => wallet.accountId, (accountId) => {
  cardDrag.cancel()
  layout.value = readOverviewLayout(accountId)
  draftLayout.value = undefined
})

function focusLayoutControl(selector: string): void {
  overview.value?.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true })
}

async function editLayout(): Promise<void> {
  if (editingLayout.value) {
    editor.value?.focusAdd()
    return
  }
  if (active.value) {
    await router.push({ path: '/wallet', query: route.query })
    morph?.skipTransition()
    await morph?.finished
  }
  layoutSaveError.value = false
  layoutAnnouncement.value = ''
  draftLayout.value = layout.value.map((card) => ({ ...card }))
  await nextTick()
  editor.value?.focusAdd()
}

async function closeLayout(): Promise<void> {
  cardDrag.cancel()
  draftLayout.value = undefined
  await nextTick()
  visibleAccountTrigger()?.focus({ preventScroll: true })
}

async function hideCard(id: OverviewCardId): Promise<void> {
  const card = draftLayout.value?.find((item) => item.id === id)
  if (!card) return
  card.visible = false
  await nextTick()
  editor.value?.focusAdd()
}

async function addCard(id: OverviewCardId): Promise<void> {
  const draft = draftLayout.value
  if (!draft) return
  const index = draft.findIndex((card) => card.id === id && !card.visible)
  if (index < 0) return
  draft.splice(index, 1)
  draft.push({ id, visible: true })
  await nextTick()
  editor.value?.focusAdd()
}

async function announceCardPosition(id: OverviewCardId, updated: OverviewCardPreference[]): Promise<void> {
  const position = updated.filter((item) => item.visible).findIndex((item) => item.id === id) + 1
  layoutAnnouncement.value = wt('overviewLayoutMoved', [wt(overviewCardTitles[id]), position])
  await nextTick()
  focusLayoutControl(`[data-card="${id}"] [data-overview-grip]`)
}

function moveCardBy(id: OverviewCardId, direction: -1 | 1): void {
  const draft = draftLayout.value
  if (!draft || dragLayout.value) return
  const visible = cards.value.filter((card) => card.visible)
  const destination = visible[visible.findIndex((card) => card.id === id) + direction]
  if (!destination) return
  const updated = moveOverviewCard(draft, id, destination.id)
  draftLayout.value = updated
  void announceCardPosition(id, updated)
}

const cardDrag = useOverviewCardDrag({
  preview(id, target) {
    const current = dragLayout.value ?? draftLayout.value
    if (current) dragLayout.value = moveOverviewCard(current, id, target)
  },
  finish(id, commit) {
    const preview = dragLayout.value
    dragLayout.value = undefined
    if (!commit || !preview) return
    draftLayout.value = preview
    void announceCardPosition(id, preview)
  },
})

function applyLayout(): void {
  const updated = draftLayout.value
  if (!updated) return
  try {
    saveOverviewLayout(wallet.accountId, updated)
    layout.value = updated.map((card) => ({ ...card }))
    void closeLayout()
  } catch {
    layoutSaveError.value = true
  }
}

if (overviewEditRequested) {
  watch(overviewEditRequested, (requested) => {
    if (!requested) return
    overviewEditRequested.value = false
    void editLayout()
  }, { immediate: true })
}

const activities = useWalletActivities()
const receiveAddresses = computed(() =>
  wallet.addresses.flatMap((item, index) => {
    const metadata = wallet.metadata?.addresses[item.address]
    if (metadata?.registration !== 'active' || metadata.archived) return []
    return [{
      address: item.address,
      label: addressLabel(metadata.label, index + 1) || wt('w357', [assetIdentityForType(item.type).symbol]),
    }]
  }),
)
const snapshotReady = computed(() => dashboard.current.source !== 'empty')
const securityLabel = computed(() =>
  !snapshotReady.value
    ? wt('w19')
    : dashboard.offline
      ? wt('w380')
      : dashboard.current.security.isolatedCount
        ? wt('refinement32')
        : dashboard.current.credentials.length
          ? wt('w126')
          : wt('refinement33'),
)
const securityTone = computed(() =>
  !snapshotReady.value || dashboard.offline
    ? 'warning'
    : dashboard.current.security.isolatedCount
      ? 'danger'
      : 'neutral',
)
const outgoingCount = computed(() => activities.value.filter((item) => item.direction === 'out').length)
const primaryAsset = computed(() => dashboard.current.assets[0])
const welcomeOpen = ref(false)
watch(
  [overview, () => wallet.accountId, unlockPhase, active, editingLayout],
  ([element, accountId, phase, panel, editing]) => {
    if (panel || editing) welcomeOpen.value = false
    else if (element && phase === 'idle' && takeWelcomeGuide(accountId)) welcomeOpen.value = true
  },
  { flush: 'post' },
)

async function refresh(): Promise<void> {
  await dashboard.sync(true)
}
</script>
<template>
  <div ref="overview" class="wallet-page overview" tabindex="-1" :class="{ 'overview--editing': editingLayout }">
    <h1 class="sr-only">{{ wt('refinement34') }}</h1>
    <WalletWelcomeGuide v-if="welcomeOpen && overview" :overview="overview" @close="welcomeOpen = false" />
    <p v-if="dashboard.offline" class="wallet-notice wallet-notice--warning">
      {{ wt('refinement39') }}
    </p>
    <p v-if="dashboard.error" class="wallet-notice wallet-notice--warning">
      {{ wt('w132') }}{{ wl(dashboard.error) }}
    </p>

    <WalletOverviewEditor
      ref="editor"
      v-if="editingLayout"
      :hidden-cards="hiddenCards"
      :save-error="layoutSaveError"
      @add="addCard"
      @restore="draftLayout = defaultOverviewLayout()"
      @close="closeLayout"
      @save="applyLayout"
    />
    <p v-if="editingLayout" class="sr-only" role="status">{{ layoutAnnouncement }}</p>
    <p v-if="showEmptyLayout" class="overview-layout-empty">{{ wt('overviewEmptyLayout') }}</p>
    <div
      v-show="!showEmptyLayout"
      class="overview-card-grid"
      :class="{ 'is-editing': editingLayout }"
      @pointerdown="editingLayout && cardDrag.start($event)"
      @pointermove="cardDrag.move"
      @pointerup="cardDrag.finish"
      @pointercancel="cardDrag.interrupt"
      @lostpointercapture="cardDrag.interrupt"
    >
      <template v-for="card in cards" :key="card.id">
        <div
          v-if="card.id === 'balance'"
          v-show="card.visible"
          data-card="balance"
          :data-overview-edge="card.edge"
          class="overview-send-card"
          :class="{ 'is-expanded': sendOpen || active === 'receive' }"
        >
          <WalletOverviewCardControls
            v-if="editingLayout && card.visible"
            :card="card.id"
            @remove="hideCard(card.id)"
            @move="moveCardBy(card.id, $event)"
          />
          <WalletBalanceField
            class="overview-summary"
            :inert="editingLayout"
            :panel="active"
            @send="toggleSend(!sendOpen)"
            :asset="primaryAsset"
            :assets="dashboard.current.assets"
            :updated-at="dashboard.current.updatedAt"
            :offline="dashboard.offline"
            :loading="dashboard.loading"
            @refresh="refresh"
          >
            <div v-show="sendOpen" id="intro-send" class="balance-intro"></div>
            <div v-show="active === 'receive'" id="intro-receive" class="balance-intro"></div>
          </WalletBalanceField>
          <OverviewDetail v-if="active === 'receive'" panel="receive" />
          <div v-show="sendOpen" id="overview-send">
            <WalletSendView v-if="sendVisited">
              <template #header-action>
                <button
                  type="button"
                  data-close-send
                  aria-expanded="true"
                  aria-controls="overview-send"
                  class="collapse-send"
                  :aria-label="wt('w365')"
                  :title="wt('w365')"
                  @click="toggleSend(false)"
                >
                  <CaretUp :size="20" aria-hidden="true" />
                </button>
              </template>
            </WalletSendView>
          </div>
        </div>
        <section
          v-else-if="card.id === 'security'"
          v-show="card.visible"
          data-card="security"
          :data-overview-edge="card.edge"
          :class="{ 'is-expanded': active === 'security' }"
          aria-labelledby="overview-security"
        >
          <WalletOverviewCardControls
            v-if="editingLayout && card.visible"
            :card="card.id"
            @remove="hideCard(card.id)"
            @move="moveCardBy(card.id, $event)"
          />
          <div class="overview-summary overview-panel security-preview" :inert="editingLayout">
            <WalletPageHeader
              v-if="active === 'security'"
              heading-id="overview-security"
              :title="wt('credentialDetails')"
              :description="securityLabel"
            >
              <div id="intro-security" class="overview-header-action"></div>
            </WalletPageHeader>
            <div v-else class="overview-panel__heading">
              <h2 id="overview-security">
                <RouterLink
                  to="/wallet#security"
                  aria-expanded="false"
                  aria-controls="detail-security"
                  >{{ wt('w177') }}</RouterLink
                >
              </h2>
              <StatusLabel :tone="securityTone">{{ securityLabel }}</StatusLabel>
            </div>
            <div class="overview-panel__body">
              <dl :class="active === 'security' ? 'overview-summary-metrics' : 'overview-metrics'">
                <div v-if="active === 'security'" class="overview-summary-metrics__primary">
                  <dt>{{ wt('w182') }}</dt>
                  <dd class="tabular">{{ snapshotReady ? dashboard.current.security.spendReady : '—' }} <small>CAL</small></dd>
                </div>
                <div>
                  <dt>{{ wt('refinement36') }}</dt>
                  <dd class="tabular">
                    <AnimatedNumber
                      :value="snapshotReady ? dashboard.current.credentials.length : null"
                    />
                  </dd>
                </div>
                <div>
                  <dt>{{ wt('refinement37') }}</dt>
                  <dd class="tabular">
                    <AnimatedNumber
                      :value="snapshotReady ? dashboard.current.security.pendingAudits : null"
                    />
                  </dd>
                </div>
                <div :class="{ 'needs-attention': dashboard.current.security.isolatedCount }">
                  <dt>{{ wt('w188') }}</dt>
                  <dd class="tabular">
                    <AnimatedNumber
                      :value="snapshotReady ? dashboard.current.security.isolatedCount : null"
                    />
                  </dd>
                </div>
              </dl>
              <WalletFigure kind="stack" :intensity="0.3" />
            </div>
            <RouterLink
              v-if="active !== 'security'"
              class="text-action security-detail"
              to="/wallet#security"
              aria-expanded="false"
              aria-controls="detail-security"
            >
              {{ wt('refinement38') }}
              <ArrowUpRight :size="15" aria-hidden="true" />
            </RouterLink>
          </div>
          <OverviewDetail v-if="active === 'security'" panel="security" />
        </section>
        <section
          v-else-if="card.id === 'activity'"
          v-show="card.visible"
          data-card="activity"
          :data-overview-edge="card.edge"
          class="overview-disclosure"
          :class="{ 'is-expanded': active === 'activity' }"
          aria-labelledby="activity-heading"
        >
          <WalletOverviewCardControls
            v-if="editingLayout && card.visible"
            :card="card.id"
            @remove="hideCard(card.id)"
            @move="moveCardBy(card.id, $event)"
          />
          <div class="overview-summary overview-panel activity" :inert="editingLayout">
            <WalletPageHeader
              v-if="active === 'activity'"
              heading-id="activity-heading"
              :title="wt('w129')"
              :description="wt('overviewActivityIntro')"
            >
              <div id="intro-activity" class="overview-header-action"></div>
            </WalletPageHeader>
            <div v-else class="overview-panel__heading">
              <div class="activity-heading">
                <h2 id="activity-heading">{{ wt('w129') }}</h2>
                <span class="overview-caption">
                  {{ activities.length }} {{ wCount('refinement40', activities.length) }}
                </span>
              </div>
            </div>
            <div class="overview-panel__body activity-body">
              <dl v-if="active === 'activity'" class="overview-summary-metrics">
                <div class="overview-summary-metrics__primary">
                  <dt>{{ wt('w3') }}</dt>
                  <dd class="tabular">{{ activities.length }}</dd>
                </div>
                <div>
                  <dt>{{ wt('w7') }}</dt>
                  <dd class="tabular">{{ outgoingCount }}</dd>
                </div>
                <div>
                  <dt>{{ wt('w8') }}</dt>
                  <dd class="tabular">{{ activities.length - outgoingCount }}</dd>
                </div>
              </dl>
              <div v-else>
                <ul v-if="activities.length">
                  <li v-for="item in activities.slice(0, 3)" :key="item.id">
                    <component
                      :is="item.direction === 'out' ? ArrowUpRight : ArrowDown"
                      :size="17"
                      aria-hidden="true"
                    />
                    <span>
                      <b>{{ item.title }}</b>
                      <small
                        >{{ item.statusLabel ?? wl(item.status) }} ·
                        {{ item.timestamp ? new Date(item.timestamp).toLocaleString(walletLocale()) : wt('w0') }}</small
                      >
                    </span>
                    <b class="tabular">{{ item.amount }}</b>
                  </li>
                </ul>
                <div v-else class="overview-empty">
                  <div>
                    <strong>{{ wt('refinement41') }}</strong>
                    <p>{{ wt('refinement42') }}</p>
                  </div>
                </div>
              </div>
              <WalletFigure kind="drawer" :intensity="0.35" />
            </div>
            <div
              v-if="active === 'activity' && activities.length"
              id="overview-activity-filters"
              class="overview-summary__footer"
            ></div>
            <RouterLink
              v-if="active !== 'activity'"
              class="text-action activity-detail"
              to="/wallet#activity"
              aria-expanded="false"
              aria-controls="detail-activity"
            >
              {{ wt('refinement43') }}
              <CaretDown :size="14" aria-hidden="true" />
            </RouterLink>
          </div>
          <OverviewDetail v-if="active === 'activity'" panel="activity" />
        </section>
        <section
          v-else-if="card.id === 'addresses-preview'"
          v-show="card.visible"
          data-card="addresses-preview"
          :data-overview-edge="card.edge"
          class="overview-disclosure receive-preview"
          :class="{ 'is-expanded': active === 'addresses' }"
          aria-labelledby="receive-heading"
        >
          <WalletOverviewCardControls
            v-if="editingLayout && card.visible"
            :card="card.id"
            @remove="hideCard(card.id)"
            @move="moveCardBy(card.id, $event)"
          />
          <div class="overview-summary overview-panel" :inert="editingLayout">
            <WalletPageHeader
              v-if="active === 'addresses'"
              heading-id="receive-heading"
              :title="wt('w144')"
              :description="wt('overviewAddressesIntro')"
            >
              <div id="intro-addresses" class="overview-header-action"></div>
            </WalletPageHeader>
            <div v-else class="overview-panel__heading">
              <div class="receive-heading">
                <h2 id="receive-heading">{{ wt('w144') }}</h2>
                <span class="overview-caption">
                  {{ receiveAddresses.length }} {{ wCount('refinement2', receiveAddresses.length) }}
                </span>
              </div>
            </div>
            <div class="overview-panel__body">
              <dl v-if="active === 'addresses'" class="overview-summary-metrics">
                <div class="overview-summary-metrics__primary">
                  <dt>{{ wt('addressTotal') }}</dt>
                  <dd class="tabular">{{ wallet.addresses.length }}</dd>
                </div>
                <div>
                  <dt>{{ wt('activeAddresses') }}</dt>
                  <dd class="tabular">{{ wallet.activeAddresses.length }}</dd>
                </div>
                <div>
                  <dt>{{ wt('w371') }}</dt>
                  <dd class="tabular">{{ wallet.addresses.length - wallet.activeAddresses.length }}</dd>
                </div>
              </dl>
              <div v-else class="receive-copy">
                <ul v-if="receiveAddresses.length" class="receive-addresses">
                  <li v-for="item in receiveAddresses.slice(0, 3)" :key="item.address">
                    <button
                      type="button"
                      class="receive-address-trigger"
                      :data-initial-address-row="item.address === initialAddress ? '' : undefined"
                      aria-expanded="false"
                      aria-controls="detail-addresses"
                      @click="openAddress(item.address)"
                    >
                      <span class="wallet-record-icon" aria-hidden="true">
                        <PhWallet :size="18" weight="duotone" />
                      </span>
                      <span class="receive-address-identity">
                        <strong>{{ item.label }}</strong>
                        <code>{{ item.address }}</code>
                      </span>
                      <CaretDown :size="14" class="receive-address-caret" aria-hidden="true" />
                    </button>
                  </li>
                </ul>
                <p v-else class="overview-caption">{{ wt('refinement44') }}</p>
              </div>
              <WalletFigure kind="phone" :intensity="0.25" />
            </div>
            <RouterLink
              v-if="active !== 'addresses'"
              class="text-action address-detail-link"
              :to="{ path: '/wallet', query: route.query, hash: '#addresses' }"
              aria-expanded="false"
              aria-controls="detail-addresses"
              @click="initialAddress = undefined"
            >
              {{ wt('viewAddressDetails') }}
              <CaretDown :size="14" aria-hidden="true" />
            </RouterLink>
          </div>
          <OverviewDetail v-if="active === 'addresses'" panel="addresses" :initial-address="initialAddress" />
        </section>
        <WalletNetworkOverview
          v-else
          :card="card.id"
          :edge="card.edge"
          :hidden="!card.visible"
          :editing="editingLayout"
          :active="active"
          :organization="dashboard.current.organization"
          :offline="dashboard.offline"
        >
          <template #edit-controls>
            <WalletOverviewCardControls
              v-if="editingLayout && card.visible"
              :card="card.id"
              @remove="hideCard(card.id)"
              @move="moveCardBy(card.id, $event)"
            />
          </template>
        </WalletNetworkOverview>
      </template>
    </div>
  </div>
</template>

<style scoped>
.overview {
  --wallet-page-gap: 1rem;
  container-type: inline-size;
}
.overview--editing { padding-bottom: calc(80px + env(safe-area-inset-bottom)); }
.overview-layout-empty {
  margin: 0;
  padding-block: 1.2rem;
  color: var(--text-muted);
  font-size: 0.875rem;
}
.text-action {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 44px;
  padding: 0;
  border-radius: 8px;
  color: var(--text-muted);
  font-size: 0.75rem;
  background: transparent;
  cursor: pointer;
}
.text-action:hover {
  color: var(--text);
}
.security-detail {
  align-self: flex-start;
  margin-top: auto;
}
.needs-attention {
  color: var(--danger);
}
.activity-detail,
.address-detail-link {
  align-self: flex-start;
  margin-top: auto;
}
.activity-heading,
.receive-heading {
  display: flex;
  flex-wrap: wrap;
  flex: 1;
  align-items: baseline;
  gap: 2px 10px;
  min-width: 0;
}
[data-card='activity']:not(.is-expanded) .activity-heading,
.receive-preview:not(.is-expanded) .receive-heading {
  justify-content: space-between;
}
.activity ul {
  padding: 0;
  margin: 0;
  list-style: none;
}
.activity li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.4rem;
  align-items: center;
  min-height: 54px;
  border-bottom: 1px solid var(--hairline);
}
.activity li > span {
  display: grid;
  gap: 0.2rem;
}
.activity li b {
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}
.activity li small {
  color: var(--text-muted);
  font-size: 0.65rem;
  line-height: 1.5;
}
.overview-empty strong {
  font-size: 0.85rem;
  font-weight: 500;
}
.overview-empty p {
  margin: 0.5rem 0 0;
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.7;
}
.receive-copy {
  min-width: 0;
}
.receive-addresses {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}
.receive-addresses > li {
  border-bottom: 1px solid var(--hairline);
}
.receive-address-trigger {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 54px;
  padding: 6px 2px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  text-align: start;
}
.receive-address-trigger:hover {
  background: var(--surface-hover);
}
.receive-address-trigger:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: -2px;
}
.receive-address-caret {
  color: var(--text-muted);
}
.receive-address-identity {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.receive-address-identity strong {
  color: var(--text);
  font-size: 0.8rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.receive-address-identity code {
  color: var(--text-muted);
  font: 0.68rem/1.55 var(--font-mono);
  overflow-wrap: anywhere;
}
.security-preview h2 a {
  color: inherit;
}
.security-preview h2 a:hover {
  color: var(--accent);
}
.receive-preview .overview-panel__body {
  align-items: start;
  margin-bottom: 0.5rem;
}
@container (max-width: 440px) {
  .receive-preview {
    --overview-figure-width: 68px;
  }
}
</style>
