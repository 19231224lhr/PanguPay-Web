import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TransferRoutePreview from '@/components/TransferRoutePreview.vue'

function nodes(mode: 'normal' | 'quick' | 'cross', member: boolean): string[] {
  return mount(TransferRoutePreview, { props: { mode, member } })
    .findAll('[data-route-node]')
    .map((item) => item.get('b').text())
}

describe('TransferRoutePreview', () => {
  it('distinguishes retail and member normal routing', () => {
    expect(nodes('normal', false)).toEqual(['本地签名', '委员会入口', 'GQNC 结算'])
    expect(nodes('normal', true)).toEqual(['本地签名', '担保组织', 'GQNC 结算'])
  })

  it('shows spend-ready before background settlement for quick transfer', () => {
    const wrapper = mount(TransferRoutePreview, { props: { mode: 'quick', member: true } })

    expect(wrapper.text()).toContain('TXCer 可支付')
    expect(wrapper.text()).toContain('GQNC 后台结算')
  })

  it('states the actual cross-chain restrictions', () => {
    const wrapper = mount(TransferRoutePreview, { props: { mode: 'cross', member: true } })

    expect(wrapper.text()).toContain('轻计算网络')
    expect(wrapper.text()).toContain('整数 PGC')
  })
})
