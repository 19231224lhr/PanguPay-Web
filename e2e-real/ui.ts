import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { expect, type Download, type Page } from '@playwright/test'

import type { RealEnvironment, RealFixtureUser } from './env'

export type TransferModeLabel = '普通' | '快速' | '跨链'

export interface WalletBackupFiles {
  recovery: string
  wallet: string
}

export interface SubmittedTransfer {
  normalInputs: number
  txCerInputs: number
  txID: string
}

export const appURL = (env: RealEnvironment, route: string) => `${env.baseURL}${route}`

export async function navigateWallet(page: Page, route: string): Promise<void> {
  if (new URL(page.url()).pathname === route) return
  if (route === '/wallet/receive') {
    await navigateWallet(page, '/wallet')
    await page.locator('a[href="/wallet/receive"]:visible').first().click()
  } else {
    if (!/^\/wallet(?:\/(?:activity|blockchain|organization|security|send|settings))?$/.test(route))
      throw new Error(`unsupported visible wallet route: ${route}`)
    await page.locator(`a[href="${route}"]:visible`).first().click()
  }
  await page.waitForURL(new RegExp(`${route.replaceAll('/', '\\/')}$`))
}

export async function importFixtureWallet(
  page: Page,
  env: RealEnvironment,
  user: RealFixtureUser,
): Promise<void> {
  await page.goto(appURL(env, '/wallet/setup'))
  if (page.url().endsWith('/wallet/unlock')) {
    await unlockWallet(page, env.password)
    return
  }
  if (/\/wallet(?:\/entry)?$/.test(page.url())) return

  await page.getByRole('radio', { name: '导入' }).click()
  await page.getByRole('radio', { name: '私钥与 RootSeed' }).click()
  await page.getByLabel('账户私钥（64 位十六进制）').fill(user.accountPrivateKey)
  await page.getByLabel('PGC 地址 RootSeed（64 位十六进制）').fill(user.addressRootSeedHex)
  await page.getByLabel('设置新钱包密码').fill(env.password)
  await page.getByLabel('确认新密码').fill(env.password)
  await page.getByRole('button', { name: '恢复并进入钱包' }).click()
  await page.waitForURL(/\/wallet(?:\/entry)?$/, { timeout: 120_000 })
}

export async function createWallet(
  page: Page,
  env: RealEnvironment,
  privateDir: string,
): Promise<WalletBackupFiles> {
  await mkdir(privateDir, { recursive: true })
  await page.goto(appURL(env, '/wallet/setup'))
  await page.getByLabel('钱包密码').fill(env.password)
  await page.getByLabel('确认密码').fill(env.password)
  const downloads: Download[] = []
  const listener = (download: Download) => downloads.push(download)
  page.on('download', listener)
  await page.getByRole('button', { name: '创建钱包并下载备份', exact: true }).click()
  await expect.poll(() => downloads.length, { timeout: 60_000 }).toBe(2)
  page.off('download', listener)

  const files: Partial<WalletBackupFiles> = {}
  for (const download of downloads) {
    const name = download.suggestedFilename()
    const destination = path.join(privateDir, name)
    await download.saveAs(destination)
    if (/recovery/i.test(name)) files.recovery = destination
    else files.wallet = destination
  }
  if (!files.wallet || !files.recovery)
    throw new Error('wallet creation did not download both backups')
  await page.getByText('我已分别安全保存').click()
  await page.getByRole('button', { name: '进入钱包' }).click()
  await page.waitForURL(/\/wallet(?:\/entry)?$/, { timeout: 120_000 })
  return files as WalletBackupFiles
}

export async function unlockWallet(page: Page, password: string): Promise<void> {
  await page.getByLabel('钱包密码').fill(password)
  await page.getByRole('button', { name: '解锁钱包' }).click()
  await page.waitForURL(/\/wallet(?:\/entry)?$/, { timeout: 120_000 })
}

export async function chooseRetail(page: Page): Promise<void> {
  if (!page.url().endsWith('/wallet/entry')) return
  await expect(page.getByRole('heading', { name: '选择你的使用方式' })).toBeVisible({
    timeout: 60_000,
  })
  await page.getByRole('button', { name: '暂不加入' }).click()
  await page.waitForURL(/\/wallet$/, { timeout: 120_000 })
}

