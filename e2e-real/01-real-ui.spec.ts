import { writeFile } from 'node:fs/promises'

import { expect, test, type Page, type TestInfo } from '@playwright/test'

import { loadRealEnvironment } from './env'
import { writeEvidence } from './evidence'
import { openRealSession, type RealSession } from './session'
import {
  appURL,
  chooseRetail,
  createWallet,
  generateCapsule,
  importFixtureWallet,
  joinFirstOrganization,
  navigateWallet,
  receiveAddress,
  submitTransfer,
  synchronizeDashboard,
  unlockWallet,
  waitForTimelineStep,
  type WalletBackupFiles,
} from './ui'

const env = loadRealEnvironment()
const privateDir = `${env.runDir}/private`

let lifecycleBackups: WalletBackupFiles
let aliceAddress = ''
let bobAddress = ''

async function screenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const output = testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path: output, fullPage: true })
  await testInfo.attach(name, { path: output, contentType: 'image/png' })
}

async function reopenUnlocked(
  profile: string,
  testInfo: TestInfo,
  viewport?: { width: number; height: number },
): Promise<RealSession> {
  const session = await openRealSession(env, testInfo, profile, viewport)
  await session.page.goto(appURL(env, '/wallet'))
  if (session.page.url().endsWith('/wallet/unlock')) await unlockWallet(session.page, env.password)
  if (session.page.url().endsWith('/wallet/entry')) await chooseRetail(session.page)
  await session.page.waitForURL(/\/wallet$/)
  await expect(session.page.locator('a[href="/wallet/settings"]:visible')).toBeVisible({
    timeout: 30_000,
  })
  await session.startTrace()
  return session
}

async function lightBalance(): Promise<bigint> {
  const response = await fetch(env.lightRPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBalance',
      params: [env.lightRecipient, 'latest'],
    }),
  })
  const payload = (await response.json()) as { result?: string; error?: unknown }
  if (!payload.result) throw new Error(`light RPC balance failed: ${JSON.stringify(payload.error)}`)
  return BigInt(payload.result)
}

