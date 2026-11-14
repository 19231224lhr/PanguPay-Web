import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WalletBalanceField from '@/components/WalletBalanceField.vue'

const pgc = {
  symbol: 'PGC',
  name: 'Pangu Coin',
  total: '100',
  utxoAvailable: '80',
  txCerSpendable: '20',
  network: 'Transfer Area',
}
const second = {
  symbol: 'TEST',
  name: 'Test asset',
  total: '7',
  utxoAvailable: '6',
  txCerSpendable: '1',
  network: 'Test',
}
const stubs = { WalletMoneyFigure: true, AppButton: { template: '<a><slot /></a>' } }
describe('Compact overview assets', () => {
  it('preserves each currency and both balance sources after consolidation', () => {
    const w = mount(WalletBalanceField, {
      props: { asset: pgc, assets: [pgc, second], updatedAt: 1 },
      global: { stubs },
    })
    expect(w.get('.wallet-balance-field__amount').text()).toContain('100')
    expect(w.get('.wallet-balance-field__composition').text()).toContain('80')
    expect(w.get('.wallet-balance-field__composition').text()).toContain('20')
    expect(w.get('.other-assets').text()).toContain('Test asset · TEST')
    expect(w.get('.other-assets').text()).toContain('UTXO 6 · TXCer 1')
    w.unmount()
  })
  it('shows unknown before the first snapshot and prevents duplicate refresh', async () => {
    const w = mount(WalletBalanceField, { global: { stubs } })
    expect(w.get('.wallet-balance-field__amount').text()).toContain('—')
    await w.get('.balance-sync').trigger('click')
    expect(w.emitted('refresh')).toHaveLength(1)
    await w.setProps({ loading: true })
    expect(w.get('.balance-sync').attributes('disabled')).toBeDefined()
    await w.get('.balance-sync').trigger('click')
    expect(w.emitted('refresh')).toHaveLength(1)
    w.unmount()
  })
})
