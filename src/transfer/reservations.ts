type ReservationBook = Record<string, string[]>

function key(accountID: string): string {
  if (!accountID.trim()) throw new Error('account ID is required')
  return `pangupay-transfer-reservations:${accountID}`
}

function normalize(value: unknown): ReservationBook {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('reservation storage is damaged')
  const result: ReservationBook = {}
  for (const [draftID, rawIDs] of Object.entries(value)) {
    if (!draftID || !Array.isArray(rawIDs)) throw new Error('reservation storage is damaged')
    const ids = rawIDs.map(String)
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length)
      throw new Error('reservation storage is damaged')
    result[draftID] = ids.sort()
  }
  return result
}

export function loadTransferReservations(accountID: string): ReservationBook {
  const raw = localStorage.getItem(key(accountID))
  if (!raw) return {}
  try {
    return normalize(JSON.parse(raw))
  } catch {
    throw new Error('reservation storage is damaged')
  }
}

function save(accountID: string, book: ReservationBook): void {
  const storageKey = key(accountID)
  if (!Object.keys(book).length) localStorage.removeItem(storageKey)
  else localStorage.setItem(storageKey, JSON.stringify(book))
}

export function reservedTransferInputIDs(accountID: string): Set<string> {
  return new Set(Object.values(loadTransferReservations(accountID)).flat())
}

export function clearTransferReservations(accountID: string): void {
  localStorage.removeItem(key(accountID))
}

export function reserveTransferInputs(
  accountID: string,
  draftID: string,
  inputIDs: readonly string[],
): void {
  if (!draftID || !inputIDs.length || inputIDs.some((id) => !id))
    throw new Error('reservation requires a draft and inputs')
  const ids = [...new Set(inputIDs)].sort()
  if (ids.length !== inputIDs.length) throw new Error('duplicate input reservation')
  const book = loadTransferReservations(accountID)
  if (book[draftID]) {
    if (JSON.stringify(book[draftID]) === JSON.stringify(ids)) return
    throw new Error('draft reservation conflict')
  }
  const occupied = new Set(Object.values(book).flat())
  if (ids.some((id) => occupied.has(id))) throw new Error('input already reserved')
  book[draftID] = ids
  save(accountID, book)
}

export function clearTransferReservation(accountID: string, draftID: string): void {
  const book = loadTransferReservations(accountID)
  delete book[draftID]
  save(accountID, book)
}
