<script setup lang="ts">
import { PhCaretDown, PhMagnifyingGlass } from '@phosphor-icons/vue'
import { computed, inject, onBeforeUnmount, ref, useId, watch } from 'vue'

import FormField from '@/components/FormField.vue'
import OrganizationInlineDetail from '@/components/OrganizationInlineDetail.vue'
import {
  createWalletNetwork,
  organizationRefreshInterval,
  walletNetworkKey,
} from '@/composables/useWalletNetwork'
import { organizationLabel, wt } from '@/i18n/walletText'
import type { WalletEntryOrganization } from '@/wallet/entryService'

const props = defineProps<{ organizations: WalletEntryOrganization[]; disabled?: boolean }>()
const selected = defineModel<string>({ required: true })
const search = ref('')
const expanded = ref('')
const id = useId()
const sharedNetwork = inject(walletNetworkKey, undefined)
const network = sharedNetwork ?? createWalletNetwork()
onBeforeUnmount(() => {
  if (!sharedNetwork) network.dispose()
})

const matches = computed(() => {
  const needle = search.value.trim().toLowerCase()
  return props.organizations.filter((item) => item.id.toLowerCase().includes(needle))
})
const detailQuery = computed(() => {
  const item = matches.value.find((candidate) => candidate.id === expanded.value)
  return item && network.organization(item)
})

watch(matches, (items) => {
  if (!items.some((item) => item.id === selected.value)) selected.value = ''
  if (!items.some((item) => item.id === expanded.value)) expanded.value = ''
})

function toggle(item: WalletEntryOrganization): void {
  expanded.value = expanded.value === item.id ? '' : item.id
  if (expanded.value) void network.organization(item).refresh(organizationRefreshInterval)
}
</script>

<template>
  <div class="organization-picker">
    <FormField
      :id="`${id}-search`"
      v-model="search"
      type="search"
      :disabled="disabled"
      :label="wt('orgSearchLabel')"
      :placeholder="wt('orgSearchPlaceholder')"
      autocomplete="off"
      spellcheck="false"
    >
      <template #suffix
        ><PhMagnifyingGlass :size="17" class="search-icon" aria-hidden="true"
      /></template>
    </FormField>

    <div class="organization-list" role="group" :aria-label="wt('w46')">
      <p v-if="!matches.length" class="organization-no-match" role="status">
        {{ wt('orgSearchEmpty') }}
      </p>
      <article
        v-for="(item, index) in matches"
        :key="item.id"
        class="organization-choice"
        :data-selected="selected === item.id || undefined"
      >
        <div class="organization-choice__row">
          <label>
            <input
              v-model="selected"
              type="radio"
              :name="id"
              :value="item.id"
              :disabled="disabled"
              :aria-label="organizationLabel(item)"
            />
            <span class="organization-choice__indicator" aria-hidden="true" />
            <span class="organization-choice__identity">
              <strong>{{ organizationLabel(item) }}</strong>
              <small
                >{{ wt('w47') }} <span>{{ item.id }}</span></small
              >
            </span>
          </label>
          <button
            type="button"
            :id="`${id}-toggle-${index}`"
            class="organization-choice__detail"
            :aria-label="wt('w50', [organizationLabel(item)])"
            :aria-expanded="expanded === item.id"
            :aria-controls="expanded === item.id ? `${id}-detail-${index}` : undefined"
            :disabled="disabled"
            @click="toggle(item)"
          >
            {{ wt('orgDetails') }} <PhCaretDown :size="14" aria-hidden="true" />
          </button>
        </div>
        <Transition name="organization-reveal">
          <div v-if="expanded === item.id && detailQuery" class="organization-reveal">
            <div class="organization-reveal__clip">
              <OrganizationInlineDetail
                :id="`${id}-detail-${index}`"
                :aria-labelledby="`${id}-toggle-${index}`"
                :detail="detailQuery.data.value"
                :busy="detailQuery.loading.value"
                :error="detailQuery.error.value"
                @retry="detailQuery.refresh()"
              />
            </div>
          </div>
        </Transition>
      </article>
    </div>
  </div>
</template>

<style scoped>
.organization-picker,
.organization-list {
  display: grid;
  min-width: 0;
}
.organization-picker {
  gap: 0.85rem;
}
.search-icon {
  flex: none;
  color: var(--text-muted);
}
.organization-list {
  overflow: clip;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface);
}
.organization-reveal {
  display: grid;
  grid-template-rows: 1fr;
}
.organization-reveal__clip {
  min-height: 0;
  overflow: hidden;
}
.organization-reveal-enter-active,
.organization-reveal-leave-active {
  transition:
    grid-template-rows var(--duration-state) var(--ease-standard),
    opacity var(--duration-state) var(--ease-standard);
}
.organization-reveal-enter-from,
.organization-reveal-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}
.organization-choice + .organization-choice {
  border-top: 1px solid var(--hairline);
}
.organization-choice__row {
  display: flex;
  align-items: stretch;
  min-width: 0;
}
.organization-choice[data-selected] .organization-choice__row {
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
}
.organization-choice label {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  min-height: 66px;
  padding: 0.65rem 0.85rem;
  cursor: pointer;
}
.organization-choice input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}
.organization-choice__indicator {
  flex: none;
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--text-muted);
  border-radius: 50%;
}
.organization-choice input:checked + span {
  border-color: var(--accent);
  background: var(--accent);
  box-shadow: inset 0 0 0 4px var(--surface);
}
.organization-choice input:focus-visible + span {
  outline: 2px solid var(--focus);
  outline-offset: 3px;
}
.organization-choice__identity {
  display: grid;
  gap: 0.18rem;
  min-width: 0;
  overflow-wrap: anywhere;
}
.organization-choice__identity strong {
  color: var(--text);
  font-size: 0.91rem;
  font-weight: 620;
}
.organization-choice__identity small,
.organization-no-match {
  color: var(--text-muted);
  font-size: 0.78rem;
}
.organization-choice__identity small span {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
.organization-choice__detail {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  align-self: center;
  gap: 0.25rem;
  min-width: 44px;
  min-height: 44px;
  margin-inline-end: 0.45rem;
  padding-inline: 0.45rem;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.78rem;
  cursor: pointer;
}
.organization-choice__detail[aria-expanded='true'] {
  color: var(--accent-strong);
}
.organization-choice__detail svg {
  transition: transform var(--duration-state) var(--ease-standard);
}
.organization-choice__detail[aria-expanded='true'] svg {
  transform: rotate(180deg);
}
.organization-choice__detail:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: -2px;
}
.organization-choice__detail:disabled,
.organization-choice label:has(input:disabled) {
  cursor: default;
}
.organization-no-match {
  margin: 0;
  padding: 1.2rem 0.85rem;
}
@media (hover: hover) and (pointer: fine) {
  .organization-choice__detail:hover:enabled {
    color: var(--accent-strong);
  }
  .organization-choice__row:has(label:hover input:enabled) {
    background: color-mix(in srgb, var(--accent) 6%, var(--surface));
  }
}
@media (prefers-reduced-motion: reduce) {
  .organization-reveal-enter-active,
  .organization-reveal-leave-active,
  .organization-choice__detail svg {
    transition: none;
  }
}
</style>
