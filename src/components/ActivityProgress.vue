<script setup lang="ts">
import { wt, walletLocale } from '@/i18n/walletText'

import { PhCheck } from '@phosphor-icons/vue'
import { computed } from 'vue'

import type { TransferProgress } from '@/transfer/journal'
import { buildTransferTimeline, type TransferTimelineItem } from '@/transfer/workflow'

const props = defineProps<{
  progress?: TransferProgress
  status?: string
}>()

const steps = computed<TransferTimelineItem[]>(() =>
  props.progress
    ? buildTransferTimeline(props.progress)
    : [{ id: 'backend', label: wt('w294'), detail: props.status || wt('w295'), state: 'pending' }],
)

const formatTime = (value?: number) =>
  value
    ? new Intl.DateTimeFormat(walletLocale(), {
        dateStyle: 'medium',
        timeStyle: 'medium',
        hour12: false,
      }).format(value)
    : wt('w296')

const milestones = computed((): Partial<Record<string, { label: string; value: string }[]>> => {
  const p = props.progress
  if (!p) return {}
  const received = [{ label: wt('w297'), value: formatTime(p.backendAcceptedAt ?? p.acceptedAt) }]
  const settlement = [
    ...(p.certifiedHeight ? [{ label: wt('w16'), value: String(p.certifiedHeight) }] : []),
    { label: wt('w302'), value: formatTime(p.settledAt) },
  ]
  if (p.mode === 'cross') {
    return {
      received,
      'target-confirmed': [
        { label: wt('w301'), value: formatTime(p.targetConfirmedAt) },
        ...settlement,
      ],
    }
  }
  if (p.mode === 'quick') {
    return {
      received,
      organization: [{ label: wt('w298'), value: formatTime(p.registeredAt) }],
      'recipient-ready': [
        {
          label: wt('w299'),
          value: p.spendReadyAt ? formatTime(p.backendSpendReadyAt ?? p.spendReadyAt) : wt('w300'),
        },
      ],
      settlement,
    }
  }
  return { received, settlement }
})
</script>

<template>
  <ol class="activity-progress" :aria-label="wt('w303')">
    <li
      v-for="step in steps"
      :key="step.id ?? step.label"
      :data-activity-step="step.id ?? ''"
      :data-state="step.state"
      :aria-current="step.state === 'active' ? 'step' : undefined"
    >
      <span class="step-marker" aria-hidden="true">
        <Transition name="step-confirmation">
          <PhCheck v-if="step.state === 'complete'" :size="11" weight="bold" />
        </Transition>
      </span>
      <div class="step-copy">
        <div class="step-description">
          <div class="step-title">
            <b>{{ step.label }}</b>
            <span v-if="step.state === 'active'" class="step-active">{{ wt('motionActive') }}</span>
          </div>
          <small>{{ step.detail }}</small>
          <small v-if="step.meta">{{ step.meta }}</small>
        </div>
        <dl v-if="step.id && milestones[step.id]?.length" class="activity-times">
          <div v-for="item in milestones[step.id]" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.activity-progress {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.activity-progress li {
  position: relative;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 9px;
  padding-bottom: 10px;
}

.activity-progress li:last-child {
  padding-bottom: 0;
}

.activity-progress li:not(:last-child)::after {
  position: absolute;
  top: 20px;
  bottom: -1px;
  left: 8px;
  width: 1px;
  background: var(--hairline);
  content: '';
}

.step-marker {
  position: relative;
  display: grid;
  place-items: center;
  width: 17px;
  height: 17px;
  margin-top: 2px;
  border: 1px solid var(--border-strong);
  border-radius: 50%;
  background: var(--surface);
}

.activity-progress li[data-state='complete'] .step-marker {
  border-color: transparent;
  color: var(--wallet-selection-ink, var(--accent));
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
}

.activity-progress li[data-state='active'] .step-marker {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, var(--surface));
}

.activity-progress li[data-state='active'] .step-marker::after {
  position: absolute;
  inset: -4px;
  border: 1px solid var(--accent);
  border-radius: inherit;
  opacity: 0.35;
  content: '';
}

.step-title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
}

.step-active {
  color: var(--wallet-selection-ink, var(--accent));
  font-size: 0.68rem;
}

@media (prefers-reduced-motion: no-preference) {
  .activity-progress li[data-state='active'] .step-marker::after {
    animation: step-pulse 1.8s ease-out infinite;
  }

  .step-confirmation-enter-active {
    transition: opacity 160ms var(--ease-standard), transform 160ms var(--ease-standard);
  }

  .step-confirmation-enter-from {
    opacity: 0;
    transform: scale(0.8);
  }
}

@keyframes step-pulse {
  from { transform: scale(0.85); opacity: 0.55; }
  to { transform: scale(1.25); opacity: 0; }
}

.activity-progress li[data-state='error'] .step-marker {
  border-color: var(--danger);
  background: var(--danger);
}

.step-copy {
  display: grid;
  gap: 4px 16px;
  min-width: 0;
}

.step-description {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
  overflow-wrap: anywhere;
}

.activity-progress b {
  font-size: 0.8rem;
}

.activity-progress small {
  color: var(--text-muted);
  font-size: 0.7rem;
  line-height: 1.45;
}
.activity-times {
  display: grid;
  gap: 3px;
  margin: 2px 0 0;
  font-size: 0.68rem;
}
.activity-times > div {
  display: flex;
  flex-wrap: wrap;
  gap: 1px 8px;
}
.activity-times dt {
  color: var(--text-muted);
}
.activity-times dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

@container activity-detail (min-width: 42rem) {
  .step-copy:has(.activity-times) {
    grid-template-columns: minmax(0, 1fr) minmax(18rem, 42%);
    align-items: start;
  }
}

.activity-progress li[data-state='unknown'] .step-marker {
  border-style: dashed;
  border-color: var(--text-muted);
  background: var(--surface);
}
</style>
