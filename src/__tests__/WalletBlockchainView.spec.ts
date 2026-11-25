import { flushPromises, mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import WalletBlockchainView from '@/views/wallet/WalletBlockchainView.vue'
import { createWalletNetwork, walletNetworkKey } from '@/composables/useWalletNetwork'

const mocks = vi.hoisted(() => ({
  status: vi.fn<() => Promise<unknown>>(),
  block: vi.fn<(height: number) => Promise<unknown>>(),
  traces: vi.fn<() => Promise<unknown>>(),
}))
vi.mock('@/services/gatewayClient', () => ({
  GatewayClient: class {
    gqncStatus = mocks.status
    gqncCertifiedBlock = mocks.block
    gqncTransactionTraces = mocks.traces
  },
}))

it('shows available blocks before a pending request resolves and preserves the selection on retry', async () => {
  const txID = 'ab'.repeat(32)
  let rejectPending!: (error: Error) => void
  const pending = new Promise((_, reject) => {
    rejectPending = reject
  })
  mocks.status.mockResolvedValue({
    protocolVersion: 'gqnc-master-v2',
    certifiedHeight: 3,
    safetyStatus: 'NORMAL',
    enabled: true,
    validatorCount: 4,
    quorum: 3,
  })
  function block(height: number) {
    return {
      Block: {
        BlockHead: { BlockHeight: height, BlockHash: `hash-${height}` },
        BlockBody: { Transactions: height === 1 ? [{ TXID: txID }] : [] },
      },
      Proposal: { ProposalID: `proposal-${height}` },
      QC: { QCID: `qc-${height}`, Threshold: 3, Signers: ['a', 'b', 'c'] },
    }
  }
  mocks.block.mockImplementation(async (height) => (height === 2 ? pending : block(height)))

  const network = createWalletNetwork()
  void network.refreshChain()
  const wrapper = mount(WalletBlockchainView, {
    global: { provide: { [walletNetworkKey as symbol]: network } },
  })
  try {
    await flushPromises()
    const buttons = wrapper.findAll('.chain-flow button')
    expect(buttons.map((button) => button.get('b').text())).toEqual(['#3', '#1'])
    expect(wrapper.get('.block-detail').text()).toContain('hash-3')
    await buttons[1]!.trigger('click')
    expect(wrapper.get('.block-transactions').text()).toContain(txID)
    expect(wrapper.get('.block-detail').text()).toContain('proposal-1')

    rejectPending(new Error('Block request timed out'))
    await flushPromises()
    expect(wrapper.text()).toContain('1 个区块暂未读到')
    expect(wrapper.findAll('.chain-flow button')).toHaveLength(2)

    mocks.block.mockImplementation(async (height) => block(height))
    await wrapper.get('.chain-status__safety button').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.chain-flow button')).toHaveLength(3)
    expect(wrapper.text()).not.toContain('暂未读到')
    expect(wrapper.get('.block-transactions').text()).toContain(txID)

    mocks.status.mockRejectedValueOnce(new Error('Offline'))
    await wrapper.get('.chain-status__safety button').trigger('click')
    await flushPromises()
    expect(wrapper.get('.chain-status__safety').text()).toContain('暂不可用')
    expect(wrapper.text()).toContain('上次成功读取的数据')
    expect(wrapper.get('.block-transactions').text()).toContain(txID)
  } finally {
    rejectPending(new Error('End of test'))
    await flushPromises()
    wrapper.unmount()
    network.dispose()
  }
})

it('finds an older certified transaction by UTXO reference and highlights its exact output', async () => {
  const txID = 'de'.repeat(32)
  const address = 'a'.repeat(40)
  mocks.traces.mockResolvedValue({ traces: [{ txID, height: 5 }] })
  mocks.block.mockResolvedValue({
    envelope: {
      Block: {
        Head: { BlockHeight: 5 },
        Body: {
          Transactions: [{
            AggregateTX: {
              AllTransactions: [{
                TXID: txID,
                TXOutputs: [
                  { ToAddress: 'b'.repeat(40), ToValue: '1', Type: 0 },
                  { ToAddress: address, ToValue: '99', Type: 0 },
                ],
              }],
            },
          }],
        },
      },
      QC: { QCID: 'c'.repeat(64), Threshold: 3, Signers: ['a', 'b', 'c'] },
    },
  })
  const network = createWalletNetwork()
  const wrapper = mount(WalletBlockchainView, {
    global: { provide: { [walletNetworkKey as symbol]: network } },
  })
  try {
    await wrapper.get('#chain-transaction-query').setValue(`${txID} + 1`)
    await wrapper.get('.chain-lookup form').trigger('submit')
    await flushPromises()
    const output = wrapper.get('[data-highlighted-output]')
    expect(output.text()).toContain('99 CAL')
    expect(output.text()).toContain(address)
    expect(wrapper.get('.chain-lookup').text()).toContain('#5')
    expect(mocks.block).toHaveBeenCalledWith(5)
  } finally {
    wrapper.unmount()
    network.dispose()
  }
})
