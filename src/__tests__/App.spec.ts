import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, onMounted, onUnmounted } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../App.vue'
import i18n from '@/i18n'
import WalletAccessFrame from '@/components/WalletAccessFrame.vue'
import { unlockPhase } from '@/composables/useEntryUnlock'

describe('App entry experience', () => {
  beforeEach(() => {
    vi.stubGlobal('innerWidth', 1200)
    vi.stubGlobal('innerHeight', 800)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    )
  })
  afterEach(() => vi.unstubAllGlobals())
  it('retains one particle scene across access routes and releases it on wallet entry', async () => {
    const mounted = vi.fn<(...args: unknown[]) => unknown>(),
      disposed = vi.fn<(...args: unknown[]) => unknown>()
    const figure = defineComponent({
      props: ['shape'],
      setup() {
        onMounted(mounted)
        onUnmounted(disposed)
      },
      template: '<canvas :data-shape="shape" />',
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'landing', component: { template: '<p>Welcome</p>' } },
        {
          path: '/setup',
          name: 'wallet-setup',
          component: {
            components: { WalletAccessFrame },
            template: '<WalletAccessFrame figure="create"><p>Create form</p></WalletAccessFrame>',
          },
        },
        {
          path: '/unlock',
          name: 'wallet-unlock',
          component: {
            components: { WalletAccessFrame },
            template: '<WalletAccessFrame figure="key"><p>Login form</p></WalletAccessFrame>',
          },
        },
        {
          path: '/wallet',
          name: 'wallet-overview',
          component: { template: '<main>Account overview</main>' },
        },
      ],
    })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(App, {
      global: { plugins: [router, i18n], stubs: { EntryParticleFigure: figure } },
    })
    await flushPromises()
    const canvas = wrapper.get('canvas').element
    const backdrop = wrapper.get('.entry-experience__backdrop').element
    const cameraFrame = wrapper.get('.entry-experience__figure').attributes('style')
    expect(cameraFrame).toContain('position: fixed')
    await router.push('/setup')
    await flushPromises()
    expect(wrapper.get('canvas').element).toBe(canvas)
    expect(wrapper.get('.entry-experience__figure').attributes('style')).toBe(cameraFrame)
    expect(wrapper.get('canvas').attributes('data-shape')).toBe('create')
    expect(wrapper.get('.entry-experience__backdrop').element).toBe(backdrop)
    await router.push('/unlock')
    await flushPromises()
    expect(wrapper.get('canvas').element).toBe(canvas)
    expect(wrapper.get('.entry-experience__figure').attributes('style')).toBe(cameraFrame)
    expect(wrapper.get('canvas').attributes('data-shape')).toBe('key')
    expect(wrapper.get('.entry-experience__backdrop').element).toBe(backdrop)
    expect(mounted).toHaveBeenCalledTimes(1)
    vi.stubGlobal('innerWidth', 1440)
    window.dispatchEvent(new Event('resize'))
    await flushPromises()
    expect(wrapper.get('.entry-experience__figure').attributes('style')).not.toBe(cameraFrame)
    expect(wrapper.get('canvas').element).toBe(canvas)
    unlockPhase.value = 'arriving'
    await router.push('/wallet')
    await flushPromises()
    const overview = wrapper.get('main').element
    expect(wrapper.get('canvas').element).toBe(canvas)
    expect(disposed).not.toHaveBeenCalled()
    unlockPhase.value = 'revealing'
    await flushPromises()
    expect(wrapper.get('canvas').element).toBe(canvas)
    unlockPhase.value = 'idle'
    await flushPromises()
    expect(wrapper.find('canvas').exists()).toBe(false)
    expect(wrapper.get('main').element).toBe(overview)
    expect(disposed).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toBe('Account overview')
    wrapper.unmount()
  })
})
