<script setup lang="ts">
import { organizationLabel, wt, wl } from '@/i18n/walletText'

import { PhCheck as Check, PhCopy as Copy, PhShieldCheck as ShieldCheck } from '@phosphor-icons/vue'
import { computed, ref, watch } from 'vue'

import AppButton from '@/components/AppButton.vue'
import AppSelect from '@/components/AppSelect.vue'
import ReceiveAddressQR from '@/components/ReceiveAddressQR.vue'
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
  {
    get label() {
      return wt('w134')
    },
    value: 'raw',
  },
  {
    get label() {
      return wt('w135')
    },
    value: 'capsule',
  },
]
const displayedAddress = computed(() =>
  addressMode.value === 'raw' ? selected.value : capsule.value,
)
const selectedRecord = computed(() =>
  wallet.addresses.find((address) => address.address === selected.value),
)
const selectedAsset = computed(
  () => ['CAL', 'BTC', 'ETH'][Number(selectedRecord.value?.type ?? 0)] ?? wt('w136'),
)
const organization = computed(() => dashboard.current.organization)
const addressOptions = computed(() =>
  wallet.addresses.map((address, index) => ({
    description: address.address,
    label: wt('w137', [
      ['CAL', 'BTC', 'ETH'][Number(address.type)] ?? wt('assetType', [address.type]),
      index + 1,
    ]),
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
    generationError.value = cause instanceof Error ? cause.message : wt('w138')
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
      :inline-target="$slots['header-action'] ? '#intro-receive' : undefined"
      :title="wt('w139')"
      :description="$slots['header-action'] ? wt('overviewReceiveIntro') : wt('w140')"
    ><slot name="header-action" /></WalletPageHeader>
    <section class="receive-plane">
      <div class="receive-details">
        <div class="receive-address-heading">
          <label for="receive-address">{{ wt('w144') }}</label>
          <AppSelect
            id="receive-mode"
            v-model="addressMode"
            inline
            :label="wt('w141')"
            :options="modeOptions"
          />
        </div>
        <AppSelect
          id="receive-address"
          v-model="selected"
          hide-label
          :label="wt('w144')"
          :options="addressOptions"
          :empty-label="wt('w145')"
        />
        <Transition name="address-mode" mode="out-in">
          <div :key="addressMode" class="address-mode-content">
            <div v-if="addressMode === 'raw'" class="receive-address-block">
              <span>{{ selectedAsset }} · {{ selectedRecord ? wt('w134') : wt('w146') }}</span>
              <output class="receive-address">{{ selected || wt('w145') }}</output>
              <p>{{ wt('w147') }}</p>
            </div>
            <div v-else class="capsule-content" :data-fresh="confirmationFresh || undefined">
              <template v-if="capsule">
                <div class="capsule-heading">
                  <ShieldCheck :size="18" weight="fill" aria-hidden="true" />
                  <span>{{
                    capsuleSigner === 'organization'
                      ? organizationLabel(organization) || wt('w148', [capsuleOrgID])
                      : wt('w149')
                  }}</span>
                  <small> {{ wt('w47') }} {{ capsuleOrgID }}</small>
                </div>
                <output class="receive-address">{{ capsule }}</output>
                <p>{{ wt('w150') }}</p>
              </template>
              <template v-else>
                <strong> {{ wt('w151') }} </strong>
                <p>{{ wt('w152') }}</p>
                <AppButton
                  variant="secondary"
                  :disabled="!selected"
                  :loading="generating"
                  @click="generateCapsule"
                >
                  {{ wt('w153') }}
                </AppButton>
              </template>
            </div>
          </div>
        </Transition>
        <p v-if="generationError" class="capsule-error" role="alert">{{ wl(generationError) }}</p>
        <AppButton size="large" :disabled="!displayedAddress" @click="copyAddress">
          <component :is="copied ? Check : Copy" :size="19" />
          {{
            copied ? wt('w154') : wt('w155', [addressMode === 'capsule' ? wt('w135') : wt('w134')])
          }}
        </AppButton>
      </div>
      <div class="receive-qr-slot">
        <Transition name="qr-swap" mode="out-in">
          <ReceiveAddressQR
            :key="`${addressMode}:${displayedAddress || 'empty'}`"
            :address="displayedAddress"
            :empty-label="addressMode === 'capsule' ? wt('w142') : wt('w143')"
          />
        </Transition>
      </div>
    </section>
  </div>
</template>

<style scoped>
.receive-page {
  width: 100%;
  container-type: inline-size;
}

.receive-address-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 0.4rem;
  margin-bottom: -0.5rem;
}

.receive-address-heading > label {
  color: var(--text);
  font-size: 0.84rem;
  font-weight: 650;
}

.receive-plane {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, 36%);
  align-items: center;
  gap: clamp(1.25rem, 5cqi, 3rem);
  padding-block: 0.5rem;
}

.receive-details {
  display: grid;
  min-width: 0;
  gap: 0.75rem;
}

.receive-qr-slot {
  display: grid;
  width: min(240px, 100%);
  aspect-ratio: 1;
  justify-self: center;
  place-items: center;
}

.receive-qr-slot :deep(.receive-qr) {
  width: 100%;
  border: 1px solid var(--hairline);
  border-radius: 14px;
  box-shadow: none;
}

.receive-address-block {
  display: grid;
  gap: 0.45rem;
  padding-block: 0.85rem;
  border-block: 1px solid var(--hairline);
}

.address-mode-content {
  min-height: 108px;
}

.capsule-content {
  position: relative;
  display: grid;
  align-content: center;
  min-height: 108px;
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

.qr-swap-enter-active { transition: opacity 135ms var(--ease-standard); }
.qr-swap-leave-active { transition: opacity 85ms var(--ease-standard); }

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

@container (max-width: 540px) {
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
    transition: none;
  }

  .capsule-content[data-fresh]::after {
    animation: none;
  }
}
</style>