test.describe.serial('PanguPay real visible browser acceptance', () => {
  test('preflight: real gateway, 4-validator GQNC and LightArea are reachable', async ({
    browserName: _browserName,
  }, testInfo) => {
    const [health, groups, gqnc] = await Promise.all([
      fetch(`${env.gatewayBase}/health`),
      fetch(`${env.gatewayBase}/api/v1/groups`),
      fetch(`${env.gatewayBase}/api/v1/committee/gqnc/status`),
    ])
    expect(health.ok).toBe(true)
    expect(groups.ok).toBe(true)
    expect(gqnc.ok).toBe(true)
    const status = (await gqnc.json()) as {
      status?: { validatorCount?: number; quorum?: number }
    }
    expect(status.status?.validatorCount).toBe(4)
    expect(status.status?.quorum).toBe(3)
    expect(env.lightRecipient).toMatch(/^0x[a-fA-F0-9]{40}$/)
    await lightBalance()
    await writeEvidence(testInfo, 'preflight', {
      gatewayReachable: health.ok,
      groupID: env.groupID,
      gqnc: status.status,
      lightAreaReachable: true,
    })
  })

  test('A: wallet create, lock, import, recover and clear use only visible UI', async ({
    browserName: _browserName,
  }, testInfo) => {
    let session = await openRealSession(env, testInfo, 'lifecycle', undefined, false)
    try {
      await session.page.goto(appURL(env, '/wallet/setup'))
      await session.page.getByLabel('钱包密码').fill('short')
      await session.page.getByLabel('确认密码').fill('different')
      await expect(
        session.page.getByRole('button', { name: '创建钱包并下载备份', exact: true }),
      ).toBeDisabled()
      lifecycleBackups = await createWallet(session.page, env, `${privateDir}/lifecycle`)
      await chooseRetail(session.page)
    } finally {
      await session.close()
    }

    session = await reopenUnlocked('lifecycle', testInfo)
    try {
      await navigateWallet(session.page, '/wallet/settings')
      await session.page.getByRole('button', { name: '锁定' }).click()
      await session.page.getByLabel('钱包密码').fill('wrong-password')
      await session.page.getByRole('button', { name: '解锁钱包' }).click()
      await expect(session.page.getByRole('alert')).toContainText('无法解锁')
      await expect(session.page.getByLabel('钱包密码')).toHaveValue('')
      await unlockWallet(session.page, env.password)
      await session.page.reload()
      await expect(session.page).toHaveURL(/\/wallet\/unlock$/)
      await screenshot(session.page, testInfo, 'wallet-locked-after-refresh')
    } finally {
      await session.close()
    }

    session = await openRealSession(env, testInfo, 'lifecycle-import', undefined, false)
    try {
      await session.page.goto(appURL(env, '/wallet/setup'))
      await session.page.getByRole('radio', { name: '导入' }).click()
      await session.page.locator('input[type="file"]').setInputFiles(lifecycleBackups.wallet)
      await session.page.getByLabel('wallet.json 原密码').fill(env.password)
      await session.page.getByRole('button', { name: '验证并导入' }).click()
      await session.page.waitForURL(/\/wallet(?:\/entry)?$/, { timeout: 120_000 })
    } finally {
      await session.close()
    }

    session = await openRealSession(env, testInfo, 'lifecycle-recover', undefined, false)
    try {
      await session.page.goto(appURL(env, '/wallet/recover'))
      await session.page.locator('input[type="file"]').setInputFiles(lifecycleBackups.recovery)
      await session.page.getByLabel('设置新钱包密码').fill(env.password)
      await session.page.getByLabel('确认新密码').fill(env.password)
      await session.page.getByRole('button', { name: '重建并进入钱包' }).click()
      await session.page.waitForURL(/\/wallet(?:\/entry)?$/, { timeout: 120_000 })
      await session.page.goto(appURL(env, '/wallet/recover'))
      await session.page.getByRole('button', { name: '清除本地钱包并重新开始' }).click()
      await session.page.getByRole('button', { name: '再次点击，确认清除' }).click()
      await expect(session.page).toHaveURL(/\/wallet\/setup$/)
    } finally {
      await session.close()
    }
  })

  test('B-D: retail funding, organization entry, address receive and normal transfer', async ({
    browserName: _browserName,
  }, testInfo) => {
    let session = await openRealSession(env, testInfo, 'alice', undefined, false)
    try {
      await importFixtureWallet(session.page, env, env.fixture.alice)
      await chooseRetail(session.page)
      aliceAddress = await receiveAddress(session.page, env)
      expect(aliceAddress).toBe(env.fixture.alice.address)
    } finally {
      await session.close()
    }

    session = await openRealSession(env, testInfo, 'retail', undefined, false)
    try {
      await importFixtureWallet(session.page, env, env.fixture.bob)
      await chooseRetail(session.page)
      const funding = await submitTransfer(session.page, env, '普通', aliceAddress, '100')
      expect(funding.normalInputs).toBeGreaterThan(0)
      expect(funding.txCerInputs).toBe(0)
      await waitForTimelineStep(session.page, '后台结算')
      await writeEvidence(testInfo, 'retail-funding', funding)
    } finally {
      await session.close()
    }

    session = await openRealSession(env, testInfo, 'bob', undefined, false)
    try {
      await createWallet(session.page, env, `${privateDir}/bob`)
      await chooseRetail(session.page)
      bobAddress = await receiveAddress(session.page, env)
      expect(bobAddress).toMatch(/^[a-f0-9]{40}$/i)
      await writeFile(
        `${env.runDir}/public-state.json`,
        `${JSON.stringify({ aliceAddress, bobAddress }, null, 2)}\n`,
        'utf8',
      )
    } finally {
      await session.close()
    }

    session = await reopenUnlocked('alice', testInfo)
    try {
      await synchronizeDashboard(session.page, env)
      const totalText =
        (await session.page.locator('.wallet-balance-field__amount').textContent()) ?? ''
      expect(Number.parseFloat(totalText.replace(/[^0-9.]/g, ''))).toBeGreaterThanOrEqual(200)
      await navigateWallet(session.page, '/wallet/organization')
      await joinFirstOrganization(session.page)
      await expect(session.page.getByText('当前归属')).toBeVisible()
      await expect(session.page.getByRole('heading', { name: 'Assign 节点' })).toBeVisible()
      await expect(session.page.getByRole('heading', { name: 'Aggregation 节点' })).toBeVisible()
      await expect(session.page.getByRole('heading', { name: 'TXCer 审计节点' })).toBeVisible()
      await expect(session.page.getByRole('heading', { name: 'GuarNode' })).toBeVisible()

      const ordinary = await submitTransfer(session.page, env, '普通', bobAddress, '2')
      expect(ordinary.normalInputs).toBeGreaterThan(0)
      expect(ordinary.txCerInputs).toBe(0)
      await waitForTimelineStep(session.page, '后台结算')
      await screenshot(session.page, testInfo, 'normal-transfer-settled')
    } finally {
      await session.close()
    }

    session = await reopenUnlocked('bob', testInfo)
    try {
      await synchronizeDashboard(session.page, env)
      await navigateWallet(session.page, '/wallet/organization')
      await joinFirstOrganization(session.page)
      await expect(session.page.getByText('当前归属')).toBeVisible()
    } finally {
      await session.close()
    }
  })

  test('E: Alice→Bob quick, Bob pure TXCer return, mixed spend and restart verification', async ({
    browserName: _browserName,
  }, testInfo) => {
    const alice = await reopenUnlocked('alice', testInfo)
    let bob: RealSession | undefined
    try {
      const issued = await submitTransfer(alice.page, env, '快速', bobAddress, '12')
      const readyText = await waitForTimelineStep(alice.page, '收款方可用')
      expect(readyText).toMatch(/后端可用|可继续支付/)
      await writeEvidence(testInfo, 'quick-issue', { ...issued, readyText })

      bob = await reopenUnlocked('bob', testInfo)
      await synchronizeDashboard(bob.page, env)
      const returned = await submitTransfer(bob.page, env, '快速', aliceAddress, '5')
      expect(returned.normalInputs).toBe(0)
      expect(returned.txCerInputs).toBeGreaterThan(0)
      await waitForTimelineStep(bob.page, '收款方可用')

      const mixed = await submitTransfer(bob.page, env, '快速', aliceAddress, '8')
      expect(mixed.normalInputs).toBeGreaterThan(0)
      expect(mixed.txCerInputs).toBeGreaterThan(0)
      await waitForTimelineStep(bob.page, '后台结算')
      await waitForTimelineStep(alice.page, '后台结算')
      await writeEvidence(testInfo, 'quick-roundtrip', { issued, returned, mixed })
    } finally {
      await bob?.close()
      await alice.close()
    }

    const restarted = await reopenUnlocked('bob', testInfo)
    try {
      await navigateWallet(restarted.page, '/wallet/security')
      await expect(restarted.page.getByRole('heading', { name: '凭证与安全' })).toBeVisible()
      await expect(restarted.page.getByText('存在隔离项')).toHaveCount(0)
      await screenshot(restarted.page, testInfo, 'credentials-after-browser-restart')
    } finally {
      await restarted.close()
    }
  })

  test('F: capsule generation, verified transfer and tamper rejection', async ({
    browserName: _browserName,
  }, testInfo) => {
    const bob = await reopenUnlocked('bob', testInfo)
    let capsule = ''
    try {
      capsule = await generateCapsule(bob.page, env)
      await expect(
        bob.page.getByText('组织签名的隐私别名，可重复使用；原始地址仍然有效。'),
      ).toBeVisible()
    } finally {
      await bob.close()
    }

    const alice = await reopenUnlocked('alice', testInfo)
    try {
      const transfer = await submitTransfer(alice.page, env, '快速', capsule, '1')
      await expect(alice.page.getByText('胶囊地址已验证')).toBeVisible()
      await waitForTimelineStep(alice.page, '收款方可用')
      await writeEvidence(testInfo, 'capsule-transfer', {
        capsuleOrg: capsule.slice(0, 8),
        ...transfer,
      })

      await alice.page.getByRole('button', { name: '继续发送' }).click()
      const tampered = `${capsule.slice(0, -1)}${capsule.endsWith('1') ? '2' : '1'}`
      await alice.page.getByLabel('收款地址').fill(tampered)
      await alice.page.getByLabel('金额').fill('1')
      await alice.page.getByRole('button', { name: '审核交易' }).click()
      await expect(alice.page.getByRole('alert')).toBeVisible()
      await expect(alice.page.locator('.review-plane')).toHaveCount(0)

      await alice.page.getByRole('radio', { name: '跨链' }).click()
      await alice.page.getByLabel('轻计算收款地址').fill(capsule)
      await expect(alice.page.getByText('跨链转账暂不支持胶囊地址，请使用原始地址。')).toBeVisible()
    } finally {
      await alice.close()
    }
  })

  test('G: cross-chain does not claim completion before a successful target receipt', async ({
    browserName: _browserName,
  }, testInfo) => {
    const before = await lightBalance()
    const alice = await reopenUnlocked('alice', testInfo)
    try {
      const transfer = await submitTransfer(alice.page, env, '跨链', env.lightRecipient, '1')
      await expect(alice.page.getByText('TXCer 可支付')).toHaveCount(0)
      await waitForTimelineStep(alice.page, '本地 GQNC 已认证')
      await waitForTimelineStep(alice.page, '轻计算区已接收')
      const targetText = await waitForTimelineStep(alice.page, '目标链到账', 'complete', 300_000)
      expect(targetText).toMatch(/区块高度/)
      const after = await lightBalance()
      expect(after - before).toBe(env.lightUnitsPerPGC)
      await writeEvidence(testInfo, 'cross-chain-finality', {
        ...transfer,
        balanceDelta: (after - before).toString(),
        targetText,
      })
    } finally {
      await alice.close()
    }
  })

  test('H-I: credentials, activity, blockchain, profile, themes and responsive routes', async ({
    browserName: _browserName,
  }, testInfo) => {
    const alice = await reopenUnlocked('alice', testInfo)
    try {
      const routes = ['activity', 'security', 'organization', 'blockchain', 'settings']
      for (const route of routes) {
        await navigateWallet(alice.page, `/wallet/${route}`)
        await expect(alice.page.locator('h1').first()).toBeVisible()
      }

      await navigateWallet(alice.page, '/wallet/activity')
      await expect(alice.page.getByText('普通转账').first()).toBeVisible()
      await expect(alice.page.getByText('快速转账').first()).toBeVisible()
      await expect(alice.page.getByText('跨链转账').first()).toBeVisible()

      await navigateWallet(alice.page, '/wallet/blockchain')
      await expect(alice.page.getByText('3-of-4')).toBeVisible()
      await expect(alice.page.getByText('invalid height')).toHaveCount(0)
      const blocks = alice.page.locator('.chain-flow button')
      if ((await blocks.count()) > 0) await blocks.first().click()

      await navigateWallet(alice.page, '/wallet/settings')
      const displayName = alice.page.getByLabel('用户名')
      await displayName.fill('Alice Real E2E')
      await alice.page.getByRole('button', { name: '保存资料' }).click()
      await alice.page.getByRole('radio', { name: '浅色' }).click()
      await expect(alice.page.locator('html')).toHaveAttribute('data-theme', 'light')
      await alice.page.getByRole('radio', { name: '深色' }).click()

      for (const viewport of [
        { width: 1024, height: 768 },
        { width: 768, height: 1024 },
        { width: 390, height: 844 },
      ]) {
        await alice.page.setViewportSize(viewport)
        await navigateWallet(alice.page, '/wallet')
        const overflow = await alice.page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        )
        expect(overflow).toBeLessThanOrEqual(1)
      }
      await screenshot(alice.page, testInfo, 'mobile-overview')
    } finally {
      await alice.close()
    }
  })
})
