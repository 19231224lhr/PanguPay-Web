<script setup lang="ts">
import {
  PhArrowRight as ArrowRight,
  PhCheckCircle as CheckCircle,
  PhShieldCheck as ShieldCheck,
} from '@phosphor-icons/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import AppButton from '@/components/AppButton.vue'
import BrandMark from '@/components/BrandMark.vue'
import PreferenceControls from '@/components/PreferenceControls.vue'

const { t } = useI18n()
const stage = ref<HTMLElement | null>(null)

function handlePointerMove(event: PointerEvent): void {
  if (!stage.value || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const bounds = stage.value.getBoundingClientRect()
  const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 24
  const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 24
  stage.value.style.setProperty('--pointer-x', `${Math.max(-12, Math.min(12, x))}px`)
  stage.value.style.setProperty('--pointer-y', `${Math.max(-12, Math.min(12, y))}px`)
}

function resetPointer(): void {
  stage.value?.style.setProperty('--pointer-x', '0px')
  stage.value?.style.setProperty('--pointer-y', '0px')
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
      <div class="landing__copy">
        <p class="page-eyebrow">{{ t('landing.eyebrow') }}</p>
        <h1>
          <span>{{ t('landing.titleLead') }}</span>
          <span class="landing__accent">
            <span>{{ t('landing.titleAccentLineOne') }}</span>
            <span>{{ t('landing.titleAccentLineTwo') }}</span>
          </span>
        </h1>
        <p class="landing__description">{{ t('landing.description') }}</p>

        <div class="landing__actions">
          <AppButton to="/__ledger-preview" size="large">
            {{ t('landing.enter') }}
            <template #icon><ArrowRight :size="18" weight="bold" /></template>
          </AppButton>
          <AppButton to="/__ledger-preview?intent=create" size="large" variant="secondary">
            {{ t('landing.create') }}
          </AppButton>
          <AppButton to="/__ledger-preview?intent=import" size="large" variant="ghost">
            {{ t('landing.import') }}
          </AppButton>
        </div>

        <p class="landing__assurance">
          <ShieldCheck :size="18" weight="regular" aria-hidden="true" />
          {{ t('landing.assurance') }}
        </p>
      </div>

      <div
        ref="stage"
        class="orbit-stage"
        :aria-label="t('landing.orbitLabel')"
        @pointermove="handlePointerMove"
        @pointerleave="resetPointer"
      >
        <div class="orbit-stage__halo" aria-hidden="true" />
        <div class="orbit-stage__system">
          <div class="orbit orbit--outer" data-orbit aria-hidden="true"><span /></div>
          <div class="orbit orbit--middle" data-orbit aria-hidden="true"><span /></div>
          <div class="orbit orbit--inner" data-orbit aria-hidden="true"><span /></div>
          <div class="orbit orbit--core-ring" data-orbit aria-hidden="true"><span /></div>

          <div class="orbit-stage__core">
            <span class="orbit-stage__core-halo" aria-hidden="true" />
            <BrandMark :size="64" />
            <small>{{ t('landing.protocol') }}</small>
          </div>

          <div class="protocol-chip protocol-chip--one">
            <CheckCircle :size="16" weight="fill" aria-hidden="true" />
            <span>Wallet signed</span>
          </div>
          <div class="protocol-chip protocol-chip--two">
            <span class="protocol-chip__pulse" aria-hidden="true" />
            <span>TXCer spend-ready</span>
          </div>
          <div class="protocol-chip protocol-chip--three">
            <CheckCircle :size="16" weight="fill" aria-hidden="true" />
            <span>FastEvidence verified</span>
          </div>
          <div class="protocol-chip protocol-chip--four">
            <span class="protocol-chip__pulse" aria-hidden="true" />
            <span>3-of-4 BlockQC</span>
          </div>
        </div>
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
  display: grid;
  min-height: 0;
  align-items: center;
  grid-template-columns: minmax(340px, 0.88fr) minmax(460px, 1.12fr);
  gap: clamp(2rem, 5vw, 6rem);
}

.landing__copy {
  z-index: 2;
  max-width: 660px;
  padding-block: 2rem;
  animation: page-enter var(--duration-enter) var(--ease-standard) both;
}

h1 {
  display: grid;
  margin: 1rem 0 1.25rem;
  font-size: clamp(3.4rem, 6.8vw, 7.4rem);
  font-weight: 670;
  letter-spacing: -0.075em;
  line-height: 0.91;
}

.landing__accent {
  display: grid;
  color: var(--accent);
}

.landing__description {
  max-width: 560px;
  margin: 0;
  color: var(--text-muted);
  font-size: clamp(1rem, 1.45vw, 1.24rem);
  letter-spacing: -0.022em;
  line-height: 1.62;
}

.landing__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 2rem;
}

