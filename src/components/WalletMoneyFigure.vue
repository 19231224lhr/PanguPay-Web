<script setup lang="ts">
import { ref } from 'vue'

const lift = ref(0)
const lean = ref(0)
function follow(event: PointerEvent) {
  if (
    event.pointerType === 'touch' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width))
  const y = Math.max(0, Math.min(1, (event.clientY - box.top) / box.height))
  lift.value = 4 + (1 - y) * 10
  lean.value = (x - 0.5) * 8
}
function rest() {
  lift.value = 0
  lean.value = 0
}
</script>

<template>
  <div
    class="wallet-figure money-figure"
    data-figure="money"
    aria-hidden="true"
    :style="{ '--coin-lift': `${-lift}px`, '--note-lean': `${lean}deg` }"
    @pointermove="follow"
    @pointerleave="rest"
    @pointercancel="rest"
  >
    <svg
      viewBox="0 0 160 128"
      fill="none"
      stroke="currentColor"
      stroke-width="0.9"
      stroke-linejoin="round"
    >
      <g class="money-note">
        <path d="M67 38 107 17 146 41 106 63Z" />
        <path d="M67 38v5l39 25 40-22v-5M106 63v5" />
        <path d="m80 38 27-14 26 17-27 15Z" class="money-detail" />
        <ellipse cx="107" cy="40" rx="8" ry="5" />
      </g>
      <g class="money-stack">
        <path d="M28 76v8c0 8 14 14 31 14s31-6 31-14v-8" />
        <ellipse cx="59" cy="76" rx="31" ry="14" />
        <path d="M28 68v8c0 8 14 14 31 14s31-6 31-14v-8" />
        <ellipse cx="59" cy="68" rx="31" ry="14" />
        <path d="M28 60v8c0 8 14 14 31 14s31-6 31-14v-8" />
        <ellipse cx="59" cy="60" rx="31" ry="14" />
      </g>
      <g class="money-top">
        <path d="M28 52v8c0 8 14 14 31 14s31-6 31-14v-8" />
        <ellipse cx="59" cy="52" rx="31" ry="14" />
        <ellipse cx="59" cy="52" rx="23" ry="9" class="money-detail" />
        <path d="m53 55 7-7 7 3-7 7Z" />
      </g>
      <g class="money-loose">
        <path d="M96 85v6c0 6 10 10 22 10s22-4 22-10v-6" />
        <ellipse cx="118" cy="85" rx="22" ry="10" />
        <ellipse cx="118" cy="85" rx="16" ry="6" class="money-detail" />
      </g>
    </svg>
  </div>
</template>

<style scoped>
.money-figure {
  width: 112px;
  aspect-ratio: 5 / 4;
  color: var(--text-muted);
}
svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}
path,
ellipse {
  fill: var(--figure-plate, var(--background));
}
.money-detail {
  fill: none;
  opacity: 0.55;
}
.money-top,
.money-note {
  transition: transform 480ms cubic-bezier(0.16, 1, 0.3, 1);
  transform-box: fill-box;
  transform-origin: center;
}
.money-top {
  transform: translateY(var(--coin-lift));
}
.money-note {
  transform: rotate(var(--note-lean));
}
@media (prefers-reduced-motion: reduce), (hover: none) {
  .money-figure {
    pointer-events: none;
  }
  .money-top,
  .money-note {
    transform: none;
    transition: none;
  }
}
</style>
