import { expect, test, type Download, type Page } from '@playwright/test'

import { mockReturningRetailEntry } from './helpers/walletEntry'

interface VisualCase {
  height: number
  label: string
  theme: 'dark' | 'light'
  width: number
}

const cases: VisualCase[] = [
  { height: 900, label: 'desktop', theme: 'dark', width: 1440 },
  { height: 900, label: 'desktop', theme: 'light', width: 1440 },
  { height: 844, label: 'mobile', theme: 'dark', width: 390 },
  { height: 844, label: 'mobile', theme: 'light', width: 390 },
]

test.beforeEach(async ({ page }) => {
  await mockReturningRetailEntry(page)
})

async function createWallet(page: Page, password: string): Promise<void> {
  await page.goto('/wallet/setup')
  await page.getByLabel('钱包密码').fill(password)
  await page.getByLabel('确认密码').fill(password)
  const downloads: Download[] = []
  const collect = (download: Download): void => {
    downloads.push(download)
  }
  page.on('download', collect)
  await page.getByRole('button', { name: '创建钱包并下载两份备份' }).click()
  await expect.poll(() => downloads.length).toBe(2)
  page.off('download', collect)
  await page.getByText('我已分别安全保存').click()
  await page.getByRole('button', { name: '进入钱包' }).click()
  await expect(page).toHaveURL(/\/wallet$/)
  await expect(page.locator('.wallet-entry-arrival')).toHaveCount(0)
}

async function openSettings(page: Page, width: number): Promise<void> {
  if (width >= 768) {
    await page.getByRole('link', { name: '设置', exact: true }).click()
    return
  }

  await page.getByRole('button', { name: '我的' }).click()
  await page.getByRole('menu').getByRole('menuitem', { name: '设置' }).click()
}

for (const visualCase of cases) {
  test(`Ledger Plane ${visualCase.theme} ${visualCase.label}`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width: visualCase.width, height: visualCase.height })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(
      ({ theme }) => {
        localStorage.setItem('pangupay.theme', theme)
        localStorage.setItem('pangupay.locale', 'zh-CN')
      },
      { theme: visualCase.theme },
    )

    await page.goto('/')
    await expect(page).toHaveScreenshot(
      `ledger-plane-${visualCase.theme}-${visualCase.label}-landing.png`,
      { animations: 'disabled' },
    )

    const password = `visual-${visualCase.theme}-${visualCase.label}-wallet`
    await createWallet(page, password)
    const shellMasks = [
      page.locator('.app-shell__account'),
      page.locator('.app-shell__mobile-account'),
    ]
    await expect(page).toHaveScreenshot(
      `ledger-plane-${visualCase.theme}-${visualCase.label}-overview.png`,
      {
        animations: 'disabled',
        mask: [
          ...shellMasks,
          page.locator('.wallet-page-header h1'),
          page.locator('.wallet-balance-field__sync'),
        ],
        maskColor: visualCase.theme === 'dark' ? '#20242a' : '#dfe3e8',
        maxDiffPixels: 12,
      },
    )

    await page.getByRole('link', { name: '查看详情' }).click()
    await expect(page).toHaveURL(/\/wallet\/security$/)
    await expect(page).toHaveScreenshot(
      `ledger-plane-${visualCase.theme}-${visualCase.label}-security.png`,
      {
        animations: 'disabled',
        mask: [...shellMasks, page.locator('.wallet-page > .wallet-section:last-of-type summary')],
        maskColor: visualCase.theme === 'dark' ? '#20242a' : '#dfe3e8',
        maxDiffPixels: 12,
      },
    )

    await openSettings(page, visualCase.width)
    await page.getByRole('button', { name: '锁定' }).click()
    await expect(page).toHaveURL(/\/wallet\/unlock$/)
    await expect(page).toHaveScreenshot(
      `ledger-plane-${visualCase.theme}-${visualCase.label}-unlock.png`,
      { animations: 'disabled' },
    )
  })
}
