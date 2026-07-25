<script setup lang="ts">
import { PhDownloadSimple as DownloadSimple, PhLockKey as LockKey } from '@phosphor-icons/vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useWalletStore } from '@/stores/wallet'

const wallet = useWalletStore()
const dashboard = useDashboardStore()
const router = useRouter()

function exportWallet(): void {
  const blob = new Blob([JSON.stringify(wallet.exportEnvelope(), null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'wallet.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

function lock(): void {
  wallet.lock()
  dashboard.reset()
  void router.replace('/wallet/unlock')
}
</script>

<template>
  <div class="wallet-page">
    <WalletPageHeader
      title="设置与备份"
      description="加密秘密与公共账户缓存彼此分离；刷新页面不会保持解锁。"
    />
    <section class="wallet-surface settings-actions">
      <div>
        <span><b>导出加密备份</b><small>下载兼容 wallet-keystore v1 的 wallet.json。</small></span
        ><AppButton variant="secondary" @click="exportWallet"
          ><DownloadSimple :size="18" />导出</AppButton
        >
      </div>
      <div>
        <span><b>立即锁定</b><small>清除当前页面内存中的私钥与 RootSeed。</small></span
        ><AppButton variant="secondary" @click="lock"><LockKey :size="18" />锁定</AppButton>
      </div>
      <div>
        <span><b>自动锁定</b><small>连续 15 分钟无操作后自动锁定。</small></span
        ><strong>15 分钟</strong>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-actions {
  display: grid;
}

.settings-actions > div {
  display: flex;
  min-height: 76px;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-top: 1px solid var(--border);
}

.settings-actions > div:first-child {
  border-top: 0;
}

.settings-actions span {
  display: grid;
  gap: 0.25rem;
}

.settings-actions small {
  color: var(--text-muted);
}
</style>
