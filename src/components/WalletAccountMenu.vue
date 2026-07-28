<script setup lang="ts">
import { PhLockKey as LockKey } from '@phosphor-icons/vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'

import type { AppShellItem } from './AppShell.vue'

const props = withDefaults(
  defineProps<{
    accountId?: string
    accountName?: string
    items?: AppShellItem[]
    utilityItems?: AppShellItem[]
    lockLabel?: string
    open: boolean
  }>(),
  {
    accountId: '',
    accountName: 'Wallet',
    items: () => [],
    utilityItems: () => [],
    lockLabel: '锁定钱包',
  },
)

const emit = defineEmits<{ close: []; lock: [] }>()
const panel = ref<HTMLElement>()

function close(): void {
  emit('close')
}

function onPointerDown(event: PointerEvent): void {
  if (!props.open) return
  const target = event.target as Element | null
  if (target?.closest('[data-account-trigger]')) return
  if (!panel.value?.contains(target)) close()
}

function onKeyDown(event: KeyboardEvent): void {
  if (props.open && event.key === 'Escape') close()
}

onMounted(() => {
  window.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <Transition name="account-menu">
    <section v-if="open" ref="panel" class="wallet-account-menu" role="menu" aria-label="账户菜单">
      <header>
        <span class="wallet-account-menu__avatar">{{ accountName.slice(0, 1).toUpperCase() }}</span>
        <span>
          <strong>{{ accountName }}</strong>
          <small>{{ accountId }}</small>
        </span>
      </header>

      <nav
        v-if="items.length"
        class="wallet-account-menu__items"
        data-account-items
        aria-label="账户功能"
      >
        <RouterLink
          v-for="item in items"
          :key="item.to"
          :to="item.to"
          role="menuitem"
          @click="close"
        >
          <component :is="item.icon" :size="18" weight="regular" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <nav
        v-if="utilityItems.length"
        class="wallet-account-menu__mobile-utilities"
        data-mobile-utilities
        aria-label="移动端钱包设置"
      >
        <RouterLink
          v-for="item in utilityItems"
          :key="item.to"
          :to="item.to"
          role="menuitem"
          @click="close"
        >
          <component :is="item.icon" :size="18" weight="regular" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <button type="button" role="menuitem" :aria-label="lockLabel" @click="emit('lock')">
        <LockKey :size="18" weight="regular" aria-hidden="true" />
        <span>{{ lockLabel }}</span>
      </button>
    </section>
  </Transition>
</template>

<style scoped>
.wallet-account-menu {
  position: fixed;
  z-index: 60;
  top: 5.85rem;
  left: 0.8rem;
  display: grid;
  width: min(248px, calc(100vw - 1.6rem));
  overflow: hidden;
  padding: 0.5rem;
  border: 1px solid var(--menu-border);
  border-radius: 16px;
  background: var(--menu-surface);
  box-shadow: var(--shadow-menu);
  backdrop-filter: blur(22px) saturate(145%);
  transform-origin: 1.5rem 0;
}

header {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.72rem;
}

header > span:last-child {
  display: grid;
  min-width: 0;
  gap: 0.12rem;
}

header strong {
  overflow: hidden;
  font-size: 0.88rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

header small {
  color: var(--text-muted);
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
}

.wallet-account-menu__avatar {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  border-radius: 50%;
  background: var(--text);
  color: var(--background);
  font-size: 0.8rem;
  font-weight: 730;
  place-items: center;
}

.wallet-account-menu__items,
.wallet-account-menu__mobile-utilities {
  display: grid;
  padding-block: 0.3rem;
  border-block: 1px solid var(--hairline);
}

.wallet-account-menu__items a,
.wallet-account-menu__mobile-utilities a,
button {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 0.7rem;
  padding: 0.62rem 0.72rem;
  border-radius: 10px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font-size: 0.82rem;
  text-align: left;
}

.wallet-account-menu__items a:hover,
.wallet-account-menu__mobile-utilities a:hover,
button:hover {
  background: var(--surface-hover);
}

.wallet-account-menu__mobile-utilities {
  display: none;
}

button {
  color: var(--danger);
}

.account-menu-enter-active,
.account-menu-leave-active {
  transition:
    opacity 180ms var(--ease-standard),
    transform 180ms var(--ease-standard),
    filter 180ms var(--ease-standard);
}

.account-menu-enter-from,
.account-menu-leave-to {
  opacity: 0;
  filter: blur(4px);
  transform: translateY(-5px) scale(0.98);
}

@media (max-width: 767px) {
  .wallet-account-menu {
    top: auto;
    right: 0.75rem;
    bottom: calc(78px + env(safe-area-inset-bottom));
    left: 0.75rem;
    width: auto;
    transform-origin: 85% 100%;
  }

  .wallet-account-menu__mobile-utilities {
    display: grid;
  }
}

@media (prefers-reduced-motion: reduce) {
  .account-menu-enter-active,
  .account-menu-leave-active {
    transition: opacity 120ms linear;
  }

  .account-menu-enter-from,
  .account-menu-leave-to {
    filter: none;
    transform: none;
  }
}
</style>
