import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import WalletActivityView from '@/views/wallet/WalletActivityView.vue'

const rows = ref([
  { id: '1', title: '等待结算', status: '等待结算', phase: 'accepted', amount: '1', timestamp: 0 },
  { id: '2', title: '旧记录', status: '未知', amount: '1', timestamp: 0 },
  { id: '3', title: '完成记录', status: '已结算', phase: 'settled', amount: '1', timestamp: 0 },
  {
    id: '4',
    title: '异常记录',
    status: '已结算',
    phase: 'settled',
    crossChainError: 'failed',
    amount: '1',
    timestamp: 0,
  },
])
vi.mock('@/composables/useWalletActivities', () => ({
  activityAssetSymbol: () => 'CAL',
  useWalletActivities: () => rows,
}))
describe('activity phase filters', () => {
  it('retains the open detail and focused summary when a transaction status changes', async () => {
    const wrapper = mount(WalletActivityView, {
      attachTo: document.body,
      global: { stubs: { WalletFigure: true, ActivityProgress: true } },
    })
    const detail = wrapper.get('details').element as HTMLDetailsElement
    detail.open = true
    const summary = wrapper.get('summary').element as HTMLElement
    summary.focus()
    rows.value[0]!.status = '担保验证完成'
    await nextTick()
    expect(wrapper.get('details').element).toBe(detail)
    expect(detail.open).toBe(true)
    expect(document.activeElement).toBe(summary)
    wrapper.unmount()
  })
  it('uses known progress, keeps unknown records in All, and prioritizes errors', async () => {
    const wrapper = mount(WalletActivityView, {
      global: { stubs: { WalletFigure: true, ActivityProgress: true } },
    })
    const buttons = wrapper.findAll('.segmented-control button')
    expect(wrapper.findAll('ol > li')).toHaveLength(4)
    await buttons[1]!.trigger('click')
    expect(wrapper.findAll('ol > li')).toHaveLength(1)
    expect(wrapper.get('ol').text()).toContain('等待结算')
    await buttons[2]!.trigger('click')
    expect(wrapper.findAll('ol > li')).toHaveLength(1)
    expect(wrapper.get('ol').text()).toContain('完成记录')
    await buttons[3]!.trigger('click')
    expect(wrapper.get('ol').text()).toContain('异常记录')
    await buttons[0]!.trigger('click')
    expect(wrapper.findAll('ol > li')).toHaveLength(4)
  })
})
