<script setup lang="ts">
import { wt } from '@/i18n/walletText'

import type { Component } from 'vue'
import {
  PhCaretDoubleLeft as CollapseSidebar,
  PhCaretDoubleRight as ExpandSidebar,
  PhCaretUpDown as CaretUpDown,
} from '@phosphor-icons/vue'
import { computed, ref } from 'vue'

import BrandMark from './BrandMark.vue'
import WalletAccountMenu from './WalletAccountMenu.vue'
import WalletMobileNavigation from './WalletMobileNavigation.vue'

export interface AppShellItem {
  label: string
  icon: Component
  to: string
  current?: boolean
}

const props = withDefaults(
  defineProps<{
    items: AppShellItem[]
    mobileItems?: AppShellItem[]
    settingsItem?: AppShellItem
    editCardsLabel?: string
    accountMenuLabel?: string
    accountMenuNavigationLabel?: string
    lockLabel?: string
    signOutLabel?: string
    moreLabel?: string
    navigationLabel: string
    accountName?: string
    accountId?: string
    accountAvatar?: string
    initiallyCollapsed?: boolean
  }>(),
  {
    mobileItems: undefined,
    accountMenuLabel: wt('w307'),
    accountName: 'Wallet',
    accountId: '',
    accountAvatar: '',
    lockLabel: wt('w308'),
    moreLabel: wt('w309'),
  },
)

defineEmits<{ editCards: []; lock: []; signOut: [] }>()

const accountMenuOpen = ref(false)
const sidebarExpanded = ref(!props.initiallyCollapsed)
const sidebarToggleLabel = computed(() =>
  wt(sidebarExpanded.value ? 'walletSidebarCollapse' : 'walletSidebarExpand'),
)
</script>

<template>
  <div class="app-shell" :data-sidebar-collapsed="!sidebarExpanded || undefined">
    <aside id="wallet-sidebar" class="app-shell__sidebar">
      <button
        class="app-shell__brand"
        type="button"
        :aria-label="sidebarToggleLabel"
        :title="sidebarToggleLabel"
        :aria-expanded="sidebarExpanded"
        aria-controls="wallet-sidebar"
        @click="sidebarExpanded = !sidebarExpanded"
      >
        <span class="app-shell__brand-icon" aria-hidden="true">
          <BrandMark :size="30" class="app-shell__brand-mark" />
          <component
            :is="sidebarExpanded ? CollapseSidebar : ExpandSidebar"
            :size="18"
            class="app-shell__brand-caret"
          />
        </span>
        <span v-show="sidebarExpanded" class="app-shell__sidebar-label">PanguPay</span>
      </button>

      <nav :aria-label="navigationLabel">
        <RouterLink
          v-for="item in items"
          :key="item.label"
          :to="item.to"
          :aria-current-value="item.current === false ? 'false' : 'page'"
          :aria-label="item.label"
          :title="sidebarExpanded ? undefined : item.label"
          class="app-shell__nav-item"
        >
          <component :is="item.icon" :size="20" weight="regular" aria-hidden="true" />
          <span v-show="sidebarExpanded" class="app-shell__sidebar-label">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="app-shell__footer">
        <button
          class="app-shell__account"
          type="button"
          data-account-trigger
          aria-haspopup="menu"
          :aria-label="accountMenuLabel"
          :aria-expanded="accountMenuOpen"
          :title="sidebarExpanded ? undefined : accountMenuLabel"
          @click="accountMenuOpen = !accountMenuOpen"
        >
          <span class="app-shell__avatar">
            <img v-if="accountAvatar" :src="accountAvatar" alt="" />
            <template v-else>{{ accountName.slice(0, 1).toUpperCase() }}</template>
          </span>
          <span v-show="sidebarExpanded" class="app-shell__account-copy">
            <strong>{{ accountName }}</strong>
            <small>{{ accountId }}</small>
          </span>
          <CaretUpDown v-show="sidebarExpanded" :size="16" weight="regular" aria-hidden="true" />
        </button>
      </div>
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
          aria-haspopup="menu"
          :aria-label="accountMenuLabel"
          :aria-expanded="accountMenuOpen"
          @click="accountMenuOpen = !accountMenuOpen"
        >
          <img v-if="accountAvatar" :src="accountAvatar" alt="" />
          <template v-else>{{ accountName.slice(0, 1).toUpperCase() }}</template>
        </button>
      </header>
      <main class="app-shell__main"><slot /></main>
    </div>

    <WalletMobileNavigation
      class="app-shell__bottom-nav"
      :items="mobileItems ?? items"
      :label="navigationLabel"
      :more-label="moreLabel"
      @more="accountMenuOpen = true"
    />

    <WalletAccountMenu
      :open="accountMenuOpen"
      :account-name="accountName"
      :account-avatar="accountAvatar"
      :account-id="accountId"
      :settings-item="settingsItem"
      :edit-cards-label="editCardsLabel"
      :lock-label="lockLabel"
      :sign-out-label="signOutLabel"
      :menu-label="accountMenuNavigationLabel || navigationLabel"
      @close="accountMenuOpen = false"
      @edit-cards="$emit('editCards')"
      @lock="$emit('lock')"
      @sign-out="$emit('signOut')"
    />
  </div>
