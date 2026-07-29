<script setup lang="ts">
import { PhCheck as Check, PhCopy as Copy, PhShieldCheck as ShieldCheck } from '@phosphor-icons/vue'
import { computed, ref, watch } from 'vue'

import AppButton from '@/components/AppButton.vue'
import AppSelect from '@/components/AppSelect.vue'
import ReceiveAddressQR from '@/components/ReceiveAddressQR.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import { generateWalletCapsule } from '@/services/capsuleService'
import { GatewayClient } from '@/services/gatewayClient'
import { useDashboardStore } from '@/stores/dashboard'
import { useWalletStore } from '@/stores/wallet'

const wallet = useWalletStore()
const dashboard = useDashboardStore()
const gateway = new GatewayClient()
const selected = ref(wallet.addresses[0]?.address ?? '')
const addressMode = ref<'raw' | 'capsule'>('raw')
const capsule = ref('')
const capsuleOrgID = ref('')
const capsuleSigner = ref<'organization' | 'committee'>()
const generating = ref(false)
const generationError = ref('')
const confirmationFresh = ref(false)
const copied = ref(false)
const modeOptions = [
  { label: '原始地址', value: 'raw' },
  { label: '胶囊地址', value: 'capsule' },
]
const displayedAddress = computed(() =>
  addressMode.value === 'raw' ? selected.value : capsule.value,
)
const selectedRecord = computed(() =>
  wallet.addresses.find((address) => address.address === selected.value),
)
const selectedAsset = computed(
  () => ['PGC', 'BTC', 'ETH'][Number(selectedRecord.value?.type ?? 0)] ?? '未知币种',
)
const organization = computed(() => dashboard.current.organization)
const addressOptions = computed(() =>
  wallet.addresses.map((address, index) => ({
    description: address.address,
    label: `${['PGC', 'BTC', 'ETH'][Number(address.type)] ?? `币种 ${address.type}`} · 地址 ${index + 1}`,
    monospace: true,
    value: address.address,
  })),
)

async function copyAddress(): Promise<void> {
  if (!displayedAddress.value) return
  await navigator.clipboard.writeText(displayedAddress.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1400)
}

async function generateCapsule(): Promise<void> {
  if (!wallet.activeRecord || !selected.value || generating.value) return
  generating.value = true
  generationError.value = ''
  try {
    const generated = await generateWalletCapsule({
      address: selected.value,
      gateway,
      groupID: organization.value?.id,
      wallet: wallet.activeRecord,
    })
    capsule.value = generated.capsule
    capsuleOrgID.value = generated.orgID
    capsuleSigner.value = generated.signer
    confirmationFresh.value = true
    setTimeout(() => (confirmationFresh.value = false), 900)
  } catch (cause) {
    generationError.value = cause instanceof Error ? cause.message : '胶囊地址生成失败。'
  } finally {
    generating.value = false
  }
}

watch(selected, () => {
  capsule.value = ''
  capsuleOrgID.value = ''
  capsuleSigner.value = undefined
  generationError.value = ''
})
</script>

