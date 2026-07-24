import { createRouter, createWebHistory } from 'vue-router'

import FoundationView from '@/views/FoundationView.vue'
import LandingView from '@/views/LandingView.vue'
import LedgerPreviewView from '@/views/LedgerPreviewView.vue'

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
  ],
})

export default router
