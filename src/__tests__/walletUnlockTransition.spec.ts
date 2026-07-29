import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const router = vi.hoisted(() => ({ replace: vi.fn<(path: string) => Promise<void>>() }))
const wallet = vi.hoisted(() => ({
  accountId: 'alice',
  busy: false,
  error: '',
  clearError: vi.fn<() => void>(),
  unlock: vi.fn<(password: string) => Promise<void>>(),
}))
const resolveWalletArrival = vi.hoisted(() => vi.fn<() => Promise<string>>())
const navigateWithSpatialTransition = vi.hoisted(() =>
  vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
)

vi.mock('vue-router', () => ({ useRouter: () => router }))
vi.mock('@/stores/wallet', () => ({ useWalletStore: () => wallet }))
vi.mock('@/wallet/entryService', () => ({ resolveWalletArrival }))
vi.mock('@/composables/useSpatialNavigation', () => ({ navigateWithSpatialTransition }))

import WalletUnlockView from '@/views/wallet/WalletUnlockView.vue'

describe('wallet unlock transition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    wallet.error = ''
    wallet.unlock.mockResolvedValue(undefined)
    resolveWalletArrival.mockResolvedValue('/wallet')
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(performance.now())
      return 1
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('keeps the loading layer visible until it can transition directly to the wallet', async () => {
    const wrapper = mount(WalletUnlockView, {
      attachTo: document.body,
      global: {
        stubs: {
          WalletAccessFrame: { template: '<main><slot /></main>' },
          RouterLink: { template: '<a><slot /></a>' },
          Teleport: true,
          ValueFoldField: { template: '<div data-loading-field />' },
        },
      },
    })

    await wrapper.get('#unlock-password').setValue('correct-password')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(resolveWalletArrival).toHaveBeenCalledExactlyOnceWith('alice')
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
