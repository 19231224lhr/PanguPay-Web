import { walletLocale, wt } from './walletText'

export function groupedPledgeAmount(value?: string): string {
  if (!value) return wt('w74')
  const parts = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value)
  if (!parts) return value + ' CAL'
  const [, sign, integer, fraction] = parts
  const format = new Intl.NumberFormat(walletLocale())
  const whole = format.format(BigInt(integer!))
  const separator = format.formatToParts(1.1).find((part) => part.type === 'decimal')?.value
  return sign + whole + (fraction ? (separator ?? '.') + fraction : '') + ' CAL'
}
