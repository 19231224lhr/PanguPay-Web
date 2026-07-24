import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.describe('Phase 0 visual baseline', () => {
  test('landing page keeps its primary actions above the fold', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('价值')
    await expect(page.getByRole('link', { name: '进入钱包' })).toBeVisible()
    await expect(page.getByText('Wallet signed')).toBeVisible()
    await expect(page.getByText('3-of-4 BlockQC')).toBeVisible()

    const viewport = page.viewportSize()
    const box = await page.getByRole('link', { name: '进入钱包' }).boundingBox()
    expect(box && viewport && box.y + box.height <= viewport.height).toBe(true)
  })

  test('theme and locale persist across reloads', async ({ page }) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem('pangupay.theme')) localStorage.setItem('pangupay.theme', 'dark')
      if (!localStorage.getItem('pangupay.locale')) localStorage.setItem('pangupay.locale', 'zh-CN')
    })
    await page.goto('/__foundation')
    await page.getByRole('button', { name: '切换到浅色主题' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await page.getByRole('button', { name: 'Switch to English' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Foundation')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Foundation')
  })

  test('wallet shell adapts to mobile without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/__ledger-preview')
    await expect(page.getByText('演示数据')).toBeVisible()
    await expect(page.getByRole('navigation', { name: '主要导航' })).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('reduced motion preserves the protocol story without animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(page.getByText('TXCer spend-ready')).toBeVisible()
    const animation = await page
      .locator('[data-orbit]')
      .first()
      .evaluate((element) => {
        const style = getComputedStyle(element)
        return `${style.animationName}:${style.animationDuration}`
      })
    expect(animation.startsWith('none:') || animation.endsWith(':0s')).toBe(true)
  })

  test('visible controls keep a minimum 44px hit target', async ({ page }) => {
    for (const route of ['/', '/__ledger-preview', '/__foundation']) {
      await page.goto(route)
      const undersized = await page
        .locator('a[href], button, input, select, textarea')
        .evaluateAll((elements) =>
          elements
            .filter((element) => {
              const style = getComputedStyle(element)
              const box = element.getBoundingClientRect()
              return style.visibility !== 'hidden' && style.display !== 'none' && box.width > 0
            })
            .map((element) => {
              const box = element.getBoundingClientRect()
              return {
                element: element.outerHTML.slice(0, 160),
                height: Math.round(box.height),
                width: Math.round(box.width),
              }
            })
            .filter(({ height, width }) => height < 44 || width < 44),
        )

      expect(undersized, `${route} contains undersized controls`).toEqual([])
    }
  })

  test('pages have no serious accessibility violations', async ({ page }) => {
    for (const route of ['/', '/__ledger-preview', '/__foundation']) {
      await page.goto(route)
      const result = await new AxeBuilder({ page }).analyze()
      expect(
        result.violations.filter((violation) =>
          ['critical', 'serious'].includes(violation.impact || ''),
        ),
      ).toEqual([])
    }
  })
})
