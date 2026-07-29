<script setup lang="ts">
import QRCode from 'qrcode'
import { computed } from 'vue'

const props = withDefaults(defineProps<{ address: string; emptyLabel?: string }>(), {
  emptyLabel: '钱包中没有可用地址，暂时无法生成二维码。',
})

const matrix = computed(() => {
  const address = props.address.trim()
  if (!address) return undefined
  const code = QRCode.create(address, { errorCorrectionLevel: 'M' })
  const commands: string[] = []
  for (let row = 0; row < code.modules.size; row += 1) {
    let start = -1
    for (let column = 0; column <= code.modules.size; column += 1) {
      const dark = column < code.modules.size && code.modules.get(row, column)
      if (dark && start < 0) start = column
      if (!dark && start >= 0) {
        const width = column - start
        commands.push(`M${start} ${row}h${width}v1h-${width}z`)
        start = -1
      }
    }
  }
  return { path: commands.join(''), size: code.modules.size }
})
</script>

<template>
  <figure class="receive-qr" :data-empty="!matrix || undefined">
    <svg
      v-if="matrix"
      :viewBox="`-4 -4 ${matrix.size + 8} ${matrix.size + 8}`"
      role="img"
      :aria-label="`收款地址 ${address} 的二维码`"
      shape-rendering="crispEdges"
    >
      <rect :x="-4" :y="-4" :width="matrix.size + 8" :height="matrix.size + 8" fill="#fff" />
      <path data-qr-modules :d="matrix.path" fill="#090b0f" />
    </svg>
    <figcaption v-else>{{ emptyLabel }}</figcaption>
  </figure>
</template>

<style scoped>
.receive-qr {
  display: grid;
  width: min(280px, 72vw);
  aspect-ratio: 1;
  margin: 0;
  padding: clamp(0.7rem, 2vw, 1rem);
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 18px 48px rgb(0 0 0 / 0.16);
  place-items: center;
}

.receive-qr svg {
  display: block;
  width: 100%;
  height: 100%;
}

.receive-qr[data-empty] {
  aspect-ratio: auto;
  min-height: 180px;
  background: var(--surface-subtle);
  box-shadow: none;
}

.receive-qr figcaption {
  max-width: 24ch;
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1.55;
  text-align: center;
}
</style>
