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
vi.mock('vue-router', () => ({ useRouter: () => router }))
vi.mock('@/stores/wallet', () => ({ useWalletStore: () => wallet }))
vi.mock('@/wallet/entryService', () => ({ resolveWalletArrival }))
import { unlockPhase, resetUnlockAnimation } from '@/composables/useEntryUnlock'

import WalletUnlockView from '@/views/wallet/WalletUnlockView.vue'

describe('wallet unlock transition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    resetUnlockAnimation()
    router.replace.mockResolvedValue(undefined)
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    wallet.error = ''
    wallet.unlock.mockResolvedValue(undefined)
    resolveWalletArrival.mockResolvedValue('/wallet')
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(performance.now())
      return 1
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    resetUnlockAnimation()
  })

  it.each([
    ['/wallet', 'revealing'],
    ['/wallet/entry', 'idle'],
  ] as const)('unlocks into %s with the appropriate transition', async (path, phase) => {
    resolveWalletArrival.mockResolvedValue(path)
    const wrapper = mount(WalletUnlockView, {
      attachTo: document.body,
      global: {
        stubs: {
          WalletAccessFrame: { template: '<main data-entry-experience><slot /></main>' },
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
    expect(router.replace).toHaveBeenCalledExactlyOnceWith(path)
    expect(unlockPhase.value).toBe(phase)
    await vi.advanceTimersByTimeAsync(1100)
    expect(unlockPhase.value).toBe('idle')
    wrapper.unmount()
  })
})
