import { describe, expect, it } from 'vitest'

import {
  transferActivityStatus,
  transferModeLabel,
  transferResultTitle,
} from '@/transfer/presentation'

describe('transfer presentation', () => {
  it('uses the same explicit transaction type everywhere', () => {
    expect(transferModeLabel('normal')).toBe('普通转账')
    expect(transferModeLabel('quick')).toBe('快速转账')
    expect(transferModeLabel('cross')).toBe('跨链转账')
  })

  it('does not call local GQNC certification a completed cross-chain transfer', () => {
    expect(transferResultTitle('cross', 'local-certified')).toBe('跨链交易处理中')
    expect(transferActivityStatus('cross', 'local-certified')).toBe('本地已认证')
    expect(transferActivityStatus('cross', 'target-accepted')).toBe('目标链处理中')
    expect(transferResultTitle('cross', 'settled')).toBe('跨链到账完成')
    expect(transferActivityStatus('cross', 'settled')).toBe('跨链已到账')
  })

  it('keeps normal and quick settlement language distinct', () => {
    expect(transferActivityStatus('normal', 'settled')).toBe('已完成')
    expect(transferActivityStatus('quick', 'spend-ready')).toBe('收款方可用')
    expect(transferActivityStatus('quick', 'settled')).toBe('后台已结算')
    expect(transferActivityStatus('cross', 'target-accepted', 'nonce state unknown')).toBe(
      '需要人工恢复',
    )
  })
})
