import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { chromium, type BrowserContext, type Page, type TestInfo } from '@playwright/test'

import type { RealEnvironment } from './env'
import { observeNetwork, sanitizeHar, writeEvidence, type NetworkEvidence } from './evidence'

export interface RealSession {
  context: BrowserContext
  network: NetworkEvidence[]
  page: Page
  startTrace(): Promise<void>
  close(): Promise<void>
}

export async function openRealSession(
  env: RealEnvironment,
  testInfo: TestInfo,
  profileName: string,
  viewport = { width: 1440, height: 900 },
  capture = true,
): Promise<RealSession> {
  const profile = path.join(env.runDir, 'profiles', profileName)
  const videoDir = testInfo.outputPath('video')
  const harPath = testInfo.outputPath(`${profileName}.har`)
  await Promise.all([mkdir(profile, { recursive: true }), mkdir(videoDir, { recursive: true })])

  const context = await chromium.launchPersistentContext(profile, {
    channel: 'msedge',
    headless: env.headless,
    viewport,
    locale: 'zh-CN',
    acceptDownloads: true,
    recordVideo: capture ? { dir: videoDir, size: viewport } : undefined,
    recordHar: capture ? { path: harPath, content: 'omit', mode: 'minimal' } : undefined,
  })
  const restoredPages = context.pages()
  const page = await context.newPage()
  context.on('page', (candidate) => {
    if (candidate !== page) void candidate.close().catch(() => undefined)
  })
  await Promise.all(restoredPages.map((candidate) => candidate.close().catch(() => undefined)))
  await page.bringToFront()
  const network = observeNetwork(page)
  let traceStarted = false

  return {
    context,
    page,
    network,
    async startTrace() {
      if (!capture || traceStarted) return
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
      traceStarted = true
    },
    async close() {
      await writeEvidence(testInfo, `${profileName}-network`, network)
      if (traceStarted) {
        await context.tracing.stop({ path: testInfo.outputPath(`${profileName}-trace.zip`) })
      }
      await context.close()
      if (capture) {
        await sanitizeHar(harPath)
        await testInfo.attach(`${profileName}-har`, {
          path: harPath,
          contentType: 'application/json',
        })
      }
    },
  }
}
