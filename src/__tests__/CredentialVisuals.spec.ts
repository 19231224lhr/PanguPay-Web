import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CredentialTrustPath from '@/components/CredentialTrustPath.vue'
import ExposureShareBar from '@/components/ExposureShareBar.vue'
import type { WalletCredentialSummary } from '@/wallet/types'

const credential: WalletCredentialSummary = {
  txCerId: 'txcer-1',
  recordId: 'record-1',
  lifecycle: 'Active',
  amount: '12',
  toAddress: 'address-1',
  fastEvidenceStatus: 'Verified',
  cfaaAuditStatus: 'Pending',
  error: '',
  hasFastEvidence: true,
  hasAssignAck: true,
  hasLiabilityReceipt: true,
  hasCFAAProof: false,
  rootIds: ['root-a', 'root-b'],
  exposureShares: [
    { rootId: 'root-a', leafId: 'leaf-a', groupId: 'group', pledgeAddress: 'p', amount: '9' },
    { rootId: 'root-b', leafId: 'leaf-b', groupId: 'group', pledgeAddress: 'p', amount: '3' },
  ],
}

describe('credential visualizations', () => {
  it('keeps asynchronous CFAA separate from spend-ready evidence', () => {
    const wrapper = mount(CredentialTrustPath, { props: { credential } })

    expect(wrapper.get('[data-trust-step="fast"]').attributes('data-state')).toBe('verified')
    expect(wrapper.get('[data-trust-step="liability"]').attributes('data-state')).toBe('verified')
    expect(wrapper.get('[data-trust-step="cfaa"]').attributes('data-state')).toBe('pending')
    expect(wrapper.text()).toContain('不阻塞可支付')
  })

  it('renders exact exposure amounts with bounded proportional weights', () => {
    const wrapper = mount(ExposureShareBar, { props: { shares: credential.exposureShares } })

    expect(wrapper.text()).toContain('9 PGC')
    expect(wrapper.text()).toContain('3 PGC')
    expect(wrapper.get('[data-share="leaf-a"]').attributes('style')).toContain(
      '--share-weight: 7500',
    )
    expect(wrapper.get('[data-share="leaf-b"]').attributes('style')).toContain(
      '--share-weight: 2500',
    )
  })
})
