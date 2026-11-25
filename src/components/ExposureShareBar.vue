<script setup lang="ts">
import { wt } from '@/i18n/walletText'

import { computed } from 'vue'

import WalletPagedRows from '@/components/WalletPagedRows.vue'
import { parseAmount } from '@/protocol-v2'
import type { WalletExposureShareSummary } from '@/wallet/types'

const props = defineProps<{ shares: WalletExposureShareSummary[] }>()

const normalized = computed(() => {
  const values = props.shares.map((share) => {
    try {
      return { share, units: parseAmount(share.amount) }
    } catch {
      return { share, units: 0n }
    }
  })
  const total = values.reduce((sum, item) => sum + item.units, 0n)
  return values.map(({ share, units }) => ({
    ...share,
    weight: total > 0n ? Number((units * 10_000n) / total) : 0,
  }))
})

const short = (value: string) =>
  value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value
</script>

<template>
  <section v-if="normalized.length" class="exposure" :aria-label="wt('w318')">
    <div v-if="normalized.length > 1" class="exposure__bar" aria-hidden="true">
      <span
        v-for="share in normalized"
        :key="share.leafId"
        :data-share="share.leafId"
        :style="`--share-weight: ${share.weight}`"
      />
    </div>
    <WalletPagedRows v-slot="{ rows, offset }" :items="normalized" :label="wt('w318')">
      <ul>
        <li v-for="(share, index) in rows" :key="share.leafId" :data-share-tone="(offset + index) % 3">
          <span v-if="normalized.length > 1" aria-hidden="true" />
          <small v-else>{{ wt('w318') }}</small>
          <b>{{ share.amount }} CAL</b>
          <small :title="share.rootId">Root {{ short(share.rootId) }}</small>
        </li>
      </ul>
    </WalletPagedRows>
  </section>
</template>

<style scoped>
.exposure {
  display: grid;
  gap: 0.7rem;
}

.exposure__bar {
  display: flex;
  height: 3px;
  gap: 2px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface-subtle);
}

.exposure__bar > span {
  min-width: 2px;
  flex-grow: var(--share-weight);
  flex-basis: 0;
  background: var(--accent);
}

.exposure__bar > span:nth-child(3n + 2) {
  background: color-mix(in srgb, var(--accent) 58%, var(--text));
}

.exposure__bar > span:nth-child(3n) {
  background: color-mix(in srgb, var(--accent) 35%, var(--text-muted));
}

.exposure ul {
  display: grid;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.exposure li {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: 0.45rem;
}

.exposure li > span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
}

.exposure li[data-share-tone='1'] > span {
  background: color-mix(in srgb, var(--accent) 58%, var(--text));
}

.exposure li[data-share-tone='2'] > span {
  background: color-mix(in srgb, var(--accent) 35%, var(--text-muted));
}

.exposure b {
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
}

.exposure small {
  min-width: 0;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 0.66rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
