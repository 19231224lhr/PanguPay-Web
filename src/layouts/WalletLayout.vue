<script setup lang="ts">
import {
  PhClockCounterClockwise as ClockCounterClockwise,
  PhCube as Cube,
  PhGear as Gear,
  PhHouse as House,
  PhPaperPlaneTilt as PaperPlaneTilt,
  PhShieldCheck as ShieldCheck,
  PhUsersThree as UsersThree,
  PhX as Close,
} from '@phosphor-icons/vue'
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import AppShell from '@/components/AppShell.vue'
import ValueFoldField from '@/components/ValueFoldField.vue'
import WalletSignOutDialog from '@/components/WalletSignOutDialog.vue'
import {
  createWalletNetwork,
  organizationRefreshInterval,
  walletNetworkKey,
} from '@/composables/useWalletNetwork'
import { wt } from '@/i18n/walletText'
import { addAmounts } from '@/protocol-v2/amount'
import { useDashboardStore } from '@/stores/dashboard'
import { useWalletStore } from '@/stores/wallet'
import { overviewEditRequestKey } from '@/wallet/overviewPanels'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const wallet = useWalletStore()
const dashboard = useDashboardStore()
const network = createWalletNetwork(dashboard.observeCertifiedBlock)
provide(walletNetworkKey, network)
const overviewEditRequested = ref(false)
provide(overviewEditRequestKey, overviewEditRequested)
const entryArrival = ref(false)
const keyboardNavigation = ref(false)
const showSignOut = ref(false)
const receiveMessage = computed(() =>
  dashboard.receiveNotices.length
    ? wt('receiveNotification', [addAmounts(...dashboard.receiveNotices.map((item) => item.amount))])
    : '',
)
let arrivalTimer: ReturnType<typeof setTimeout> | undefined
let networkTimer: ReturnType<typeof setInterval> | undefined

function detailLink(panel: string) {
  return route.path === '/wallet'
    ? { to: '/wallet#' + panel, current: route.hash === '#' + panel }
    : { to: '/wallet/' + panel, current: route.path === '/wallet/' + panel }
}

const navItems = computed(() => [
  { label: t('wallet.nav.overview'), icon: House, to: '/wallet', current: route.name === 'wallet-overview' && !route.hash },
  { label: t('wallet.nav.send'), icon: PaperPlaneTilt, to: '/wallet#send', current: route.hash === '#send' },
  { label: t('wallet.nav.activity'), icon: ClockCounterClockwise, ...detailLink('activity') },
  { label: t('wallet.nav.security'), icon: ShieldCheck, ...detailLink('security') },
  { label: t('wallet.nav.organization'), icon: UsersThree, ...detailLink('organization') },
  { label: t('wallet.nav.blockchain'), icon: Cube, ...detailLink('blockchain') },
])

const mobileItems = computed(() => navItems.value.slice(0, 4))

const settingsItem = computed(() => ({
  label: t('wallet.nav.settings'),
  icon: Gear,
  to: '/wallet/settings',
  current: route.name === 'wallet-settings',
}))

async function editOverviewCards(): Promise<void> {
  if (route.path !== '/wallet') await router.push({ path: '/wallet', query: route.query })
  if (route.path === '/wallet') overviewEditRequested.value = true
}

function lockWallet(): void {
  wallet.lock()
  dashboard.reset()
  void router.replace('/wallet/unlock')
}

function prefetchOrganization(): void {
  const current = dashboard.current.organization
  if (current) void network.organization(current).refresh(organizationRefreshInterval)
}

function refreshNetwork(): void {
  const livePanel = ['#blockchain', '#activity'].includes(route.hash) ||
    route.name === 'wallet-blockchain' || route.name === 'wallet-activity'
  void network.refreshChain(livePanel ? 3_000 : 30_000)
  void network.directory.refresh(organizationRefreshInterval)
  prefetchOrganization()
}

function refreshVisibleNetwork(): void {
  if (document.hidden) return
  refreshNetwork()
  dashboard.pollReceipts()
}

watch(() => dashboard.current.organization?.id, prefetchOrganization)

