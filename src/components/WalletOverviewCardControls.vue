<script setup lang="ts">
import { PhDotsSixVertical, PhX } from '@phosphor-icons/vue'
import { wt } from '@/i18n/walletText'
import { overviewCardTitles, type OverviewCardId } from '@/wallet/overviewLayout'

defineProps<{ card: OverviewCardId }>()
const emit = defineEmits<{ remove: []; move: [direction: -1 | 1] }>()
</script>

<template>
  <div class="overview-card-controls">
    <button
      type="button"
      class="overview-card-remove"
      :aria-label="wt('overviewRemoveCard', [wt(overviewCardTitles[card])])"
      :title="wt('overviewRemoveCard', [wt(overviewCardTitles[card])])"
      @click="emit('remove')"
    >
      <PhX :size="16" weight="bold" aria-hidden="true" />
    </button>
    <button
      type="button"
      data-overview-grip
      :aria-label="wt('overviewMoveCard', [wt(overviewCardTitles[card])])"
      :title="wt('overviewMoveCard', [wt(overviewCardTitles[card])])"
      aria-describedby="overview-edit-instructions"
      @keydown.up.prevent="emit('move', -1)"
      @keydown.left.prevent="emit('move', -1)"
      @keydown.down.prevent="emit('move', 1)"
      @keydown.right.prevent="emit('move', 1)"
    >
      <PhDotsSixVertical :size="20" weight="bold" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.overview-card-controls {
  display: flex;
  justify-content: space-between;
  padding: 6px 8px 0;
}
.overview-card-controls > button {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  background: var(--surface-hover);
  cursor: pointer;
}
.overview-card-controls > button:hover {
  color: var(--text);
  border-color: var(--border);
}
.overview-card-controls > [data-overview-grip] {
  cursor: grab;
  touch-action: none;
}
@media (pointer: coarse) {
  .overview-card-controls > button {
    width: 44px;
    height: 44px;
  }
}
</style>
