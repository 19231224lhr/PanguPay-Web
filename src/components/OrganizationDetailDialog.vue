<script setup lang="ts">
import { groupedPledgeAmount } from '@/i18n/pledgeAmount'
import { wCount, organizationLabel, wt, wl } from '@/i18n/walletText'

import {
  PhArrowClockwise as ArrowClockwise,
  PhCheckCircle as CheckCircle,
  PhShieldCheck as ShieldCheck,
  PhWarningCircle as WarningCircle,
  PhX as X,
} from '@phosphor-icons/vue'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import type {
  WalletEntryOrganization,
  WalletEntryOrganizationDetail,
  WalletEntryOrganizationNode,
  WalletEntryOrganizationNodeRole,
} from '@/wallet/entryService'
import CurveMark from './CurveMark.vue'
import AppButton from './AppButton.vue'
import IconButton from './IconButton.vue'
import WalletPagedRows from './WalletPagedRows.vue'

const props = defineProps<{
  open: boolean
  organization?: WalletEntryOrganization
  detail?: WalletEntryOrganizationDetail
  busy?: boolean
  error?: string
}>()

const emit = defineEmits<{
  close: []
  retry: []
}>()

const dialog = ref<HTMLDialogElement>()

const nodeGroupDefinitions: Array<{
  role: WalletEntryOrganizationNodeRole
  title: string
  description: string
}> = [
  {
    role: 'assign',
    get title() {
      return wt('w67')
    },
    get description() {
      return wt('w68')
    },
  },
  {
    role: 'aggregation',
    get title() {
      return wt('w69')
    },
    get description() {
      return wt('w70')
    },
  },
  {
    role: 'txcer',
    get title() {
      return wt('w71')
    },
    get description() {
      return wt('w72')
    },
  },
  {
    role: 'guarantor',
    get title() {
      return wt('w93')
    },
    get description() {
      return wt('w73')
    },
  },
]

const nodeGroups = computed(() =>
  nodeGroupDefinitions.map((group) => ({
    ...group,
    nodes: (props.detail?.nodes ?? []).filter((node) => node.role === group.role),
  })),
)

function nodeName(node: WalletEntryOrganizationNode, fallback: string): string {
  return node.id || fallback
}

function nodeStatus(status?: string): string {
  if (!status) return wt('w75')
  const normalized = status.toLowerCase()
  if (['active', 'online', 'ready'].includes(normalized)) return wt('w76')
  if (['standby', 'pending'].includes(normalized)) return wt('w77')
  if (['disabled', 'revoked', 'offline'].includes(normalized)) return wt('w78')
  return status
}


function close(): void {
  emit('close')
}

function handleBackdrop(event: MouseEvent): void {
  if (event.target === dialog.value) close()
}

watch(
  () => props.open,
  async (open) => {
    await nextTick()
    if (open && dialog.value && !dialog.value.open) dialog.value.showModal()
    if (!open && dialog.value?.open) dialog.value.close()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (dialog.value?.open) dialog.value.close()
})
</script>

