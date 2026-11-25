/// <reference lib="webworker" />

import { createEncryptedWallet, openWalletEnvelope } from '@/wallet/keystore'
import type { WalletWorkerRequest } from '@/wallet/unlockWorker'

self.onmessage = async ({ data }: MessageEvent<WalletWorkerRequest>) => {
  try {
    const value = data.operation === 'create'
      ? await createEncryptedWallet(data.password)
      : await openWalletEnvelope(data.envelope, data.password)
    self.postMessage({ ok: true, value })
  } catch (cause) {
    self.postMessage({ ok: false, error: cause instanceof Error ? cause.message : `wallet ${data.operation} failed` })
  }
}
