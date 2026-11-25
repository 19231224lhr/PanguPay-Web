<script setup lang="ts">
import { wt } from '@/i18n/walletText'

import BrandMark from './BrandMark.vue'
import { inject, watch } from 'vue'
import { entryFigureKey } from '@/composables/useEntryFigure'
import type { EntryShape } from '@/graphics/entryParticles'

const props = withDefaults(
  defineProps<{
    compact?: boolean
    figure?: EntryShape
    quietScroll?: boolean
    fieldActive?: boolean
  }>(),
  {
    quietScroll: true,
    fieldActive: false,
  },
)

const sharedFigure = inject(entryFigureKey, undefined)
watch(
  () => props.figure,
  (value) => {
    if (sharedFigure) sharedFigure.value = value
  },
  { immediate: true },
)
</script>

<template>
  <main class="wallet-access" :class="{ 'wallet-access--compact': compact }">
    <section class="wallet-access__stage">
      <aside class="wallet-access__visual" aria-label="PanguPay">
        <div class="entry-figure-anchor" data-entry-figure-anchor aria-hidden="true" />
        <div class="wallet-access__statement">
          <BrandMark :size="34" />
          <p>PanguPay</p>
          <strong>
            <span> {{ wt('w352') }} </span>
            <span> {{ wt('w353') }} </span>
          </strong>
        </div>
      </aside>
      <div
        class="wallet-access__form"
        :class="{ 'wallet-access__form--quiet-scroll': quietScroll }"
      >
        <slot />
      </div>
    </section>
  </main>
</template>

<style scoped>
.wallet-access {
  display: grid;
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
  box-sizing: border-box;
  grid-template-rows: minmax(0, 1fr);
  padding: calc(var(--entry-top, 1rem) + var(--entry-header-height, 44px))
    var(--entry-gutter, 1.125rem)
    max(1.15rem, env(safe-area-inset-bottom));
  background: transparent;
}

.wallet-access__stage {
  display: grid;
  width: min(var(--entry-content-width, 1380px), 100%);
  min-height: 0;
  height: 100%;
  grid-template-columns: minmax(380px, 5fr) minmax(0, 7fr);
  gap: clamp(2rem, 5vw, 6rem);
  margin-inline: auto;
}

.wallet-access__visual {
  grid-column: 2;
  grid-row: 1;
  position: relative;
  display: grid;
  min-height: 0;
  align-items: center;
  overflow: hidden;
}

.wallet-access__visual .entry-figure-anchor {
  width: min(720px, 92%, calc(100dvh - 7.5rem));
  max-height: 100%;
  margin-inline: auto;
  aspect-ratio: 1;
}

.wallet-access__statement {
  position: absolute;
  bottom: clamp(2rem, 7vh, 5rem);
  left: clamp(1rem, 3vw, 3rem);
  display: grid;
  max-width: 520px;
  gap: 0.55rem;
}

.wallet-access__statement > p {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 650;
}

.wallet-access__statement > strong {
  display: grid;
  font-size: clamp(1.55rem, 2.5vw, 2.35rem);
  font-weight: 560;
  letter-spacing: -0.035em;
  line-height: 1.15;
}

.wallet-access__form {
  grid-column: 1;
  grid-row: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  width: min(420px, 100%);
  align-content: start;
  justify-self: center;
  min-height: 0;
  max-height: 100%;
  overflow-y: auto;
  padding-block: clamp(64px, 10vh, 96px) 2rem;
  scrollbar-gutter: stable;
}

.wallet-access__form--quiet-scroll {
  scrollbar-width: none;
  scrollbar-gutter: auto;
}

.wallet-access__form--quiet-scroll::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

:deep(.access-panel) {
  width: 100%;
  min-width: 0;
  padding: 0;
}

:deep(.app-button__rest) {
  max-inline-size: 100%;
}

:deep(.app-button__content) {
  white-space: normal;
  line-height: 1.25;
}

:deep(.app-button__rest > svg) {
  flex: none;
}

:deep(.access-panel h1) {
  margin: 0;
  font-size: clamp(2.5rem, 5vw, 3rem);
  font-weight: 590;
  letter-spacing: -0.04em;
  line-height: 1.04;
}

:deep(.access-panel > p) {
  margin: 0.7rem 0 1.5rem;
  color: var(--text-muted);
  line-height: 1.55;
}

:deep(.access-form) {
  display: grid;
  gap: 1rem;
}

@media (max-width: 900px) {
  .wallet-access__stage {
    grid-template-columns: 1fr;
  }

  .wallet-access__visual {
    grid-column: 2;
    grid-row: 1;
    display: none;
  }

  .wallet-access__form {
    grid-column: 1;
    grid-row: 1;
    width: min(420px, 100%);
    height: 100%;
    min-height: 0;
  }
}

@media (max-height: 700px) and (min-width: 901px) {
  .wallet-access__statement {
    display: none;
  }

  .wallet-access__visual .entry-figure-anchor {
    width: min(610px, 88%, calc(100dvh - 5.5rem));
  }
}

@media (max-width: 480px) {
  .wallet-access__form {
    grid-column: 1;
    grid-row: 1;
    width: 100%;
    align-content: start;
    padding-top: clamp(4rem, 12vh, 7rem);
  }

  :deep(.access-panel h1) {
    font-size: 2.55rem;
  }
}

.wallet-access--compact .wallet-access__statement {
  display: none;
}

.wallet-access--compact .wallet-access__form {
  width: min(460px, 100%);
  align-content: start;
  padding-block: clamp(4.5rem, 16vh, 10rem) 1.5rem;
}

@media (min-width: 901px) {
  .wallet-access--compact .wallet-access__form { justify-self: start; }
}
.wallet-access--compact :deep(.access-panel h1) {
  font-size: clamp(28px, 2.6vw, 36px);
  line-height: 1.15;
  font-weight: 630;
}
.wallet-access--compact :deep(.access-panel > p) {
  font-size: 14px;
  line-height: 1.6;
  margin: 10px 0 24px;
}
.wallet-access--compact :deep(.access-form) {
  gap: 14px;
}
.wallet-access--compact :deep(.form-field__control) {
  min-height: 46px;
}
.wallet-access--compact :deep(.app-button--large) {
  min-height: 46px;
  padding-block: 12px;
}
@media (max-width: 480px), (max-height: 650px) {
  .wallet-access--compact .wallet-access__form {
    align-content: start;
    padding-block: clamp(2.75rem, 8vh, 4.5rem) 1.25rem;
  }
}
</style>
