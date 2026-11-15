import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import AppSelect from '@/components/AppSelect.vue'
import WalletAccountMenu from '@/components/WalletAccountMenu.vue'

describe('menu continuity', () => {
  it('scrolls the active keyboard option into view without opening motion', async () => {
    const scroll = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scroll,
    })
    const wrapper = mount(AppSelect, {
      attachTo: document.body,
      props: {
        id: 'long',
        label: '地址',
        modelValue: '0',
        options: Array.from({ length: 30 }, (_, i) => ({ value: String(i), label: `地址 ${i}` })),
      },
    })
    await wrapper.get('button').trigger('keydown', { key: 'ArrowDown' })
    await wrapper.get('[role=listbox]').trigger('keydown', { key: 'End' })
    await flushPromises()
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest', behavior: 'instant' })
    expect(wrapper.attributes('data-keyboard')).toBe('true')
    expect(wrapper.get('[role=listbox]').attributes('aria-activedescendant')).toContain('option-29')
    wrapper.unmount()
  })
  it('moves focus into the account menu and restores the trigger on Escape', async () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const wrapper = mount(WalletAccountMenu, {
      attachTo: document.body,
      props: { open: false, lockLabel: '锁定' },
    })
    await wrapper.setProps({ open: true })
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('[role=menuitem]').element)
    await wrapper.get('[role=menuitem]').trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(document.activeElement).toBe(trigger)
    wrapper.unmount()
    trigger.remove()
  })
})
