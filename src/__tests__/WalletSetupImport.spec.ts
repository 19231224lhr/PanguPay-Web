import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const router = vi.hoisted(() => ({ replace: vi.fn<(path: string) => Promise<void>>() }))
const wallet = vi.hoisted(() => ({
  create: vi.fn().mockResolvedValue({ encrypted: 'test' }),
  exportRecoveryKit: vi.fn().mockReturnValue({ test: true }),
  confirmCreatedWallet: vi.fn().mockResolvedValue(undefined),
  accountId: 'alice',
  busy: false,
  error: '',
  clearError: vi.fn<() => void>(),
  importEnvelope: vi.fn<(value: unknown, password: string) => Promise<void>>(),
  importLegacy:
    vi.fn<
      (
        privateScalarHex: string,
        roots: Array<{ type: number; rootSeedHex: string }>,
        password: string,
      ) => Promise<unknown>
    >(),
}))
const resolveWalletArrival = vi.hoisted(() => vi.fn<() => Promise<string>>())
const navigateWithSpatialTransition = vi.hoisted(() =>
  vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
)

vi.mock('vue-router', () => ({ useRouter: () => router }))
vi.mock('@/stores/wallet', () => ({ useWalletStore: () => wallet }))
vi.mock('@/wallet/entryService', () => ({ resolveWalletArrival }))
vi.mock('@/composables/useSpatialNavigation', () => ({ navigateWithSpatialTransition }))

import WalletSetupView from '@/views/wallet/WalletSetupView.vue'

describe('wallet backup import experience', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    wallet.error = ''
    resolveWalletArrival.mockResolvedValue('/wallet')
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 0),
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  it('replaces password inputs with backup confirmation before entering', async () => {
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const wrapper = mount(WalletSetupView, {
      global: { stubs: { WalletAccessFrame: { template: '<main><slot /></main>' } } },
    })
    await wrapper.get('#create-password').setValue('test-password-123')
    await wrapper.get('#create-password-confirm').setValue('test-password-123')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('#create-password').exists()).toBe(false)
    expect(wrapper.find('input[value="import"]').exists()).toBe(false)
    expect(wrapper.get('.backup-files').text()).toContain('PanguPay-recovery.json')
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wallet.confirmCreatedWallet).toHaveBeenCalledOnce()
    expect(navigateWithSpatialTransition).toHaveBeenCalledWith(
      router,
      '/wallet',
      'wallet',
      'replace',
    )
    click.mockRestore()
    wrapper.unmount()
  })

  it('moves to a verification stage immediately and returns a friendly focused error', async () => {
    let rejectImport!: (cause: Error) => void
    wallet.importEnvelope.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectImport = reject
        }),
    )
    const wrapper = mount(WalletSetupView, {
      attachTo: document.body,
      global: {
        stubs: {
          WalletAccessFrame: { template: '<main><slot /></main>' },
        },
      },
    })

    await wrapper.get('input[type="radio"][value="import"]').setValue()
    const file = new File(['{}'], 'wallet.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => '{}' })
    const fileInput = wrapper.get('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', { value: [file] })
    await fileInput.trigger('change')
    await flushPromises()
    await wrapper.get('#import-password').setValue('wrong-password')

    void wrapper.get('form.import-form').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[aria-busy="true"] h1').text()).toBe('正在验证加密备份')
    expect(wrapper.text()).not.toContain('验证并导入')
    await vi.waitFor(() => expect(wallet.importEnvelope).toHaveBeenCalledOnce())

    rejectImport(new Error('wallet unlock failed'))
    await flushPromises()

    const alert = wrapper.get('#import-feedback [role="alert"]')
    expect(alert.text()).toContain('无法验证备份')
    expect(alert.text()).not.toContain('wallet unlock failed')
    expect(wrapper.get('#import-password').element).toBe(document.activeElement)
    expect(wrapper.get('#import-password').attributes('aria-invalid')).toBe('true')
    wrapper.unmount()
  })

  it('leaves the verification stage directly for a known wallet without flashing entry', async () => {
    wallet.importEnvelope.mockResolvedValue(undefined)
    const wrapper = mount(WalletSetupView, {
      attachTo: document.body,
      global: {
        stubs: {
          WalletAccessFrame: { template: '<main><slot /></main>' },
        },
      },
    })

    await wrapper.get('input[type="radio"][value="import"]').setValue()
    const file = new File(['{}'], 'wallet.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => '{}' })
    const fileInput = wrapper.get('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', { value: [file] })
    await fileInput.trigger('change')
    await flushPromises()
    await wrapper.get('#import-password').setValue('correct-password')
    await wrapper.get('form.import-form').trigger('submit')

    await vi.waitFor(() => expect(resolveWalletArrival).toHaveBeenCalledWith('alice'))
    expect(navigateWithSpatialTransition).toHaveBeenCalledExactlyOnceWith(
      router,
      '/wallet',
      'wallet',
      'replace',
    )
    expect(router.replace).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
