import {
  hasLocalNoGroupChoice,
  rememberLocalNoGroupChoice,
  resolveOrganizationEntry,
  type OrganizationEntryInput,
} from './entry'

export interface WalletEntryOrganization {
  id: string
  name: string
  description?: string
}

export type WalletEntryOrganizationNodeRole = 'assign' | 'aggregation' | 'txcer' | 'guarantor'

export interface WalletEntryOrganizationNode {
  role: WalletEntryOrganizationNodeRole
  id?: string
  peerId?: string
  endpoint?: string
  status?: string
}

export interface WalletEntryOrganizationDetail extends WalletEntryOrganization {
  pledgeAmount?: string
  pledgeAddress?: string
  guarantorCount: number
  certifierCount: number
  assignAvailable: boolean
  aggregationAvailable: boolean
  assignEndpoint?: string
  aggregationEndpoint?: string
  peerGroupId?: string
  nodes: WalletEntryOrganizationNode[]
}

export interface WalletEntryService {
  recover(): Promise<OrganizationEntryInput>
  listOrganizations(): Promise<WalletEntryOrganization[]>
  organization(groupId: string, name?: string): Promise<WalletEntryOrganizationDetail>
  join(groupId: string): Promise<void>
  leave(groupId: string): Promise<void>
  registerAddress(address: string, groupId?: string): Promise<void>
  unbindAddress(address: string, groupId?: string): Promise<void>
  registerNoGroup(): Promise<void>
}

let service: WalletEntryService | undefined

export function configureWalletEntryService(next: WalletEntryService | undefined): void {
  service = next
}

export function getWalletEntryService(): WalletEntryService | undefined {
  return service
}

export async function resolveWalletArrival(
  accountId: string,
): Promise<'/wallet' | '/wallet/entry'> {
  if (!service) return '/wallet/entry'

  try {
    const decision = resolveOrganizationEntry({
      ...(await service.recover()),
      localSkipped: hasLocalNoGroupChoice(accountId),
    })
    if (decision.kind === 'no-group') {
      rememberLocalNoGroupChoice(accountId)
    }
    return decision.kind === 'member' || decision.kind === 'no-group' ? '/wallet' : '/wallet/entry'
  } catch {
    return '/wallet/entry'
  }
}
