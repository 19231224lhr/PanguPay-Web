import { nextTick } from 'vue'
import type { Router } from 'vue-router'

export type SpatialTransition = 'access' | 'wallet'

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => Promise<unknown>) => {
    finished: Promise<void>
  }
}

export async function navigateWithSpatialTransition(
  router: Router,
  destination: string,
  mode: SpatialTransition,
): Promise<void> {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const transitionDocument = document as ViewTransitionDocument

  if (reduced || !transitionDocument.startViewTransition) {
    await router.push(destination)
    return
  }

  const className = mode === 'access' ? 'wallet-access-transition' : 'wallet-entry-transition'
  document.documentElement.classList.add(className)
  try {
    await transitionDocument.startViewTransition(async () => {
      await router.push(destination)
      await nextTick()
    }).finished
  } finally {
    document.documentElement.classList.remove(className)
  }
}
