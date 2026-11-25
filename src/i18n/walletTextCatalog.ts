import type { walletMessages } from './walletMessages'

export type WalletTextCatalog = Record<keyof (typeof walletMessages)['zh-CN'], string>
