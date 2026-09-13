<script setup lang="ts">
import { wt, walletLocale } from '@/i18n/walletText'

import { computed } from 'vue'

import type { TransferProgress } from '@/transfer/journal'
import { buildTransferTimeline } from '@/transfer/workflow'

const props = defineProps<{
  progress?: TransferProgress
  status?: string
}>()

const steps = computed(() =>
  props.progress
    ? buildTransferTimeline(props.progress)
    : [{ label: wt('w294'), detail: props.status || wt('w295'), state: 'pending' }],
)

const formatTime = (value?: number) =>
  value
    ? new Intl.DateTimeFormat(walletLocale(), {
        dateStyle: 'medium',
        timeStyle: 'medium',
        hour12: false,
      }).format(value)
    : wt('w296')

const milestones = computed(() => {
  const p = props.progress
  if (!p) return []
  const result = [{ label: wt('w297'), value: formatTime(p.backendAcceptedAt ?? p.acceptedAt) }]
  if (p.mode === 'quick') {
    result.push({ label: wt('w298'), value: formatTime(p.registeredAt) })
    result.push({
      label: wt('w299'),
      value: p.spendReadyAt ? formatTime(p.backendSpendReadyAt ?? p.spendReadyAt) : wt('w300'),
    })
  }
  if (p.mode === 'cross') {
    result.push({ label: wt('w301'), value: formatTime(p.targetConfirmedAt) })
  }
  result.push({ label: wt('w302'), value: formatTime(p.settledAt) })
  return result
})
</script>

<template>
  <ol class="activity-progress" :aria-label="wt('w303')">
    <li v-for="step in steps" :key="step.label" data-activity-step :data-state="step.state">
      <span aria-hidden="true" />
      <div>
        <b>{{ step.label }}</b>
        <small>{{ step.detail }}</small>
        <small v-if="'meta' in step && step.meta">{{ step.meta }}</small>
      </div>
    </li>
  </ol>
  <dl v-if="milestones.length" class="activity-times" :aria-label="wt('w304')">
    <div v-for="item in milestones" :key="item.label">
      <dt>{{ item.label }}</dt>
      <dd>{{ item.value }}</dd>
    </div>
  </dl>
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
  grid-template-columns: 16px minmax(0, 1fr);
  gap: 0.65rem;
  padding-bottom: 0.85rem;
}

.activity-progress li:not(:last-child)::after {
  position: absolute;
  top: 15px;
  bottom: 0;
  left: 5px;
  width: 1px;
  background: var(--hairline);
  content: '';
}

.activity-progress li > span {
  width: 11px;
  height: 11px;
  margin-top: 0.22rem;
  border: 1px solid var(--border-strong);
  border-radius: 50%;
  background: var(--surface);
}

.activity-progress li[data-state='complete'] > span {
  border-color: var(--success);
  background: var(--success);
}

.activity-progress li[data-state='active'] > span {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 12%, transparent);
}

.activity-progress li[data-state='error'] > span {
  border-color: var(--danger);
  background: var(--danger);
}

.activity-progress div {
  display: grid;
  gap: 0.12rem;
}

.activity-progress b {
  font-size: 0.76rem;
}

.activity-progress small {
  color: var(--text-muted);
  font-size: 0.7rem;
  line-height: 1.45;
}
.activity-times {
  display: grid;
  gap: 0.5rem;
  margin: 0.75rem 0 0;
  font-size: 0.72rem;
}
.activity-times > div {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.25rem 1rem;
}
.activity-times dt {
  color: var(--text-muted);
}
.activity-times dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
.activity-progress li[data-state='unknown'] > span {
  border-style: dashed;
  border-color: var(--text-muted);
  background: var(--surface);
}
</style>
