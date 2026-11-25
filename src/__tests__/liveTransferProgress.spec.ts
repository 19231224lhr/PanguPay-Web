import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { expect, it, vi } from 'vitest'

import i18n from '@/i18n'
import type { GatewayClient } from '@/services/gatewayClient'
import { useTransferStore, type TransferReview } from '@/stores/transfer'
import { recordTransferProgress } from '@/transfer/journal'
import WalletSendView from '@/views/wallet/WalletSendView.vue'

vi.mock('@/stores/wallet', () => ({
  useWalletStore: () => ({
    accountId: 'live-progress',
    unlockedRecord: {},
    addresses: [{ address: 'b'.repeat(40), type: '0' }],
  }),
}))
vi.mock('@/stores/dashboard', () => ({
  useDashboardStore: () => ({ current: { assets: [] }, sync: vi.fn() }),
}))
vi.mock('@/transfer', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/transfer')>(),
  resolveTransferChainScope: async () => 'live-progress-chain',
  submitBuiltTransfer: async () => ({ accepted: true }),
}))

it('advances the open result from Assign confirmation to certified settlement despite unavailable DAG events', async () => {
  localStorage.clear()
  vi.useFakeTimers()
  i18n.global.locale.value = 'zh-CN'
  const pinia = createPinia()
  setActivePinia(pinia)
  const transfer = useTransferStore()
  const txID = 'a'.repeat(64)
  let certifiedHeight = 0
  const gateway = {
    assignTransactionStatus: async () => ({ status: 'success' }),
    txCerSpendReadyStatus: async () => { throw new Error('not available yet') },
    schedulerDAGEvents: async () => { throw new Error('node request failed') },
    gqncStatus: async () => ({ status: { certifiedHeight } }),
    gqncCertifiedBlock: async () => ({
      envelope: {
        QC: { QCID: 'b'.repeat(64), Threshold: 3, Signers: ['1', '2', '3'] },
        Block: { Body: { Transactions: [{ AggregateTX: { AllTransactions: [{ TXID: txID }] } }] } },
      },
    }),
    gqncPerformance: async () => ({ samples: [] }),
  } as unknown as GatewayClient
  transfer.setGatewayForTests(gateway)
  await flushPromises()
  await transfer.synchronizeHistory()
  recordTransferProgress('live-progress', {
    draftID: txID, txID, mode: 'quick', phase: 'review', amount: '2', recipient: 'c'.repeat(40),
    submissionKind: 'assign', groupID: '10000000', coinType: 0, inputIDs: ['source-output'],
    updatedAt: Date.now(),
  })
  transfer.review = { draftID: txID, mode: 'quick', membership: 'member', built: {} } as TransferReview
  transfer.stage = 'review'

  await transfer.submit()
  await flushPromises()
  const wrapper = mount(WalletSendView, {
    global: {
      plugins: [pinia, i18n],
      stubs: { RouterLink: true, WalletPageHeader: true, WalletFigure: true },
    },
  })
  try {
    const result = wrapper.get('.result-plane')
    expect(result.text()).toContain('快速转账处理中')
    expect(result.findAll('.timeline__item--complete').map(item => item.get('strong').text())).toContain('组织确认')
    expect(result.get('.timeline__item--unknown').text()).toContain('收款方可用（未确认）')

    certifiedHeight = 1
    await vi.advanceTimersByTimeAsync(2_500)
    await nextTick()
    expect(result.text()).toContain('快速转账已完成')
    expect(result.findAll('.timeline__item--complete').map(item => item.get('strong').text())).toContain('后台结算')
    expect(transfer.currentProgress?.certifiedHeight).toBe(1)
  } finally {
    wrapper.unmount()
    vi.useRealTimers()
    localStorage.clear()
  }
})
