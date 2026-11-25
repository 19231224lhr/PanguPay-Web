import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import WalletFigure from '@/components/WalletFigure.vue'

const mocks = vi.hoisted(() => ({
  drawer: vi.fn<(...args: unknown[]) => unknown>(),
  settle: vi.fn<(...args: unknown[]) => unknown>(),
  destroy: vi.fn<(...args: unknown[]) => unknown>(),
  update: vi.fn<(...args: unknown[]) => unknown>(),
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
  it('starts the idle animation and updates intensity without remounting', async () => {
    const w = mount(WalletFigure, { props: { kind: 'drawer' } })
    expect(mocks.drawer).toHaveBeenCalledWith(w.element, { intensity: 0.35, play: true })
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
