import { createEncryptedWallet, openWalletEnvelope } from './keystore'
import type { WalletKeystoreEnvelope } from './types'

export type WalletWorkerRequest =
  | { operation: 'create'; password: string }
  | { operation: 'unlock'; envelope: WalletKeystoreEnvelope; password: string }

type WorkerReply<T> = { ok: true; value: T } | { ok: false; error: string }

function runWalletWorker<T>(request: WalletWorkerRequest): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const worker = new Worker(new URL('../workers/walletUnlock.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (event: MessageEvent<WorkerReply<T>>) => {
      worker.terminate()
      if (event.data.ok) resolve(event.data.value)
      else reject(new Error(event.data.error))
    }
    worker.onerror = worker.onmessageerror = () => {
      worker.terminate()
      reject(new Error(`wallet ${request.operation} worker failed`))
    }
    worker.postMessage(request)
  })
}

export function decryptWalletEnvelopeOffThread(envelope: WalletKeystoreEnvelope, password: string) {
  if (typeof Worker === 'undefined') return openWalletEnvelope(envelope, password)
  return runWalletWorker<Awaited<ReturnType<typeof openWalletEnvelope>>>({
    operation: 'unlock',
    envelope,
    password,
  })
}

export function createWalletOffThread(password: string) {
  if (typeof Worker === 'undefined') return createEncryptedWallet(password)
  return runWalletWorker<Awaited<ReturnType<typeof createEncryptedWallet>>>({ operation: 'create', password })
}