<template>
  <dialog
    ref="dialog"
    class="organization-dialog"
    :aria-labelledby="organization ? 'organization-detail-title' : undefined"
    @cancel.prevent="close"
    @click="handleBackdrop"
    @close="open && close()"
  >
    <article class="organization-dialog__surface" @click.stop>
      <header>
        <div class="organization-dialog__identity">
          <CurveMark v-if="open" motion="once" :size="44"
            ><ShieldCheck :size="22" weight="duotone"
          /></CurveMark>
          <div>
            <p>{{ wt('w86') }}</p>
            <h2 id="organization-detail-title">{{ organizationLabel(organization) || wt('w319') }}</h2>
          </div>
        </div>
        <IconButton :label="wt('w320')" @click="close"><X :size="18" /></IconButton>
      </header>

      <div v-if="busy && !detail" class="organization-dialog__loading" role="status" aria-live="polite">
        <div class="organization-dialog__loading-title"><CurveMark variant="link" :size="36" /><strong>{{ wt('w321') }}</strong></div>
        <small> {{ wt('w322') }} </small>
      </div>

      <div v-else-if="error" class="organization-dialog__error" role="alert">
        <WarningCircle :size="22" />
        <div>
          <strong> {{ wt('w323') }} </strong>
          <small>{{ detail ? wt('networkCachedData') : wl(error) }}</small>
        </div>
        <AppButton variant="secondary" :disabled="busy" @click="emit('retry')">
          <template #icon><ArrowClockwise :size="16" /></template> {{ wt('w324') }}
        </AppButton>
      </div>

      <template v-if="detail">
        <section class="organization-dialog__services" :aria-label="wt('w325')">
          <span><CheckCircle :size="16" weight="fill" /> {{ wt('w48') }} </span>
          <span><CheckCircle :size="16" weight="fill" /> {{ wt('w326') }} </span>
        </section>

        <dl class="organization-dialog__metrics">
          <div>
            <dt>{{ wt('w92') }}</dt>
            <dd>{{ groupedPledgeAmount(detail.pledgeAmount) }}</dd>
          </div>
          <div>
            <dt>{{ wt('w327') }}</dt>
            <dd>{{ detail.guarantorCount }} {{ wCount('w328', detail.guarantorCount) }}</dd>
          </div>
          <div>
            <dt>{{ wt('w329') }}</dt>
            <dd>{{ detail.certifierCount }} {{ wCount('w330', detail.certifierCount) }}</dd>
          </div>
        </dl>

        <section class="organization-dialog__nodes" aria-labelledby="organization-nodes-title">
          <div class="organization-dialog__nodes-heading">
            <div>
              <span> {{ wt('w331') }} </span>
              <h3 id="organization-nodes-title">{{ wt('w98') }}</h3>
            </div>
            <p>{{ wt('w332') }}</p>
          </div>

          <div class="organization-dialog__node-groups">
            <section v-for="group in nodeGroups" :key="group.role" class="organization-node-group">
              <div class="organization-node-group__heading">
                <div>
                  <h4>{{ group.title }}</h4>
                  <p>{{ group.description }}</p>
                </div>
                <span>{{ group.nodes.length }}</span>
              </div>
              <WalletPagedRows v-if="group.nodes.length" v-slot="{ rows }" :items="group.nodes" :label="group.title">
                <ul>
                  <li v-for="node in rows" :key="`${group.role}-${node.id || node.peerId}`">
                    <div>
                      <strong>{{ nodeName(node, group.title) }}</strong>
                      <small v-if="node.peerId">Peer · {{ node.peerId }}</small>
                      <small v-if="node.endpoint">API · {{ node.endpoint }}</small>
                    </div>
                    <b :data-status="node.status?.toLowerCase() || 'registered'">
                      {{ nodeStatus(node.status) }}
                    </b>
                  </li>
                </ul>
              </WalletPagedRows>
              <p v-else class="organization-node-group__empty">{{ wt('w100') }}</p>
            </section>
          </div>
        </section>

        <details class="organization-dialog__technical">
          <summary>{{ wt('w101') }}</summary>
          <dl>
            <div>
              <dt>{{ wt('w47') }}</dt>
              <dd>{{ detail.id }}</dd>
            </div>
            <div v-if="detail.peerGroupId">
              <dt>{{ wt('w102') }}</dt>
              <dd>{{ detail.peerGroupId }}</dd>
            </div>
            <div v-if="detail.pledgeAddress">
              <dt>{{ wt('w103') }}</dt>
              <dd>{{ detail.pledgeAddress }}</dd>
            </div>
            <div v-if="detail.assignEndpoint">
              <dt>Assign</dt>
              <dd>{{ detail.assignEndpoint }}</dd>
            </div>
            <div v-if="detail.aggregationEndpoint">
              <dt>Aggregation</dt>
              <dd>{{ detail.aggregationEndpoint }}</dd>
            </div>
          </dl>
        </details>
      </template>

      <footer>
        <p>{{ wt('w333') }}</p>
        <AppButton variant="secondary" @click="close"> {{ wt('w334') }} </AppButton>
      </footer>
    </article>
  </dialog>
