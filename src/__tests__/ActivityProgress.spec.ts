import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ActivityProgress from '@/components/ActivityProgress.vue'
import type { TransferProgress } from '@/transfer/journal'
import { buildTransferTimeline } from '@/transfer/workflow'

const progress = (extra: Partial<TransferProgress> = {}): TransferProgress => ({
  draftID: 'test',
  txID: 'a'.repeat(64),
  mode: 'quick',
  phase: 'registered',
  amount: '1',
  recipient: 'recipient',
  acceptedAt: 1789277256321,
  backendAcceptedAt: 1789277256321,
  registeredAt: 1789277256381,
  updatedAt: 1789277256400,
  ...extra,
})

describe('ActivityProgress', () => {
  it.each(['accepted', 'registered', 'spend-ready', 'settled', 'failed'] as const)(
    'uses the send-page timeline for %s',
    (phase) => {
      const p = progress({ phase })
      const wrapper = mount(ActivityProgress, { props: { progress: p } })
      expect(
        wrapper.findAll('[data-activity-step]').map((el) => el.attributes('data-state')),
      ).toEqual(buildTransferTimeline(p).map((step) => step.state))
    },
  )
  it('shows registration and timing without claiming receiver availability', () => {
    const wrapper = mount(ActivityProgress, { props: { progress: progress() } })
    expect(wrapper.text()).not.toContain('等待入口确认')
    expect(wrapper.text()).toContain('登记确认耗时 60 ms')
    expect(wrapper.get('[data-activity-step="organization"]').text()).toContain('TXCer 登记时间')
    expect(wrapper.get('[data-activity-step="received"]').text()).toContain('入口接收时间')
    expect(wrapper.find('[data-activity-step="recipient-ready"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-activity-step]')[0]?.attributes('data-state')).toBe('complete')
  })
  it('does not manufacture recipient time from settlement', () => {
    const wrapper = mount(ActivityProgress, {
      props: {
        progress: progress({
          phase: 'settled',
          settledAt: 1789277346400,
        }),
      },
    })
    expect(wrapper.find('[data-activity-step="recipient-ready"]').exists()).toBe(false)
    const settlement = wrapper.get('[data-activity-step="settlement"]')
    expect(settlement.text()).toContain('本机观察到结算的时间')
    expect(settlement.attributes('data-state')).toBe('complete')
  })
  it('renders recorded spend-readiness and its elapsed time', () => {
    const wrapper = mount(ActivityProgress, {
      props: {
        progress: progress({
          phase: 'spend-ready',
          spendReadyAt: 1789277256450,
          backendSpendReadyAt: 1789277256421,
        }),
      },
    })
    expect(wrapper.text()).toContain('100 ms')
    const ready = wrapper.get('[data-activity-step="recipient-ready"]')
    expect(ready.attributes('data-state')).toBe('complete')
    expect(ready.text()).toContain('收款方可用时间')
  })
  it('keeps opaque backend activity opaque', () => {
    const wrapper = mount(ActivityProgress, { props: { status: 'Confirmed' } })
    expect(wrapper.findAll('[data-activity-step]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Confirmed')
    expect(wrapper.find('.activity-times').exists()).toBe(false)
  })
  it('shows cross-chain target finality separately', () => {
    const wrapper = mount(ActivityProgress, {
      props: {
        progress: progress({
          mode: 'cross',
          phase: 'target-accepted',
          lightTxHash: 'b'.repeat(64),
        }),
      },
    })
    expect(wrapper.text()).toContain('目标链到账')
    expect(wrapper.get('[data-activity-step="target-confirmed"]').text()).toContain('目标链到账时间')
    expect(wrapper.text()).not.toContain('TXCer')
  })
})

it.each(['registered', 'settled'] as const)(
  'omits the optional recipient milestone when evidence is missing for %s',
  (phase) => {
    const wrapper = mount(ActivityProgress, {
      props: {
        progress: progress({
          phase,
          settledAt: phase === 'settled' ? 1789277346400 : undefined,
          backendConsensusMillis: 66,
        }),
      },
    })
    expect(wrapper.find('[data-activity-step="recipient-ready"]').exists()).toBe(false)
    expect(wrapper.text().includes('共识阶段耗时 66 ms')).toBe(phase === 'settled')
    expect(wrapper.text()).not.toContain('结算耗时')
  },
)
