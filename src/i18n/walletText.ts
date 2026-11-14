import i18n from './index'
import { walletMessages } from './walletMessages'

export function walletLocale(): string {
  return i18n.global.locale.value
}
export function wt(key: keyof (typeof walletMessages)['zh-CN'], values: unknown[] = []): string {
  return i18n.global.t('walletText.' + key, values)
}
const sourceKeys = new Map(
  Object.entries(walletMessages['zh-CN']).map(([key, value]) => [value, key]),
)
/** Localize known application messages retained in state; never translate arbitrary user data. */
export function wl(value: string | undefined): string {
  if (value === undefined) return ''
  const key = sourceKeys.get(value)
  return key ? wt(key as keyof (typeof walletMessages)['zh-CN']) : value
}
