<script setup lang="ts">
export interface TimelineItem {
  label: string
  detail?: string
  meta?: string
  state: 'complete' | 'active' | 'pending' | 'error'
}

defineProps<{
  items: TimelineItem[]
}>()
</script>

<template>
  <ol class="timeline">
    <li v-for="(item, index) in items" :key="item.label" :class="`timeline__item--${item.state}`">
      <div class="timeline__rail" aria-hidden="true">
        <span class="timeline__dot" />
        <span v-if="index < items.length - 1" class="timeline__line" />
      </div>
      <div class="timeline__content">
        <div class="timeline__title">
          <strong>{{ item.label }}</strong>
          <span v-if="item.meta" class="timeline__meta">{{ item.meta }}</span>
        </div>
        <span v-if="item.detail">{{ item.detail }}</span>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.timeline {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.timeline li {
  display: grid;
  grid-template-columns: 22px 1fr;
  gap: 0.65rem;
  min-height: 54px;
}

.timeline__rail {
  display: flex;
  align-items: center;
  flex-direction: column;
}

.timeline__dot {
  width: 10px;
  height: 10px;
  flex: none;
  margin-top: 0.22rem;
  border: 2px solid var(--text-faint);
  border-radius: 50%;
  background: var(--surface);
}

.timeline__line {
  width: 1px;
  flex: 1;
  margin-block: 4px;
  background: var(--border-strong);
}

.timeline__item--complete .timeline__dot,
.timeline__item--active .timeline__dot {
  border-color: var(--accent);
  background: var(--accent);
}

.timeline__item--active .timeline__dot {
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent) 18%, transparent);
  animation: status-breathe 2.2s ease-in-out infinite;
}

.timeline__item--error .timeline__dot {
  border-color: var(--danger);
  background: var(--danger);
}

.timeline__content {
  display: grid;
  align-content: start;
  gap: 0.18rem;
}

.timeline__content strong {
  font-size: 0.86rem;
  font-weight: 650;
}

.timeline__title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.timeline__meta {
  flex: none;
  color: var(--accent) !important;
  font-size: 0.7rem !important;
  font-variant-numeric: tabular-nums;
  font-weight: 620;
  letter-spacing: 0.01em;
}

.timeline__content span {
  color: var(--text-muted);
  font-size: 0.75rem;
}

@media (max-width: 479px) {
  .timeline__title {
    display: grid;
    justify-content: start;
    gap: 0.08rem;
  }
}
</style>
