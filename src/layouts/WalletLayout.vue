<script setup lang="ts">
import {
  PhClockCounterClockwise as ClockCounterClockwise,
  PhGear as Gear,
  PhHouse as House,
  PhPaperPlaneTilt as PaperPlaneTilt,
  PhShieldCheck as ShieldCheck,
  PhUsersThree as UsersThree,
} from '@phosphor-icons/vue'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import AppShell from '@/components/AppShell.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useWalletStore } from '@/stores/wallet'

const { t } = useI18n()
const router = useRouter()
const wallet = useWalletStore()
const dashboard = useDashboardStore()

const navItems = computed(() => [
  { label: t('wallet.nav.overview'), icon: House, to: '/wallet' },
  { label: t('wallet.nav.send'), icon: PaperPlaneTilt, to: '/wallet/send' },
  { label: t('wallet.nav.activity'), icon: ClockCounterClockwise, to: '/wallet/activity' },
  { label: t('wallet.nav.security'), icon: ShieldCheck, to: '/wallet/security' },
  { label: t('wallet.nav.organization'), icon: UsersThree, to: '/wallet/organization' },
  { label: t('wallet.nav.settings'), icon: Gear, to: '/wallet/settings' },
])

function lockWallet(): void {
  wallet.lock()
  dashboard.reset()
  void router.replace('/wallet/unlock')
}

onMounted(async () => {
  await dashboard.loadCache()
  void dashboard.sync()
})
</script>

<template>
  <AppShell
    :items="navItems"
    :navigation-label="t('wallet.nav.label')"
    :account-name="dashboard.current.displayName"
    :account-id="wallet.accountId"
    @lock="lockWallet"
  >
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
