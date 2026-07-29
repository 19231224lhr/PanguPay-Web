import { decryptWalletEnvelope } from './keystore'
import type { WalletKeystoreEnvelope, WalletRecord } from './types'

type UnlockWorkerResult = { ok: true; record: WalletRecord } | { ok: false; error: string }

export async function decryptWalletEnvelopeOffThread(
  envelope: WalletKeystoreEnvelope,
  password: string,
): Promise<WalletRecord> {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    return decryptWalletEnvelope(envelope, password)
  }
  return new Promise<WalletRecord>((resolve, reject) => {
    const worker = new Worker(new URL('../workers/walletUnlock.worker.ts', import.meta.url), {
      type: 'module',
    })
    const finish = () => worker.terminate()
    worker.onmessage = (event: MessageEvent<UnlockWorkerResult>) => {
      finish()
      if (event.data.ok) resolve(event.data.record)
      else reject(new Error(event.data.error))
    }
    worker.onerror = () => {
      finish()
      reject(new Error('wallet unlock worker failed'))
    }
    worker.postMessage({ envelope, password })
  })
}
