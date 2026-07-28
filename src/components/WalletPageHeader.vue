<script setup lang="ts">
withDefaults(
  defineProps<{
    description?: string
    eyebrow?: string
    title: string
    variant?: 'default' | 'compact'
  }>(),
  { description: undefined, eyebrow: undefined, variant: 'default' },
)
</script>

<template>
  <header class="wallet-page-header" :class="`wallet-page-header--${variant}`">
    <div>
      <p v-if="eyebrow" class="page-eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
    </div>
    <slot />
  </header>
</template>

<style scoped>
.wallet-page-header {
  display: flex;
  min-height: 78px;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem;
}

h1 {
  margin: 0;
  font-size: clamp(1.9rem, 3vw, 2.25rem);
  font-weight: 610;
  letter-spacing: -0.035em;
  line-height: 1.08;
}

.wallet-page-header--compact {
  min-height: 54px;
}

.wallet-page-header--compact h1 {
  font-size: clamp(1.75rem, 2.5vw, 2.05rem);
  font-weight: 570;
}

.page-eyebrow + h1 {
  margin-top: 0.72rem;
}

p:not(.page-eyebrow) {
  max-width: 620px;
  margin: 0.55rem 0 0;
  color: var(--text-muted);
  font-size: 0.9rem;
  line-height: 1.55;
}

@media (max-width: 599px) {
  .wallet-page-header {
    min-height: 64px;
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
