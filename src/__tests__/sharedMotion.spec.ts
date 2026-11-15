import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import AppButton from '@/components/AppButton.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import AnimatedNumber from '@/components/AnimatedNumber.vue'

describe('shared motion contracts', () => {
  it('does not infer success when a request stops loading', async () => {
    const wrapper = mount(AppButton, { props: { loading: true }, slots: { default: '审核交易' } })
    expect(wrapper.attributes('data-state')).toBe('loading')
    expect(wrapper.attributes('disabled')).toBeDefined()
    await wrapper.setProps({ loading: false })
    expect(wrapper.attributes('data-state')).toBe('idle')
    await wrapper.setProps({ status: 'error' })
    expect(wrapper.attributes('data-state')).toBe('error')
    expect(wrapper.attributes('disabled')).toBeUndefined()
    await wrapper.setProps({ status: 'success' })
    expect(wrapper.attributes('data-state')).toBe('success')
  })

  it('keeps exact values and missing data, even with rapid updates', async () => {
    const wrapper = mount(AnimatedNumber, { props: { value: '9007199254740993' } })
    expect(wrapper.get('.animated-number__accessible').text()).toBe('9007199254740993')
    await wrapper.setProps({ value: 9 })
    await wrapper.setProps({ value: 12 })
    expect(wrapper.get('.animated-number__accessible').text()).toBe('12')
    await wrapper.setProps({ value: null })
    expect(wrapper.get('.animated-number__accessible').text()).toBe('—')
  })

  it('uses keyboard selection without choosing a disabled phase', async () => {
    const wrapper = mount(SegmentedControl, {
      props: {
        modelValue: 'all',
        label: '阶段',
        semantics: 'buttons',
        compact: true,
        options: [
          { value: 'all', label: '全部', count: 12 },
          { value: 'wait', label: '等待', disabled: true },
          { value: 'done', label: '完成', count: 9 },
        ],
      },
    })
    await wrapper.get('button').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')?.slice(-1)[0]).toEqual(['done'])
    await wrapper.setProps({ modelValue: 'done' })
    expect(wrapper.attributes('style')).toContain('--segment-index: 2')
    expect(wrapper.findAll('[data-segment-indicator]')).toHaveLength(1)
  })
})
