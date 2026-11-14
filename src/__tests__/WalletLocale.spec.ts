vi.mock('@/components/WalletFigure.vue', () => ({ default: { template: '<div />' } }))
import { mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import i18n from '@/i18n'
import { walletMessages } from '@/i18n/walletMessages'
import { describeTransferIssue } from '@/transfer/errors'
import WalletSendView from '@/views/wallet/WalletSendView.vue'
import WalletActivityView from '@/views/wallet/WalletActivityView.vue'

vi.mock('@/stores/dashboard', () => ({
  useDashboardStore: () => ({
    current: {
      assets: [{ symbol: 'CAL', total: '20' }],
      organization: { id: '10000000' },
      activities: [],
    },
  }),
}))
vi.mock('@/stores/wallet', () => ({
  useWalletStore: () => ({
    addresses: [{ address: 'a'.repeat(40), type: '0' }],
  }),
}))
vi.mock('@/stores/transfer', () => ({
  useTransferStore: () => ({
    stage: 'compose',
    error: '',
    busy: false,
    dismissError: vi.fn<(...args: unknown[]) => unknown>(),
    synchronizeHistory: vi.fn<(...args: unknown[]) => unknown>(),
    history: [
      {
        draftID: 'test',
        txID: 'b'.repeat(64),
        mode: 'quick',
        phase: 'registered',
        amount: '1',
        recipient: 'c'.repeat(40),
        coinType: 0,
        acceptedAt: 1789277256321,
        backendAcceptedAt: 1789277256321,
        registeredAt: 1789277256381,
        updatedAt: 1789277256400,
      },
    ],
  }),
}))
const options = {
  global: { plugins: [i18n], stubs: { RouterLink: { template: '<a><slot /></a>' } } },
}
afterEach(() => {
  i18n.global.locale.value = 'zh-CN'
})

it('switches the full send form live and preserves input', async () => {
  i18n.global.locale.value = 'zh-CN'
  const wrapper = mount(WalletSendView, options)
  expect(wrapper.text()).toContain('审核交易')
  await wrapper.find('#send-recipient').setValue('c'.repeat(40))
  await wrapper.find('#send-amount').setValue('1')
  i18n.global.locale.value = 'en-US'
  await nextTick()
  expect(wrapper.text()).toContain('Review transaction')
  expect(wrapper.text()).toContain('Quick')
  expect(wrapper.text()).toContain('Source address')
  expect(wrapper.text()).not.toMatch(/[\u3400-\u9fff]/u)
  expect((wrapper.find('#send-recipient').element as HTMLInputElement).value).toBe('c'.repeat(40))
  expect((wrapper.find('#send-amount').element as HTMLInputElement).value).toBe('1')
  i18n.global.locale.value = 'zh-CN'
  await nextTick()
  expect(wrapper.text()).toContain('审核交易')
  wrapper.unmount()
})

it('switches activity phases and date formats without changing transaction data', async () => {
  i18n.global.locale.value = 'zh-CN'
  const wrapper = mount(WalletActivityView, options)
  expect(wrapper.text()).toContain('登记确认耗时 60 ms')
  i18n.global.locale.value = 'en-US'
  await nextTick()
  expect(wrapper.text()).toContain('Registration duration 60 ms')
  expect(wrapper.text()).toContain('Recipient availability (unconfirmed)')
  expect(wrapper.text()).toContain('Not reported')
  expect(wrapper.text()).not.toMatch(/[\u3400-\u9fff]/u)
  expect(wrapper.text()).toContain('b'.repeat(64))
  wrapper.unmount()
})

it('resolves error descriptions in the current language on each call', () => {
  i18n.global.locale.value = 'en-US'
  expect(describeTransferIssue('insufficient spendable balance').title).toBe(
    'Insufficient spendable balance',
  )
  i18n.global.locale.value = 'zh-CN'
  expect(describeTransferIssue('insufficient spendable balance').title).toBe('可用余额不足')
})

it('has matching translations and interpolation parameters for every wallet message', () => {
  expect(Object.keys(walletMessages['en-US'])).toEqual(Object.keys(walletMessages['zh-CN']))
  for (const key of Object.keys(walletMessages['zh-CN']) as Array<
    keyof (typeof walletMessages)['zh-CN']
  >) {
    const zh = walletMessages['zh-CN'][key],
      en = walletMessages['en-US'][key]
    expect(en.trim()).not.toBe('')
    expect(en.match(/\{\d+\}/g) ?? []).toEqual(zh.match(/\{\d+\}/g) ?? [])
    expect(key === 'w239' ? '' : en).not.toMatch(/[\u3400-\u9fff]/u)
  }
})
