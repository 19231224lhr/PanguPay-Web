import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ActivityProgress from '@/components/ActivityProgress.vue'

describe('ActivityProgress', () => {
  it('separates quick availability from background settlement', () => {
    const wrapper = mount(ActivityProgress, { props: { mode: 'quick', phase: 'spend-ready' } })
    const states = wrapper
      .findAll('[data-activity-step]')
      .map((item) => item.attributes('data-state'))

    expect(wrapper.text()).toContain('TXCer 可支付')
    expect(wrapper.text()).toContain('后台结算')
    expect(states).toEqual(['complete', 'complete', 'pending'])
  })

  it('does not invent transfer phases for an opaque backend activity', () => {
    const wrapper = mount(ActivityProgress, { props: { status: 'Confirmed' } })

    expect(wrapper.findAll('[data-activity-step]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Confirmed')
  })

  it('shows cross-chain target finality instead of TXCer availability', () => {
    const wrapper = mount(ActivityProgress, {
      props: { mode: 'cross', phase: 'target-accepted' },
    })

    expect(wrapper.text()).toContain('本地 GQNC 已认证')
    expect(wrapper.text()).toContain('轻计算区已接收')
    expect(wrapper.text()).toContain('目标链到账')
    expect(wrapper.text()).not.toContain('TXCer')
  })
})
