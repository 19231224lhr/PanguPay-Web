import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'

import { chromium } from '@playwright/test'

function argument(name, fallback = '') {
  const index = process.argv.indexOf(name)
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback
}

const fixturePath = argument('--fixture')
const outputPath = argument('--output')
const baseURL = argument('--base-url', 'http://127.0.0.1:64972')

if (!fixturePath) throw new Error('missing --fixture')

const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
const password = 'capsule-final-validation-password'
const report = {
  startedAt: new Date().toISOString(),
  baseURL,
  gatewayBase: fixture.gatewayBase,
  groupID: fixture.groupID,
  capsules: {},
  transfers: [],
  consoleErrors: [],
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })

async function newWalletPage(name) {
  const context = await browser.newContext({ acceptDownloads: true })
  const page = await context.newPage()
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(`${name}: ${message.text()}`)
  })
  page.on('pageerror', (error) => report.consoleErrors.push(`${name}: ${error.message}`))
  page.on('response', async (response) => {
    if (response.status() < 400) return
    let body = ''
    try {
      body = await response.text()
    } catch {
      // The status and URL still identify the failed boundary.
    }
    report.consoleErrors.push(`${name}: HTTP ${response.status()} ${response.url()} ${body}`.trim())
  })
  return { context, page }
}

async function ensureOrganizationMember(page) {
  await page.getByRole('complementary').getByRole('link', { name: '担保组织', exact: true }).click()
  await page.waitForURL(/\/wallet\/organization$/, { timeout: 15_000 })
  await page.waitForFunction(
    () =>
      document.body.innerText.includes('快速能力已启用') ||
      Boolean(document.querySelector('.organization-options label')),
    undefined,
    { timeout: 30_000 },
  )
  if (await page.getByText('快速能力已启用', { exact: true }).isVisible()) return

  const organization = page.locator('.organization-options label').first()
  await organization.waitFor({ state: 'visible', timeout: 30_000 })
  await organization.click()
  await page.getByRole('button', { name: '确认加入' }).click()
  await page.getByText('快速能力已启用', { exact: true }).waitFor({ timeout: 60_000 })
}

