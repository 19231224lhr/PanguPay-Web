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
  const settlement = { label: wt('w302'), value: formatTime(p.settledAt) }
  if (p.mode === 'cross') {
    return {
      received,
      'target-confirmed': [
        { label: wt('w301'), value: formatTime(p.targetConfirmedAt) },
        settlement,
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
      settlement: [settlement],
    }
  }
  return { received, settlement: [settlement] }
})
</script>

<template>
  <ol class="activity-progress" :aria-label="wt('w303')">
    <li
      v-for="step in steps"
      :key="step.id ?? step.label"
      :data-activity-step="step.id ?? ''"
      :data-state="step.state"
    >
      <span class="step-marker" aria-hidden="true">
        <PhCheck v-if="step.state === 'complete'" :size="11" weight="bold" />
      </span>
      <div class="step-copy">
        <div class="step-description">
          <b>{{ step.label }}</b>
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
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 12%, transparent);
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
