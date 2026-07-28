<script setup lang="ts">
import {
  PhClockCounterClockwise as ClockCounterClockwise,
  PhGear as Gear,
  PhHouse as House,
  PhPaperPlaneTilt as PaperPlaneTilt,
  PhShieldCheck as ShieldCheck,
  PhUsersThree as UsersThree,
} from '@phosphor-icons/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import AppShell from '@/components/AppShell.vue'
import ValueFoldField from '@/components/ValueFoldField.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useWalletStore } from '@/stores/wallet'

const { t } = useI18n()
const router = useRouter()
const wallet = useWalletStore()
const dashboard = useDashboardStore()
const entryArrival = ref(false)
let arrivalTimer: ReturnType<typeof setTimeout> | undefined

const navItems = computed(() => [
  { label: t('wallet.nav.overview'), icon: House, to: '/wallet' },
  { label: t('wallet.nav.send'), icon: PaperPlaneTilt, to: '/wallet/send' },
  { label: t('wallet.nav.activity'), icon: ClockCounterClockwise, to: '/wallet/activity' },
  { label: t('wallet.nav.security'), icon: ShieldCheck, to: '/wallet/security' },
])

const accountItems = computed(() => [
  { label: t('wallet.nav.organization'), icon: UsersThree, to: '/wallet/organization' },
])

const utilityItems = computed(() => [
  { label: t('wallet.nav.settings'), icon: Gear, to: '/wallet/settings' },
])

function lockWallet(): void {
  wallet.lock()
  dashboard.reset()
  void router.replace('/wallet/unlock')
}

onMounted(async () => {
  if (sessionStorage.getItem('pangupay-wallet-entry-arrival') === '1') {
    sessionStorage.removeItem('pangupay-wallet-entry-arrival')
    entryArrival.value = true
    arrivalTimer = setTimeout(() => (entryArrival.value = false), 720)
  }
  await dashboard.loadCache()
  void dashboard.sync()
})

onBeforeUnmount(() => {
  if (arrivalTimer) clearTimeout(arrivalTimer)
})
</script>

<template>
  <AppShell
    :items="navItems"
    :account-items="accountItems"
    :utility-items="utilityItems"
    :navigation-label="t('wallet.nav.label')"
    :account-menu-label="t('wallet.account.openMenu')"
    :account-name="dashboard.current.displayName"
    :account-id="wallet.accountId"
    :lock-label="t('wallet.account.lock')"
    :more-label="t('wallet.account.my')"
    @lock="lockWallet"
  >
    <div v-if="entryArrival" class="wallet-entry-arrival" aria-hidden="true">
      <ValueFoldField :intro="false" :active="true" label="" transition-name="pangu-value-fold" />
    </div>
    <RouterView v-slot="{ Component }">
      <Transition name="wallet-page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </AppShell>
</template>

<style>
.wallet-page-enter-active,
.wallet-page-leave-active {
  transition:
    opacity 190ms var(--ease-standard),
    transform 190ms var(--ease-standard);
}

.wallet-page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.wallet-page-leave-to {
  opacity: 0;
  transform: translateY(-3px);
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
.wallet-entry-arrival {
  position: fixed;
  z-index: 120;
  inset: 0;
  display: grid;
  overflow: hidden;
  background: color-mix(in srgb, var(--background) 36%, transparent);
  pointer-events: none;
  place-items: center;
  animation: wallet-entry-arrival 720ms var(--ease-standard) both;
}

.wallet-entry-arrival :deep(.value-fold-field) {
  width: min(46vw, 560px);
}

@keyframes wallet-entry-arrival {
  0%,
  48% {
    opacity: 1;
    filter: brightness(1);
  }
  68% {
    opacity: 0.94;
    filter: brightness(1.35);
  }
  100% {
    opacity: 0;
    filter: brightness(1.7);
    transform: scale(0.965);
  }
}

@media (prefers-reduced-motion: reduce) {
  .wallet-entry-arrival {
    animation: simple-crossfade 120ms linear both;
  }
}
</style>
