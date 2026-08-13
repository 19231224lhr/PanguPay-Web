import { describe, expect, it } from 'vitest'

import { describeTransferIssue } from '@/transfer/errors'

describe('transfer issue presentation', () => {
  it.each([
    ['insufficient spendable balance', 'insufficient-balance', '可用余额不足', '降低金额'],
    ['input already reserved: utxo-1', 'input-reserved', '上一笔交易仍在处理中', '活动'],
    [
      'quick transfer requires a guarantor organization',
      'organization-required',
      '需要加入担保组织',
      '担保组织',
    ],
    ['invalid light-compute address', 'recipient-invalid', '收款地址需要检查', '0x'],
    ['Failed to fetch', 'network', '暂时无法连接服务', '填写内容'],
    [
      'resource conflict: hard seed_step:address:998',
      'address-state',
      '地址状态尚未就绪',
      '重新同步',
    ],
    ['signature is invalid', 'signing', '交易签名未完成', '重新解锁'],
  ])('classifies %s without exposing backend text', (raw, code, title, detail) => {
    const issue = describeTransferIssue(raw)
    expect(issue.code).toBe(code)
    expect(issue.title).toBe(title)
    expect(issue.message).toContain(detail)
    expect(`${issue.title}${issue.message}`).not.toContain(raw)
  })

  it('keeps cross-chain constraints specific and recoverable', () => {
    expect(describeTransferIssue('cross-chain transfer requires whole PGC')).toMatchObject({
      code: 'cross-chain-constraint',
      title: '跨链金额需要调整',
      tone: 'warning',
    })
  })

  it('treats the previous combined balance message as a balance issue', () => {
    expect(describeTransferIssue('可用余额不足，或已有输入正在等待上一笔交易完成。')).toMatchObject(
      { code: 'insufficient-balance', title: '可用余额不足' },
    )
  })

  it('uses a safe fallback for unknown internal errors', () => {
    const issue = describeTransferIssue('opaque backend stack trace')
    expect(issue).toMatchObject({
      code: 'unknown',
      title: '暂时无法准备交易',
      tone: 'warning',
    })
    expect(issue.message).not.toContain('opaque backend stack trace')
  })
})
