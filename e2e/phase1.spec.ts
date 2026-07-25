import { expect, test } from '@playwright/test'

test.describe('Phase 1 wallet foundation', () => {
  test('landing resolves an absent wallet to setup', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '进入钱包' }).click()
    await expect(page).toHaveURL(/\/wallet\/setup$/)
    await expect(page.getByRole('heading', { name: '建立你的钱包' })).toBeVisible()
  })

  test('creates, backs up, locks, unlocks and reimports a browser wallet', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000)
    await page.goto('/wallet/setup')
    await page.getByLabel('钱包密码').fill('phase-one-password')
    await page.getByLabel('确认密码').fill('phase-one-password')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: '创建并下载备份' }).click()
    const download = await downloadPromise
    const backupPath = testInfo.outputPath('wallet.json')
    await download.saveAs(backupPath)
    await expect(page.getByRole('button', { name: '进入钱包' })).toBeDisabled()
    await page.getByText('我已将 wallet.json 安全保存').click()
    await page.getByRole('button', { name: '进入钱包' }).click()
    await expect(page).toHaveURL(/\/wallet$/)
    await expect(page.getByRole('heading', { name: /你好/ })).toBeVisible()

    await page.getByRole('link', { name: '收款' }).first().click()
    const address = page.getByText(/^[a-f0-9]{40}$/)
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

    await page.getByRole('link', { name: '设置' }).click()
    await page.getByRole('button', { name: '锁定' }).click()
    await expect(page).toHaveURL(/\/wallet\/unlock$/)
    await page.reload()
    await page.getByLabel('钱包密码').fill('phase-one-password')
    await page.getByRole('button', { name: '解锁钱包' }).click()
    await expect(page).toHaveURL(/\/wallet$/)

    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase('pangupay-wallet')
          request.onerror = () => reject(request.error)
          request.onblocked = () => reject(new Error('wallet database deletion was blocked'))
          request.onsuccess = () => resolve()
        }),
    )
    await page.goto('/wallet/setup')
    await page.getByRole('radio', { name: '导入' }).click()
    await page.locator('input[type="file"]').setInputFiles(backupPath)
    await page.getByLabel('钱包密码').fill('phase-one-password')
    await page.getByRole('button', { name: '验证并导入' }).click()
    await expect(page).toHaveURL(/\/wallet$/)
    await page.getByRole('link', { name: '收款' }).first().click()
    await expect(page.locator('output.receive-address')).toHaveText(originalAddress ?? '')
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
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
