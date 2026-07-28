export type WalletLifecycle = 'absent' | 'locked' | 'unlocked'

export interface WalletAddressRecord {
  address: string
  type: string
  root_seed: string
}

export interface WalletRecord {
  account_id: string
  account_private_scalar: string
  addresses: WalletAddressRecord[]
}

export interface WalletRecoveryKit {
  version: 1
  kind: 'pangu-wallet-recovery'
  wallet: WalletRecord
}

export interface WalletKeystoreEnvelope {
  version: 1
  kind: 'wallet'
  id: string
  public: { account_id: string }
  crypto: {
    kdf: {
      name: 'argon2id'
      time: 3
      memory_kib: 65536
      threads: 4
      key_len: 32
      salt: string
    }
    nonce: string
  }
  ciphertext: string
}

export interface WalletAssetBalance {
  symbol: string
  name: string
  total: string
  utxoAvailable: string
  txCerSpendable: string
  network: string
}

export interface WalletAddressSummary {
  address: string
  type: string
  balance: string
  txCerBalance: string
}

export interface WalletSecuritySummary {
  spendReady: string
  credentialStatus: 'normal' | 'warning'
  pendingAudits: number
  isolatedCount: number
}

export interface WalletActivity {
  id: string
  title: string
  amount: string
  coinType?: number
  asset?: string
  direction: 'in' | 'out'
  status: string
  timestamp: number
}

export interface OrganizationSummary {
  id: string
  name: string
  role: string
}

export interface WalletExposureShareSummary {
  rootId: string
  leafId: string
  groupId: string
  pledgeAddress: string
  amount: string
}

export interface WalletCredentialSummary {
  txCerId: string
  recordId: string
  lifecycle: string
  amount: string
  toAddress: string
  fastEvidenceStatus: 'Pending' | 'Verified' | 'Failed'
  cfaaAuditStatus: 'Pending' | 'Verified' | 'Failed' | 'Unavailable'
  error: string
  hasFastEvidence: boolean
  hasAssignAck: boolean
  hasLiabilityReceipt: boolean
  hasCFAAProof: boolean
  rootIds: string[]
  exposureShares: WalletExposureShareSummary[]
}

export interface WalletDashboardSnapshot {
  accountId: string
  displayName: string
  addresses: WalletAddressSummary[]
  assets: WalletAssetBalance[]
  organization?: OrganizationSummary
  security: WalletSecuritySummary
  credentials: WalletCredentialSummary[]
  activities: WalletActivity[]
  /** Full Assign delivery envelopes retained locally for restart-safe TXCer spending. */
  receivedTXCers?: unknown[]
  updatedAt: number
  source: 'live' | 'cache' | 'empty'
}
