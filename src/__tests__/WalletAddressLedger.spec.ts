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

  it('clears the wallet password as soon as address creation starts', async () => {
    let resolveAddress!: (value: { address: string; type: string; root_seed: string }) => void
    const pendingAddress = new Promise<{ address: string; type: string; root_seed: string }>(
      (resolve) => {
        resolveAddress = resolve
      },
    )
    const wallet = useWalletStore()
    const dashboard = useDashboardStore()
    vi.spyOn(wallet, 'addAddress').mockReturnValue(pendingAddress)
    vi.spyOn(wallet, 'setAddressMetadata').mockResolvedValue()
    vi.spyOn(dashboard, 'sync').mockResolvedValue()

    const wrapper = mount(WalletAddressLedger)
    const createToggle = wrapper
      .findAll('button')
      .find((button) => button.text().includes('新建地址'))
    await createToggle!.trigger('click')

    const password = wrapper.get<HTMLInputElement>('#new-address-password')
    await password.setValue('correct horse battery staple')
    await wrapper.get('form.address-create').trigger('submit')

    expect(password.element.value).toBe('')

    resolveAddress({ address: 'new-address', type: '0', root_seed: 'root-seed' })
    await flushPromises()
  })
})
