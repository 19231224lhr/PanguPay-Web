<script setup lang="ts">
import { PhUserCircle as UserCircle } from '@phosphor-icons/vue'

import type { AppShellItem } from './AppShell.vue'

withDefaults(
  defineProps<{
    items: AppShellItem[]
    label: string
    moreLabel?: string
  }>(),
  { moreLabel: '我的' },
)

defineEmits<{ more: [] }>()
</script>

<template>
  <nav class="wallet-mobile-navigation" :aria-label="label">
    <RouterLink v-for="item in items.slice(0, 3)" :key="item.to" :to="item.to">
      <component :is="item.icon" :size="21" weight="regular" aria-hidden="true" />
      <span>{{ item.label }}</span>
    </RouterLink>
    <button type="button" data-account-trigger @click="$emit('more')">
      <UserCircle :size="21" weight="regular" aria-hidden="true" />
      <span>{{ moreLabel }}</span>
    </button>
  </nav>
</template>

<style scoped>
.wallet-mobile-navigation {
  position: fixed;
  z-index: 30;
  right: 0;
  bottom: 0;
  left: 0;
  display: none;
  min-height: 68px;
  grid-template-columns: repeat(4, 1fr);
  padding: 0.35rem 0.45rem max(0.35rem, env(safe-area-inset-bottom));
  border-top: 1px solid var(--hairline);
  background: var(--navigation-overlay);
  backdrop-filter: blur(20px) saturate(145%);
}

a,
button {
  display: grid;
  min-height: 52px;
  align-content: center;
  justify-items: center;
  gap: 0.2rem;
  border-radius: 10px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.64rem;
}

a.router-link-exact-active {
  color: var(--accent);
}

@media (max-width: 767px) {
  .wallet-mobile-navigation {
    display: grid;
  }
}
</style>
