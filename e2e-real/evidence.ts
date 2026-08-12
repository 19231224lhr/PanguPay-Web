import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { Page, Request, TestInfo } from '@playwright/test'

import { redactEvidence } from './metrics'

export interface NetworkEvidence {
  method: string
  path: string
  status: number
  durationMs: number
}

export function observeNetwork(page: Page): NetworkEvidence[] {
  const started = new WeakMap<Request, number>()
  const entries: NetworkEvidence[] = []
  page.on('request', (request) => started.set(request, Date.now()))
  page.on('response', (response) => {
    const request = response.request()
    const url = new URL(request.url())
    if (!url.pathname.startsWith('/api/') && url.pathname !== '/health') return
    entries.push({
      method: request.method(),
      path: url.pathname,
      status: response.status(),
      durationMs: Math.max(0, Date.now() - (started.get(request) ?? Date.now())),
    })
  })
  return entries
}

export async function writeEvidence(
  testInfo: TestInfo,
  name: string,
  value: unknown,
): Promise<string> {
  const output = testInfo.outputPath(`${name}.json`)
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(redactEvidence(value), null, 2)}\n`, 'utf8')
  await testInfo.attach(name, { path: output, contentType: 'application/json' })
  return output
}

export async function sanitizeHar(harPath: string): Promise<void> {
  const raw = JSON.parse(await readFile(harPath, 'utf8')) as {
    log?: {
      version?: string
      creator?: unknown
      pages?: unknown[]
      entries?: Array<{
        startedDateTime?: string
        time?: number
        request?: { method?: string; url?: string }
        response?: { status?: number; statusText?: string }
      }>
    }
  }
  const entries = (raw.log?.entries ?? []).map((entry) => {
    const requestURL = new URL(String(entry.request?.url || 'http://invalid/'))
    return {
      startedDateTime: entry.startedDateTime,
      time: entry.time,
      request: { method: entry.request?.method, url: requestURL.pathname },
      response: { status: entry.response?.status, statusText: entry.response?.statusText },
    }
  })
  await writeFile(
    harPath,
    `${JSON.stringify({ log: { version: raw.log?.version || '1.2', creator: raw.log?.creator, entries } }, null, 2)}\n`,
    'utf8',
  )
}
