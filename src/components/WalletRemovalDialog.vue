<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { PhSignOut, PhWarningCircle } from '@phosphor-icons/vue'
import CurveMark from './CurveMark.vue'
import AppButton from './AppButton.vue'
import { wt } from '@/i18n/walletText'
const props = defineProps<{ open: boolean; busy?: boolean; error?: string }>()
const emit = defineEmits<{ close: []; confirm: [] }>()
const dialog = ref<HTMLDialogElement>()
let trigger: HTMLElement | undefined
watch(
  () => props.open,
  async (open) => {
    await nextTick()
    if (open && !dialog.value?.open) {
      trigger = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
      dialog.value?.showModal()
      dialog.value?.querySelector<HTMLButtonElement>('[data-testid="cancel-sign-out"]')?.focus()
    } else if (!open && dialog.value?.open) {
      dialog.value.close()
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  },
)
function close() {
  if (!props.busy) emit('close')
}
onBeforeUnmount(() => dialog.value?.close())
</script>
<template>
  <dialog
    ref="dialog"
    class="wallet-removal"
    aria-labelledby="wallet-removal-title"
    aria-describedby="wallet-removal-description"
    :aria-busy="busy || undefined"
    @cancel.prevent="close"
    @click="$event.target === dialog && close()"
  >
    <div class="wallet-removal__heading">
      <CurveMark v-if="open" motion="once" :size="40"
        ><PhSignOut :size="21" weight="duotone"
      /></CurveMark>
      <h2 id="wallet-removal-title">{{ wt('signOutTitle') }}</h2>
    </div>
    <p id="wallet-removal-description">{{ wt('signOutWarning') }}</p>
    <p class="wallet-removal__backup"><PhWarningCircle :size="18" />{{ wt('signOutBackup') }}</p>
    <p v-if="error" role="alert" class="wallet-removal__error">{{ error }}</p>
    <footer>
      <AppButton
        data-testid="cancel-sign-out"
        variant="secondary"
        :disabled="busy"
        @click="close"
        >{{ wt('w108') }}</AppButton
      >
      <AppButton
        data-testid="confirm-sign-out"
        variant="danger"
        :loading="busy"
        @click="emit('confirm')"
        >{{ wt('signOutConfirm') }}</AppButton
      >
    </footer>
  </dialog>
</template>
<style scoped>
.wallet-removal {
  width: min(440px, calc(100vw - 32px));
  box-sizing: border-box;
  max-height: calc(100dvh - 32px);
  overflow: auto;
  margin: auto;
  padding: 26px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 24px 80px #0006;
}
.wallet-removal::backdrop {
  background: #0008;
  backdrop-filter: blur(5px);
}
.wallet-removal[open] {
  animation: appear 170ms cubic-bezier(0.22, 1, 0.36, 1);
}
.wallet-removal__heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.wallet-removal h2 {
  font-size: 23px;
  line-height: 1.3;
  margin: 0;
  letter-spacing: -0.03em;
}
.wallet-removal p {
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.7;
}
.wallet-removal__backup {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.wallet-removal__backup svg {
  flex-shrink: 0;
  margin-top: 3px;
}
.wallet-removal .wallet-removal__error {
  color: var(--danger);
}
.wallet-removal footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}
@keyframes appear {
  from {
    opacity: 0;
    transform: translateY(5px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .wallet-removal[open] {
    animation: none;
  }
}
@media (max-width: 400px) {
  .wallet-removal {
    padding: 20px;
  }
  .wallet-removal footer {
    flex-wrap: wrap;
  }
}
</style>
