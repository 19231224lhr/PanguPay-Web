import { wt } from '@/i18n/walletText'
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
      get actionLabel() {
        return wt('w237')
      },
      code: 'insufficient-balance',
      get message() {
        return wt('w396')
      },
      get title() {
        return wt('w397')
      },
      tone: 'warning',
    },
  },
  {
    pattern: /input already reserved|reservation conflict|上一笔交易仍在处理|输入.*等待/i,
    issue: {
      action: 'view-activity',
      get actionLabel() {
        return wt('w237')
      },
      code: 'input-reserved',
      get message() {
        return wt('w398')
      },
      get title() {
        return wt('w399')
      },
      tone: 'warning',
    },
  },
  {
    pattern:
      /quick transfer requires|cross-chain transfer requires a guarantor|需要先加入担保组织/i,
    issue: {
      action: 'open-organization',
      get actionLabel() {
        return wt('w111')
      },
      code: 'organization-required',
      get message() {
        return wt('w400')
      },
      get title() {
        return wt('w401')
      },
      tone: 'warning',
    },
  },
  {
    pattern:
      /invalid light-compute address|recipient is required|收款地址.*(无效|需要)|请输入有效的\s*(0x|40\s*位地址)|胶囊地址(?:格式|校验和|载荷长度)无效|胶囊地址(?:签名验证|还原)失败/i,
    issue: {
      code: 'recipient-invalid',
      get message() {
        return wt('w402')
      },
      get title() {
        return wt('w403')
      },
      tone: 'danger',
    },
  },
  {
    pattern:
      /requires whole (?:PGC|CAL)|supports (?:PGC|CAL) only|cannot use TXCer|跨链转账仅支持/i,
    issue: {
      code: 'cross-chain-constraint',
      get message() {
        return wt('w404')
      },
      get title() {
        return wt('w405')
      },
      tone: 'warning',
    },
  },
  {
    pattern: /amount must be positive|decimal|precision|有效金额|最多 8 位小数/i,
    issue: {
      code: 'amount-invalid',
      get message() {
        return wt('w406')
      },
      get title() {
        return wt('w407')
      },
      tone: 'warning',
    },
  },
  {
    pattern:
      /recipient is not registered|seed metadata|resource conflict: hard seed_step|来源地址|地址登记服务|地址.*未.*登记/i,
    issue: {
      action: 'retry',
      get actionLabel() {
        return wt('w408')
      },
      code: 'address-state',
      get message() {
        return wt('w409')
      },
      get title() {
        return wt('w410')
      },
      tone: 'warning',
    },
  },
  {
    pattern: /failed to fetch|network|timeout|offline|无法连接|服务.*不可用|尚未就绪/i,
    issue: {
      action: 'retry',
      get actionLabel() {
        return wt('w65')
      },
      code: 'network',
      get message() {
        return wt('w411')
      },
      get title() {
        return wt('w412')
      },
      tone: 'warning',
    },
  },
  {
    pattern: /signature|signing|private key|seed|签名|密钥/i,
    issue: {
      action: 'unlock',
      get actionLabel() {
        return wt('w413')
      },
      code: 'signing',
      get message() {
        return wt('w414')
      },
      get title() {
        return wt('w415')
      },
      tone: 'danger',
    },
  },
  {
    pattern: /rejected|提交未完成|交易未被接收|提交结果暂时未知/i,
    issue: {
      action: 'view-activity',
      get actionLabel() {
        return wt('w416')
      },
      code: 'submission-rejected',
      get message() {
        return wt('w417')
      },
      get title() {
        return wt('w418')
      },
      tone: 'danger',
    },
  },
]

export function describeTransferIssue(raw: string): TransferIssue {
  const normalized = raw.trim()
  return (
    rules.find(({ pattern }) => pattern.test(normalized))?.issue ?? {
      code: 'unknown',
      message: wt('w419'),
      title: wt('w420'),
      tone: 'warning',
    }
  )
}
