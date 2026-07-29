<script setup lang="ts">
import { computed } from 'vue'

import type { TransferMode } from '@/transfer'

const props = defineProps<{ mode: TransferMode; member: boolean }>()

const route = computed(() => {
  if (props.mode === 'quick') {
    return {
      label: '快速可用路径',
      nodes: ['本地签名', '担保责任', '目标 Assign', 'TXCer 可支付'],
      note: 'GQNC 后台结算，不阻塞 TXCer 继续支付。',
      background: true,
    }
  }
  if (props.mode === 'cross') {
    return {
      label: '跨链路径',
      nodes: ['本地签名', '担保组织', '跨链出口', '轻计算网络'],
      note: '当前仅支持整数 PGC、单一轻计算收款地址。',
      background: false,
    }
  }
  return {
    label: props.member ? '组织内普通路径' : '独立普通路径',
    nodes: props.member
      ? ['本地签名', '担保组织', 'GQNC 结算']
      : ['本地签名', '委员会入口', 'GQNC 结算'],
    note: props.member ? '仅使用普通 UTXO。' : '不依赖担保组织，仅使用普通 UTXO。',
    background: false,
  }
})
</script>

<template>
  <section class="transfer-route" :aria-label="route.label">
    <Transition name="route-swap" mode="out-in">
      <div :key="`${mode}-${member}`" class="transfer-route__content">
        <div class="transfer-route__nodes">
          <template v-for="(node, index) in route.nodes" :key="node">
            <span v-if="index" class="transfer-route__connector" aria-hidden="true"><i /></span>
            <span
              data-route-node
              class="transfer-route__node"
              :data-terminal="index === route.nodes.length - 1 || undefined"
            >
              <i aria-hidden="true">{{ index + 1 }}</i>
              <b>{{ node }}</b>
            </span>
          </template>
        </div>
        <p><span v-if="route.background" aria-hidden="true" />{{ route.note }}</p>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.transfer-route {
  padding: 0.9rem 0 0.15rem;
  border-top: 1px solid var(--hairline);
}

.transfer-route__content {
  display: grid;
  gap: 0.7rem;
}

.transfer-route__nodes {
  display: flex;
  min-width: 0;
  align-items: center;
}

.transfer-route__node {
  display: grid;
  min-width: 0;
  gap: 0.35rem;
  justify-items: center;
  text-align: center;
}

.transfer-route__node > i {
  display: grid;
  width: 24px;
  height: 24px;
  border: 1px solid var(--border-strong);
  border-radius: 50%;
  background: var(--surface-raised);
  color: var(--text-muted);
  font-size: 0.66rem;
  font-style: normal;
  font-variant-numeric: tabular-nums;
  place-items: center;
}

.transfer-route__node[data-terminal] > i {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border-strong));
  background: color-mix(in srgb, var(--accent) 12%, var(--surface-raised));
  color: var(--accent-strong);
}

.transfer-route__node > b {
  max-width: 11ch;
  font-size: 0.7rem;
  font-weight: 620;
  line-height: 1.35;
}

.transfer-route__connector {
  position: relative;
  height: 1px;
  flex: 1 1 34px;
  min-width: 18px;
  margin: 0 0.4rem 1.45rem;
  overflow: hidden;
  background: var(--hairline);
}

.transfer-route__connector i {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  clip-path: inset(0 100% 0 0);
  animation: route-draw 220ms var(--ease-standard) forwards;
}

.transfer-route p {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  color: var(--text-muted);
  font-size: 0.72rem;
  line-height: 1.5;
}

.transfer-route p > span {
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: 50%;
  background: var(--accent);
}

.route-swap-enter-active,
.route-swap-leave-active {
  transition:
    opacity 160ms var(--ease-standard),
    transform 160ms var(--ease-standard);
}

.route-swap-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.route-swap-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}

@keyframes route-draw {
  to {
    clip-path: inset(0);
  }
}

@media (max-width: 560px) {
  .transfer-route__node > b {
    max-width: 8ch;
    font-size: 0.66rem;
  }

  .transfer-route__connector {
    margin-inline: 0.2rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .transfer-route__connector i {
    clip-path: none;
    animation: none;
  }

  .route-swap-enter-active,
  .route-swap-leave-active {
    transition-duration: 120ms;
    transition-property: opacity;
  }

  .route-swap-enter-from,
  .route-swap-leave-to {
    transform: none;
  }
}
</style>
