export interface ReOnlineResult {
  isInGroup: boolean
  groupId?: string
}

export interface OrganizationEntryInput {
  reOnline: ReOnlineResult
  addressGroupIds: string[]
  localSkipped?: boolean
}

interface EntryPreferenceStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const noGroupChoiceKey = (accountId: string) => `pangupay:wallet-entry:no-group:${accountId}`

export function formatWalletEntryError(cause: unknown): string {
  if (
    cause instanceof TypeError ||
    /failed to fetch|networkerror|load failed/i.test(String(cause))
  ) {
    return '无法连接到本地服务，请确认后端已启动后重试。'
  }
  if (cause instanceof Error && cause.message.trim()) return cause.message
  return '无法恢复组织状态，请稍后重试。'
}

export function hasLocalNoGroupChoice(
  accountId: string,
  storage: EntryPreferenceStorage = localStorage,
): boolean {
  return storage.getItem(noGroupChoiceKey(accountId)) === '1'
}

export function rememberLocalNoGroupChoice(
  accountId: string,
  storage: EntryPreferenceStorage = localStorage,
): void {
  storage.setItem(noGroupChoiceKey(accountId), '1')
}

export type OrganizationEntryDecision =
  | { kind: 'member'; groupId?: string }
  | { kind: 'no-group' }
  | { kind: 'repair-no-group' }
  | { kind: 'chooser' }
  | { kind: 'inconsistent'; groupIds: string[] }

export function resolveOrganizationEntry({
  reOnline,
  addressGroupIds,
  localSkipped = false,
}: OrganizationEntryInput): OrganizationEntryDecision {
  if (reOnline.isInGroup) return { kind: 'member', groupId: reOnline.groupId }

  const groupIds = [...new Set(addressGroupIds.map((id) => id.trim()).filter(Boolean))]
  const organizationIds = groupIds.filter((id) => id !== '0' && id !== '1')
  if (organizationIds.length) return { kind: 'inconsistent', groupIds: organizationIds }
  if (groupIds.includes('1')) return { kind: 'no-group' }
  return localSkipped ? { kind: 'repair-no-group' } : { kind: 'chooser' }
}
