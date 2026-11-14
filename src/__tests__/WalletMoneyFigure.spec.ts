import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import WalletMoneyFigure from '@/components/WalletMoneyFigure.vue'

afterEach(() => vi.unstubAllGlobals())
describe('Money illustration motion', () => {
  it('responds to the pointer, then returns to rest', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const w = mount(WalletMoneyFigure)
    vi.spyOn(w.element, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 112,
      height: 90,
    } as DOMRect)
    w.element.dispatchEvent(new MouseEvent('pointermove', { clientX: 100, clientY: 20 }))
    await nextTick()
    expect(w.attributes('style')).not.toContain('--coin-lift: 0px')
    await w.trigger('pointerleave')
    expect(w.attributes('style')).toContain('--coin-lift: 0px')
    w.unmount()
  })
  it('stays still when reduced motion is requested', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const w = mount(WalletMoneyFigure)
    w.element.dispatchEvent(new MouseEvent('pointermove', { clientX: 100, clientY: 20 }))
    await nextTick()
    expect(w.attributes('style')).toContain('--coin-lift: 0px')
    w.unmount()
  })
})