async function importKeys(page, user, label, { joinGroup = false } = {}) {
  await page.goto(`${baseURL}/wallet/setup`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('radio', { name: '导入' }).check()
  await page.getByRole('radio', { name: '私钥与 RootSeed' }).check()
  await page.locator('#legacy-scalar').fill(user.accountPrivateKey)
  await page.locator('#legacy-root').fill(user.addressRootSeedHex)
  await page.locator('#recovery-new-password').fill(password)
  await page.locator('#recovery-new-password-confirm').fill(password)
  await page.getByRole('button', { name: '恢复并进入钱包' }).click()
  await page.waitForURL(/\/wallet(?:\/entry)?$/, { timeout: 60_000 })
  if (page.url().endsWith('/wallet/entry')) {
    await page.waitForURL(/\/wallet$/, { timeout: 60_000 })
  }
  const accountText = await page.locator('body').innerText()
  if (!accountText.includes(user.accountID)) {
    throw new Error(`${label} imported account ${user.accountID} is not visible`)
  }
  if (joinGroup) await ensureOrganizationMember(page)
}

async function importRetailKeys(page) {
  await page.goto(`${baseURL}/wallet/setup`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('radio', { name: '导入' }).check()
  await page.getByRole('radio', { name: '私钥与 RootSeed' }).check()
  await page.locator('#legacy-scalar').fill('2'.padStart(64, '0'))
  await page.locator('#legacy-root').fill('3'.padStart(64, '0'))
  await page.locator('#recovery-new-password').fill(password)
  await page.locator('#recovery-new-password-confirm').fill(password)
  await page.getByRole('button', { name: '恢复并进入钱包' }).click()
  await page.waitForURL(/\/wallet(?:\/entry)?$/, { timeout: 60_000 })
  if (page.url().endsWith('/wallet/entry')) {
    await page.getByRole('button', { name: '暂不加入' }).click()
    await page.waitForURL(/\/wallet$/, { timeout: 60_000 })
  }
}

async function generateCapsule(page, expectedPrefix) {
  if (!page.url().endsWith('/wallet')) {
    await page.getByRole('complementary').getByRole('link', { name: '总览', exact: true }).click()
    await page.waitForURL(/\/wallet$/, { timeout: 15_000 })
  }
  await page.getByRole('link', { name: '收款', exact: true }).click()
  await page.waitForURL(/\/wallet\/receive$/, { timeout: 15_000 })
  const output = page.locator('output.receive-address')
  const rawAddress = (await output.textContent())?.trim() ?? ''
  if (!/^[0-9a-f]{40}$/i.test(rawAddress)) {
    throw new Error(`invalid source address ${rawAddress}`)
  }
  await page.getByRole('radio', { name: '胶囊地址' }).check()
  await page.getByRole('button', { name: '生成胶囊地址' }).click()
  await page.waitForFunction(
    () =>
      Boolean(
        document.querySelector('output.receive-address')?.textContent?.trim() ||
        document.querySelector('.capsule-error')?.textContent?.trim(),
      ),
    undefined,
    { timeout: 30_000 },
  )
  const errorLocator = page.locator('.capsule-error')
  const error = (await errorLocator.count()) ? (await errorLocator.textContent())?.trim() : ''
  if (error) throw new Error(`capsule generation failed: ${error}`)
  const capsule = (await output.textContent())?.trim() ?? ''
  if (!capsule.startsWith(`${expectedPrefix}@`)) {
    throw new Error(`expected ${expectedPrefix} capsule, received ${capsule}`)
  }
  return { value: capsule, rawAddress }
}

function transactionFromRequest(request) {
  if (!request.url().includes('/assign/submit-tx') || request.method() !== 'POST') return undefined
  try {
    return request.postDataJSON()
  } catch {
    return undefined
  }
}

function findTransaction(value) {
  if (!value || typeof value !== 'object') return undefined
  for (const candidate of [value.UserTX, value.userTX, value.TX, value.tx, value.Transaction]) {
    if (candidate && typeof candidate === 'object') return candidate
  }
  return value
}

async function submitTransfer(page, mode, capsule, amount, expectedRecipient) {
  const submitted = []
  const listener = (request) => {
    const body = transactionFromRequest(request)
    if (body) submitted.push(body)
  }
  page.on('request', listener)
  try {
    if (!page.url().endsWith('/wallet/send')) {
      await page.getByRole('complementary').getByRole('link', { name: '发送', exact: true }).click()
      await page.waitForURL(/\/wallet\/send$/, { timeout: 15_000 })
    }
    await page.getByRole('radio', { name: mode === 'quick' ? '快速' : '普通' }).check()
    await page.locator('#send-recipient').fill(capsule)
    await page.locator('#send-amount').fill(amount)
    await page.getByRole('button', { name: '审核交易' }).click()
    await page.getByText('胶囊地址已验证', { exact: true }).waitFor({ timeout: 30_000 })

    const targetRow = page.locator('.review-details > div').filter({ hasText: '链上真实目标' })
    const target = (await targetRow.locator('dd').textContent())?.trim() ?? ''
    if (target !== expectedRecipient) {
      throw new Error(`${mode} transfer resolved ${target}, expected ${expectedRecipient}`)
    }
    const txID = (
      await page
        .locator('.review-details > div')
        .filter({ hasText: '交易 ID' })
        .locator('dd')
        .textContent()
    )?.trim()
    if (!txID || !/^[0-9a-f]{64}$/i.test(txID)) throw new Error(`invalid transaction ID ${txID}`)

    await page.getByRole('button', { name: '确认并提交' }).click()
    await page.getByRole('heading', { name: '交易已进入处理流程' }).waitFor({ timeout: 30_000 })

    const acceptedAt = Date.now()
    let spendReadyMs
    if (mode === 'quick') {
      const spendReady = page.locator('li.timeline__item--complete').filter({
        hasText: '收款方已到账可用',
      })
      await spendReady.waitFor({ timeout: 30_000 })
      spendReadyMs = Date.now() - acceptedAt
    }
    await page
      .locator('li.timeline__item--complete')
      .filter({ hasText: '后台本地结算' })
      .waitFor({ timeout: 100_000 })

    const body = submitted.at(-1)
    const transaction = findTransaction(body)
    const wireText = JSON.stringify(body ?? {})
    if (wireText.includes(capsule)) throw new Error(`${mode} wire leaked capsule address`)
    if (!wireText.includes(expectedRecipient))
      throw new Error(`${mode} wire misses resolved recipient`)

    return {
      mode,
      amount,
      txID,
      resolvedRecipient: target,
      spendReadyMs,
      settledMs: Date.now() - acceptedAt,
      txType: transaction?.TXType ?? transaction?.txType,
      normalInputs: (transaction?.TXInputsNormal ?? transaction?.txInputsNormal ?? []).length,
      txCerInputs: (transaction?.TXInputsCertificate ?? transaction?.txInputsCertificate ?? [])
        .length,
    }
  } finally {
    page.off('request', listener)
  }
}

const bob = await newWalletPage('bob')
const retail = await newWalletPage('retail')
const alice = await newWalletPage('alice')

try {
  await importKeys(bob.page, fixture.bob, 'bob', { joinGroup: true })
  report.capsules.member = await generateCapsule(bob.page, fixture.groupID)

  await importRetailKeys(retail.page)
  report.capsules.retail = await generateCapsule(retail.page, '00000000')

  await importKeys(alice.page, fixture.alice, 'alice', { joinGroup: true })
  report.transfers.push(
    await submitTransfer(
      alice.page,
      'normal',
      report.capsules.retail.value,
      '2',
      report.capsules.retail.rawAddress,
    ),
  )
  await alice.page.getByRole('button', { name: '继续发送' }).click()
  report.transfers.push(
    await submitTransfer(
      alice.page,
      'quick',
      report.capsules.member.value,
      '3',
      fixture.bob.address,
    ),
  )

  report.completedAt = new Date().toISOString()
  report.passed = true
} catch (error) {
  report.completedAt = new Date().toISOString()
  report.passed = false
  report.error = error instanceof Error ? (error.stack ?? error.message) : String(error)
  throw error
} finally {
  await Promise.all([alice.context.close(), bob.context.close(), retail.context.close()])
  await browser.close()
  if (outputPath) await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}
