import { createRouter, createWebHistory } from 'vue-router'

import FoundationView from '@/views/FoundationView.vue'
import LandingView from '@/views/LandingView.vue'
import LedgerPreviewView from '@/views/LedgerPreviewView.vue'
import WalletLayout from '@/layouts/WalletLayout.vue'
import WalletActivityView from '@/views/wallet/WalletActivityView.vue'
import WalletOrganizationView from '@/views/wallet/WalletOrganizationView.vue'
import WalletOverviewView from '@/views/wallet/WalletOverviewView.vue'
import WalletReceiveView from '@/views/wallet/WalletReceiveView.vue'
import WalletSecurityView from '@/views/wallet/WalletSecurityView.vue'
import WalletSendView from '@/views/wallet/WalletSendView.vue'
import WalletSettingsView from '@/views/wallet/WalletSettingsView.vue'
import WalletSetupView from '@/views/wallet/WalletSetupView.vue'
import WalletUnlockView from '@/views/wallet/WalletUnlockView.vue'
import { pinia } from '@/stores/pinia'
import { useWalletStore } from '@/stores/wallet'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: LandingView,
    },
    {
      path: '/__ledger-preview',
      name: 'ledger-preview',
      component: LedgerPreviewView,
    },
    {
      path: '/__foundation',
      name: 'foundation',
      component: FoundationView,
    },
    {
      path: '/wallet/setup',
      name: 'wallet-setup',
      component: WalletSetupView,
    },
    {
      path: '/wallet/unlock',
      name: 'wallet-unlock',
      component: WalletUnlockView,
    },
    {
      path: '/wallet',
      component: WalletLayout,
      meta: { requiresWallet: true },
      children: [
        { path: '', name: 'wallet-overview', component: WalletOverviewView },
        { path: 'send', name: 'wallet-send', component: WalletSendView },
        { path: 'receive', name: 'wallet-receive', component: WalletReceiveView },
        { path: 'activity', name: 'wallet-activity', component: WalletActivityView },
        { path: 'security', name: 'wallet-security', component: WalletSecurityView },
        {
          path: 'organization',
          name: 'wallet-organization',
          component: WalletOrganizationView,
        },
        { path: 'settings', name: 'wallet-settings', component: WalletSettingsView },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const wallet = useWalletStore(pinia)
  await wallet.initialize()
  if (to.meta.requiresWallet && wallet.lifecycle !== 'unlocked') {
    return wallet.lifecycle === 'absent' ? '/wallet/setup' : '/wallet/unlock'
  }
  if (to.name === 'wallet-unlock') {
    if (wallet.lifecycle === 'absent') return '/wallet/setup'
    if (wallet.lifecycle === 'unlocked') return '/wallet'
  }
  if (to.name === 'wallet-setup' && wallet.lifecycle !== 'absent') {
    return wallet.lifecycle === 'unlocked' ? '/wallet' : '/wallet/unlock'
  }
})

export default router
