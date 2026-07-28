<script setup lang="ts">
import { useRouter } from 'vue-router'

import { navigateWithSpatialTransition } from '@/composables/useSpatialNavigation'

import BrandMark from './BrandMark.vue'
import ValueFoldField from './ValueFoldField.vue'

withDefaults(
  defineProps<{
    quietScroll?: boolean
    fieldActive?: boolean
  }>(),
  {
    quietScroll: true,
    fieldActive: false,
  },
)

const router = useRouter()

async function returnHome(): Promise<void> {
  await navigateWithSpatialTransition(router, '/', 'access')
}
</script>

<template>
  <main class="wallet-access">
    <header class="wallet-access__header">
      <RouterLink to="/" aria-label="PanguPay home" @click.prevent="returnHome">
        <BrandMark :size="32" transition-name="pangu-mobile-brand" />PanguPay
      </RouterLink>
    </header>
    <section class="wallet-access__stage">
      <aside class="wallet-access__visual" aria-label="PanguPay">
        <ValueFoldField
          :intro="false"
          :active="fieldActive"
          label="PanguPay 价值折叠场"
          transition-name="pangu-value-fold"
        />
        <div class="wallet-access__statement">
          <BrandMark :size="34" />
          <p>PanguPay</p>
          <strong>
            <span>计算，为了无法计算的</span>
            <span>价值。</span>
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
  grid-template-rows: auto minmax(0, 1fr);
  padding: max(1rem, env(safe-area-inset-top)) clamp(1rem, 3vw, 3rem)
    max(1.15rem, env(safe-area-inset-bottom));
  background: var(--background);
}

.wallet-access__header {
  display: flex;
  position: relative;
  z-index: 2;
  align-items: center;
  justify-content: space-between;
}

.wallet-access__header a {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 0.65rem;
  font-weight: 730;
  letter-spacing: -0.035em;
}

.wallet-access__stage {
  display: grid;
  width: min(1380px, 100%);
  min-height: 0;
  height: 100%;
  grid-template-columns: minmax(0, 7fr) minmax(380px, 5fr);
  gap: clamp(2rem, 5vw, 6rem);
  margin-inline: auto;
}

.wallet-access__visual {
  position: relative;
  display: grid;
  min-height: 0;
  align-items: center;
  overflow: hidden;
}

.wallet-access__visual :deep(.value-fold-field) {
  width: min(720px, 92%, calc(100dvh - 7.5rem));
  max-height: 100%;
  margin-inline: auto;
  opacity: 0.76;
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
  display: grid;
  width: min(420px, 100%);
  align-content: start;
  justify-self: center;
  min-height: 0;
  max-height: 100%;
  overflow-y: auto;
  padding-block: clamp(2.5rem, 6vh, 4rem) 2rem;
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
  padding: 0;
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
    display: none;
  }

  .wallet-access__form {
    width: min(420px, 100%);
    height: 100%;
    min-height: 0;
  }
}

@media (max-height: 700px) and (min-width: 901px) {
  .wallet-access__statement {
    display: none;
  }

  .wallet-access__visual :deep(.value-fold-field) {
    width: min(610px, 88%, calc(100dvh - 5.5rem));
  }
}

@media (max-width: 480px) {
  .wallet-access {
    padding-inline: 1.1rem;
  }

  .wallet-access__header > a {
    font-size: 0;
  }

  .wallet-access__form {
    width: 100%;
    align-content: start;
    padding-top: clamp(4rem, 12vh, 7rem);
  }

  :deep(.access-panel h1) {
    font-size: 2.55rem;
  }
}
</style>
