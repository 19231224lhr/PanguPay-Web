vi.mock('@/components/WalletFigure.vue', () => ({ default: { template: '<div />' } }))
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import AppShell from '@/components/AppShell.vue'
import WalletSettingsView from '@/views/wallet/WalletSettingsView.vue'
import { useWalletStore } from '@/stores/wallet'
import { useDashboardStore } from '@/stores/dashboard'

const { replace } = vi.hoisted(() => ({ replace: vi.fn<(...args: unknown[]) => unknown>() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ replace }) }))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  replace.mockClear()
  i18n.global.locale.value = 'zh-CN'
})

it('uses the same photo in the header and open account menu and updates both', async () => {
  const wrapper = mount(AppShell, {
    props: {
      items: [],
      navigationLabel: 'Wallet',
      accountName: 'Test',
      accountAvatar: 'data:image/png;base64,AA==',
    },
    global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  })
  await wrapper.find('.app-shell__mobile-account').trigger('click')
  const selectors = [
    '.app-shell__avatar img',
    '.app-shell__mobile-account img',
    '.wallet-account-menu__avatar img',
  ]
  for (const selector of selectors)
    expect(wrapper.find(selector).attributes('src')).toBe('data:image/png;base64,AA==')
  await wrapper.setProps({ accountAvatar: 'data:image/png;base64,AQ==' })
  for (const selector of selectors)
    expect(wrapper.find(selector).attributes('src')).toBe('data:image/png;base64,AQ==')
  await wrapper.setProps({ accountAvatar: '' })
  expect(wrapper.find('.wallet-account-menu__avatar').text()).toBe('T')
  expect(wrapper.find('.app-shell__mobile-account').text()).toBe('T')
  wrapper.unmount()
})

it.each(['zh-CN', 'en-US'] as const)(
  'requires confirmation before clearing the wallet and returning home in %s',
  async (locale) => {
    const pinia = createPinia()
    setActivePinia(pinia)
    i18n.global.locale.value = locale
    const wallet = useWalletStore(),
      dashboard = useDashboardStore()
    const clear = vi.spyOn(wallet, 'clearLocalWallet').mockResolvedValue()
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true
      },
    })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false
      },
    })
    const navigate = vi.fn()
    vi.stubGlobal('location', { replace: navigate })
    const reset = vi.spyOn(dashboard, 'reset')
    const wrapper = mount(WalletSettingsView, { global: { plugins: [pinia, i18n] } })
    expect(wrapper.find('[data-testid="sign-out"]').text()).toBe(
      locale === 'en-US' ? 'Sign out' : '退出当前账户',
    )
    await wrapper.find('[data-testid="sign-out"]').trigger('click')
    expect(clear).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    await wrapper.get('[data-testid=cancel-sign-out]').trigger('click')
    expect(clear).not.toHaveBeenCalled()
    await wrapper.get('[data-testid=sign-out]').trigger('click')
    await wrapper.get('[data-testid=confirm-sign-out]').trigger('click')
    await flushPromises()
    expect(clear).toHaveBeenCalledOnce()
    expect(reset).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledWith('/')
    expect(clear.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0]!)
    wrapper.unmount()
  },
)