export async function joinFirstOrganization(page: Page): Promise<void> {
  if (!page.url().endsWith('/wallet/entry')) {
    await navigateWallet(page, '/wallet/organization')
    if (
      await page
        .getByText('当前归属')
        .isVisible()
        .catch(() => false)
    )
      return
    const option = page.locator('.organization-option input[type="radio"]').first()
    await expect(option).toBeVisible({ timeout: 60_000 })
    await option.check()
    await page.getByRole('button', { name: '确认加入' }).click()
    await expect(page.getByText('当前归属')).toBeVisible({ timeout: 120_000 })
    return
  }
  await expect(page.getByRole('heading', { name: '选择你的使用方式' })).toBeVisible({
    timeout: 60_000,
  })
  const option = page.locator('.organization-choice input[type="radio"]').first()
  await expect(option).toBeVisible()
  await option.check()
  await page.getByRole('button', { name: '加入所选组织' }).click()
  await page.waitForURL(/\/wallet$/, { timeout: 120_000 })
}

export async function receiveAddress(page: Page, env: RealEnvironment): Promise<string> {
  void env
  await navigateWallet(page, '/wallet/receive')
  const output = page.locator('output.receive-address')
  await expect(output).toHaveText(/^[a-f0-9]{40}$/i, { timeout: 60_000 })
  return (await output.textContent())!.trim()
}

export async function generateCapsule(page: Page, env: RealEnvironment): Promise<string> {
  void env
  await navigateWallet(page, '/wallet/receive')
  await page.getByRole('radio', { name: '胶囊地址' }).click()
  await page.getByRole('button', { name: '生成胶囊地址' }).click()
  const output = page.locator('output.receive-address')
  await expect(output).toHaveText(/^\d{8}@\S+$/, { timeout: 60_000 })
  return (await output.textContent())!.trim()
}

async function reviewValue(page: Page, label: string): Promise<string> {
  const row = page
    .locator('.review-details > div')
    .filter({ has: page.locator('dt', { hasText: label }) })
  return ((await row.locator('dd').textContent()) ?? '').trim()
}

export async function submitTransfer(
  page: Page,
  env: RealEnvironment,
  mode: TransferModeLabel,
  recipient: string,
  amount: string,
): Promise<SubmittedTransfer> {
  void env
  await navigateWallet(page, '/wallet/send')
  await page.getByRole('radio', { name: mode }).click()
  await page.getByLabel(mode === '跨链' ? '轻计算收款地址' : '收款地址').fill(recipient)
  await page.getByLabel('金额').fill(amount)
  await page.getByRole('button', { name: '审核交易' }).click()
  await expect(page.locator('.review-plane')).toBeVisible({ timeout: 120_000 })
  await expect(page.getByText(`${mode}转账`, { exact: true })).toBeVisible()

  const txID = await reviewValue(page, '交易 ID')
  const normalInputs = Number.parseInt(await reviewValue(page, '普通输入'), 10)
  const txCerInputs = Number.parseInt(await reviewValue(page, 'TXCer 输入'), 10)
  if (!/^[a-f0-9]{64}$/i.test(txID)) throw new Error(`review produced invalid TXID: ${txID}`)

  await page.getByRole('button', { name: '确认并提交' }).click()
  await expect(page.locator('.result-plane')).toBeVisible({ timeout: 120_000 })
  await expect(page.locator('.result-plane .mono')).toContainText(txID)
  return { normalInputs, txCerInputs, txID }
}

export async function waitForTimelineStep(
  page: Page,
  label: string,
  state: 'complete' | 'active' | 'error' = 'complete',
  timeout = 180_000,
): Promise<string> {
  const step = page.locator('.timeline > li').filter({ hasText: label })
  await expect(step).toHaveClass(new RegExp(`timeline__item--${state}`), { timeout })
  return (await step.textContent()) ?? ''
}

export async function continueSending(page: Page): Promise<void> {
  await page.getByRole('button', { name: '继续发送' }).click()
  await expect(page.getByRole('button', { name: '审核交易' })).toBeVisible()
}

export async function synchronizeDashboard(page: Page, env: RealEnvironment): Promise<void> {
  void env
  await navigateWallet(page, '/wallet')
  const button = page.getByRole('button', { name: '同步', exact: true })
  await expect(button).toBeVisible()
  await button.click()
  await expect(button).toBeEnabled({ timeout: 120_000 })
}
