<script setup lang="ts">
import type { Component } from 'vue'
import { PhCaretUpDown as CaretUpDown } from '@phosphor-icons/vue'
import { ref } from 'vue'

import BrandMark from './BrandMark.vue'
import WalletAccountMenu from './WalletAccountMenu.vue'
import WalletMobileNavigation from './WalletMobileNavigation.vue'

export interface AppShellItem {
  label: string
  icon: Component
  to: string
}

withDefaults(
  defineProps<{
    items: AppShellItem[]
    accountItems?: AppShellItem[]
    utilityItems?: AppShellItem[]
    accountMenuLabel?: string
    lockLabel?: string
    moreLabel?: string
    navigationLabel: string
    accountName?: string
    accountId?: string
  }>(),
  {
    accountItems: () => [],
    utilityItems: () => [],
    accountMenuLabel: '打开账户菜单',
    accountName: 'Wallet',
    accountId: '',
    lockLabel: '锁定钱包',
    moreLabel: '我的',
  },
)

defineEmits<{ lock: [] }>()

const accountMenuOpen = ref(false)
</script>

<template>
  <div class="app-shell">
    <aside class="app-shell__sidebar">
      <RouterLink class="app-shell__brand" to="/" aria-label="PanguPay home">
        <BrandMark :size="30" />
        <span>PanguPay</span>
      </RouterLink>

      <button
        class="app-shell__account"
        type="button"
        data-account-trigger
        :aria-label="accountMenuLabel"
        :aria-expanded="accountMenuOpen"
        @click="accountMenuOpen = !accountMenuOpen"
      >
        <span class="app-shell__avatar">{{ accountName.slice(0, 1).toUpperCase() }}</span>
        <span
          ><strong>{{ accountName }}</strong
          ><small>{{ accountId }}</small></span
        >
        <CaretUpDown :size="16" weight="regular" aria-hidden="true" />
      </button>

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

      <nav
        v-if="utilityItems.length"
        class="app-shell__utilities"
        data-sidebar-utilities
        aria-label="钱包设置"
      >
        <RouterLink
          v-for="item in utilityItems"
          :key="item.to"
          :to="item.to"
          class="app-shell__nav-item"
        >
          <component :is="item.icon" :size="20" weight="regular" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>

    <div class="app-shell__body">
      <header class="app-shell__topbar">
        <RouterLink class="app-shell__mobile-brand" to="/">
          <BrandMark :size="27" />
          <span>PanguPay</span>
        </RouterLink>
        <button
          class="app-shell__mobile-account"
          type="button"
          data-account-trigger
          :aria-label="accountMenuLabel"
          :aria-expanded="accountMenuOpen"
          @click="accountMenuOpen = !accountMenuOpen"
        >
          {{ accountName.slice(0, 1).toUpperCase() }}
        </button>
      </header>
      <main class="app-shell__main"><slot /></main>
    </div>

    <WalletMobileNavigation
      class="app-shell__bottom-nav"
      :items="items"
      :label="navigationLabel"
      :more-label="moreLabel"
      @more="accountMenuOpen = true"
    />

    <WalletAccountMenu
      :open="accountMenuOpen"
      :account-name="accountName"
      :account-id="accountId"
      :items="accountItems"
      :utility-items="utilityItems"
      :lock-label="lockLabel"
      @close="accountMenuOpen = false"
      @lock="$emit('lock')"
    />
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  min-height: 100dvh;
  grid-template-columns: var(--wallet-sidebar-width) minmax(0, 1fr);
  background: var(--background);
}

.app-shell__sidebar {
  position: sticky;
  top: 0;
  display: flex;
  height: 100dvh;
  flex-direction: column;
  padding: 1.35rem 0.8rem;
  border-right: 1px solid var(--hairline);
  background: var(--navigation-surface);
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
  width: 100%;
  min-height: 58px;
  align-items: center;
  gap: 0.72rem;
  margin: 1.4rem 0 1.55rem;
  padding: 0.62rem;
  border-radius: 12px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  text-align: left;
  transition: background var(--duration-state) var(--ease-standard);
}

.app-shell__account:hover {
  background: var(--surface-hover);
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

.app-shell__account > span:nth-child(2) {
  display: grid;
  gap: 0.1rem;
}

.app-shell__account > svg {
  margin-left: auto;
  color: var(--text-faint);
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
  gap: 0.18rem;
}

.app-shell__utilities {
  margin-top: auto;
  padding-top: 0.8rem;
  border-top: 1px solid var(--hairline);
}

.app-shell__nav-item {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 0.72rem;
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  color: var(--text-muted);
  font-size: 0.84rem;
  font-weight: 570;
  transition:
    background var(--duration-state) var(--ease-standard),
    color var(--duration-state) var(--ease-standard);
}

.app-shell__nav-item:hover,
.app-shell__nav-item.router-link-exact-active {
  background: var(--surface-hover);
  color: var(--text);
}

.app-shell__nav-item.router-link-exact-active {
  box-shadow: inset 2px 0 var(--accent);
}

.app-shell__body {
  min-width: 0;
}

.app-shell__topbar {
  display: none;
}

.app-shell__main {
  width: min(var(--wallet-content-max), 100%);
  margin-inline: auto;
  padding: clamp(1.5rem, 3.4vw, 3rem);
}

.app-shell__mobile-account {
  display: grid;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--text);
  color: var(--background);
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 730;
  place-items: center;
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
    border-bottom: 1px solid var(--hairline);
    background: var(--navigation-surface);
  }

  .app-shell__main {
    padding: 1.25rem 1rem 2rem;
  }
}
</style>
