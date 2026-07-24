import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppButton from '@/components/AppButton.vue'
import BrandMark from '@/components/BrandMark.vue'
import FormField from '@/components/FormField.vue'

describe('foundation components', () => {
  it('renders the four-loop brand mark as labelled scalable SVG', () => {
    const wrapper = mount(BrandMark, { props: { label: 'PanguPay' } })
    expect(wrapper.find('svg').attributes('viewBox')).toBe('0 0 64 64')
    expect(wrapper.findAll('path')).toHaveLength(4)
    expect(wrapper.attributes('aria-label')).toBe('PanguPay')
  })

  it('prevents loading buttons from being submitted twice', async () => {
    const wrapper = mount(AppButton, {
      props: { loading: true },
      slots: { default: 'Continue' },
    })
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button').attributes('aria-busy')).toBe('true')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('keeps a visible label and associates errors with the input', () => {
    const wrapper = mount(FormField, {
      props: {
        id: 'recipient',
        label: 'Recipient',
        modelValue: '',
        error: 'Recipient is required',
      },
    })
    expect(wrapper.get('label').attributes('for')).toBe('recipient')
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('input').attributes('aria-describedby')).toContain('recipient-error')
  })
})
