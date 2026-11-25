<script setup lang="ts">
import { wt, wl } from '@/i18n/walletText'

import {
  PhArrowClockwise as ArrowClockwise,
  PhArrowRight as ArrowRight,
  PhCloudSlash as CloudSlash,
} from '@phosphor-icons/vue'
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import CurveMark from '@/components/CurveMark.vue'
import AppButton from '@/components/AppButton.vue'
import OrganizationChooser from '@/components/OrganizationChooser.vue'
import WalletAccessFrame from '@/components/WalletAccessFrame.vue'
import { waitForEntryBrandKey } from '@/composables/useEntryFigure'
import { navigateWithSpatialTransition } from '@/composables/useSpatialNavigation'
import { useWalletStore } from '@/stores/wallet'
import {
  formatWalletEntryError,
  hasLocalNoGroupChoice,
  isWalletEntryConnectionError,
  rememberLocalNoGroupChoice,
  resolveOrganizationEntry,
  type OrganizationEntryDecision,
} from '@/wallet/entry'
import {
  getWalletEntryService,
  type WalletEntryOrganization,
  WalletEntryConfirmationPending,
} from '@/wallet/entryService'

const waitForBrand = inject(waitForEntryBrandKey, undefined)
const router = useRouter()
const wallet = useWalletStore()
const decision = ref<OrganizationEntryDecision>()
const organizations = ref<WalletEntryOrganization[]>([])
const selectedGroupId = ref('')
const busy = ref(true)
const error = ref('')
const connectionInterrupted = ref(false)
const stage = ref<'w34' | 'w37' | 'w38' | 'w39' | 'w40' | 'w42'>('w34')
type EntryAction = 'join' | 'retail'
const pendingAction = ref<EntryAction>()
const confirmation = ref<{ action: EntryAction; check: () => Promise<void> }>()

const isChoosing = computed(() => decision.value?.kind === 'chooser')
const isRepairing = computed(() => decision.value?.kind === 'repair-no-group')
const entryPanel = computed(() => {
  if (isChoosing.value) return 'organizations'
  if (isRepairing.value) return 'repair'
  if (error.value) return connectionInterrupted.value ? 'connection' : 'error'
  return 'checking'
})
const selectedOrganization = computed(() =>
  organizations.value.find((organization) => organization.id === selectedGroupId.value),
)

let reconnectTimer: number | undefined
let reconnectAttempted = false
let disposed = false

function clearReconnectTimer(): void {
  if (reconnectTimer === undefined) return
  window.clearTimeout(reconnectTimer)
  reconnectTimer = undefined
}

function scheduleReconnect(): void {
  if (disposed || reconnectAttempted || reconnectTimer !== undefined) return
  reconnectAttempted = true
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = undefined
    void restore()
  }, 1_500)
}

async function enterWallet(): Promise<void> {
  if (disposed) return
  await navigateWithSpatialTransition(router, '/wallet', 'wallet', 'replace')
}

async function restore(manual = false): Promise<void> {
  if (manual) reconnectAttempted = false
  clearReconnectTimer()
  busy.value = true
  error.value = ''
  connectionInterrupted.value = false
  const service = getWalletEntryService()
  if (!service) {
    busy.value = false
    connectionInterrupted.value = true
    error.value = wt('w35')
    scheduleReconnect()
    return
  }
  try {
    const recovered = await service.recover()
    if (disposed) return
    const next = resolveOrganizationEntry({
      ...recovered,
      localSkipped: hasLocalNoGroupChoice(wallet.accountId),
    })
    if (next.kind === 'chooser') organizations.value = await service.listOrganizations()
    decision.value = next
    reconnectAttempted = false
    if (next.kind === 'inconsistent') error.value = wt('w36')
    if (next.kind === 'member') stage.value = 'w37'
    if (next.kind === 'no-group') {
      rememberLocalNoGroupChoice(wallet.accountId)
      stage.value = 'w38'
    }
    if (next.kind === 'repair-no-group') stage.value = 'w39'
    if (next.kind === 'member' || next.kind === 'no-group') await enterWallet()
  } catch (cause) {
    connectionInterrupted.value = isWalletEntryConnectionError(cause)
    error.value = formatWalletEntryError(cause)
    if (connectionInterrupted.value) scheduleReconnect()
  } finally {
    busy.value = false
  }
}

async function completeChoice(action: EntryAction): Promise<void> {
  const service = getWalletEntryService()
  if (busy.value || !service || (action === 'join' && !selectedGroupId.value)) return
  busy.value = true
  pendingAction.value = action
  error.value = ''
  stage.value = action === 'join' ? 'w40' : 'w42'
  try {
    if (confirmation.value) await confirmation.value.check()
    else if (action === 'join') await service.join(selectedGroupId.value)
    else await service.registerNoGroup()
    if (disposed) return
    if (action === 'retail') rememberLocalNoGroupChoice(wallet.accountId)
    await waitForBrand?.()
    await enterWallet()
  } catch (cause) {
    if (cause instanceof WalletEntryConfirmationPending) {
      confirmation.value = { action, check: cause.confirm }
    }
    error.value = formatWalletEntryError(cause)
  } finally {
    busy.value = false
    pendingAction.value = undefined
  }
}

onMounted(() => void restore())
onBeforeUnmount(() => {
  disposed = true
  clearReconnectTimer()
})
</script>

