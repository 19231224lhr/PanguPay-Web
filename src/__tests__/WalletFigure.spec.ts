import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import WalletFigure from '@/components/WalletFigure.vue'

const mocks = vi.hoisted(() => ({
  drawer: vi.fn(),
  settle: vi.fn(),
  destroy: vi.fn(),
  update: vi.fn(),
}))
vi.mock('@lucasmarkes/hairline', () => ({
  drawer: mocks.drawer,
  settle: mocks.settle,
  stack: mocks.drawer,
  branches: mocks.settle,
  phone: mocks.drawer,
  format: mocks.drawer,
}))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.drawer.mockReturnValue({ destroy: mocks.destroy, update: mocks.update })
  mocks.settle.mockReturnValue({ destroy: mocks.destroy, update: mocks.update })
})

describe('Wallet decorative figures', () => {
  it('updates intensity without remounting and never autoplays', async () => {
    const w = mount(WalletFigure, { props: { kind: 'drawer' } })
    expect(mocks.drawer).toHaveBeenCalledWith(w.element, { intensity: 0.35, play: false })
    expect(w.attributes('aria-hidden')).toBe('true')
    await w.setProps({ intensity: 0.5 })
    expect(mocks.update).toHaveBeenCalledWith({ intensity: 0.5 })
    expect(mocks.drawer).toHaveBeenCalledTimes(1)
    w.unmount()
    expect(mocks.destroy).toHaveBeenCalledTimes(1)
  })
  it('cleans up the old animation on replacement and navigation', async () => {
    const w = mount(WalletFigure, { props: { kind: 'drawer' } })
    await w.setProps({ kind: 'settle' })
    expect(mocks.destroy).toHaveBeenCalledTimes(1)
    expect(mocks.settle).toHaveBeenCalledTimes(1)
    w.unmount()
    expect(mocks.destroy).toHaveBeenCalledTimes(2)
  })
})
