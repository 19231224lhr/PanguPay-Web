import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'
import WalletSettingsView from '@/views/wallet/WalletSettingsView.vue'

vi.mock('vue-router', () => ({ useRouter: () => ({ replace: vi.fn<() => void>() }) }))

describe('WalletSettingsView localization', () => {
  afterEach(() => {
    i18n.global.locale.value = 'zh-CN'
  })

  it('renders every settings section in English when English is selected', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    i18n.global.locale.value = 'en-US'
    const wrapper = mount(WalletSettingsView, { global: { plugins: [pinia, i18n] } })

    expect(wrapper.text()).toContain('Profile')
    expect(wrapper.text()).toContain('Wallet & access')
    expect(wrapper.text()).toContain('Export encrypted backup')
    expect(wrapper.text()).toContain('Lock now')
    expect(wrapper.text()).not.toContain('个人资料')
    expect(wrapper.text()).not.toContain('钱包与访问')
    expect(wrapper.text()).not.toContain('立即锁定')
  })
})