<template>
  <div class="wallet-page receive-page">
    <WalletPageHeader
      title="收款"
      description="原始地址与胶囊地址都可重复收款；胶囊只隐藏公开地址，不改变链上资金归属。"
    />
    <SegmentedControl
      v-model="addressMode"
      class="receive-mode"
      label="收款地址形式"
      :options="modeOptions"
    />
    <section class="receive-plane">
      <Transition name="qr-swap" mode="out-in">
        <ReceiveAddressQR
          :key="`${addressMode}:${displayedAddress || 'empty'}`"
          :address="displayedAddress"
          :empty-label="
            addressMode === 'capsule'
              ? '选择下方原始地址后生成一个可重复使用的胶囊别名。'
              : '钱包中没有可用地址，暂时无法生成二维码。'
          "
        />
      </Transition>
      <div class="receive-details">
        <AppSelect
          id="receive-address"
          v-model="selected"
          label="收款地址"
          :options="addressOptions"
          empty-label="钱包中没有可用地址"
        />
        <Transition name="address-mode" mode="out-in">
          <div :key="addressMode" class="address-mode-content">
            <div v-if="addressMode === 'raw'" class="receive-address-block">
              <span>{{ selectedAsset }} · {{ selectedRecord ? '原始地址' : '暂无地址' }}</span>
              <output class="receive-address">{{ selected || '钱包中没有可用地址' }}</output>
              <p>二维码仅编码公开地址，不包含私钥或 RootSeed。</p>
            </div>
            <div v-else class="capsule-content" :data-fresh="confirmationFresh || undefined">
              <template v-if="capsule">
                <div class="capsule-heading">
                  <ShieldCheck :size="18" weight="fill" aria-hidden="true" />
                  <span>{{
                    capsuleSigner === 'organization'
                      ? organization?.name || `担保组织 ${capsuleOrgID}`
                      : '委员会签名'
                  }}</span>
                  <small>组织 ID {{ capsuleOrgID }}</small>
                </div>
                <output class="receive-address">{{ capsule }}</output>
                <p>组织签名的隐私别名，可重复使用；原始地址仍然有效。</p>
              </template>
              <template v-else>
                <strong>创建公开地址的签名别名</strong>
                <p>胶囊会隐藏原始地址，付款方验签后仍向同一地址转账。</p>
                <AppButton
                  variant="secondary"
                  :disabled="!selected"
                  :loading="generating"
                  @click="generateCapsule"
                >
                  生成胶囊地址
                </AppButton>
              </template>
            </div>
          </div>
        </Transition>
        <p v-if="generationError" class="capsule-error" role="alert">{{ generationError }}</p>
        <AppButton size="large" :disabled="!displayedAddress" @click="copyAddress">
          <component :is="copied ? Check : Copy" :size="19" />
          {{ copied ? '已复制' : `复制${addressMode === 'capsule' ? '胶囊' : ''}地址` }}
        </AppButton>
      </div>
    </section>
  </div>
</template>

<style scoped>
.receive-page {
  width: min(760px, 100%);
}

.receive-mode {
  width: min(360px, 100%);
  margin-bottom: 1.25rem;
}

.receive-plane {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  align-items: center;
  gap: clamp(1.5rem, 4vw, 3.25rem);
  padding-block: 0.5rem;
}

.receive-details {
  display: grid;
  gap: 1rem;
}

.receive-address-block {
  display: grid;
  gap: 0.45rem;
  padding-block: 0.85rem;
  border-block: 1px solid var(--hairline);
}

.address-mode-content {
  min-height: 168px;
}

.capsule-content {
  position: relative;
  display: grid;
  align-content: center;
  min-height: 168px;
  gap: 0.75rem;
  overflow: hidden;
  padding-block: 0.8rem;
  border-block: 1px solid var(--hairline);
}

.capsule-content[data-fresh]::after {
  position: absolute;
  inset: 0 auto 0 -35%;
  width: 32%;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--accent) 20%, transparent),
    transparent
  );
  content: '';
  pointer-events: none;
  animation: capsule-confirm 820ms var(--ease-standard) forwards;
}

.capsule-heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--accent);
  font-size: 0.78rem;
  font-weight: 650;
}

.capsule-heading small {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 0.68rem;
  font-weight: 500;
}

.capsule-content > strong {
  font-size: 1rem;
}

.capsule-content p,
.receive-address-block p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.72rem;
  line-height: 1.55;
}

.capsule-error {
  margin: -0.25rem 0 0;
  padding: 0.75rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--danger) 18%, transparent);
  border-radius: 12px;
  color: color-mix(in srgb, var(--danger) 72%, var(--text));
  background: color-mix(in srgb, var(--danger) 7%, var(--surface));
  font-size: 0.74rem;
  line-height: 1.5;
  backdrop-filter: blur(14px);
}

.receive-address-block > span,
.receive-details > p {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.receive-address {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.receive-details > p {
  margin: -0.25rem 0 0;
  line-height: 1.5;
}

.app-button {
  justify-self: start;
}

.qr-swap-enter-active,
.qr-swap-leave-active {
  transition: opacity 160ms var(--ease-standard);
}

.qr-swap-enter-from,
.qr-swap-leave-to {
  opacity: 0;
}

.address-mode-enter-active,
.address-mode-leave-active {
  transition:
    opacity 180ms var(--ease-standard),
    transform 180ms var(--ease-standard);
}

.address-mode-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.address-mode-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}

@keyframes capsule-confirm {
  to {
    left: 110%;
  }
}

@media (max-width: 599px) {
  .receive-plane {
    grid-template-columns: 1fr;
    justify-items: center;
  }

  .receive-details {
    width: 100%;
  }

  .app-button {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .qr-swap-enter-active,
  .qr-swap-leave-active,
  .address-mode-enter-active,
  .address-mode-leave-active {
    transition-duration: 120ms;
  }

  .capsule-content[data-fresh]::after {
    animation: none;
  }
}
</style>
