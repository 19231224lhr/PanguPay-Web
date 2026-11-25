import type { InjectionKey, Ref } from 'vue'

export const overviewEditRequestKey: InjectionKey<Ref<boolean>> = Symbol('overviewEditRequest')

export const overviewCards = {
  send: 'balance',
  receive: 'balance',
  security: 'security',
  activity: 'activity',
  addresses: 'addresses-preview',
  organization: 'organization',
  blockchain: 'blockchain',
} as const

export type OverviewPanel = keyof typeof overviewCards

export function panelFromHash(hash: string): OverviewPanel | undefined {
  const panel = hash.slice(1)
  return Object.prototype.hasOwnProperty.call(overviewCards, panel)
    ? (panel as OverviewPanel)
    : undefined
}