</template>

<style scoped>
.organization-dialog {
  width: min(92vw, 580px);
  max-height: none;
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--menu-border);
  border-radius: 20px;
  background: var(--menu-surface);
  box-shadow: var(--shadow-menu);
  color: var(--text);
  opacity: 0;
  transform: translateY(10px) scale(0.985);
  transition:
    opacity var(--duration-enter) var(--ease-standard),
    transform var(--duration-enter) var(--ease-standard),
    display var(--duration-enter) allow-discrete,
    overlay var(--duration-enter) allow-discrete;
}

.organization-dialog[open] {
  opacity: 1;
  transform: none;
}

@starting-style {
  .organization-dialog[open] {
    opacity: 0;
    transform: translateY(10px) scale(0.985);
  }
}

.organization-dialog::backdrop {
  background: rgb(0 0 0 / 0.52);
  backdrop-filter: blur(8px);
}

.organization-dialog__surface {
  display: grid;
  width: 100%;
  max-height: min(84dvh, 720px);
  box-sizing: border-box;
  gap: 1.25rem;
  padding: 1.35rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
}

.organization-dialog__surface::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.organization-dialog header,
.organization-dialog footer,
.organization-dialog__identity,
.organization-dialog__services {
  display: flex;
  align-items: center;
}

.organization-dialog header {
  justify-content: space-between;
  gap: 1rem;
}

.organization-dialog__identity {
  gap: 0.8rem;
}

.organization-dialog__identity div,
.organization-dialog__nodes-heading > div {
  display: grid;
  gap: 0.12rem;
}

.organization-dialog__identity p,
.organization-dialog__identity h2,
.organization-dialog footer p {
  margin: 0;
}

.organization-dialog__identity p,
.organization-dialog footer p {
  color: var(--text-muted);
  font-size: 0.75rem;
}

.organization-dialog__identity h2 {
  font-size: clamp(1.25rem, 3vw, 1.65rem);
  letter-spacing: -0.025em;
}

.organization-dialog__services {
  flex-wrap: wrap;
  gap: 0.55rem;
}

.organization-dialog__services span {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 9%, transparent);
  color: var(--accent-strong);
  font-size: 0.76rem;
  font-weight: 650;
}

.organization-dialog__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  border-block: 1px solid var(--hairline);
}

.organization-dialog__metrics > div {
  display: grid;
  gap: 0.35rem;
  padding: 1rem 0.8rem;
}

.organization-dialog__metrics > div + div {
  border-left: 1px solid var(--hairline);
}

.organization-dialog dt {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.organization-dialog dd {
  margin: 0;
  font-size: 0.86rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}

.organization-dialog__nodes {
  display: grid;
  gap: 0.85rem;
}

.organization-dialog__nodes-heading,
.organization-node-group__heading,
.organization-node-group li {
  display: flex;
  align-items: center;
}

.organization-dialog__nodes-heading {
  justify-content: space-between;
  gap: 1rem;
}

.organization-dialog__nodes-heading span,
.organization-dialog__nodes-heading p,
.organization-node-group p,
.organization-node-group small {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.7rem;
  line-height: 1.45;
}

.organization-dialog__nodes-heading h3,
.organization-node-group h4 {
  margin: 0;
  letter-spacing: -0.018em;
}

.organization-dialog__nodes-heading h3 {
  font-size: 1rem;
}

.organization-dialog__nodes-heading > p {
  text-align: right;
}

.organization-dialog__node-groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 1.25rem;
}

