import type { OrganizationEntryInput } from './entry'

export interface WalletEntryOrganization {
  id: string
  name: string
  description?: string
}

export interface WalletEntryService {
  recover(): Promise<OrganizationEntryInput>
  listOrganizations(): Promise<WalletEntryOrganization[]>
  join(groupId: string): Promise<void>
  registerNoGroup(): Promise<void>
}

let service: WalletEntryService | undefined

export function configureWalletEntryService(next: WalletEntryService | undefined): void {
  service = next
}

export function getWalletEntryService(): WalletEntryService | undefined {
  return service
}
