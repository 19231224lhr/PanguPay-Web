import i18n from './index'
import { walletMessages } from './walletMessages'
import { walletText as japanese } from './ja-JP'
import { walletText as spanish } from './es-ES'
import { walletText as french } from './fr-FR'

type WalletTextKey = keyof (typeof walletMessages)['zh-CN']

export function organizationLabel(organization?: { id: string; name?: string }): string {
  if (!organization) return ''
  const { id, name } = organization
  return !name || name === `担保组织 ${id}` ? wt('w148', [id]) : name
}

export function addressLabel(label: string | undefined, ordinal: number): string {
  return label === `地址 ${ordinal}` ? wt('w516', [ordinal]) : label || ''
}

export function walletLocale(): string {
  return i18n.global.locale.value
}
export function wt(key: keyof (typeof walletMessages)['zh-CN'], values: unknown[] = []): string {
  return i18n.global.t('walletText.' + key, values)
}
export function wCount(key: keyof (typeof walletMessages)['zh-CN'], count: number): string {
  return i18n.global.t('walletText.' + key, count)
}
const sourceKeys = new Map<string, WalletTextKey>()
for (const catalog of [walletMessages['zh-CN'], walletMessages['en-US'], japanese, spanish, french]) {
  for (const key of Object.keys(catalog) as WalletTextKey[]) {
    sourceKeys.set(catalog[key], key)
  }
}

// These diagnostics come from wallet storage and validation, including older persisted records.
const serviceErrors: Record<string, WalletTextKey> = {
  'wallet unlock failed': 'w288',
  'wallet must be unlocked': 'w510',
  'wallet must be unlocked before exporting recovery material': 'w510',
  'wallet is not configured': 'walletNotConfigured',
  'wallet address is unknown': 'unknownWalletAddress',
  'unsupported address type': 'addressTypeUnsupported',
  'password must contain between 12 and 1024 UTF-8 bytes': 'passwordByteLength',
  'cannot open wallet database': 'walletDatabaseOpenFailed',
  'wallet database request failed': 'walletDatabaseRequestFailed',
  'wallet database transaction failed': 'walletDatabaseTransactionFailed',
  'account private scalar must be 32 bytes': 'accountKeyLength',
  'address RootSeed must be exactly 32 bytes': 'seedLength',
  '账户私钥 必须为 32 字节。': 'accountKeyLength',
  '账户私钥 必须为32字节。': 'accountKeyLength',
  '地址 RootSeed 必须为32字节。': 'seedLength',
}
for (const [message, key] of Object.entries(serviceErrors)) sourceKeys.set(message, key)

const parameterizedMessages: ReadonlyArray<[RegExp, WalletTextKey]> = [
  [/^地址 (\S+) 的币种类型无效。$/, 'addressCoinTypeInvalid'],
  [/^地址 (\S+) 与 RootSeed 不匹配。$/, 'addressSeedInvalid'],
  [/^地址 (\S+) 的 RootSeed 必须为 32 字节。$/, 'addressSeedLength'],
  [/^网络尚未确认新的组织状态：(.+)$/, 'organizationUnconfirmed'],
  [/^Gateway request failed with status (\d{3})$/, 'gatewayStatusError'],
  [/^Asset type ([\w?-]+)$/, 'assetType'],
]
/** Localize known application messages retained in state; never translate arbitrary user data. */
export function wl(value: string | undefined): string {
  if (value === undefined) return ''
  const key = sourceKeys.get(value)
  if (key) return wt(key)
  for (const [pattern, messageKey] of parameterizedMessages) {
    const match = pattern.exec(value)
    if (match) return wt(messageKey, match.slice(1))
  }
  return value
}
