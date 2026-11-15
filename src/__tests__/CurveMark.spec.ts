import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CurveMark from '../components/CurveMark.vue'

describe('CurveMark motion lifecycle', () => {
  let intersect: (entries: { isIntersecting: boolean }[]) => void
  let reduced = false
  let mediaChange: () => void
  let callbacks: Map<number, FrameRequestCallback>
  let sequence = 0
  function advance(now: number) {
    const pending = [...callbacks.values()]
    callbacks.clear()
    pending.forEach((fn) => fn(now))
  }
  beforeEach(() => {
    callbacks = new Map()
    reduced = false
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
      callbacks.set(++sequence, fn)
      return sequence
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id))
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return reduced
      },
      addEventListener: (_: string, fn: () => void) => {
        mediaChange = fn
      },
      removeEventListener: vi.fn<() => void>(),
    }))
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(fn: typeof intersect) {
          intersect = fn
        }
        observe() {}
        disconnect() {}
      },
    )
  })
  afterEach(() => vi.unstubAllGlobals())
  it('animates only while visible and cancels work when removed', () => {
    const wrapper = mount(CurveMark)
    expect(callbacks.size).toBe(0)
    intersect([{ isIntersecting: true }])
    advance(100)
    const first = wrapper.find('circle').attributes('cx')
    advance(164)
    expect(wrapper.find('circle').attributes('cx')).not.toBe(first)
    intersect([{ isIntersecting: false }])
    expect(callbacks.size).toBe(0)
    intersect([{ isIntersecting: true }])
    wrapper.unmount()
    expect(callbacks.size).toBe(0)
  })
  it('keeps a visible static curve when motion is reduced, including changes at runtime', () => {
    reduced = true
    const wrapper = mount(CurveMark)
    intersect([{ isIntersecting: true }])
    expect(callbacks.size).toBe(0)
    expect(wrapper.find('path').attributes('d')).toContain('Z')
    reduced = false
    mediaChange()
    expect(callbacks.size).toBe(1)
    reduced = true
    mediaChange()
    expect(callbacks.size).toBe(0)
    wrapper.unmount()
  })
  it('finishes a dialog flourish and leaves the semantic symbol visible', () => {
    const wrapper = mount(CurveMark, { props: { motion: 'once' }, slots: { default: '<b>✓</b>' } })
    intersect([{ isIntersecting: true }])
    for (let time = 100; time < 1500; time += 50) advance(time)
    expect(callbacks.size).toBe(0)
    expect(wrapper.find('.curve-mark__symbol').text()).toBe('✓')
    expect(wrapper.find('g g').attributes('opacity')).toBe('0')
    wrapper.unmount()
  })
})
