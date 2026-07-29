import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'

import { navigateWithSpatialTransition } from '@/composables/useSpatialNavigation'

const arrivalKey = 'pangupay-wallet-entry-arrival'

function routerStub(): Router {
  return {
    push: vi.fn<Router['push']>().mockResolvedValue(undefined),
    replace: vi.fn<Router['replace']>().mockResolvedValue(undefined),
  } as unknown as Router
}

describe('wallet spatial navigation', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.stubGlobal(
      'matchMedia',
      vi.fn<() => { matches: boolean }>().mockReturnValue({ matches: false }),
    )
  })

  afterEach(() => {
    Reflect.deleteProperty(document, 'startViewTransition')
    document.documentElement.className = ''
    vi.unstubAllGlobals()
  })

  it('uses only the native view transition when the browser supports it', async () => {
    const router = routerStub()
    sessionStorage.setItem(arrivalKey, '1')
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: vi.fn<(update: () => Promise<unknown>) => { finished: Promise<void> }>(
        (update: () => Promise<unknown>) => ({
          finished: update().then(() => undefined),
        }),
      ),
    })

    await navigateWithSpatialTransition(router, '/wallet', 'wallet')

    expect(sessionStorage.getItem(arrivalKey)).toBeNull()
    expect(router.push).toHaveBeenCalledExactlyOnceWith('/wallet')
  })

  it('arms the wallet arrival overlay only when native transitions are unavailable', async () => {
    const router = routerStub()

    await navigateWithSpatialTransition(router, '/wallet', 'wallet')

    expect(sessionStorage.getItem(arrivalKey)).toBe('1')
    expect(router.push).toHaveBeenCalledExactlyOnceWith('/wallet')
  })

  it('can replace access history while keeping the same visual transition', async () => {
    const router = routerStub()
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: vi.fn<(update: () => Promise<unknown>) => { finished: Promise<void> }>(
        (update: () => Promise<unknown>) => ({
          finished: update().then(() => undefined),
        }),
      ),
    })

    await navigateWithSpatialTransition(router, '/wallet', 'wallet', 'replace')

    expect(router.replace).toHaveBeenCalledExactlyOnceWith('/wallet')
    expect(router.push).not.toHaveBeenCalled()
  })
})