.landing__assurance {
  display: flex;
  max-width: 520px;
  align-items: flex-start;
  gap: 0.55rem;
  margin: 1.5rem 0 0;
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1.55;
}

.landing__assurance svg {
  flex: none;
  margin-top: 0.1rem;
  color: var(--success);
}

.orbit-stage {
  --pointer-x: 0px;
  --pointer-y: 0px;
  position: relative;
  width: min(48vw, 700px);
  max-width: 100%;
  aspect-ratio: 1;
  justify-self: center;
  touch-action: pan-y;
}

.orbit-stage__system {
  position: absolute;
  inset: 4%;
  transform: translate(var(--pointer-x), var(--pointer-y));
  transition: transform 520ms var(--ease-standard);
}

.orbit-stage__halo {
  position: absolute;
  inset: 23%;
  border-radius: 50%;
  background: var(--hero-halo);
  filter: blur(54px);
}

.orbit {
  position: absolute;
  border: 1px solid var(--orbit);
  border-radius: 50%;
  animation: orbit-clockwise 32s linear infinite;
}

.orbit span {
  position: absolute;
  top: 50%;
  right: -5px;
  width: 10px;
  height: 10px;
  border: 2px solid var(--background);
  border-radius: 50%;
  background: var(--accent);
  box-shadow:
    0 0 0 1px var(--accent),
    0 0 24px var(--hero-halo);
}

.orbit--outer {
  inset: 3%;
}

.orbit--middle {
  inset: 14%;
  animation: orbit-counterclockwise 28s linear infinite;
}

.orbit--inner {
  inset: 25%;
  animation-duration: 25s;
}

.orbit--core-ring {
  inset: 35%;
  animation: orbit-counterclockwise 24s linear infinite;
}

.orbit-stage__core {
  position: absolute;
  inset: 38%;
  display: grid;
  border: 1px solid var(--border-strong);
  border-radius: 50%;
  background: var(--overlay);
  box-shadow: var(--shadow-soft);
  place-items: center;
}

.orbit-stage__core :deep(.brand-mark) {
  color: var(--text);
}

.orbit-stage__core small {
  position: absolute;
  top: calc(100% + 1rem);
  width: 180px;
  color: var(--text-muted);
  font-size: 0.68rem;
  font-weight: 620;
  letter-spacing: 0.08em;
  text-align: center;
  text-transform: uppercase;
}

.orbit-stage__core-halo {
  position: absolute;
  inset: -18%;
  z-index: -1;
  border-radius: 50%;
  background: var(--hero-halo);
  filter: blur(24px);
}

.protocol-chip {
  position: absolute;
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 0.48rem;
  padding: 0.55rem 0.78rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--overlay);
  box-shadow: 0 12px 40px rgb(0 0 0 / 0.08);
  color: var(--text-muted);
  font-size: 0.7rem;
  font-weight: 650;
  white-space: nowrap;
  backdrop-filter: blur(18px);
}

.protocol-chip svg {
  color: var(--success);
}

.protocol-chip__pulse {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  animation: status-breathe 2.4s ease-in-out infinite;
}

.protocol-chip--one {
  top: 9%;
  left: 9%;
}

.protocol-chip--two {
  top: 23%;
  right: -1%;
}

.protocol-chip--three {
  bottom: 15%;
  left: -2%;
}

.protocol-chip--four {
  right: 5%;
  bottom: 4%;
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

  .landing__copy {
    padding-top: clamp(3rem, 10vh, 6rem);
  }

  h1 {
    font-size: clamp(3.4rem, 12vw, 6.4rem);
  }

  .orbit-stage {
    width: min(82vw, 640px);
    margin: -1rem auto 2rem;
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
    font-size: clamp(3rem, 16vw, 4.6rem);
  }

  .landing__actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .landing__actions :deep(.app-button:first-child) {
    grid-column: 1 / -1;
  }

  .orbit-stage {
    width: min(96vw, 500px);
    margin-inline: -0.5rem;
  }

  .protocol-chip {
    min-height: 34px;
    padding: 0.4rem 0.58rem;
    font-size: 0.58rem;
  }

  .landing__footer {
    justify-content: center;
  }
}
</style>
