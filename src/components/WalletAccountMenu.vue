<script setup lang="ts">
import { wt } from '@/i18n/walletText'

import { PhLockKey as LockKey, PhSignOut as SignOut, PhSlidersHorizontal } from '@phosphor-icons/vue'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { AppShellItem } from './AppShell.vue'

const props = withDefaults(
  defineProps<{
    accountId?: string
    accountName?: string
    accountAvatar?: string
    settingsItem?: AppShellItem
    editCardsLabel?: string
    lockLabel?: string
    signOutLabel?: string
    menuLabel?: string
    open: boolean
  }>(),
  {
    accountId: '',
    accountName: 'Wallet',
    accountAvatar: '',
    lockLabel: wt('w308'),
    menuLabel: wt('w354'),
  },
)

const emit = defineEmits<{ close: []; editCards: []; lock: []; signOut: [] }>()
const panel = ref<HTMLElement>()

let trigger: HTMLElement | undefined
function menuItems() {
  return Array.from(panel.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
}
watch(
  () => props.open,
  async (open) => {
    if (!open) return
    trigger = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    await nextTick()
    if (props.open) menuItems()[0]?.focus({ preventScroll: true })
  },
)
function close(restore = true): void {
  emit('close')
  if (restore) nextTick(() => trigger?.isConnected && trigger.focus({ preventScroll: true }))
}

function requestSignOut(): void {
  close()
  emit('signOut')
}

function requestLock(): void {
  close(false)
  emit('lock')
}

function requestCardEdit(): void {
  close(false)
  emit('editCards')
}

function onPointerDown(event: PointerEvent): void {
  if (!props.open) return
  const target = event.target as Element | null
  if (target?.closest('[data-account-trigger]')) return
  if (!panel.value?.contains(target)) close(false)
}

function onKeyDown(event: KeyboardEvent): void {
  if (!props.open) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key === 'Tab') {
    close(false)
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const items = menuItems()
  if (!items.length) return
  const index = items.indexOf(document.activeElement as HTMLElement)
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
  items[next]?.focus({ preventScroll: true })
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
    <section
      v-if="open"
      ref="panel"
      class="wallet-account-menu"
      role="menu"
      :aria-label="menuLabel"
    >
      <header role="presentation">
        <span class="wallet-account-menu__avatar">
          <img v-if="accountAvatar" :src="accountAvatar" alt="" />
          <template v-else>{{ accountName.slice(0, 1).toUpperCase() }}</template>
        </span>
        <span>
          <strong>{{ accountName }}</strong>
          <small>{{ accountId }}</small>
        </span>
      </header>

      <div class="wallet-account-menu__items" role="presentation">
        <RouterLink
          v-if="settingsItem"
          :to="settingsItem.to"
          :aria-current-value="settingsItem.current === false ? 'false' : 'page'"
          role="menuitem"
          @click="close()"
        >
          <component :is="settingsItem.icon" :size="18" weight="regular" aria-hidden="true" />
          <span>{{ settingsItem.label }}</span>
        </RouterLink>
        <button v-if="editCardsLabel" type="button" role="menuitem" @click="requestCardEdit">
          <PhSlidersHorizontal :size="18" weight="regular" aria-hidden="true" />
          <span>{{ editCardsLabel }}</span>
        </button>
        <button type="button" role="menuitem" @click="requestLock">
          <LockKey :size="18" weight="regular" aria-hidden="true" />
          <span>{{ lockLabel }}</span>
        </button>
        <button
          v-if="signOutLabel"
          type="button"
          role="menuitem"
          class="wallet-account-menu__sign-out"
          @click="requestSignOut"
        >
          <SignOut :size="18" weight="regular" aria-hidden="true" />
          <span>{{ signOutLabel }}</span>
        </button>
      </div>
    </section>
  </Transition>
</template>

<style scoped>
.wallet-account-menu {
  position: fixed;
  z-index: 60;
  bottom: var(--wallet-sidebar-block-inset, 1.35rem);
  left: calc(var(--sidebar-width, 0px) + 6px);
  display: grid;
  width: min(248px, calc(100vw - 1.6rem));
  overflow: hidden;
  padding: 0.5rem;
  border: 1px solid var(--menu-border);
  border-radius: 16px;
  background: var(--menu-surface);
  box-shadow: var(--shadow-menu);
  backdrop-filter: blur(22px) saturate(145%);
  transform-origin: left bottom;
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
  overflow: hidden;
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

.wallet-account-menu__items {
  display: grid;
  padding-top: 0.3rem;
  border-top: 1px solid var(--hairline);
}

.wallet-account-menu__items :is(a, button) {
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

.wallet-account-menu__items :is(a, button):is(:hover, :focus-visible) {
  background: var(--surface-hover);
}

.wallet-account-menu__items .wallet-account-menu__sign-out {
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
  transform: translateY(4px) scale(0.98);
}

@media (max-width: 767px) {
  .wallet-account-menu {
    right: 0.75rem;
    bottom: calc(78px + env(safe-area-inset-bottom));
    left: 0.75rem;
    width: auto;
    transform-origin: 85% 100%;
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
.wallet-account-menu__avatar img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