.organization-node-group {
  min-width: 0;
  padding-block: 0.8rem;
  border-top: 1px solid var(--hairline);
}

.organization-node-group__heading {
  justify-content: space-between;
  gap: 0.65rem;
}

.organization-node-group__heading h4 {
  font-size: 0.82rem;
}

.organization-node-group__heading > span {
  display: grid;
  min-width: 25px;
  height: 25px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  color: var(--accent-strong);
  font-size: 0.68rem;
  font-weight: 700;
  place-items: center;
}

.organization-node-group ul {
  display: grid;
  gap: 0.55rem;
  margin: 0.65rem 0 0;
  padding: 0;
  list-style: none;
}

.organization-node-group li {
  min-width: 0;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--hairline) 88%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface-raised) 58%, transparent);
}

.organization-node-group li > div {
  display: grid;
  min-width: 0;
  gap: 0.1rem;
}

.organization-node-group li strong,
.organization-node-group li small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.organization-node-group li strong {
  font-size: 0.75rem;
  font-weight: 650;
}

.organization-node-group li > b {
  flex: none;
  color: var(--success);
  font-size: 0.66rem;
  font-weight: 650;
}

.organization-node-group li > b[data-status='standby'],
.organization-node-group li > b[data-status='pending'] {
  color: var(--warning);
}

.organization-node-group li > b[data-status='disabled'],
.organization-node-group li > b[data-status='revoked'],
.organization-node-group li > b[data-status='offline'] {
  color: var(--danger);
}

.organization-node-group__empty {
  padding-top: 0.7rem;
}

.organization-dialog__technical {
  color: var(--text-muted);
  font-size: 0.78rem;
}

.organization-dialog__technical summary {
  min-height: 44px;
  cursor: pointer;
  line-height: 44px;
}

.organization-dialog__technical dl {
  display: grid;
  gap: 0.65rem;
  margin: 0;
  padding-top: 0.6rem;
}

.organization-dialog__technical dl > div {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 0.75rem;
}

.organization-dialog__technical dd {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 500;
}

.organization-dialog__loading,
.organization-dialog__error {
  display: grid;
  min-height: 170px;
  place-items: center;
  align-content: center;
  gap: 0.45rem;
  text-align: center;
}

.organization-dialog__loading-title { display: flex; align-items: center; gap: 10px; }

.organization-dialog__loading small,
.organization-dialog__error small {
  color: var(--text-muted);
}

.organization-dialog__error > svg {
  color: var(--warning);
}

.organization-dialog__error > div {
  display: grid;
  gap: 0.25rem;
}

.organization-dialog footer {
  justify-content: space-between;
  gap: 1rem;
  padding-top: 0.2rem;
}

@media (max-width: 700px) {
  .organization-dialog {
    width: 100%;
    max-width: none;
    max-height: none;
    margin: auto 0 0;
    border-width: 1px 0 0;
    border-radius: 20px 20px 0 0;
    transform: translateY(18px);
  }

  .organization-dialog__surface {
    max-height: min(90dvh, 760px);
    gap: 1rem;
    padding: 1rem 1rem max(1rem, env(safe-area-inset-bottom));
  }

  .organization-dialog__metrics {
    grid-template-columns: 1fr;
  }

  .organization-dialog__metrics > div {
    grid-template-columns: 1fr auto;
    align-items: center;
  }

  .organization-dialog__metrics > div + div {
    border-top: 1px solid var(--hairline);
    border-left: 0;
  }

  .organization-dialog footer {
    align-items: stretch;
    flex-direction: column;
  }

  .organization-dialog__node-groups {
    grid-template-columns: 1fr;
  }

  .organization-dialog__nodes-heading > p {
    max-width: 16ch;
  }
}

@media (prefers-reduced-motion: reduce) {
  .organization-dialog {
    transition-duration: 0.01ms;
  }
}
</style>
