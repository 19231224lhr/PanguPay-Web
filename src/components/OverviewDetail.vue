<script setup lang="ts">
import { PhCaretUp } from '@phosphor-icons/vue'
import { useRoute } from 'vue-router'
import { wt } from '@/i18n/walletText'
import type { OverviewPanel } from '@/wallet/overviewPanels'
import WalletAddressLedger from './WalletAddressLedger.vue'
import WalletReceiveView from '@/views/wallet/WalletReceiveView.vue'
import WalletSecurityView from '@/views/wallet/WalletSecurityView.vue'
import WalletActivityView from '@/views/wallet/WalletActivityView.vue'
import WalletOrganizationView from '@/views/wallet/WalletOrganizationView.vue'
import WalletBlockchainView from '@/views/wallet/WalletBlockchainView.vue'

defineProps<{ panel: Exclude<OverviewPanel, 'send'>; initialAddress?: string }>()
const route = useRoute()
const views = {
  receive: WalletReceiveView,
  security: WalletSecurityView,
  activity: WalletActivityView,
  addresses: WalletAddressLedger,
  organization: WalletOrganizationView,
  blockchain: WalletBlockchainView,
}
</script>

<template>
  <div class="overview-detail" :id="'detail-' + panel">
    <component :is="views[panel]" v-bind="panel === 'addresses' ? { initialAddress } : {}">
      <template #header-action>
        <button
          type="button"
          class="collapse-send"
          :aria-label="wt('w365')"
          :title="wt('w365')"
          data-close-panel
          :aria-controls="'detail-' + panel"
          aria-expanded="true"
          @click="$router.push({ path: '/wallet', query: route.query })"
        >
          <PhCaretUp :size="20" aria-hidden="true" />
        </button>
      </template>
    </component>
  </div>
</template>
