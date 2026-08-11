<script setup lang="ts">
import { computed } from 'vue'

import type { TransferMode, TransferPhase } from '@/transfer'

const props = defineProps<{
  mode?: TransferMode
  phase?: TransferPhase
  status?: string
  lightTxHash?: string
  targetBlock?: number
  crossChainError?: string
}>()

const shortHash = (value: string) => `${value.slice(0, 10)}…${value.slice(-8)}`

type StepState = 'complete' | 'active' | 'pending' | 'error'

const steps = computed(() => {
  if (!props.phase)
    return [{ label: '后端记录', detail: props.status || '状态未知', state: 'active' as StepState }]
  const failed = props.phase === 'failed'
  const accepted = [
    'accepted',
    'spend-ready',
    'local-certified',
    'target-accepted',
    'settled',
  ].includes(props.phase)
  const spendReady = ['spend-ready', 'settled'].includes(props.phase)
  const settled = props.phase === 'settled'
  if (props.mode === 'cross') {
    const localCertified = ['local-certified', 'target-accepted', 'settled'].includes(props.phase)
    const targetAccepted = ['target-accepted', 'settled'].includes(props.phase)
    return [
      {
        label: '跨链交易已接收',
        detail: accepted ? '源区入口已接收交易。' : '等待源区入口确认。',
        state: failed ? 'error' : accepted ? 'complete' : ('active' as StepState),
      },
      {
        label: '担保验证',
        detail: localCertified ? '担保验证已经完成。' : '等待担保节点确认。',
        state: failed ? 'error' : localCertified ? 'complete' : accepted ? 'active' : 'pending',
      },
      {
        label: '本地 GQNC 已认证',
        detail: localCertified ? '源区交易已获得终局认证。' : '等待本地 GQNC 认证。',
        state: failed ? 'error' : localCertified ? 'complete' : 'pending',
      },
      {
        label: '轻计算区已接收',
        detail: targetAccepted
          ? props.lightTxHash
            ? `交易 ${shortHash(props.lightTxHash)} 已接收，等待出块。`
            : '目标交易已进入轻计算区，等待出块。'
          : '等待轻计算区接收。',
        state: failed
          ? 'error'
          : targetAccepted
            ? 'complete'
            : localCertified
              ? 'active'
              : 'pending',
      },
      {
        label: '目标链到账',
        detail: props.crossChainError
          ? `需要人工恢复：${props.crossChainError}`
          : settled
            ? props.targetBlock
              ? `目标链回执成功，区块高度 ${props.targetBlock}。`
              : '目标链回执成功。'
            : '等待目标链出块。',
        state: props.crossChainError
          ? 'error'
          : failed
            ? 'error'
            : settled
              ? 'complete'
              : targetAccepted
                ? 'active'
                : 'pending',
      },
    ] satisfies Array<{ label: string; detail: string; state: StepState }>
  }
  const result = [
    {
      label: '入口接收',
      detail: accepted ? '提交已通过入口校验。' : '等待入口确认。',
      state: failed ? 'error' : accepted ? 'complete' : 'active',
    },
  ]
  if (props.mode === 'quick') {
    result.push({
      label: 'TXCer 可支付',
      detail: spendReady ? '收款方已获得可继续支付的 TXCer。' : '等待收款方权威状态。',
      state: failed ? 'error' : spendReady ? 'complete' : accepted ? 'active' : 'pending',
    })
  }
  result.push({
    label: '后台结算',
    detail: settled ? 'GQNC 已完成本地认证与结算。' : '后台处理不冒充快速可用。',
    state: failed ? 'error' : settled ? 'complete' : 'pending',
  })
  return result
})
</script>

<template>
  <ol class="activity-progress" aria-label="交易处理进度">
    <li v-for="step in steps" :key="step.label" data-activity-step :data-state="step.state">
      <span aria-hidden="true" />
      <div>
        <b>{{ step.label }}</b
        ><small>{{ step.detail }}</small>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.activity-progress {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.activity-progress li {
  position: relative;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  gap: 0.65rem;
  padding-bottom: 0.85rem;
}

.activity-progress li:not(:last-child)::after {
  position: absolute;
  top: 15px;
  bottom: 0;
  left: 5px;
  width: 1px;
  background: var(--hairline);
  content: '';
}

.activity-progress li > span {
  width: 11px;
  height: 11px;
  margin-top: 0.22rem;
  border: 1px solid var(--border-strong);
  border-radius: 50%;
  background: var(--surface);
}

.activity-progress li[data-state='complete'] > span {
  border-color: var(--success);
  background: var(--success);
}

.activity-progress li[data-state='active'] > span {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 12%, transparent);
}

.activity-progress li[data-state='error'] > span {
  border-color: var(--danger);
  background: var(--danger);
}

.activity-progress div {
  display: grid;
  gap: 0.12rem;
}

.activity-progress b {
  font-size: 0.76rem;
}

.activity-progress small {
  color: var(--text-muted);
  font-size: 0.7rem;
  line-height: 1.45;
}
</style>
