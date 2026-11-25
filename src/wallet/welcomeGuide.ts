const key = (accountId: string) => `pangupay:wallet-welcome:${accountId}`

export function queueWelcomeGuide(accountId: string): void {
  try {
    localStorage.setItem(key(accountId), 'pending')
  } catch {
    // A browser that blocks local storage can still create a wallet.
  }
}

export function clearWelcomeGuide(accountId: string): void {
  try {
    localStorage.removeItem(key(accountId))
  } catch {
    // Optional UI state.
  }
}

export function takeWelcomeGuide(accountId: string): boolean {
  if (!accountId) return false
  try {
    if (localStorage.getItem(key(accountId)) !== 'pending') return false
    localStorage.removeItem(key(accountId))
    return true
  } catch {
    return false
  }
}
