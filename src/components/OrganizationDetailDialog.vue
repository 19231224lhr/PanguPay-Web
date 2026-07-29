<script setup lang="ts">
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
import AppButton from './AppButton.vue'
import IconButton from './IconButton.vue'

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
  { role: 'assign', title: 'Assign 节点', description: '账户接入与 TXCer 原子登记' },
  { role: 'aggregation', title: 'Aggregation 节点', description: '责任聚合与签发调度' },
  { role: 'txcer', title: 'TXCer 审计节点', description: 'Certifier / CFAA 后台证明' },
  { role: 'guarantor', title: 'GuarNode', description: '担保责任与交易确认' },
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
  if (!status) return '已登记'
  const normalized = status.toLowerCase()
  if (['active', 'online', 'ready'].includes(normalized)) return '运行中'
  if (['standby', 'pending'].includes(normalized)) return '备用'
  if (['disabled', 'revoked', 'offline'].includes(normalized)) return '已停用'
  return status
}

function groupedAmount(value?: string): string {
  if (!value) return '未公开'
  const [integer, fraction] = value.split('.', 2)
  const sign = integer?.startsWith('-') ? '-' : ''
  const digits = (integer ?? '').replace(/^-/, '')
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}${grouped}${fraction === undefined ? '' : `.${fraction}`} PGC`
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
          <span class="organization-dialog__mark" aria-hidden="true">
            <ShieldCheck :size="23" weight="regular" />
          </span>
          <div>
            <p>担保组织</p>
            <h2 id="organization-detail-title">{{ organization?.name || '组织详情' }}</h2>
          </div>
        </div>
        <IconButton label="关闭组织详情" @click="close"><X :size="18" /></IconButton>
      </header>

      <div v-if="busy" class="organization-dialog__loading" role="status" aria-live="polite">
        <span aria-hidden="true" />
        <strong>正在读取组织信息</strong>
        <small>数据来自当前 Gateway 的权威登记。</small>
      </div>

      <div v-else-if="error" class="organization-dialog__error" role="alert">
        <WarningCircle :size="22" />
        <div>
          <strong>暂时无法读取详情</strong>
          <small>{{ error }}</small>
        </div>
        <AppButton variant="secondary" @click="emit('retry')">
          <template #icon><ArrowClockwise :size="16" /></template>
          重新加载
        </AppButton>
      </div>

      <template v-else-if="detail">
        <section class="organization-dialog__services" aria-label="支持的服务">
          <span><CheckCircle :size="16" weight="fill" />快速转账</span>
          <span><CheckCircle :size="16" weight="fill" />跨链转账</span>
        </section>

        <dl class="organization-dialog__metrics">
          <div>
            <dt>担保额度</dt>
            <dd>{{ groupedAmount(detail.pledgeAmount) }}</dd>
          </div>
          <div>
            <dt>组织构成</dt>
            <dd>{{ detail.guarantorCount }} 个担保节点</dd>
          </div>
          <div>
            <dt>独立审计</dt>
            <dd>{{ detail.certifierCount }} 个审计节点</dd>
          </div>
        </dl>

        <section class="organization-dialog__nodes" aria-labelledby="organization-nodes-title">
          <div class="organization-dialog__nodes-heading">
            <div>
              <span>节点构成</span>
              <h3 id="organization-nodes-title">服务与责任节点</h3>
            </div>
            <p>来自当前 Gateway 的权威登记</p>
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
              <ul v-if="group.nodes.length">
                <li v-for="node in group.nodes" :key="`${group.role}-${node.id || node.peerId}`">
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
              <p v-else class="organization-node-group__empty">暂未登记</p>
            </section>
          </div>
        </section>

        <details class="organization-dialog__technical">
          <summary>技术信息</summary>
          <dl>
            <div>
              <dt>组织 ID</dt>
              <dd>{{ detail.id }}</dd>
            </div>
            <div v-if="detail.peerGroupId">
              <dt>通信组</dt>
              <dd>{{ detail.peerGroupId }}</dd>
            </div>
            <div v-if="detail.pledgeAddress">
              <dt>质押地址</dt>
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
        <p>加入后可使用快速转账与跨链服务。</p>
        <AppButton variant="secondary" @click="close">返回选择</AppButton>
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

.organization-dialog__mark {
  display: grid;
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: 13px;
  background: color-mix(in srgb, var(--accent) 11%, var(--surface-raised));
  color: var(--accent);
  place-items: center;
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

.organization-dialog__loading > span {
  width: 22px;
  height: 22px;
  border: 2px solid var(--hairline);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: organization-spin 0.8s linear infinite;
}

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

@keyframes organization-spin {
  to {
    transform: rotate(1turn);
  }
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

  .organization-dialog__loading > span {
    animation: none;
  }
}
</style>
