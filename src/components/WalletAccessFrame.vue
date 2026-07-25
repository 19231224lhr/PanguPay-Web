<script setup lang="ts">
import BrandMark from './BrandMark.vue'
import PreferenceControls from './PreferenceControls.vue'
</script>

<template>
  <main class="wallet-access">
    <header>
      <RouterLink to="/" aria-label="PanguPay home"><BrandMark :size="32" />PanguPay</RouterLink>
      <PreferenceControls />
    </header>
    <section class="wallet-access__content"><slot /></section>
  </main>
</template>

<style scoped>
.wallet-access {
  min-height: 100dvh;
  padding: max(1.15rem, env(safe-area-inset-top)) clamp(1rem, 4vw, 4rem)
    max(1.15rem, env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at 74% 38%, var(--hero-halo), transparent 34rem), var(--background);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

header a {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 0.65rem;
  font-weight: 730;
  letter-spacing: -0.035em;
}

.wallet-access__content {
  display: grid;
  width: min(520px, 100%);
  min-height: calc(100dvh - 110px);
  align-content: center;
  margin-inline: auto;
  padding-block: 2rem;
}

:deep(.access-panel) {
  padding: clamp(1.3rem, 4vw, 2.2rem);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(24px);
}

:deep(.access-panel h1) {
  margin: 0;
  font-size: clamp(2.1rem, 6vw, 3.2rem);
  font-weight: 650;
  letter-spacing: -0.06em;
  line-height: 1;
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
</style>
