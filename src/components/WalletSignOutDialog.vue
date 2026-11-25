<script setup lang="ts">
import { ref } from 'vue'

import WalletRemovalDialog from '@/components/WalletRemovalDialog.vue'
import { wt } from '@/i18n/walletText'
import { useDashboardStore } from '@/stores/dashboard'
import { useWalletStore } from '@/stores/wallet'

const open = defineModel<boolean>('open', { required: true })
const wallet = useWalletStore()
const dashboard = useDashboardStore()
const phase = ref<'clearing' | 'returning'>()
const error = ref('')

function close(): void {
  error.value = ''
  open.value = false
}

async function signOut(): Promise<void> {
  if (phase.value || wallet.busy) return
  phase.value = 'clearing'
  error.value = ''
  try {
    dashboard.reset()
    await wallet.clearLocalWallet()
  } catch {
    error.value = wt('signOutError')
    phase.value = undefined
    return
  }

  phase.value = 'returning'
  try {
    sessionStorage.setItem('pangupay.wallet-exit', '1')
  } catch {
    // The visual handoff is optional if session storage is unavailable.
  }
  // A fresh document also releases all in-memory signing and monitoring state.
  window.location.replace(import.meta.env.BASE_URL)
}
</script>

<template>
  <WalletRemovalDialog :open="open" :phase="phase" :error="error" @close="close" @confirm="signOut" />
</template>