onMounted(async () => {
  if (sessionStorage.getItem('pangupay-wallet-entry-arrival') === '1') {
    sessionStorage.removeItem('pangupay-wallet-entry-arrival')
    entryArrival.value = true
    arrivalTimer = setTimeout(() => (entryArrival.value = false), 940)
  }
  await dashboard.loadCache()
  refreshNetwork()
  networkTimer = setInterval(refreshVisibleNetwork, 3_000)
  document.addEventListener('visibilitychange', refreshVisibleNetwork)
  void dashboard.sync()
})

onBeforeUnmount(() => {
  if (arrivalTimer) clearTimeout(arrivalTimer)
  clearInterval(networkTimer)
  document.removeEventListener('visibilitychange', refreshVisibleNetwork)
  network.dispose()
})
</script>

<template>
  <AppShell
    initially-collapsed
    @keydown.capture="keyboardNavigation = true"
    @pointerdown.capture="keyboardNavigation = false"
    :items="navItems"
    :mobile-items="mobileItems"
    :settings-item="settingsItem"
    :edit-cards-label="wt('overviewEditCards')"
    :navigation-label="t('wallet.nav.label')"
    :account-menu-label="t('wallet.account.openMenu')"
    :account-menu-navigation-label="t('wallet.account.menuLabel')"
    :account-name="dashboard.current.displayName"
    :account-id="wallet.accountId"
    :account-avatar="wallet.profile.avatarDataUrl"
    :lock-label="t('wallet.account.lock')"
    :sign-out-label="wt('signOut')"
    :more-label="t('wallet.account.my')"
    @edit-cards="editOverviewCards"
    @lock="lockWallet"
    @sign-out="showSignOut = true"
  >
    <div v-if="entryArrival" class="wallet-entry-arrival" aria-hidden="true">
      <ValueFoldField :intro="false" :active="true" label="" transition-name="pangu-value-fold" />
    </div>
    <div class="wallet-receive-notice" :data-visible="!!receiveMessage || undefined">
      <p role="status">{{ receiveMessage }}</p>
      <button
        v-if="receiveMessage"
        type="button"
        :aria-label="wt('dismissReceiveNotification')"
        @click="dashboard.dismissReceiveNotices"
      >
        <Close :size="17" aria-hidden="true" />
      </button>
    </div>
    <RouterView v-slot="{ Component }">
      <Transition name="wallet-page" :css="!keyboardNavigation">
        <component :is="Component" />
      </Transition>
    </RouterView>
    <WalletSignOutDialog v-model:open="showSignOut" />
  </AppShell>
</template>

<style>
.wallet-page-enter-active,
.wallet-page-leave-active {
  transition: opacity 140ms var(--ease-standard);
}

.wallet-page-leave-active {
  display: none;
  transition: none;
}

.wallet-page-enter-from {
  opacity: 0;
}

.wallet-page-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .wallet-page-enter-active,
  .wallet-page-leave-active {
    transition: opacity 120ms linear;
  }

  .wallet-page-enter-from,
  .wallet-page-leave-to {
    transform: none;
  }
}
</style>

<style scoped>
.wallet-receive-notice p {
  margin: 0;
}

.wallet-receive-notice[data-visible] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-block-end: 1rem;
  padding-inline-start: 1rem;
  border: 1px solid var(--hairline);
  border-radius: var(--radius-md);
  background: var(--surface-subtle);
  font-size: 0.85rem;
}

.wallet-receive-notice button {
  display: grid;
  min-width: 44px;
  min-height: 44px;
  flex: none;
  place-items: center;
  border-radius: inherit;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.wallet-receive-notice button:hover {
  color: var(--text);
}

.wallet-entry-arrival {
  position: fixed;
  z-index: 120;
  inset: 0;
  display: grid;
  overflow: hidden;
  background: var(--background);
  pointer-events: none;
  place-items: center;
  animation: wallet-entry-arrival 920ms var(--ease-standard) both;
}

.wallet-entry-arrival :deep(.value-fold-field) {
  width: min(46vw, 560px);
}

@keyframes wallet-entry-arrival {
  0%,
  62% {
    opacity: 1;
    filter: brightness(1);
  }
  78% {
    opacity: 0.94;
    filter: brightness(1.28);
  }
  100% {
    opacity: 0;
    filter: brightness(1.55);
    transform: scale(0.975);
  }
}

@media (prefers-reduced-motion: reduce) {
  .wallet-entry-arrival {
    animation: simple-crossfade 120ms linear both;
  }
}
</style>
