import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ReceiveAddressQR from '@/components/ReceiveAddressQR.vue'

describe('ReceiveAddressQR', () => {
  it('builds a local QR matrix and updates it with the selected address', async () => {
    const wrapper = mount(ReceiveAddressQR, { props: { address: 'pgc-address-one' } })

    expect(wrapper.get('svg').attributes('aria-label')).toContain('pgc-address-one')
    const firstPath = wrapper.get('[data-qr-modules]').attributes('d')
    expect(firstPath).toBeTruthy()

    await wrapper.setProps({ address: 'pgc-address-two' })
    expect(wrapper.get('[data-qr-modules]').attributes('d')).not.toBe(firstPath)
  })

  it('does not invent a code for an empty address', () => {
    const wrapper = mount(ReceiveAddressQR, { props: { address: '' } })

    expect(wrapper.find('svg').exists()).toBe(false)
    expect(wrapper.text()).toContain('没有可用地址')
  })
})
