import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import LandingView from '@/views/LandingView.vue'
import WalletLayout from '@/layouts/WalletLayout.vue'
import WalletActivityView from '@/views/wallet/WalletActivityView.vue'
import WalletBlockchainView from '@/views/wallet/WalletBlockchainView.vue'
import WalletOrganizationView from '@/views/wallet/WalletOrganizationView.vue'
import WalletOverviewView from '@/views/wallet/WalletOverviewView.vue'
import WalletReceiveView from '@/views/wallet/WalletReceiveView.vue'
import WalletRecoveryView from '@/views/wallet/WalletRecoveryView.vue'
import WalletSecurityView from '@/views/wallet/WalletSecurityView.vue'
import WalletSettingsView from '@/views/wallet/WalletSettingsView.vue'
import WalletSetupView from '@/views/wallet/WalletSetupView.vue'
import WalletEntryView from '@/views/wallet/WalletEntryView.vue'
import WalletUnlockView from '@/views/wallet/WalletUnlockView.vue'
import { pinia } from '@/stores/pinia'
import { useWalletStore } from '@/stores/wallet'
import { overviewCards, panelFromHash } from '@/wallet/overviewPanels'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'landing',
    component: LandingView,
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
    path: '/wallet/recover',
    name: 'wallet-recover',
    component: WalletRecoveryView,
  },
  {
    path: '/wallet/entry',
    name: 'wallet-entry',
    component: WalletEntryView,
    meta: { requiresWallet: true },
  },
  {
    path: '/wallet',
    component: WalletLayout,
    meta: { requiresWallet: true },
    children: [
      { path: '', name: 'wallet-overview', component: WalletOverviewView },
      { path: 'send', name: 'wallet-send', redirect: { name: 'wallet-overview', hash: '#send' } },
      { path: 'receive', name: 'wallet-receive', component: WalletReceiveView },
      { path: 'activity', name: 'wallet-activity', component: WalletActivityView },
      { path: 'security', name: 'wallet-security', component: WalletSecurityView },
      { path: 'blockchain', name: 'wallet-blockchain', component: WalletBlockchainView },
      {
        path: 'organization',
        name: 'wallet-organization',
        component: WalletOrganizationView,
      },
      { path: 'settings', name: 'wallet-settings', component: WalletSettingsView },
    ],
  },
]

if (import.meta.env.DEV) {
  routes.push({
    path: '/__foundation',
    name: 'foundation',
    component: () => import('@/views/FoundationView.vue'),
  })
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    if (from.name === 'wallet-settings' && savedPosition) return savedPosition
    if (to.path !== from.path) return { top: 0 }
    // Selecting an open panel again leaves the hash unchanged.
    if (to.name !== 'wallet-overview' || to.fullPath !== from.fullPath) return false
    const panel = panelFromHash(to.hash)
    if (!panel) return false
    const card = document.querySelector(`.overview [data-card="${overviewCards[panel]}"].is-expanded`)
    if (!card) return false
    return {
      el: card,
      top: Number.parseFloat(getComputedStyle(card).scrollMarginTop) || 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    }
  },
  routes,
})

router.beforeEach(async (to) => {
  if (to.name === 'wallet-overview' && to.hash === '#settings') {
    return { name: 'wallet-settings', query: to.query, replace: true }
  }
  const wallet = useWalletStore(pinia)
  await wallet.initialize()
  if (to.meta.requiresWallet && wallet.lifecycle !== 'unlocked') {
    return wallet.lifecycle === 'absent' ? '/wallet/setup' : '/wallet/unlock'
  }
  if (to.name === 'wallet-unlock') {
    if (wallet.lifecycle === 'absent') return '/wallet/setup'
    if (wallet.lifecycle === 'unlocked') return '/wallet/entry'
  }
  if (to.name === 'wallet-recover') {
    if (wallet.lifecycle === 'absent') return '/wallet/setup'
    if (wallet.lifecycle === 'unlocked') return '/wallet/entry'
  }
  if (to.name === 'wallet-setup' && wallet.lifecycle !== 'absent') {
    return wallet.lifecycle === 'unlocked' ? '/wallet/entry' : '/wallet/unlock'
  }
})

export default router
