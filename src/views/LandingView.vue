<script setup lang="ts">
import { PhArrowRight as ArrowRight } from '@phosphor-icons/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import BrandMark from '@/components/BrandMark.vue'
import PreferenceControls from '@/components/PreferenceControls.vue'
import ValueFoldField from '@/components/ValueFoldField.vue'
import { useWalletStore } from '@/stores/wallet'
import { resolveWalletEntry } from '@/wallet/navigation'

const { t } = useI18n()
const router = useRouter()
const wallet = useWalletStore()
const walletEntryActive = ref(false)
const entering = ref(false)

async function enterWallet(): Promise<void> {
  if (entering.value) return
  entering.value = true
  walletEntryActive.value = true
  await wallet.initialize()
  const destination = resolveWalletEntry(wallet.lifecycle)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!reduced) await new Promise((resolve) => setTimeout(resolve, 110))
  const transitionDocument = document as Document & {
    startViewTransition?: (callback: () => Promise<unknown>) => { finished: Promise<void> }
  }
  if (!reduced && transitionDocument.startViewTransition) {
    await transitionDocument.startViewTransition(() => router.push(destination)).finished
  } else {
    await router.push(destination)
  }
  walletEntryActive.value = false
  entering.value = false
}
</script>

<template>
  <main class="landing">
    <header class="landing__header">
      <RouterLink to="/" class="landing__brand" aria-label="PanguPay home">
        <BrandMark :size="34" />
        <span>PanguPay</span>
      </RouterLink>
      <PreferenceControls />
    </header>

    <section class="landing__hero">
      <svg
        class="landing__signal-bridge"
        :class="{ 'is-active': walletEntryActive }"
        viewBox="0 0 1200 620"
        preserveAspectRatio="none"
        aria-hidden="true"
        data-signal-bridge
        :data-active="String(walletEntryActive)"
      >
        <path d="M 255 430 C 440 430 575 310 875 310" pathLength="100" />
      </svg>

      <div class="landing__copy">
        <h1>
          <span class="landing__lead-line" data-hero-line>{{ t('landing.titleLead') }}</span>
          <span class="landing__accent">
            <span class="landing__long-line" data-hero-line>
              {{ t('landing.titleAccentLineOne') }}
            </span>
            <span class="landing__value-line" data-hero-line>
              {{ t('landing.titleAccentLineTwo') }}
            </span>
          </span>
        </h1>

        <div
          class="landing__actions"
          @pointerenter="walletEntryActive = true"
          @pointerleave="walletEntryActive = false"
          @focusin="walletEntryActive = true"
          @focusout="walletEntryActive = false"
        >
          <AppButton size="large" :loading="entering" @click="enterWallet">
            {{ t('landing.enter') }}
            <template #icon><ArrowRight :size="18" weight="bold" /></template>
          </AppButton>
        </div>
      </div>

      <div class="value-fold-field-stage">
        <ValueFoldField :active="walletEntryActive" :label="t('landing.orbitLabel')" />
      </div>
    </section>

    <footer class="landing__footer">
      <span>TXCer</span>
      <i aria-hidden="true" />
      <span>FastEvidence</span>
      <i aria-hidden="true" />
      <span>GQNC</span>
    </footer>
  </main>
</template>

<style scoped>
.landing {
  position: relative;
  display: grid;
  min-height: 100dvh;
  overflow: hidden;
  grid-template-rows: auto minmax(0, 1fr) auto;
  padding: max(1.15rem, env(safe-area-inset-top)) clamp(1rem, 4vw, 4rem)
    max(1.1rem, env(safe-area-inset-bottom));
  isolation: isolate;
}

.landing::before {
  position: absolute;
  z-index: -2;
  top: -20%;
  right: -10%;
  width: 68vw;
  height: 68vw;
  border-radius: 50%;
  background: radial-gradient(circle, var(--hero-halo), transparent 66%);
  content: '';
  filter: blur(18px);
  pointer-events: none;
}

