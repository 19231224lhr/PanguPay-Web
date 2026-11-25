import { afterEach, expect, it } from 'vitest'
import {
  clearOverviewLayout,
  defaultOverviewLayout,
  placeOverviewCards,
  readOverviewLayout,
  saveOverviewLayout,
} from '@/wallet/overviewLayout'

afterEach(() => {
  clearOverviewLayout('layout-A')
  clearOverviewLayout('layout-B')
})

it('loads the saved order and visibility for the matching account', () => {
  const cards = defaultOverviewLayout().reverse()
  cards[0]!.visible = false
  saveOverviewLayout('layout-A', cards)

  expect(readOverviewLayout('layout-A')).toEqual(cards)
  expect(readOverviewLayout('layout-B')).toEqual(defaultOverviewLayout())
  clearOverviewLayout('layout-A')
  expect(readOverviewLayout('layout-A')).toEqual(defaultOverviewLayout())
})

it('keeps saved entries and fills in newly available cards', () => {
  localStorage.setItem(
    'pangupay:wallet-overview:layout-A',
    JSON.stringify([
      { id: 'activity', visible: false },
      { id: 'activity', visible: true },
      { id: 'deprecated', visible: true },
    ]),
  )
  const cards = readOverviewLayout('layout-A')
  expect(cards[0]).toEqual({ id: 'activity', visible: false })
  expect(cards.slice(1)).toEqual(defaultOverviewLayout().filter(({ id }) => id !== 'activity'))
})

it('temporarily shows a hidden card opened by a navigation link', () => {
  const cards = defaultOverviewLayout().map((card) => ({ ...card, visible: false }))
  expect(placeOverviewCards(cards).some((card) => card.visible)).toBe(false)
  expect(placeOverviewCards(cards, 'security').filter((card) => card.visible)).toEqual([
    { id: 'security', visible: true },
  ])
  expect(cards.every((card) => !card.visible)).toBe(true)
})
