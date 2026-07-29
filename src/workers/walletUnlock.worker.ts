/// <reference lib="webworker" />

import { decryptWalletEnvelope } from '@/wallet/keystore'
import type { WalletKeystoreEnvelope } from '@/wallet/types'

interface UnlockRequest {
  envelope: WalletKeystoreEnvelope
  password: string
}

self.onmessage = async (event: MessageEvent<UnlockRequest>) => {
  try {
    const record = await decryptWalletEnvelope(event.data.envelope, event.data.password)
    self.postMessage({ ok: true, record })
  } catch (cause) {
    self.postMessage({
      ok: false,
      error: cause instanceof Error ? cause.message : 'wallet unlock failed',
    })
  }
}

export {}
