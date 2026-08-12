import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, markRaw } from 'vue'

import AppButton from '@/components/AppButton.vue'
import AppSelect from '@/components/AppSelect.vue'
import AppShell from '@/components/AppShell.vue'
import BrandMark from '@/components/BrandMark.vue'
import FormField from '@/components/FormField.vue'
import InlineNotice from '@/components/InlineNotice.vue'
import ProgressTimeline from '@/components/ProgressTimeline.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import WalletAccessFrame from '@/components/WalletAccessFrame.vue'
import WalletBalanceField from '@/components/WalletBalanceField.vue'
import WalletReceiveView from '@/views/wallet/WalletReceiveView.vue'
import WalletSendView from '@/views/wallet/WalletSendView.vue'

describe('foundation components', () => {
  it('renders the original PanguPay silhouette as a current-color mask', () => {
    const wrapper = mount(BrandMark, {
      props: { label: 'PanguPay', size: 48, transitionName: 'pangu-mobile-brand' },
    })
    expect(wrapper.find('.brand-mark__shape').exists()).toBe(true)
    expect(wrapper.find('svg').exists()).toBe(false)
    expect(wrapper.attributes('style')).toContain('--brand-size: 48px')
    expect(wrapper.attributes('style')).toContain('view-transition-name: pangu-mobile-brand')
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

  it('settles a sync halo into the existing top-right value field', async () => {
    const wrapper = mount(WalletBalanceField, {
      props: {
        animate: true,
        asset: {
          name: 'Pangu Coin',
          network: 'Transfer Area',
          symbol: 'PGC',
          total: '12',
          txCerSpendable: '2',
          utxoAvailable: '10',
        },
      },
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    })

    expect(wrapper.classes()).toContain('wallet-balance-field--settle')
    expect(wrapper.find('.wallet-balance-field__settle').exists()).toBe(true)
    expect(wrapper.find('.wallet-balance-field__sweep').exists()).toBe(false)

    await wrapper.get('.wallet-balance-field__settle').trigger('animationend')
    expect(wrapper.emitted('sweepEnd')).toHaveLength(1)
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

  it('shows an observed milestone duration without mixing it into the status copy', () => {
    const wrapper = mount(ProgressTimeline, {
      props: {
        items: [
          {
            label: '收款方已到账可用',
            detail: 'TXCer 已完成原子登记，可立即再次支付。',
            meta: '接收 → 可用 · 86 ms',
            state: 'complete',
          },
        ],
      },
    })

    expect(wrapper.get('.timeline__content strong').text()).toBe('收款方已到账可用')
    expect(wrapper.get('.timeline__meta').text()).toBe('接收 → 可用 · 86 ms')
  })

  it('moves one shared selection lens across segmented options', async () => {
    const wrapper = mount(SegmentedControl, {
      props: {
        label: '导入方式',
        modelValue: 'wallet',
        options: [
          { label: 'wallet.json', value: 'wallet' },
          { label: '私钥与 RootSeed', value: 'private' },
        ],
      },
    })

    expect(wrapper.findAll('[data-segment-indicator]')).toHaveLength(1)
    expect(wrapper.get('fieldset').attributes('style')).toContain('--segment-count: 2')
    expect(wrapper.get('fieldset').attributes('style')).toContain('--segment-index: 0')

    await wrapper.setProps({ modelValue: 'private' })

    expect(wrapper.get('fieldset').attributes('style')).toContain('--segment-index: 1')
  })

  it('opens an anchored select and commits a keyboard choice', async () => {
    const wrapper = mount(AppSelect, {
      attachTo: document.body,
      props: {
        id: 'source-address',
        label: '来源地址',
        modelValue: 'address-a',
        options: [
          { label: 'PGC · 地址 1', description: 'address-a', value: 'address-a' },
          { label: 'PGC · 地址 2', description: 'address-b', value: 'address-b' },
        ],
      },
    })

    const trigger = wrapper.get('[data-select-trigger]')
    expect(trigger.attributes('aria-expanded')).toBe('false')

    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')

    const listbox = wrapper.get('[role="listbox"]')
    await listbox.trigger('keydown', { key: 'ArrowDown' })
    await listbox.trigger('keydown', { key: 'Enter' })

    const updates = wrapper.emitted('update:modelValue') ?? []
    expect(updates[updates.length - 1]).toEqual(['address-b'])
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps the branded listbox in compact viewports', async () => {
    const mediaQuery = {
      matches: true,
      addEventListener:
        vi.fn<(type: string, listener: EventListenerOrEventListenerObject) => void>(),
      removeEventListener:
        vi.fn<(type: string, listener: EventListenerOrEventListenerObject) => void>(),
    }
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mediaQuery),
    )

    try {
      const wrapper = mount(AppSelect, {
        props: {
          id: 'mobile-address',
          label: '收款地址',
          modelValue: 'address-a',
          options: [
            { label: '地址 1', value: 'address-a' },
            { label: '地址 2', value: 'address-b' },
          ],
        },
      })

      await wrapper.vm.$nextTick()
      expect(wrapper.find('select').exists()).toBe(false)
      const trigger = wrapper.get('[data-select-trigger]')
      await trigger.trigger('click')
      await wrapper.findAll('[role="option"]')[1]?.trigger('click')
      expect(wrapper.emitted('update:modelValue')).toEqual([['address-b']])
      wrapper.unmount()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('uses the shared select for source addresses on the send page', () => {
    setActivePinia(createPinia())
    const wrapper = mount(WalletSendView)

    expect(wrapper.findComponent(AppSelect).exists()).toBe(true)
    expect(wrapper.find('.select-field').exists()).toBe(false)
  })

  it('uses the shared select for receive addresses on the receive page', () => {
    setActivePinia(createPinia())
    const wrapper = mount(WalletReceiveView)

    expect(wrapper.findComponent(AppSelect).exists()).toBe(true)
    expect(wrapper.find('label > select').exists()).toBe(false)
  })

  it('supports an externally rendered error message and exposes focus control', () => {
    const wrapper = mount(FormField, {
      attachTo: document.body,
      props: {
        describedBy: 'unlock-feedback',
        id: 'unlock-password',
        invalid: true,
        label: '钱包密码',
        modelValue: '',
        type: 'password',
      },
    })

    const input = wrapper.get('input')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toContain('unlock-feedback')
    ;(wrapper.vm as unknown as { focus: () => void }).focus()
    expect(document.activeElement).toBe(input.element)
    wrapper.unmount()
  })

  it('announces a destructive inline error without reducing it to raw backend text', () => {
    const wrapper = mount(InlineNotice, {
      props: {
        tone: 'danger',
        title: '无法解锁钱包',
      },
      slots: {
        default: '密码不正确，或钱包文件已损坏。',
      },
    })

    expect(wrapper.attributes('role')).toBe('alert')
    expect(wrapper.get('.inline-notice__title').text()).toBe('无法解锁钱包')
    expect(wrapper.text()).not.toContain('wallet unlock failed')
  })

  it('keeps settings at the desktop sidebar bottom and the account menu compact', async () => {
    const TestIcon = markRaw(defineComponent({ template: '<span aria-hidden="true" />' }))
    const RouterLinkStub = {
      props: ['to'],
      template: '<a :href="to"><slot /></a>',
    }
    const wrapper = mount(AppShell, {
      props: {
        accountName: 'Alice',
        accountId: '92319817',
        items: [
          { label: '总览', icon: TestIcon, to: '/wallet' },
          { label: '发送', icon: TestIcon, to: '/wallet/send' },
          { label: '活动', icon: TestIcon, to: '/wallet/activity' },
          { label: '安全', icon: TestIcon, to: '/wallet/security' },
        ],
        accountItems: [{ label: '担保组织', icon: TestIcon, to: '/wallet/organization' }],
        utilityItems: [{ label: '设置与备份', icon: TestIcon, to: '/wallet/settings' }],
        navigationLabel: '钱包导航',
      },
      global: {
        stubs: {
          PreferenceControls: true,
          RouterLink: RouterLinkStub,
        },
      },
    })

    expect(wrapper.get('[data-sidebar-utilities]').text()).toContain('设置与备份')

    await wrapper.get('button[aria-label="打开账户菜单"]').trigger('click')

    expect(wrapper.emitted('lock')).toBeUndefined()
    expect(wrapper.get('[data-account-items]').text()).toContain('担保组织')
    expect(wrapper.get('[data-account-items]').text()).not.toContain('设置与备份')
    expect(wrapper.get('[data-mobile-utilities]').text()).toContain('设置与备份')
    expect(wrapper.find('.wallet-account-menu__preferences').exists()).toBe(false)

    await wrapper.get('button[aria-label="锁定钱包"]').trigger('click')
    expect(wrapper.emitted('lock')).toHaveLength(1)
  })

  it('keeps the mobile primary navigation to three tasks plus a My entry', () => {
    const TestIcon = markRaw(defineComponent({ template: '<span aria-hidden="true" />' }))
    const RouterLinkStub = {
      props: ['to'],
      template: '<a :href="to"><slot /></a>',
    }
    const wrapper = mount(AppShell, {
      props: {
        accountName: 'Alice',
        accountId: '92319817',
        items: [
          { label: '总览', icon: TestIcon, to: '/wallet' },
          { label: '发送', icon: TestIcon, to: '/wallet/send' },
          { label: '活动', icon: TestIcon, to: '/wallet/activity' },
          { label: '安全', icon: TestIcon, to: '/wallet/security' },
        ],
        accountItems: [],
        utilityItems: [{ label: '设置', icon: TestIcon, to: '/wallet/settings' }],
        navigationLabel: '钱包导航',
      },
      global: {
        stubs: {
          PreferenceControls: true,
          RouterLink: RouterLinkStub,
        },
      },
    })

    const mobileNavigation = wrapper.get('.app-shell__bottom-nav')
    expect(mobileNavigation.findAll('a')).toHaveLength(3)
    expect(mobileNavigation.get('button').text()).toContain('我的')
  })

  it('derives the utility navigation label from the translated item', () => {
    const TestIcon = markRaw(defineComponent({ template: '<span aria-hidden="true" />' }))
    const wrapper = mount(AppShell, {
      props: {
        items: [],
        utilityItems: [{ label: 'Settings', icon: TestIcon, to: '/wallet/settings' }],
        navigationLabel: 'Wallet navigation',
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    })

    expect(wrapper.get('[data-sidebar-utilities]').attributes('aria-label')).toBe('Settings')
  })

  it('gives wallet access flows a dedicated brand plane and form plane', () => {
    const wrapper = mount(WalletAccessFrame, {
      slots: {
        default: '<section class="access-panel">Secure form</section>',
      },
      global: {
        stubs: {
          PreferenceControls: true,
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
          ValueFoldField: {
            props: ['intro', 'label', 'transitionName'],
            template:
              '<div data-access-fold :data-intro="String(intro)" :data-transition-name="transitionName">{{ label }}</div>',
          },
        },
      },
    })

    expect(wrapper.get('.wallet-access__visual').text()).toContain('PanguPay')
    expect(wrapper.get('.wallet-access__form').text()).toContain('Secure form')
    expect(wrapper.findComponent({ name: 'PreferenceControls' }).exists()).toBe(false)
    expect(wrapper.get('[data-access-fold]').attributes('data-intro')).toBe('false')
    expect(wrapper.get('[data-access-fold]').attributes('data-transition-name')).toBe(
      'pangu-value-fold',
    )
  })
})