<template>
  <WalletAccessFrame compact :figure="pendingAction ? 'brand' : isChoosing ? 'organization' : undefined">
    <Transition name="entry-route" mode="out-in">
      <section
        :key="entryPanel"
        class="access-panel wallet-entry"
        :class="{ 'wallet-entry--busy': busy }"
      >
        <template v-if="isChoosing">
          <h1>{{ wt('w44') }}</h1>
          <p>{{ wt('w45') }}</p>

          <OrganizationChooser
            v-if="organizations.length"
            v-model="selectedGroupId"
            :organizations="organizations"
            :disabled="busy || !!confirmation"
          />

          <div v-else class="organization-empty">
            <strong> {{ wt('w52') }} </strong>
            <span> {{ wt('w53') }} </span>
          </div>

          <div v-if="!confirmation" class="entry-actions">
            <AppButton
              size="large"
              :disabled="busy || !selectedOrganization"
              :loading="pendingAction === 'join'"
              @click="completeChoice('join')"
            >
              {{ wt('w54') }} <template #icon><ArrowRight :size="18" /></template>
            </AppButton>
            <AppButton
              size="large"
              variant="secondary"
              :disabled="busy"
              :loading="pendingAction === 'retail'"
              @click="completeChoice('retail')"
            >
              {{ wt('w55') }}
            </AppButton>
          </div>
          <p v-if="!pendingAction && !error" class="entry-note">{{ wt('w56') }}</p>
        </template>

        <template v-else-if="isRepairing">
          <h1>{{ wt('w57') }}</h1>
          <p>{{ wt('w58') }}</p>
          <AppButton
            v-if="!confirmation"
            size="large"
            :loading="busy"
            @click="completeChoice('retail')"
          >
            {{ wt('w59') }} <template #icon><ArrowRight :size="18" /></template>
          </AppButton>
        </template>

        <template v-else-if="error && connectionInterrupted">
          <div class="entry-service-state" data-service-interruption role="alert">
            <span class="entry-service-state__icon" aria-hidden="true">
              <CloudSlash :size="24" weight="regular" />
            </span>
            <h1>{{ wt('w60') }}</h1>
            <p>{{ wt('w61') }}</p>
            <div class="entry-service-state__status">
              <span aria-hidden="true" /> {{ wt('w62') }}
            </div>
            <AppButton
              class="entry-service-state__retry"
              size="large"
              variant="secondary"
              :loading="busy"
              @click="restore(true)"
            >
              {{ wt('w63') }} <template #icon><ArrowClockwise :size="18" /></template>
            </AppButton>
          </div>
        </template>

        <template v-else-if="error">
          <h1>{{ wt('w64') }}</h1>
          <p class="entry-error" role="alert">{{ wl(error) }}</p>
          <AppButton size="large" @click="restore(true)"> {{ wt('w65') }} </AppButton>
        </template>

        <template v-else>
          <h1>{{ wt('w66') }}</h1>
          <div class="entry-preparation" role="status">
            <CurveMark variant="link" :size="44" />
            <span>{{ wt(stage) }}</span>
          </div>
        </template>
        <template v-if="isChoosing || isRepairing">
          <p v-if="pendingAction" class="entry-note" role="status">{{ wt(stage) }}</p>
          <p v-else-if="error" class="entry-error" role="alert">{{ wl(error) }}</p>
          <AppButton
            v-if="confirmation"
            size="large"
            :loading="busy"
            @click="completeChoice(confirmation.action)"
          >
            {{ wt('entryConfirmAgain') }}
          </AppButton>
        </template>
      </section>
    </Transition>
  </WalletAccessFrame>
</template>

<style scoped>
.wallet-entry {
  align-content: center;
  min-height: 0;
  row-gap: 0;
}

.wallet-entry > p {
  margin: 10px 0 20px;
}

.entry-preparation {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-top: 0.5rem;
  color: var(--text-muted);
  font-size: 0.925rem;
  line-height: 1.5;
}
.entry-preparation :deep(.curve-mark) {
  color: var(--text);
}

.entry-service-state {
  display: grid;
  justify-items: start;
  gap: 0;
}

.entry-service-state__icon {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  margin-bottom: 1.15rem;
  border-radius: 14px;
  background: color-mix(in srgb, var(--accent) 9%, var(--surface));
  color: var(--accent-strong);
}

.entry-service-state > p {
  max-width: 34ch;
  margin: 0.7rem 0 1.35rem;
  color: var(--text-muted);
  line-height: 1.55;
}

.entry-service-state__status {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  gap: 0.65rem;
  margin-bottom: 1.2rem;
  padding-inline: 0.9rem;
  border: 1px solid var(--hairline);
  border-radius: 13px;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 570;
  backdrop-filter: blur(14px);
}

.entry-service-state__status > span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--warning);
}

.entry-service-state__retry {
  min-width: 172px;
}

.entry-actions {
  margin-top: 1.15rem;
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: 0.8rem;
}

.entry-actions :deep(.app-button) {
  width: 100%;
}

.entry-note,
.organization-empty span {
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.45;
}

.entry-note {
  margin: 0.7rem 0 0 !important;
}

.organization-empty {
  display: grid;
  gap: 0.25rem;
  padding: 1.1rem 0;
  border-block: 1px solid var(--hairline);
}

.entry-error {
  color: var(--danger) !important;
}

@media (prefers-reduced-motion: reduce) {
  .wallet-entry--busy {
    transition: none;
  }
}

@media (max-width: 560px) {
  .wallet-entry {
    min-height: 0;
    align-content: start;
    padding-bottom: 1.25rem;
  }

  .wallet-entry > p {
    margin-block: 0.65rem 1.35rem;
  }

  .entry-actions {
    grid-template-columns: 1fr;
    gap: 0.7rem;
  }

  .entry-note {
    margin-top: 0.65rem !important;
  }
}
</style>