.landing__header {
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.landing__brand {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 0.68rem;
  font-size: 1rem;
  font-weight: 730;
  letter-spacing: -0.04em;
}

.landing__hero {
  position: relative;
  display: grid;
  min-height: 0;
  align-items: center;
  grid-template-columns: minmax(340px, 0.88fr) minmax(460px, 1.12fr);
  gap: clamp(2rem, 5vw, 6rem);
}

.landing__signal-bridge {
  position: absolute;
  z-index: 0;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.landing__signal-bridge path {
  fill: none;
  stroke: var(--accent);
  stroke-dasharray: 14 86;
  stroke-dashoffset: 100;
  stroke-linecap: round;
  stroke-width: 0.75;
  opacity: 0;
  filter: blur(1px) drop-shadow(0 0 8px color-mix(in srgb, var(--accent) 28%, transparent));
  vector-effect: non-scaling-stroke;
}

.landing__signal-bridge.is-active path {
  animation: landing-signal-converge 820ms var(--ease-standard) both;
}

.landing__copy {
  z-index: 2;
  max-width: 700px;
  padding-block: 3rem;
  animation: page-enter var(--duration-enter) var(--ease-standard) both;
}

h1 {
  display: grid;
  margin: 0;
  font-size: clamp(4rem, 7.4vw, 7rem);
  font-weight: 670;
  letter-spacing: -0.04em;
  line-height: 0.96;
  row-gap: clamp(0.45rem, 0.8vw, 0.75rem);
}

.landing__accent {
  display: grid;
  color: var(--accent);
  row-gap: clamp(0.2rem, 0.4vw, 0.4rem);
}

.landing__lead-line {
  font-size: 0.84em;
  letter-spacing: -0.035em;
  line-height: 1;
}

.landing__long-line {
  font-size: 0.68em;
  letter-spacing: -0.03em;
  line-height: 1.02;
}

.landing__value-line {
  line-height: 0.94;
}

.landing__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: clamp(2.25rem, 4.4vh, 3.5rem);
}

.landing__actions :deep(.app-button) {
  min-width: 176px;
  min-height: 56px;
  justify-content: space-between;
  padding-right: 1.1rem;
  padding-left: 1.4rem;
  border: 0;
  background: var(--action-frosted);
  box-shadow: var(--action-frosted-shadow);
  color: var(--text);
  backdrop-filter: blur(22px) saturate(150%);
  transition:
    background var(--duration-state) var(--ease-standard),
    border-color var(--duration-state) var(--ease-standard),
    box-shadow var(--duration-state) var(--ease-standard),
    transform var(--duration-press) var(--ease-press);
  -webkit-backdrop-filter: blur(22px) saturate(150%);
}

.landing__actions :deep(.app-button:hover) {
  background: var(--action-frosted-hover);
}

.landing__actions :deep(.app-button svg) {
  color: var(--accent);
  transition: transform var(--duration-state) var(--ease-standard);
}

.landing__actions:hover :deep(.app-button svg),
.landing__actions:focus-within :deep(.app-button svg) {
  transform: translateX(4px);
}

.value-fold-field-stage {
  position: relative;
  z-index: 1;
  width: min(38vw, 540px);
  max-width: 100%;
  aspect-ratio: 1;
  justify-self: center;
  touch-action: pan-y;
  transform: translateX(clamp(1.5rem, 2.4vw, 2.2rem));
}

@keyframes landing-signal-converge {
  0% {
    stroke-dashoffset: 100;
    opacity: 0;
  }

  18% {
    opacity: 0.1;
  }

  82% {
    opacity: 0.1;
  }

  100% {
    stroke-dashoffset: 0;
    opacity: 0;
  }
}

.landing__footer {
  display: flex;
  min-height: 32px;
  align-items: center;
  gap: 0.65rem;
  color: var(--text-faint);
  font-size: 0.68rem;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.landing__footer i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--accent);
}

@media (max-width: 1023px) {
  .landing {
    min-height: 100dvh;
    overflow-y: auto;
  }

  .landing__hero {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .landing__signal-bridge {
    display: none;
  }

  .landing__copy {
    padding-top: clamp(3rem, 10vh, 6rem);
  }

  h1 {
    font-size: clamp(4rem, 14.2vw, 7rem);
  }

  .value-fold-field-stage {
    width: min(82vw, 540px);
    margin: 0 auto 2rem;
    justify-self: center;
    transform: none;
  }
}

@media (max-width: 599px) {
  .landing {
    padding-inline: 1rem;
  }

  .landing__copy {
    padding-top: 3rem;
  }

  h1 {
    font-size: clamp(3.6rem, 18vw, 5.5rem);
  }

  .landing__actions {
    display: flex;
  }

  .value-fold-field-stage {
    width: min(94vw, 500px);
    margin: 1rem -0.5rem 1.5rem;
  }

  .landing__footer {
    justify-content: center;
  }
}

@media (max-width: 420px) {
  .landing__actions {
    display: block;
  }

  .landing__actions :deep(.app-button) {
    width: 100%;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .landing__actions :deep(.app-button) {
    background: var(--surface-raised);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .landing__signal-bridge,
  .landing__actions :deep(.app-button svg) {
    animation: none;
    transition: none;
  }
}
</style>
