export const overviewCardTitles = {
  balance: 'refinement10',
  security: 'w177',
  activity: 'w129',
  'addresses-preview': 'w144',
  organization: 'w86',
  blockchain: 'refinement28',
} as const

export type OverviewCardId = keyof typeof overviewCardTitles
export type OverviewCardPreference = { id: OverviewCardId; visible: boolean }
export type OverviewCardEdge = 'start' | 'end'
type OverviewCardPlacement = OverviewCardPreference & { edge?: OverviewCardEdge }

const cardIds = Object.keys(overviewCardTitles) as OverviewCardId[]
const storageKey = (accountId: string) => `pangupay:wallet-overview:${accountId}`

export function defaultOverviewLayout(): OverviewCardPreference[] {
  return cardIds.map((id) => ({ id, visible: true }))
}

export function readOverviewLayout(accountId: string): OverviewCardPreference[] {
  if (!accountId) return defaultOverviewLayout()
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey(accountId)) ?? 'null')
    if (!Array.isArray(saved)) return defaultOverviewLayout()

    const cards = new Map<OverviewCardId, OverviewCardPreference>()
    for (const item of saved as unknown[]) {
      if (!item || typeof item !== 'object' || !('id' in item) || !('visible' in item)) continue
      if (typeof item.id !== 'string' || typeof item.visible !== 'boolean') continue
      if (!Object.prototype.hasOwnProperty.call(overviewCardTitles, item.id)) continue
      const id = item.id as OverviewCardId
      if (!cards.has(id)) cards.set(id, { id, visible: item.visible })
    }
    for (const card of defaultOverviewLayout()) {
      if (!cards.has(card.id)) cards.set(card.id, card)
    }
    return [...cards.values()]
  } catch {
    return defaultOverviewLayout()
  }
}

export function saveOverviewLayout(accountId: string, cards: OverviewCardPreference[]): void {
  localStorage.setItem(storageKey(accountId), JSON.stringify(cards))
}

export function clearOverviewLayout(accountId: string): void {
  localStorage.removeItem(storageKey(accountId))
}

export function moveOverviewCard(
  cards: OverviewCardPreference[],
  id: OverviewCardId,
  target: OverviewCardId,
): OverviewCardPreference[] {
  const from = cards.findIndex((card) => card.id === id && card.visible)
  const to = cards.findIndex((card) => card.id === target && card.visible)
  if (from < 0 || to < 0 || from === to) return cards
  const reordered = cards.slice()
  const [card] = reordered.splice(from, 1)
  reordered.splice(to, 0, card!)
  return reordered
}

export function placeOverviewCards(
  cards: OverviewCardPreference[],
  expanded?: OverviewCardId,
): OverviewCardPlacement[] {
  const visible = cards.filter((card) => card.visible)
  const hidden = cards.filter((card) => !card.visible && card.id !== expanded)
  const placed: OverviewCardPlacement[] = []
  if (expanded && !visible.some((card) => card.id === expanded)) {
    placed.push({ id: expanded, visible: true })
  }

  for (let index = 0; index < visible.length; index += 2) {
    const first = visible[index]!
    const next = visible[index + 1]
    if (!next) placed.push(first)
    else if (first.id === expanded) placed.push(first, next)
    else if (next.id === expanded) placed.push(next, first)
    else placed.push({ ...first, edge: 'start' }, { ...next, edge: 'end' })
  }

  return [...placed, ...hidden]
}
