<script setup lang="ts">
import {
  PhArrowLeft as ArrowLeft,
  PhArrowRight as ArrowRight,
  PhCheck as Check,
  PhCopy as Copy,
  PhPlus as Plus,
} from '@phosphor-icons/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import AmountField from '@/components/AmountField.vue'
import AppButton from '@/components/AppButton.vue'
import BrandMark from '@/components/BrandMark.vue'
import IconButton from '@/components/IconButton.vue'
import PreferenceControls from '@/components/PreferenceControls.vue'
import ProgressTimeline from '@/components/ProgressTimeline.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import StatusLabel from '@/components/StatusLabel.vue'
import { usePreferences, type ThemePreference } from '@/composables/usePreferences'

const { t } = useI18n()
const preferences = usePreferences()
const recipient = ref('')
const amount = ref('12.00000000')
const themeModel = ref<ThemePreference>(preferences.themePreference.value)

watch(themeModel, (value) => preferences.setTheme(value))
watch(preferences.themePreference, (value) => (themeModel.value = value))

const themeOptions = computed(() => [
  { label: t('common.system'), value: 'system' },
  { label: t('common.light'), value: 'light' },
  { label: t('common.dark'), value: 'dark' },
])

const timeline = computed(() => [
  { label: 'TXCer spend-ready', detail: t('foundation.normal'), state: 'complete' as const },
  { label: 'FastEvidence', detail: 'Verified', state: 'complete' as const },
  { label: 'CFAA audit', detail: t('foundation.warning'), state: 'active' as const },
  { label: '3-of-4 BlockQC', detail: 'Queued', state: 'pending' as const },
])
</script>

<template>
  <main class="foundation">
    <header class="foundation__header">
      <RouterLink to="/" class="foundation__brand">
        <BrandMark :size="30" />
        <span>PanguPay</span>
      </RouterLink>
      <PreferenceControls />
    </header>

    <div class="foundation__intro">
      <p class="page-eyebrow">{{ t('foundation.eyebrow') }}</p>
      <h1>{{ t('foundation.title') }}</h1>
      <p>{{ t('foundation.description') }}</p>
    </div>

    <section class="foundation-section" aria-labelledby="actions-title">
      <header>
        <span>01</span>
        <h2 id="actions-title">{{ t('foundation.actions') }}</h2>
      </header>
      <div class="foundation-section__content foundation-section__content--wrap">
        <AppButton>
          {{ t('foundation.primary') }}
          <template #icon><ArrowRight :size="17" weight="bold" /></template>
        </AppButton>
        <AppButton variant="secondary">{{ t('foundation.secondary') }}</AppButton>
        <AppButton variant="ghost">Ghost</AppButton>
        <AppButton loading>{{ t('foundation.loading') }}</AppButton>
        <IconButton label="Add"><Plus :size="20" /></IconButton>
        <IconButton label="Copy"><Copy :size="20" /></IconButton>
      </div>
    </section>

    <section class="foundation-section" aria-labelledby="fields-title">
      <header>
        <span>02</span>
        <h2 id="fields-title">{{ t('foundation.fields') }}</h2>
      </header>
      <div class="foundation-section__content foundation-section__content--fields">
        <div class="foundation__field-stack">
          <label class="foundation__standalone-label">Theme</label>
          <SegmentedControl v-model="themeModel" label="Theme" :options="themeOptions" />
        </div>
        <div class="foundation__field-stack">
          <label for="recipient-demo" class="foundation__standalone-label">{{
            t('foundation.recipient')
          }}</label>
          <input
            id="recipient-demo"
            v-model="recipient"
            :placeholder="t('foundation.recipientHelp')"
          />
        </div>
        <AmountField
          id="amount-demo"
          v-model="amount"
          :label="t('foundation.amount')"
          :error="amount === '0' ? t('foundation.invalid') : ''"
        />
      </div>
    </section>

    <section class="foundation-section" aria-labelledby="status-title">
      <header>
        <span>03</span>
        <h2 id="status-title">{{ t('foundation.status') }}</h2>
      </header>
      <div class="foundation-section__content foundation-section__content--status">
        <div class="foundation__labels">
          <StatusLabel tone="success">{{ t('foundation.normal') }}</StatusLabel>
          <StatusLabel tone="warning">{{ t('foundation.warning') }}</StatusLabel>
          <StatusLabel tone="danger">{{ t('foundation.danger') }}</StatusLabel>
          <StatusLabel tone="accent"><Check :size="13" />Verified</StatusLabel>
        </div>
        <ProgressTimeline :items="timeline" />
      </div>
    </section>

    <footer class="foundation__footer">
      <AppButton to="/" variant="ghost">
        <ArrowLeft :size="17" weight="bold" />
        {{ t('foundation.back') }}
      </AppButton>
      <AppButton to="/__ledger-preview" variant="secondary">{{ t('foundation.shell') }}</AppButton>
    </footer>
  </main>
