import { access, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { loadRealEnvironment } from './env'
import { openRealSession, type RealSession } from './session'
import {
  appURL,
  navigateWallet,
  submitTransfer,
  synchronizeDashboard,
  unlockWallet,
  waitForTimelineStep,
} from './ui'

const env = loadRealEnvironment()
const controlDir = process.env.PANGU_REAL_E2E_CONTROL_DIR

async function waitForFile(file: string, timeout = 90_000): Promise<void> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      await access(file)
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  throw new Error(`node control acknowledgement timed out: ${file}`)
}

async function control(action: 'start' | 'stop', node: string): Promise<void> {
  if (!controlDir) throw new Error('PANGU_REAL_E2E_CONTROL_DIR is required for fault recovery')
  const ack = path.join(controlDir, `${action}-${node}.ack`)
  await rm(ack, { force: true })
  await writeFile(path.join(controlDir, `${action}-${node}.command`), `${Date.now()}\n`, 'utf8')
  await waitForFile(ack)
}

async function waitForGateway(): Promise<void> {
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(`${env.gatewayBase}/health`)).ok
        } catch {
          return false
        }
      },
      { timeout: 120_000 },
    )
    .toBe(true)
}

async function participant(profile: string): Promise<RealSession> {
  const session = await openRealSession(env, test.info(), profile)
  await session.page.goto(appURL(env, '/wallet'))
  if (session.page.url().endsWith('/wallet/unlock')) await unlockWallet(session.page, env.password)
  await session.startTrace()
  return session
}

async function addresses(): Promise<{ aliceAddress: string; bobAddress: string }> {
  return JSON.parse(await readFile(`${env.runDir}/public-state.json`, 'utf8')) as {
    aliceAddress: string
    bobAddress: string
  }
}

async function expectNoSettlement(page: Page, timeout = 8_000): Promise<void> {
  const settlement = page.locator('.timeline > li').filter({ hasText: '后台结算' })
  await expect(settlement).toBeVisible()
  await page.waitForTimeout(timeout)
  await expect(settlement).not.toHaveClass(/timeline__item--complete/)
}

test.describe.serial('real node interruption and recovery', () => {
  test('Gateway offline is visible and synchronization recovers', async () => {
    const alice = await participant('alice')
    try {
      await control('stop', 'BootNode')
      await navigateWallet(alice.page, '/wallet')
      await alice.page.getByRole('button', { name: '同步', exact: true }).click()
      await expect(alice.page.getByText(/离线|无法连接|同步失败/).first()).toBeVisible({
        timeout: 30_000,
      })
      await control('start', 'BootNode')
      await waitForGateway()
      await synchronizeDashboard(alice.page, env)
      await expect(alice.page.getByText(/已同步|资金状态正常/).first()).toBeVisible()
    } finally {
      await alice.close()
    }
  })

  test('one validator still settles; two validators cannot claim settlement', async () => {
    const { bobAddress } = await addresses()
    const alice = await participant('alice')
    try {
      await control('stop', 'ComNode4')
      await submitTransfer(alice.page, env, '快速', bobAddress, '0.2')
      await waitForTimelineStep(alice.page, '后台结算', 'complete', 180_000)

      await alice.page.getByRole('button', { name: '继续发送' }).click()
      await control('stop', 'ComNode3')
      await submitTransfer(alice.page, env, '快速', bobAddress, '0.2')
      await expectNoSettlement(alice.page)
      await control('start', 'ComNode3')
      await waitForTimelineStep(alice.page, '后台结算', 'complete', 180_000)
      await control('start', 'ComNode4')
    } finally {
      await control('start', 'ComNode3').catch(() => undefined)
      await control('start', 'ComNode4').catch(() => undefined)
      await alice.close()
    }
  })

  test('Aggregation interruption resumes the same transaction', async () => {
    const { bobAddress } = await addresses()
    const alice = await participant('alice')
    try {
      await control('stop', 'AggregationNode')
      const transfer = await submitTransfer(alice.page, env, '快速', bobAddress, '0.2')
      await expectNoSettlement(alice.page)
      await control('start', 'AggregationNode')
      await waitForTimelineStep(alice.page, '收款方可用', 'complete', 180_000)
      await waitForTimelineStep(alice.page, '后台结算', 'complete', 180_000)
      await expect(alice.page.locator('.result-plane .mono')).toContainText(transfer.txID)
    } finally {
      await control('start', 'AggregationNode').catch(() => undefined)
      await alice.close()
    }
  })

  test('CFAA interruption does not block quick availability', async () => {
    const { bobAddress } = await addresses()
    const alice = await participant('alice')
    try {
      await control('stop', 'CertifierNode')
      await submitTransfer(alice.page, env, '快速', bobAddress, '0.2')
      await waitForTimelineStep(alice.page, '收款方可用', 'complete', 180_000)
      await control('start', 'CertifierNode')
      await waitForTimelineStep(alice.page, '后台结算', 'complete', 180_000)
    } finally {
      await control('start', 'CertifierNode').catch(() => undefined)
      await alice.close()
    }
  })
})
