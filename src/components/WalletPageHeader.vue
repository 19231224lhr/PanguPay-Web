<script setup lang="ts">
defineProps<{ eyebrow?: string; title: string; description?: string }>()
</script>

<template>
  <header class="wallet-page-header">
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
  min-height: 96px;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem;
}

h1 {
  margin: 0;
  font-size: clamp(2.1rem, 4.8vw, 3.6rem);
  font-weight: 650;
  letter-spacing: -0.06em;
  line-height: 1;
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
    min-height: 76px;
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
