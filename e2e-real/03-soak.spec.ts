import { readFile, writeFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'

import { loadRealEnvironment } from './env'
import { assertSoakThresholds, summarizeSamples, type SoakSample } from './metrics'
import { openRealSession } from './session'
import { continueSending, submitTransfer, unlockWallet, waitForTimelineStep } from './ui'

const env = loadRealEnvironment()
const sampleCount = Number.parseInt(process.env.PANGU_REAL_E2E_SOAK_COUNT || '30', 10)

interface RecordedSoakSample extends SoakSample {
  index: number
  txID: string
  error?: string
}

function duration(text: string, label: string): number {
  const match = text.match(new RegExp(`${label}\\s*([0-9.]+)\\s*ms`, 'i'))
  if (!match) throw new Error(`missing ${label} in timeline: ${text}`)
  return Number.parseFloat(match[1]!)
}

async function openParticipant(profile: string) {
  const session = await openRealSession(
    env,
    test.info(),
    profile,
    { width: 1440, height: 900 },
    false,
  )
  await session.page.goto(`${env.baseURL}/wallet/send`)
  if (session.page.url().endsWith('/wallet/unlock')) await unlockWallet(session.page, env.password)
  await session.page.waitForURL(/\/wallet(?:\/send)?$/)
  return session
}

async function assignTiming(page: import('@playwright/test').Page, txID: string) {
  const response = await page.request.get(
    `${env.gatewayBase}/api/v1/${encodeURIComponent(env.groupID)}/assign/tx-status/${encodeURIComponent(txID)}`,
  )
  expect(response.ok()).toBe(true)
  const body = (await response.json()) as Record<string, unknown>
  const acceptedAt = Number(body.accepted_at_unix_ms)
  const spendReadyAt = Number(body.spend_ready_at_unix_ms)
  if (!Number.isSafeInteger(acceptedAt) || !Number.isSafeInteger(spendReadyAt)) {
    throw new Error(`Assign timing is incomplete for ${txID}`)
  }
  if (spendReadyAt < acceptedAt) throw new Error(`Assign timing regressed for ${txID}`)
  return { acceptedAt, spendReadyAt }
}

test('visible Edge quick-transfer soak @soak', async () => {
  test.setTimeout(Math.max(30 * 60_000, sampleCount * 4 * 60_000))
  const state = JSON.parse(await readFile(`${env.runDir}/public-state.json`, 'utf8')) as {
    aliceAddress: string
    bobAddress: string
  }
  const alice = await openParticipant('alice')
  const bob = await openParticipant('bob')
  const samples: RecordedSoakSample[] = []
  try {
    for (let index = 0; index < sampleCount; index += 1) {
      const sender = index % 2 === 0 ? alice.page : bob.page
      const recipient = index % 2 === 0 ? state.bobAddress : state.aliceAddress
      try {
        const transfer = await submitTransfer(sender, env, '快速', recipient, '0.01')
        const ready = await waitForTimelineStep(sender, '收款方可用', 'complete', 180_000)
        const readyObservedAt = Date.now()
        const backend = await assignTiming(sender, transfer.txID)
        const settled = await waitForTimelineStep(sender, '后台结算', 'complete', 180_000)
        const displayedTXCerMs = duration(ready, '可用耗时')
        const backendTXCerMs = backend.spendReadyAt - backend.acceptedAt
        expect(displayedTXCerMs).toBeCloseTo(backendTXCerMs, 0)
        samples.push({
          index: index + 1,
          txID: transfer.txID,
          accepted: true,
          certified: true,
          txcerMs: backendTXCerMs,
          gqncMs: duration(settled, '结算耗时'),
          frontendObservedMs: Math.max(0, readyObservedAt - backend.spendReadyAt),
        })
        await continueSending(sender)
      } catch (error) {
        const failurePath = test.info().outputPath(`soak-failure-${index + 1}.png`)
        await sender.screenshot({ path: failurePath, fullPage: true })
        await test.info().attach(`soak-failure-${index + 1}`, {
          path: failurePath,
          contentType: 'image/png',
        })
        samples.push({
          index: index + 1,
          txID: '',
          accepted: false,
          certified: false,
          txcerMs: Number.POSITIVE_INFINITY,
          gqncMs: Number.POSITIVE_INFINITY,
          frontendObservedMs: Number.POSITIVE_INFINITY,
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      } finally {
        await writeFile(
          `${env.runDir}/soak-progress.json`,
          `${JSON.stringify({ samples, summary: summarizeSamples(samples) }, null, 2)}\n`,
          'utf8',
        )
      }
    }

    expect(samples).toHaveLength(sampleCount)
    expect(samples.every((sample) => sample.accepted && sample.certified)).toBe(true)
    if (sampleCount === 500) assertSoakThresholds(summarizeSamples(samples))
  } finally {
    await Promise.all([alice.close(), bob.close()])
  }
})
