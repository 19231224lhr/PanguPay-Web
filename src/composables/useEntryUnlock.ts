import { nextTick, ref } from 'vue'

export type UnlockPhase = 'idle' | 'loading' | 'arriving' | 'revealing'
export const unlockPhase = ref<UnlockPhase>('idle')
export const resetUnlockAnimation = () => {
  unlockPhase.value = 'idle'
}
export async function revealUnlockedPage(navigate: () => Promise<unknown>) {
  unlockPhase.value = 'arriving'
  try {
    await navigate()
    await nextTick()
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
    unlockPhase.value = 'revealing'
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    await new Promise((resolve) => setTimeout(resolve, reduced ? 180 : 1100))
  } finally {
    resetUnlockAnimation()
  }
}
