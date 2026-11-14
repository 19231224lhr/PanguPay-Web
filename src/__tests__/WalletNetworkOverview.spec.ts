import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import WalletNetworkOverview from '@/components/WalletNetworkOverview.vue'

const mocks = vi.hoisted(() => ({ status: vi.fn(), organizations: vi.fn() }))
vi.mock('@/services/gatewayClient', () => ({
  GatewayClient: class {
    gqncStatus = mocks.status
  },
}))
vi.mock('@/wallet/entryService', () => ({
  getWalletEntryService: () => ({ listOrganizations: mocks.organizations }),
}))
const normal = {
  protocolVersion: 'gqnc-master-v2',
  enabled: true,
  safetyStatus: 'NORMAL',
  certifiedHeight: 12,
  quorum: 3,
  validatorCount: 4,
  currentView: 2,
}
const wrappers: ReturnType<typeof mount>[] = []
function render() {
  const wrapper = mount(WalletNetworkOverview, {
    props: { offline: false },
    global: { stubs: { RouterLink: { template: '<a><slot /></a>' }, WalletFigure: true } },
  })
  wrappers.push(wrapper)
  return wrapper
}
beforeEach(() => {
  mocks.status.mockReset().mockResolvedValue(normal)
  mocks.organizations.mockReset().mockResolvedValue([{ id: 'g1', name: '测试组织' }])
})
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
  vi.useRealTimers()
})

describe('Overview network evidence', () => {
  it('renders authoritative summaries and links to detail pages', async () => {
    const w = render()
    await flushPromises()
    const chain = w.get('section[aria-labelledby="overview-chain"]')
    expect(chain.text()).toContain('12')
    expect(chain.text()).toContain('3 / 4')
    expect(chain.text()).toContain('正常')
    expect(w.get('section[aria-labelledby="overview-organization"]').text()).toContain('1 个')
    expect(w.find('details').exists()).toBe(false)
    expect(w.find('a[to="/wallet/organization"]').exists()).toBe(true)
    expect(w.find('a[to="/wallet/blockchain"]').exists()).toBe(true)
    expect(w.text()).toContain('独立账户')
  })
  it('does not retain healthy or height values when refresh fails, and recovers on retry', async () => {
    const w = render()
    await flushPromises()
    mocks.status.mockRejectedValueOnce(new Error('Offline'))
    await w.get('button[aria-label="刷新认证链"]').trigger('click')
    await flushPromises()
    const chain = w.get('section[aria-labelledby="overview-chain"]')
    expect(chain.text()).toContain('暂不可用')
    expect(chain.text()).not.toContain('正常')
    expect(chain.text()).not.toContain('3 / 4')
    await w.get('button[aria-label="刷新认证链"]').trigger('click')
    await flushPromises()
    expect(chain.text()).toContain('正常')
  })
  it('rejects empty status payload instead of inventing a zero-height chain', async () => {
    mocks.status.mockResolvedValue({})
    mocks.organizations.mockRejectedValue(new Error('Offline'))
    const w = render()
    await flushPromises()
    expect(w.text()).toContain('暂不可用')
    expect(w.text()).toContain('组织目录暂不可用')
    expect(w.text()).not.toContain('0 个')
  })
  it('stops background refresh when the overview unmounts', async () => {
    vi.useFakeTimers()
    const w = render()
    await flushPromises()
    w.unmount()
    wrappers.splice(wrappers.indexOf(w), 1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(mocks.status).toHaveBeenCalledTimes(1)
  })
})
