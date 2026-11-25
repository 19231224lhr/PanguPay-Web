<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { PhArrowCounterClockwise, PhCheck, PhPlus, PhX } from '@phosphor-icons/vue'
import { wt } from '@/i18n/walletText'
import {
  overviewCardTitles,
  type OverviewCardId,
  type OverviewCardPreference,
} from '@/wallet/overviewLayout'

defineProps<{ hiddenCards: OverviewCardPreference[]; saveError: boolean }>()
const emit = defineEmits<{ close: []; save: []; restore: []; add: [card: OverviewCardId] }>()
const showAdd = ref(false)

// The overview is a CSS query container. Mount the dock outside it so its
// fixed position follows the viewport while inheriting the shell's rail width.
const dockHost = document.querySelector('.app-shell__body') ?? document.body
const dock = ref<HTMLElement>()
const addButton = ref<HTMLButtonElement>()
function focusAdd() {
  addButton.value?.focus({ preventScroll: true })
}
defineExpose({ focusAdd })

function dismiss() {
  showAdd.value = false
  focusAdd()
}
function outside(event: Event) {
  if (dock.value && !event.composedPath().includes(dock.value)) showAdd.value = false
}
function leaveDock(event: FocusEvent) {
  if (event.relatedTarget instanceof Node && !dock.value?.contains(event.relatedTarget)) showAdd.value = false
}
watch(showAdd, (open) => {
  if (open) document.addEventListener('pointerdown', outside)
  else document.removeEventListener('pointerdown', outside)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
</script>

<template>
  <Teleport :to="dockHost">
    <section ref="dock" class="overview-editor" :aria-label="wt('overviewEditCards')"
      @keydown.esc="showAdd && dismiss()"
      @focusout="leaveDock">
      <div class="overview-editor__bar">
        <button ref="addButton" type="button" class="dock-add" data-overview-add
          :aria-expanded="showAdd" :aria-label="wt('overviewAddCards')" aria-controls="overview-add-options"
          @click="showAdd = !showAdd">
          <PhPlus :size="18" weight="bold" aria-hidden="true" /><span>{{ wt('overviewAddCards') }}</span>
        </button>
        <div class="overview-editor__panels">
          <Transition name="dock-pop">
            <div v-show="showAdd" id="overview-add-options" class="dock-panel">
              <strong>{{ wt('overviewAddCards') }}</strong>
              <p v-if="!hiddenCards.length">{{ wt('overviewAddEmpty') }}</p>
              <button v-for="card in hiddenCards" :key="card.id" type="button" class="dock-option"
                :aria-label="wt('overviewAddCard', [wt(overviewCardTitles[card.id])])"
                @click="dismiss(); emit('add', card.id)">
                {{ wt(overviewCardTitles[card.id]) }}<PhPlus :size="16" aria-hidden="true" />
              </button>
              <footer>
                <p id="overview-edit-instructions">{{ wt('overviewLayoutHint') }}</p>
                <button type="button" class="dock-restore" @click="dismiss(); emit('restore')">
                  <PhArrowCounterClockwise :size="16" aria-hidden="true" />{{ wt('overviewRestoreLayout') }}
                </button>
              </footer>
            </div>
          </Transition>
          <p v-if="saveError" role="alert" class="dock-error">{{ wt('overviewSaveError') }}</p>
        </div>
        <span class="dock-divider" aria-hidden="true" />
        <button type="button" class="dock-cancel" :aria-label="wt('w108')" :title="wt('w108')" @click="emit('close')">
          <PhX :size="18" aria-hidden="true" />
        </button>
        <button type="button" class="dock-done" @click="emit('save')">
          <PhCheck :size="17" weight="bold" aria-hidden="true" />{{ wt('overviewSaveLayout') }}
        </button>
      </div>
    </section>
  </Teleport>
</template>

<style scoped>
.overview-editor {
  --dock-inset: var(--sidebar-width, 0px);
  --dock-bottom: max(20px, env(safe-area-inset-bottom));
  position: fixed;
  z-index: 35;
  inset-inline: var(--dock-inset) 0;
  bottom: var(--dock-bottom);
  width: max-content;
  max-width: calc(100% - var(--dock-inset) - 24px);
  margin-inline: auto;
  color: var(--text);
}
.overview-editor__bar::before, .dock-panel, .dock-error {
  border: 1px solid var(--menu-border);
  background: var(--surface-raised);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.12), 0 6px 24px rgb(0 0 0 / 0.15);
}
@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .overview-editor__bar::before, .dock-panel, .dock-error {
    background: color-mix(in srgb, var(--surface-raised) 74%, transparent);
    -webkit-backdrop-filter: blur(22px) saturate(140%);
    backdrop-filter: blur(22px) saturate(140%);
  }
}
.overview-editor__bar::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  z-index: -1;
  pointer-events: none;
}
.overview-editor__bar {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 5px;
  border-radius: 28px;
}
.overview-editor button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 44px;
  padding-inline: 14px;
  border: 0;
  border-radius: 22px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 590;
}
.overview-editor button:is(:hover, [aria-expanded="true"]) { background: var(--surface-hover); }
.overview-editor button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.dock-divider { width: 1px; height: 19px; background: var(--border-strong); }
.overview-editor .dock-cancel { width: 44px; padding: 0; color: var(--text-muted); }
.overview-editor .dock-done { background: var(--action-primary); color: white; }
.overview-editor .dock-done:hover { background: var(--action-primary-hover); }
.overview-editor__panels {
  position: absolute;
  inset-inline-start: 50%;
  bottom: calc(100% + 8px);
  width: min(19rem, calc(100vw - var(--dock-inset) - 24px));
  transform: translateX(-50%);
  display: grid;
  gap: 6px;
}
.dock-panel, .dock-error {
  padding: 14px;
  border-radius: 18px;
}
.dock-panel {
  max-height: calc(100dvh - var(--dock-bottom) - 80px);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.dock-panel strong { display: block; margin: 0 4px 6px; font-size: 0.95rem; }
.dock-panel p, .dock-error { margin: 0; color: var(--text-muted); font-size: 0.8rem; line-height: 1.5; }
.dock-panel p { padding-inline: 4px; }
.dock-panel .dock-option { width: 100%; justify-content: space-between; border-radius: 8px; padding-inline: 8px; }
.dock-panel footer { margin-top: 10px; border-top: 1px solid var(--hairline); padding-top: 10px; }
.dock-panel .dock-restore { color: var(--accent-strong); padding-inline: 6px; }
.dock-error { color: var(--danger); }
@media (max-width: 767px) {
  .overview-editor { --dock-inset: 0px; --dock-bottom: calc(78px + env(safe-area-inset-bottom)); }
}
@media (max-width: 350px) {
  .overview-editor button { padding-inline: 9px; }
}
@media (prefers-reduced-motion: no-preference) {
  .overview-editor { animation: dock-in 180ms var(--ease-standard); }
  .dock-pop-enter-active, .dock-pop-leave-active { transition: opacity 140ms ease, transform 140ms var(--ease-standard); }
  .dock-pop-enter-from, .dock-pop-leave-to { opacity: 0; transform: translateY(5px); }
  @keyframes dock-in { from { opacity: 0; transform: translateY(8px); } }
}
</style>
