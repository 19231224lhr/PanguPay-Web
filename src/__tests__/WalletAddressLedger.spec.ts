import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import WalletAddressLedger from '@/components/WalletAddressLedger.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useWalletStore } from '@/stores/wallet'
import { configureWalletEntryService, type WalletEntryService } from '@/wallet/entryService'

describe('WalletAddressLedger', () => {
  const service: WalletEntryService = {
    recover: vi.fn<WalletEntryService['recover']>(),
    listOrganizations: vi.fn<WalletEntryService['listOrganizations']>(),
    organization: vi.fn<WalletEntryService['organization']>(),
    join: vi.fn<WalletEntryService['join']>(),
    leave: vi.fn<WalletEntryService['leave']>(),
    registerAddress: vi.fn<WalletEntryService['registerAddress']>(),
    unbindAddress: vi.fn<WalletEntryService['unbindAddress']>(),
    registerNoGroup: vi.fn<WalletEntryService['registerNoGroup']>(),
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    configureWalletEntryService(service)
  })

  afterEach(() => configureWalletEntryService(undefined))

  it('generates and registers an address without asking again for the wallet password', async () => {
    let resolveAddress!: (value: { address: string; type: string; root_seed: string }) => void
    const pendingAddress = new Promise<{ address: string; type: string; root_seed: string }>(
      (resolve) => {
        resolveAddress = resolve
      },
    )
    const wallet = useWalletStore()
    wallet.lifecycle = 'unlocked'
    const dashboard = useDashboardStore()
    vi.spyOn(wallet, 'addAddress').mockReturnValue(pendingAddress)
    vi.spyOn(wallet, 'setAddressMetadata').mockResolvedValue()
    vi.spyOn(dashboard, 'sync').mockResolvedValue()

    const wrapper = mount(WalletAddressLedger, { global: { stubs: { WalletFigure: true } } })
    const createToggle = wrapper
      .findAll('button')
      .find((button) => button.text().includes('新建地址'))
    await createToggle!.trigger('click')

    expect(wrapper.find('input[type="password"]').exists()).toBe(false)
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('form.address-create').trigger('submit')
    expect(wallet.addAddress).toHaveBeenCalledExactlyOnceWith(0)
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()

    resolveAddress({ address: 'new-address', type: '0', root_seed: 'root-seed' })
    await flushPromises()
    expect(service.registerAddress).toHaveBeenCalledWith('new-address', undefined)
    expect(wrapper.find('form.address-create').exists()).toBe(false)
  })
})