</template>

<style scoped>
.app-shell {
  --wallet-sidebar-inset: 6px;
  --wallet-sidebar-block-inset: 1.35rem;
  --wallet-sidebar-icon-column: 45px;
  --wallet-sidebar-rail-width: calc(var(--wallet-sidebar-icon-column) + 2 * var(--wallet-sidebar-inset) + 1px);
  --sidebar-width: var(--wallet-sidebar-width);
  display: grid;
  min-height: 100dvh;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  background: var(--background);
  transition: grid-template-columns var(--duration-state) var(--ease-standard);
}

.app-shell[data-sidebar-collapsed] {
  --sidebar-width: var(--wallet-sidebar-rail-width);
}

.app-shell__sidebar {
  position: sticky;
  top: 0;
  display: flex;
  height: 100dvh;
  min-width: 0;
  flex-direction: column;
  padding: var(--wallet-sidebar-block-inset) var(--wallet-sidebar-inset);
  border-right: 1px solid var(--hairline);
  background: var(--navigation-surface);
}

.app-shell__brand,
.app-shell__mobile-brand {
  min-height: 44px;
  align-items: center;
  font-size: 1rem;
  font-weight: 720;
  letter-spacing: -0.03em;
}

.app-shell__mobile-brand {
  display: flex;
  gap: 0.62rem;
}

.app-shell__sidebar :is(.app-shell__brand, .app-shell__account, .app-shell__nav-item) {
  display: grid;
  grid-template-columns: var(--wallet-sidebar-icon-column) minmax(0, 1fr);
  align-items: center;
}

.app-shell__sidebar :is(.app-shell__brand-icon, .app-shell__avatar, .app-shell__nav-item > svg) {
  justify-self: center;
}

.app-shell__brand {
  width: 100%;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  text-align: start;
}

.app-shell__brand-icon {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
}

.app-shell__brand-icon > * {
  grid-area: 1 / 1;
  transition: opacity 140ms var(--ease-standard);
}

.app-shell__brand-caret {
  color: var(--text-muted);
  opacity: 0;
}

.app-shell__brand-icon:hover .app-shell__brand-mark,
.app-shell__brand:focus-visible .app-shell__brand-mark {
  opacity: 0;
}

.app-shell__brand-icon:hover .app-shell__brand-caret,
.app-shell__brand:focus-visible .app-shell__brand-caret {
  opacity: 1;
}

.app-shell__sidebar-label,
.app-shell__account-copy,
.app-shell__account-copy :is(strong, small) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-shell__sidebar-label,
.app-shell__account-copy {
  padding-inline-start: 6px;
}

.app-shell__sidebar .app-shell__account {
  grid-template-columns: var(--wallet-sidebar-icon-column) minmax(0, 1fr) auto;
  overflow: hidden;
  width: 100%;
  min-height: 48px;
  padding: 0;
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
  overflow: hidden;
  display: grid;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--text);
  color: var(--background);
  font-size: 0.85rem;
  font-weight: 750;
  place-items: center;
}

.app-shell__avatar img,
.app-shell__mobile-account img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
  display: block;
}

.app-shell__account-copy {
  display: grid;
  gap: 0.1rem;
}

.app-shell__account > svg {
  margin-inline: 4px 10px;
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
  min-height: 0;
  margin-top: 0.85rem;
  gap: 0.18rem;
  overflow-y: auto;
  scrollbar-width: none;
}

.app-shell__footer {
  flex-shrink: 0;
  margin-top: auto;
  padding-top: 0.55rem;
  border-top: 1px solid var(--hairline);
}

.app-shell__nav-item {
  min-height: 44px;
  padding: 0.65rem 0;
  border-radius: 10px;
  color: var(--text-muted);
  font-size: 0.84rem;
  font-weight: 570;
  transition:
    background var(--duration-state) var(--ease-standard),
    color var(--duration-state) var(--ease-standard);
}

.app-shell__nav-item:hover,
.app-shell__nav-item[aria-current="page"] {
  background: var(--surface-hover);
  color: var(--text);
}

.app-shell__nav-item[aria-current="page"] {
  background: var(--wallet-selection-fill, var(--surface-hover));
  color: var(--wallet-selection-ink, var(--text));
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
  padding: 0;
  overflow: hidden;
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

@media (prefers-reduced-motion: reduce) {
  .app-shell,
  .app-shell__brand-icon > * {
    transition: none;
  }
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
