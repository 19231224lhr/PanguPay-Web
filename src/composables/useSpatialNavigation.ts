import { nextTick } from 'vue'
import { revealUnlockedPage, resetUnlockAnimation } from './useEntryUnlock'
import type { Router } from 'vue-router'

export type SpatialTransition = 'access' | 'wallet'
export type SpatialNavigationMethod = 'push' | 'replace'

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => Promise<unknown>) => {
    finished: Promise<void>
  }
}

const walletArrivalFallbackKey = 'pangupay-wallet-entry-arrival'

export async function navigateWithSpatialTransition(
  router: Router,
  destination: string,
  mode: SpatialTransition,
  method: SpatialNavigationMethod = 'push',
): Promise<void> {
  // Every entry path shares the same live scene, including new wallets and imports.
  if (document.querySelector('[data-entry-experience]')) {
    sessionStorage.removeItem(walletArrivalFallbackKey)
    if (mode === 'wallet') await revealUnlockedPage(() => router[method](destination))
    else {
      resetUnlockAnimation()
      await router[method](destination)
    }
    return
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const transitionDocument = document as ViewTransitionDocument
  const navigate = () => router[method](destination)

  if (reduced || !transitionDocument.startViewTransition) {
    if (mode === 'wallet') {
      sessionStorage.setItem(walletArrivalFallbackKey, '1')
    }
    await navigate()
    return
  }

  if (mode === 'wallet') {
    sessionStorage.removeItem(walletArrivalFallbackKey)
  }

  const className = mode === 'access' ? 'wallet-access-transition' : 'wallet-entry-transition'
  document.documentElement.classList.add(className)
  try {
    await transitionDocument.startViewTransition(async () => {
      await navigate()
      await nextTick()
    }).finished
  } finally {
    document.documentElement.classList.remove(className)
  }
}
