<script setup lang="ts">
import type { Component } from 'vue'

import BrandMark from './BrandMark.vue'
import PreferenceControls from './PreferenceControls.vue'

export interface AppShellItem {
  label: string
  icon: Component
  to: string
}

defineProps<{
  items: AppShellItem[]
  navigationLabel: string
}>()
</script>

<template>
  <div class="app-shell">
    <aside class="app-shell__sidebar">
      <RouterLink class="app-shell__brand" to="/" aria-label="PanguPay home">
        <BrandMark :size="30" />
        <span>PanguPay</span>
      </RouterLink>

      <div class="app-shell__account">
        <span class="app-shell__avatar">A</span>
        <span><strong>Alice</strong><small>9231 9817</small></span>
      </div>

      <nav :aria-label="navigationLabel">
        <RouterLink
          v-for="item in items"
          :key="item.label"
          :to="item.to"
          class="app-shell__nav-item"
        >
          <component :is="item.icon" :size="20" weight="regular" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <PreferenceControls class="app-shell__preferences" />
    </aside>

    <div class="app-shell__body">
      <header class="app-shell__topbar">
        <RouterLink class="app-shell__mobile-brand" to="/">
          <BrandMark :size="27" />
          <span>PanguPay</span>
        </RouterLink>
        <PreferenceControls />
      </header>
      <main class="app-shell__main"><slot /></main>
    </div>

    <nav class="app-shell__bottom-nav" :aria-label="navigationLabel">
      <RouterLink v-for="item in items.slice(0, 4)" :key="item.label" :to="item.to">
        <component :is="item.icon" :size="21" weight="regular" />
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  min-height: 100dvh;
  grid-template-columns: 236px minmax(0, 1fr);
  background: var(--background);
}

.app-shell__sidebar {
  position: sticky;
  top: 0;
  display: flex;
  height: 100dvh;
  flex-direction: column;
  padding: 1.35rem 1rem;
  border-right: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 88%, var(--background));
}

.app-shell__brand,
.app-shell__mobile-brand {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 0.62rem;
  font-size: 1rem;
  font-weight: 720;
  letter-spacing: -0.03em;
}

.app-shell__account {
  display: flex;
  align-items: center;
  gap: 0.72rem;
  margin: 1.5rem 0 1.7rem;
  padding: 0.7rem;
}

.app-shell__avatar {
  display: grid;
  width: 38px;
  height: 38px;
  flex: none;
  border-radius: 50%;
  background: var(--text);
  color: var(--background);
  font-size: 0.85rem;
  font-weight: 750;
  place-items: center;
}

.app-shell__account > span:last-child {
  display: grid;
  gap: 0.1rem;
}

.app-shell__account strong {
  font-size: 0.84rem;
}

.app-shell__account small {
  color: var(--text-muted);
  font-size: 0.69rem;
  font-variant-numeric: tabular-nums;
}

.app-shell__sidebar nav {
  display: grid;
  gap: 0.25rem;
}

.app-shell__nav-item {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 0.72rem;
  padding: 0.65rem 0.75rem;
  border-radius: 12px;
  color: var(--text-muted);
  font-size: 0.84rem;
  font-weight: 570;
  transition:
    background var(--duration-state) var(--ease-standard),
    color var(--duration-state) var(--ease-standard);
}

.app-shell__nav-item:hover,
.app-shell__nav-item.router-link-exact-active {
  background: var(--surface-subtle);
  color: var(--text);
}

.app-shell__preferences {
  margin-top: auto;
  padding: 0.55rem;
}

.app-shell__body {
  min-width: 0;
}

.app-shell__topbar {
  display: none;
}

.app-shell__main {
  width: min(1180px, 100%);
  margin-inline: auto;
  padding: clamp(1.5rem, 4vw, 3.5rem);
}

.app-shell__bottom-nav {
  display: none;
}

@media (max-width: 767px) {
  .app-shell {
    display: block;
    padding-bottom: calc(74px + env(safe-area-inset-bottom));
  }

  .app-shell__sidebar {
    display: none;
  }

  .app-shell__topbar {
    display: flex;
    min-height: 64px;
    align-items: center;
    justify-content: space-between;
    padding: max(0.6rem, env(safe-area-inset-top)) 1rem 0.6rem;
    border-bottom: 1px solid var(--border);
  }

  .app-shell__main {
    padding: 1.25rem 1rem 2rem;
  }

  .app-shell__bottom-nav {
    position: fixed;
    z-index: 30;
    right: 0;
    bottom: 0;
    left: 0;
    display: grid;
    min-height: 68px;
    grid-template-columns: repeat(4, 1fr);
    padding: 0.38rem 0.45rem max(0.38rem, env(safe-area-inset-bottom));
    border-top: 1px solid var(--border);
    background: var(--overlay);
    backdrop-filter: blur(18px);
  }

  .app-shell__bottom-nav a {
    display: grid;
    min-height: 52px;
    align-content: center;
    justify-items: center;
    gap: 0.2rem;
    border-radius: 12px;
    color: var(--text-muted);
    font-size: 0.64rem;
  }

  .app-shell__bottom-nav a.router-link-exact-active {
    color: var(--accent);
  }
}
</style>
