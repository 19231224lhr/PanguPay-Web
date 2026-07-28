import { expect, test, type Download, type Page } from '@playwright/test'

import { mockReturningRetailEntry } from './helpers/walletEntry'

async function createAndCollectBackups(page: Page): Promise<Download[]> {
  const downloads: Download[] = []
  const collect = (download: Download): void => {
    downloads.push(download)
  }
  page.on('download', collect)
  try {
    await page.getByRole('button', { name: '创建钱包并下载两份备份' }).click()
    await expect.poll(() => downloads.length).toBe(2)
    return downloads
  } finally {
    page.off('download', collect)
  }
}

test.describe('Phase 1 wallet foundation', () => {
  test.beforeEach(async ({ page }) => {
    await mockReturningRetailEntry(page)
  })

  test('landing resolves an absent wallet to setup', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.landing__header .preference-controls')).toHaveCount(0)
    const landingTransitionName = await page
      .locator('[data-value-fold-field]')
      .evaluate((element) => getComputedStyle(element).viewTransitionName)
    expect(landingTransitionName).toBe('pangu-value-fold')
    await page.getByRole('button', { name: '进入钱包' }).click()
    await expect(page).toHaveURL(/\/wallet\/setup$/)
    await expect(page.getByRole('heading', { name: '建立你的钱包' })).toBeVisible()
    await expect(page.locator('.wallet-access__header .preference-controls')).toHaveCount(0)
    const accessTransitionName = await page
      .locator('[data-value-fold-field]')
      .evaluate((element) => getComputedStyle(element).viewTransitionName)
    expect(accessTransitionName).toBe('pangu-value-fold')
  })

  test('keeps every setup title on the same top anchor while long forms scroll below it', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/wallet/setup')

    const createTop = await page
      .getByRole('heading', { name: '建立你的钱包' })
      .evaluate((element) => element.getBoundingClientRect().top)
    const setupModeControl = page.locator('.segmented-control').first()
    const createModeControlTop = await setupModeControl.evaluate(
      (element) => element.getBoundingClientRect().top,
    )

    await page.getByRole('radio', { name: '导入' }).click()
    const backupTop = await page
      .getByRole('heading', { name: '导入加密备份' })
      .evaluate((element) => element.getBoundingClientRect().top)
    const backupModeControlTop = await setupModeControl.evaluate(
      (element) => element.getBoundingClientRect().top,
    )

    await page.getByRole('radio', { name: '私钥与 RootSeed' }).click()
    const keyHeading = page.getByRole('heading', { name: '使用密钥恢复' })
    const keyTop = await keyHeading.evaluate((element) => element.getBoundingClientRect().top)
    const keyModeControlTop = await setupModeControl.evaluate(
      (element) => element.getBoundingClientRect().top,
    )

    expect(Math.abs(createTop - backupTop)).toBeLessThanOrEqual(1)
    expect(Math.abs(createTop - keyTop)).toBeLessThanOrEqual(1)
    expect(Math.abs(createModeControlTop - backupModeControlTop)).toBeLessThanOrEqual(1)
    expect(Math.abs(createModeControlTop - keyModeControlTop)).toBeLessThanOrEqual(1)
    await expect(keyHeading).toBeVisible()
    const accessForm = page.locator('.wallet-access__form')
    await expect(accessForm).toHaveCSS('scrollbar-width', 'none')
    const scrollState = await accessForm.evaluate((element) => {
      const maxScrollTop = element.scrollHeight - element.clientHeight
      element.scrollTop = maxScrollTop
      return { maxScrollTop, scrollTop: element.scrollTop }
    })
    expect(scrollState.maxScrollTop).toBeGreaterThan(0)
    expect(scrollState.scrollTop).toBeGreaterThan(0)
  })

  test('keeps encrypted backup import and private-key recovery as distinct flows', async ({
    page,
  }) => {
    await page.goto('/wallet/setup')
    const setupScrollbar = await page
      .locator('.wallet-access__form')
      .evaluate((element) => getComputedStyle(element).scrollbarWidth)
    expect(setupScrollbar).toBe('none')
    await page.getByRole('radio', { name: '导入' }).click()

    await expect(page.getByRole('heading', { name: '导入加密备份' })).toBeVisible()
    await page.locator('input[type="file"]').setInputFiles({
      name: 'wallet.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{}'),
    })
    await expect(page.getByText('文件已读取，输入备份原密码即可验证。')).toBeVisible()
    await expect(page.getByLabel('wallet.json 原密码')).toBeVisible()
    await expect(page.getByLabel('确认密码')).toHaveCount(0)
    await expect(page.getByText('这是已有备份的密码，不是在设置新密码。')).toBeVisible()

    await page.getByRole('radio', { name: '私钥与 RootSeed' }).click()
    await expect(page.getByRole('heading', { name: '使用密钥恢复' })).toBeVisible()
    await expect(page.locator('input[type="file"]')).toHaveCount(0)
    await expect(page.getByLabel('账户私钥（64 位十六进制）')).toBeVisible()
    await expect(page.getByLabel('PGC 地址 RootSeed（64 位十六进制）')).toBeVisible()
    await expect(page.getByLabel('设置新钱包密码')).toBeVisible()
    await expect(page.getByLabel('确认新密码')).toBeVisible()
    const recoverButton = page.getByRole('button', { name: '恢复并进入钱包' })
    await expect(recoverButton).toBeDisabled()

    await page
      .getByLabel('账户私钥（64 位十六进制）')
      .fill('1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100')
    await page
      .getByLabel('PGC 地址 RootSeed（64 位十六进制）')
      .fill('a0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebf')
    await page.getByLabel('设置新钱包密码').fill('private-recovery-password')
    await page.getByLabel('确认新密码').fill('private-recovery-password')
    await expect(recoverButton).toBeEnabled()
    await recoverButton.click()
    await expect(page).toHaveURL(/\/wallet$/)
  })

  test('creates, backs up, locks, unlocks and reimports a browser wallet', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000)
    await page.goto('/wallet/setup')
    await page.getByLabel('钱包密码').fill('phase-one-password')
    await page.getByLabel('确认密码').fill('phase-one-password')
    const downloads = await createAndCollectBackups(page)
    const download = downloads.find((item) => item.suggestedFilename() === 'wallet.json')!
    const recoveryDownload = downloads.find(
      (item) => item.suggestedFilename() === 'PanguPay-recovery.json',
    )!
    const backupPath = testInfo.outputPath('wallet.json')
    await download.saveAs(backupPath)
    const recoveryPath = testInfo.outputPath('PanguPay-recovery.json')
    await recoveryDownload.saveAs(recoveryPath)
    await expect(page.getByRole('button', { name: '下载独立恢复材料' })).toHaveCount(0)
    await expect(page.getByText('wallet.json', { exact: true })).toBeVisible()
    await expect(page.getByText('PanguPay-recovery.json', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '进入钱包' })).toBeDisabled()
    await page.getByText('我已分别安全保存').click()
    await page.getByRole('button', { name: '进入钱包' }).click()
    await expect(page).toHaveURL(/\/wallet$/)
    await expect(page.getByRole('heading', { name: /你好/ })).toBeVisible()
    await expect(page.getByRole('region', { name: '资金状态' })).toContainText('资金状态')
    await expect(page.getByText('UTXO 可用', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('TXCer 可支付', { exact: false }).first()).toBeVisible()

    await page.getByRole('link', { name: '收款' }).first().click()
    const address = page.getByRole('status').filter({ hasText: /^[a-f0-9]{40}$/ })
    await expect(address).toBeVisible()
    const originalAddress = await address.textContent()
    await page.getByRole('button', { name: '复制地址' }).click()
    await expect(page.getByRole('button', { name: '已复制' })).toBeVisible()

    const persisted = await page.evaluate(
      () =>
        new Promise<{ envelope: unknown; localStorageValues: string[] }>((resolve, reject) => {
          const open = indexedDB.open('pangupay-wallet', 1)
          open.onerror = () => reject(open.error)
          open.onsuccess = () => {
            const database = open.result
            const request = database.transaction('keystore').objectStore('keystore').get('primary')
            request.onerror = () => reject(request.error)
            request.onsuccess = () => {
              const localStorageValues = Array.from(
                { length: localStorage.length },
                (_, index) => localStorage.getItem(localStorage.key(index) ?? '') ?? '',
              )
              resolve({ envelope: request.result, localStorageValues })
              database.close()
            }
          }
        }),
    )
    const persistedText = JSON.stringify(persisted)
    expect(persistedText).not.toContain('account_private_scalar')
    expect(persistedText).not.toContain('root_seed')

    await page.getByRole('button', { name: '打开账户菜单' }).click()
    const desktopAccountMenu = page.getByRole('menu', { name: '账户菜单' })
    await expect(desktopAccountMenu.getByRole('menuitem', { name: '担保组织' })).toBeVisible()
    await expect(desktopAccountMenu.getByRole('menuitem', { name: '设置' })).toBeHidden()
    await expect(desktopAccountMenu).not.toContainText('外观与语言')
    await page.keyboard.press('Escape')
    await page.getByRole('link', { name: '设置', exact: true }).click()
    await expect(page.getByRole('group', { name: '外观' })).toBeVisible()
    await expect(page.getByRole('group', { name: '语言' })).toBeVisible()
    await page.getByRole('radio', { name: '浅色' }).check()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await page.getByRole('radio', { name: 'English' }).check()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
    await page.getByRole('radio', { name: '简体中文' }).check()
    await page.getByRole('radio', { name: '跟随系统' }).check()
    await page.getByRole('button', { name: '锁定' }).click()
    await expect(page).toHaveURL(/\/wallet\/unlock$/)

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1366, height: 768 },
      { width: 1024, height: 768 },
    ]) {
      await page.setViewportSize(viewport)
      const documentOverflow = await page.evaluate(
        () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
      )
      expect(documentOverflow).toBeLessThanOrEqual(1)
    }

    await page.reload()
    await page.getByLabel('钱包密码').fill('definitely-wrong')
    await page.getByRole('button', { name: '解锁钱包' }).click()
    const unlockNotice = page.getByRole('alert')
    await expect(unlockNotice).toHaveCount(1)
    await expect(unlockNotice).toContainText('无法解锁，请检查密码')
    await expect(unlockNotice).not.toContainText('wallet unlock failed')
    await expect(page.getByLabel('钱包密码')).toHaveValue('')
    await expect(page.getByLabel('钱包密码')).toBeFocused()
    const unlockNoticeHeight = await unlockNotice.evaluate(
      (element) => element.getBoundingClientRect().height,
    )
    expect(unlockNoticeHeight).toBeLessThanOrEqual(32)
    await page.getByRole('link', { name: '忘记密码？' }).click()
    await expect(page).toHaveURL(/\/wallet\/recover$/)
    await expect(page.getByText('wallet.json 仍需要原密码')).toHaveCount(0)
    const recoveryScrollbar = await page
      .locator('.wallet-access__form')
      .evaluate((element) => getComputedStyle(element).scrollbarWidth)
    expect(recoveryScrollbar).toBe('none')
    await page.locator('input[type="file"]').setInputFiles(recoveryPath)
    await page.getByLabel('设置新钱包密码').fill('recovered-wallet-password')
    await page.getByLabel('确认新密码').fill('recovered-wallet-password')
    await page.getByRole('button', { name: '重建并进入钱包' }).click()
    await expect(page).toHaveURL(/\/wallet$/)

    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.open('pangupay-wallet', 1)
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const database = request.result
            const transaction = database.transaction(['keystore', 'public'], 'readwrite')
            transaction.objectStore('keystore').clear()
            transaction.objectStore('public').clear()
            transaction.onerror = () => reject(transaction.error)
            transaction.oncomplete = () => {
              database.close()
              resolve()
            }
          }
        }),
    )
    await page.goto('/wallet/setup')
    await page.getByRole('radio', { name: '导入' }).click()
    await page.locator('input[type="file"]').setInputFiles(backupPath)
    await page.getByLabel('wallet.json 原密码').fill('phase-one-password')
    await page.getByRole('button', { name: '验证并导入' }).click()
    await expect(page).toHaveURL(/\/wallet$/)
    await page.getByRole('link', { name: '收款' }).first().click()
    await expect(page.locator('output.receive-address')).toHaveText(originalAddress ?? '')

    await page.getByRole('link', { name: '设置', exact: true }).click()
    await page.getByRole('button', { name: '锁定' }).click()
    await page.getByRole('link', { name: '忘记密码？' }).click()
    await page.getByRole('button', { name: '清除本地钱包并重新开始' }).click()
    await expect(page.getByText('选择 recovery.json')).toHaveCount(0)
    await expect(page.getByLabel('设置新钱包密码')).toHaveCount(0)
    await expect(page.getByLabel('输入“清除本地钱包”以确认')).toHaveCount(0)
    const clearButton = page.getByRole('button', { name: '再次点击，确认清除' })
    await clearButton.click()
    await expect(page).toHaveURL(/\/wallet\/setup$/)
  })

  test('wallet routes never submit transactions or call GQNC operations', async ({ page }) => {
    const forbidden: string[] = []
    page.on('request', (request) => {
      if (
        request.url().includes('/submit-tx') ||
        request.url().includes('/submit-noguargroup-tx') ||
        request.url().includes('/committee/gqnc/')
      )
        forbidden.push(`${request.method()} ${request.url()}`)
    })
    await page.goto('/wallet/send')
    await expect(page).toHaveURL(/\/wallet\/setup$/)
    expect(forbidden).toEqual([])
  })

  test('setup remains usable at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/wallet/setup')
    await expect(page.getByRole('heading', { name: '建立你的钱包' })).toBeVisible()
    await page.getByLabel('钱包密码').focus()
    const focusShadow = await page
      .locator('#create-password')
      .locator('..')
      .evaluate((element) => getComputedStyle(element).boxShadow)
    expect(focusShadow).toContain('inset')
    expect(focusShadow).not.toContain('0px 0px 0px 3px')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('recovery page remains usable at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/wallet/setup')
    await page.getByLabel('钱包密码').fill('mobile-recovery-password')
    await page.getByLabel('确认密码').fill('mobile-recovery-password')
    await createAndCollectBackups(page)
    await page.getByText('我已分别安全保存').click()
    await page.getByRole('button', { name: '进入钱包' }).click()
    await page.getByRole('button', { name: '我的' }).click()
    await page.getByRole('menuitem', { name: '锁定钱包' }).click()
    await page.getByRole('link', { name: '忘记密码？' }).click()

    await expect(page.getByRole('heading', { name: '重新获得钱包访问' })).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('mobile wallet keeps balance composition and all functions reachable', async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/wallet/setup')
    await page.getByLabel('钱包密码').fill('mobile-ledger-password')
    await page.getByLabel('确认密码').fill('mobile-ledger-password')
    await createAndCollectBackups(page)
    await page.getByText('我已分别安全保存').click()
    await page.getByRole('button', { name: '进入钱包' }).click()

    await expect(page).toHaveURL(/\/wallet$/)
    await expect(page.getByText('UTXO 可用', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('TXCer 可支付', { exact: false }).first()).toBeVisible()
    await expect(page.getByRole('navigation', { name: '钱包导航' })).toBeVisible()
    await page.getByRole('button', { name: '我的' }).click()
    const accountMenu = page.getByRole('menu', { name: '账户菜单' })
    await expect(accountMenu.getByRole('menuitem', { name: '担保组织' })).toBeVisible()
    await expect(accountMenu.getByRole('menuitem', { name: '设置' })).toBeVisible()
    await expect(accountMenu.getByRole('menuitem', { name: '锁定钱包' })).toBeVisible()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