</template>

<style scoped>
.foundation {
  width: min(1120px, calc(100% - 2rem));
  min-height: 100dvh;
  margin-inline: auto;
  padding: max(1rem, env(safe-area-inset-top)) 0 max(2rem, env(safe-area-inset-bottom));
  animation: page-enter var(--duration-enter) var(--ease-standard) both;
}

.foundation__header,
.foundation__brand,
.foundation__footer {
  display: flex;
  align-items: center;
}

.foundation__header {
  justify-content: space-between;
}

.foundation__brand {
  min-height: 44px;
  gap: 0.6rem;
  font-weight: 720;
  letter-spacing: -0.035em;
}

.foundation__intro {
  max-width: 720px;
  padding: clamp(4rem, 10vw, 8rem) 0 clamp(2.5rem, 6vw, 5rem);
}

.foundation__intro h1 {
  margin: 0.8rem 0 1rem;
  font-size: clamp(3rem, 7vw, 6.6rem);
  font-weight: 650;
  letter-spacing: -0.075em;
  line-height: 0.95;
}

.foundation__intro > p:last-child {
  max-width: 620px;
  margin: 0;
  color: var(--text-muted);
  font-size: 1rem;
  line-height: 1.65;
}

.foundation-section {
  display: grid;
  grid-template-columns: minmax(180px, 0.42fr) minmax(0, 1fr);
  gap: 2rem;
  padding: 2.25rem 0;
  border-top: 1px solid var(--border-strong);
}

.foundation-section > header {
  display: grid;
  align-content: start;
  gap: 0.65rem;
}

.foundation-section > header span {
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 0.7rem;
}

.foundation-section h2 {
  margin: 0;
  font-size: 1.12rem;
  letter-spacing: -0.035em;
}

.foundation-section__content {
  min-width: 0;
}

.foundation-section__content--wrap,
.foundation__labels {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
}

.foundation-section__content--fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.foundation-section__content--fields > :last-child {
  grid-column: 1 / -1;
}

.foundation__field-stack {
  display: grid;
  align-content: start;
  gap: 0.48rem;
}

.foundation__standalone-label {
  font-size: 0.84rem;
  font-weight: 650;
}

.foundation__field-stack input {
  min-height: 48px;
  padding: 0 0.82rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  outline: 0;
  background: var(--surface-raised);
}

.foundation__field-stack input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--focus);
}

.foundation-section__content--status {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.foundation__labels {
  align-content: start;
}

.foundation__footer {
  justify-content: space-between;
  padding-top: 2rem;
  border-top: 1px solid var(--border-strong);
}

@media (max-width: 767px) {
  .foundation-section {
    grid-template-columns: 1fr;
    gap: 1.2rem;
  }

  .foundation-section__content--fields,
  .foundation-section__content--status {
    grid-template-columns: 1fr;
  }

  .foundation-section__content--fields > :last-child {
    grid-column: auto;
  }
}
</style>
