import { flushPromises, mount } from '@vue/test-utils'
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
import { useTransferStore } from '@/stores/transfer'
import { InsufficientSpendableBalanceError } from '@/transfer/core'

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

  it('keeps the cached balance readable and identifies its offline state', async () => {
    const wrapper = mount(WalletBalanceField, {
      props: {
        offline: true,
        updatedAt: 1,
        asset: {
          name: 'CAL',
          network: 'Transfer Area',
          symbol: 'CAL',
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

    expect(wrapper.get('.wallet-balance-field__amount').text()).toContain('12')
    expect(wrapper.get('.balance-sync').text()).toContain('离线快照')
    expect(wrapper.get('.balance-sync').attributes('aria-label')).toContain('缓存于')
    await wrapper.get('.balance-sync').trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
    await wrapper.setProps({ offline: false })
    expect(wrapper.get('header').text()).not.toContain('已同步')
    expect(wrapper.get('.balance-sync').text()).toContain('已同步')
    await wrapper.setProps({ panel: 'send' })
    expect(wrapper.get('.balance-sync').text()).toContain('已同步')
    wrapper.unmount()
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
          { label: 'CAL · 地址 1', description: 'address-a', value: 'address-a' },
          { label: 'CAL · 地址 2', description: 'address-b', value: 'address-b' },
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
    const wrapper = mount(WalletSendView, { global: { stubs: { WalletFigure: true } } })

    expect(wrapper.findComponent(AppSelect).exists()).toBe(true)
    expect(wrapper.find('.select-field').exists()).toBe(false)
  })

  it('places input errors next to their fields and reserves the warning card for service errors', async () => {
    setActivePinia(createPinia())
    const transfer = useTransferStore()
    const prepare = vi.spyOn(transfer, 'prepare')
    const wrapper = mount(WalletSendView, { global: { stubs: { WalletFigure: true, WalletPaymentFigure: true } } })
    try {
      await wrapper.get('form.send-form').trigger('submit')
      expect(prepare).not.toHaveBeenCalled()
      for (const field of ['send-recipient', 'send-amount']) {
        const input = wrapper.get(`#${field}`)
        expect(input.attributes('aria-invalid')).toBe('true')
        expect(input.attributes('aria-describedby')).toBe(`${field}-error`)
      }
      expect(wrapper.find('.transfer-error-notice').exists()).toBe(false)
      await wrapper.get('#send-recipient').setValue('a'.repeat(40))
      await wrapper.get('#send-amount').setValue('1')
      expect(wrapper.find('.form-field__error').exists()).toBe(false)

      await wrapper.get('#send-amount').setValue('200')
      prepare.mockImplementationOnce(async () => {
        transfer.error = '当前可用余额不足。'
        throw new InsufficientSpendableBalanceError('102', '98')
      })
      await wrapper.get('form.send-form').trigger('submit')
      await flushPromises()
      expect(wrapper.get('#send-amount-balance').text()).toBe('余额不足，还差 98 CAL')
      expect(wrapper.get('#send-amount').attributes('aria-describedby')).toBe('send-amount-balance')
      expect(wrapper.get('.send-available-total').text()).toContain('102 CAL')
      expect(wrapper.find('.transfer-error-notice').exists()).toBe(false)
      await wrapper.get('#send-amount').setValue('1')
      expect(wrapper.find('#send-amount-balance').exists()).toBe(false)

      transfer.error = 'Failed to fetch'
      await wrapper.vm.$nextTick()
      expect(wrapper.get('.transfer-error-notice').classes()).toContain('inline-notice--warning')
      expect(wrapper.get('button[type="submit"]').attributes('data-state')).toBe('idle')
    } finally {
      wrapper.unmount()
    }
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

  it('groups settings, lock and sign-out behind the footer avatar', async () => {
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
        settingsItem: { label: '设置', icon: TestIcon, to: '/wallet/settings' },
        signOutLabel: '退出钱包',
        navigationLabel: '钱包导航',
      },
      global: {
        stubs: {
          PreferenceControls: true,
          RouterLink: RouterLinkStub,
        },
      },
    })

    const footerAvatar = wrapper.get('.app-shell__footer button[aria-label="打开账户菜单"]')
    await footerAvatar.trigger('click')

    expect(wrapper.emitted('lock')).toBeUndefined()
    expect(wrapper.findAll('[role=menuitem]').map((item) => item.text())).toEqual([
      '设置', '锁定钱包', '退出钱包',
    ])

    await wrapper.findAll('[role=menuitem]')[1]!.trigger('click')
    expect(wrapper.emitted('lock')).toHaveLength(1)
    await footerAvatar.trigger('click')
    await wrapper.findAll('[role=menuitem]')[2]!.trigger('click')
    expect(wrapper.emitted('signOut')).toHaveLength(1)
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
        settingsItem: { label: '设置', icon: TestIcon, to: '/wallet/settings' },
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

  it('uses the translated settings link in the account menu', async () => {
    const TestIcon = markRaw(defineComponent({ template: '<span aria-hidden="true" />' }))
    const wrapper = mount(AppShell, {
      props: {
        items: [],
        settingsItem: { label: 'Settings', icon: TestIcon, to: '/wallet/settings' },
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

    await wrapper.get('.app-shell__account').trigger('click')
    const settings = wrapper.get('a[role=menuitem]')
    expect(settings.text()).toBe('Settings')
    expect(settings.attributes('href')).toBe('/wallet/settings')
  })

  it('keeps the access form available inside the shared entry scene', () => {
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

    expect(wrapper.find('.wallet-access__visual').exists()).toBe(true)
    expect(wrapper.get('.wallet-access__form').text()).toContain('Secure form')
    expect(wrapper.findComponent({ name: 'PreferenceControls' }).exists()).toBe(false)
    expect(wrapper.find('[data-access-fold]').exists()).toBe(false)
  })
})
