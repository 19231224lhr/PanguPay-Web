export type TransferIssueTone = 'info' | 'warning' | 'danger'

export type TransferIssueAction = 'view-activity' | 'open-organization' | 'retry' | 'unlock'

export interface TransferIssue {
  action?: TransferIssueAction
  actionLabel?: string
  code:
    | 'insufficient-balance'
    | 'input-reserved'
    | 'organization-required'
    | 'recipient-invalid'
    | 'amount-invalid'
    | 'cross-chain-constraint'
    | 'address-state'
    | 'network'
    | 'signing'
    | 'submission-rejected'
    | 'unknown'
  message: string
  title: string
  tone: TransferIssueTone
}

interface TransferIssueRule {
  issue: TransferIssue
  pattern: RegExp
}

const rules: TransferIssueRule[] = [
  {
    pattern: /insufficient spendable balance|可用余额不足|余额不足/i,
    issue: {
      action: 'view-activity',
      actionLabel: '查看活动',
      code: 'insufficient-balance',
      message: '请降低金额；若刚提交过交易，也可以在活动中等待已占用的资金释放。',
      title: '可用余额不足',
      tone: 'warning',
    },
  },
  {
    pattern: /input already reserved|reservation conflict|上一笔交易仍在处理|输入.*等待/i,
    issue: {
      action: 'view-activity',
      actionLabel: '查看活动',
      code: 'input-reserved',
      message: '部分资金正由上一笔交易使用，结算完成后会自动恢复；可前往活动查看进度。',
      title: '上一笔交易仍在处理中',
      tone: 'warning',
    },
  },
  {
    pattern:
      /quick transfer requires|cross-chain transfer requires a guarantor|需要先加入担保组织/i,
    issue: {
      action: 'open-organization',
      actionLabel: '选择担保组织',
      code: 'organization-required',
      message: '加入担保组织后，才可以使用快速转账和跨链服务。',
      title: '需要加入担保组织',
      tone: 'warning',
    },
  },
  {
    pattern:
      /invalid light-compute address|recipient is required|收款地址.*(无效|需要)|请输入有效的 0x/i,
    issue: {
      code: 'recipient-invalid',
      message: '请核对完整地址；跨链收款地址应以 0x 开头。',
      title: '收款地址需要检查',
      tone: 'danger',
    },
  },
  {
    pattern: /requires whole PGC|supports PGC only|cannot use TXCer|跨链转账仅支持/i,
    issue: {
      code: 'cross-chain-constraint',
      message: '跨链仅支持整数 PGC，且不能使用 TXCer 作为输入。',
      title: '跨链金额需要调整',
      tone: 'warning',
    },
  },
  {
    pattern: /amount must be positive|decimal|precision|有效金额|最多 8 位小数/i,
    issue: {
      code: 'amount-invalid',
      message: '请输入大于 0、最多 8 位小数的金额。',
      title: '金额格式需要检查',
      tone: 'warning',
    },
  },
  {
    pattern: /recipient is not registered|seed metadata|来源地址|地址登记服务|地址.*未.*登记/i,
    issue: {
      action: 'retry',
      actionLabel: '重新同步',
      code: 'address-state',
      message: '地址资料尚未同步完整。重新同步后，填写内容会继续保留。',
      title: '地址状态尚未就绪',
      tone: 'warning',
    },
  },
  {
    pattern: /failed to fetch|network|timeout|offline|无法连接|服务.*不可用|尚未就绪/i,
    issue: {
      action: 'retry',
      actionLabel: '重新尝试',
      code: 'network',
      message: '网络或节点暂时不可用，填写内容已经保留。',
      title: '暂时无法连接服务',
      tone: 'warning',
    },
  },
  {
    pattern: /signature|signing|private key|seed|签名|密钥/i,
    issue: {
      action: 'unlock',
      actionLabel: '重新解锁',
      code: 'signing',
      message: '本机密钥状态异常，请重新解锁钱包后再试。',
      title: '交易签名未完成',
      tone: 'danger',
    },
  },
  {
    pattern: /rejected|提交未完成|交易未被接收|提交结果暂时未知/i,
    issue: {
      action: 'view-activity',
      actionLabel: '查看状态',
      code: 'submission-rejected',
      message: '入口没有确认这笔交易。你的余额不会因本次失败而被重复扣除。',
      title: '交易未被接收',
      tone: 'danger',
    },
  },
]

export function describeTransferIssue(raw: string): TransferIssue {
  const normalized = raw.trim()
  return (
    rules.find(({ pattern }) => pattern.test(normalized))?.issue ?? {
      code: 'unknown',
      message: '没有修改你的余额或交易状态，请检查输入后重试。',
      title: '暂时无法准备交易',
      tone: 'warning',
    }
  )
}
