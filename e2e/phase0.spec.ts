import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.describe('Phase 0 visual baseline', () => {
  test('landing page keeps its primary actions above the fold', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      '计算，为了无法计算的价值。',
    )
    await expect(page.getByRole('button', { name: '进入钱包' })).toBeVisible()
    await expect(page.getByRole('link', { name: '创建钱包' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: '导入钱包' })).toHaveCount(0)
    await expect(page.locator('.landing__actions .app-button')).toHaveCount(1)
    await expect(page.locator('[data-value-fold-field]')).toBeVisible()
    await expect(page.locator('[data-value-fold-field]')).toHaveAttribute(
      'data-motion-engine',
      'native-svg',
    )
    await expect(page.locator('[data-grid-line]')).toHaveCount(26)
    await expect(page.locator('[data-grid-layer="vertical"]')).toHaveCount(1)
    await expect(page.locator('[data-grid-layer="horizontal"]')).toHaveCount(1)
    await expect(page.locator('[data-field-logo]')).toHaveCount(1)
    await expect(page.locator('[data-field-wave]')).toHaveCount(1)
    await expect(page.locator('[data-quorum-flow]')).toHaveCount(0)
    await expect(page.locator('[data-flow-particle]')).toHaveCount(0)
    await expect(page.locator('[data-seal-segment]')).toHaveCount(0)
    await expect(page.locator('[data-orbit]')).toHaveCount(0)
    await expect(page.locator('.protocol-chip')).toHaveCount(0)
    await expect(page.getByText('担保型快速转账')).toHaveCount(0)
    await expect(
      page.getByText('先获得可支付的 TXCer，再由 GQNC 在后台完成轻量认证。'),
    ).toHaveCount(0)
    await expect(page.getByText('快速可用与后台认证彼此独立，安全状态始终清晰可见。')).toHaveCount(
      0,
    )

    const viewport = page.viewportSize()
    const box = await page.getByRole('button', { name: '进入钱包' }).boundingBox()
    const fieldBox = await page.locator('[data-value-fold-field]').boundingBox()
    expect(box && viewport && box.y + box.height <= viewport.height).toBe(true)
    expect(fieldBox && fieldBox.width).toBeGreaterThanOrEqual(480)
    expect(fieldBox && fieldBox.width).toBeLessThanOrEqual(541)
    expect(fieldBox && viewport && (fieldBox.x + fieldBox.width / 2) / viewport.width).toBeCloseTo(
      0.74,
      2,
    )
    expect(
      fieldBox && viewport && (fieldBox.y + fieldBox.height / 2) / viewport.height,
    ).toBeCloseTo(0.51, 2)

    const logoWidth = await page
      .locator('[data-field-logo]')
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).width))
    expect(logoWidth).toBe(84)
    const logoLightAnimation = await page
      .locator('.value-fold-field__logo-light')
      .evaluate((element) => getComputedStyle(element).animationName)
    expect(logoLightAnimation).toContain('value-fold-logo-breathe')
  })

  test('wallet entry sends a light wave into the value fold field', async ({ page }) => {
    await page.goto('/')

    const field = page.locator('[data-value-fold-field]')
    const bridge = page.locator('[data-signal-bridge]')
    await expect(field).toHaveAttribute('data-active', 'false')
    await expect(bridge).toHaveAttribute('data-active', 'false')
    await page.getByRole('button', { name: '进入钱包' }).hover()
    await expect(field).toHaveAttribute('data-active', 'true')
    await expect(bridge).toHaveAttribute('data-active', 'true')
    await page.locator('header').hover()
    await expect(field).toHaveAttribute('data-active', 'false')
    await expect(bridge).toHaveAttribute('data-active', 'false')
  })

  test('mathematical field breathes through curvature and responds to a fine pointer', async ({
    page,
  }) => {
    await page.goto('/')

    const field = page.locator('[data-value-fold-field]')
    const line = field.locator('[data-grid-line]').first()
    const before = await line.getAttribute('d')
    await expect.poll(() => line.getAttribute('d')).not.toBe(before)

    const bounds = await field.boundingBox()
    expect(bounds).not.toBeNull()
    await page.mouse.move(bounds!.x + bounds!.width * 0.78, bounds!.y + bounds!.height * 0.32)
    await expect
      .poll(() =>
        field.evaluate((element) =>
          getComputedStyle(element).getPropertyValue('--field-grid-x').trim(),
        ),
      )
      .not.toBe('0px')
  })

  test('theme and locale persist across reloads', async ({ page }) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem('pangupay.theme')) localStorage.setItem('pangupay.theme', 'dark')
      if (!localStorage.getItem('pangupay.locale')) localStorage.setItem('pangupay.locale', 'zh-CN')
    })
    await page.goto('/')
    const darkFieldMaterial = await page.locator('[data-value-fold-field]').evaluate((element) => {
      return getComputedStyle(element, '::before').backgroundImage
    })
    expect(darkFieldMaterial).toContain('rgba(7, 19, 31, 0.46)')
    await page.getByRole('button', { name: '切换到浅色主题' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    const lightFieldMaterial = await page.locator('[data-value-fold-field]').evaluate((element) => {
      return getComputedStyle(element, '::before').backgroundImage
    })
    expect(lightFieldMaterial).not.toContain('rgba(7, 19, 31, 0.46)')
    await page.goto('/__foundation')
    await page.getByRole('button', { name: 'Switch to English' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Foundation')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Foundation')
  })

  test('brand mark follows the active theme through currentColor', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pangupay.theme', 'dark')
      localStorage.setItem('pangupay.locale', 'zh-CN')
    })
    await page.goto('/')

    const mark = page.locator('.landing__brand .brand-mark__shape')
    await expect(mark).toHaveCount(1)
    const darkColors = await mark.evaluate((element) => {
      const style = getComputedStyle(element)
      return { background: style.backgroundColor, color: style.color }
    })
    expect(darkColors.background).toBe(darkColors.color)

    await page.getByRole('button', { name: '切换到浅色主题' }).click()
    const lightColors = await mark.evaluate((element) => {
      const style = getComputedStyle(element)
      return { background: style.backgroundColor, color: style.color }
    })
    expect(lightColors.background).toBe(lightColors.color)
    expect(lightColors.background).not.toBe(darkColors.background)
  })

  test('landscape hero keeps editorial type rhythm and a compact primary action', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 524, height: 616 })
    await page.addInitScript(() => localStorage.setItem('pangupay.theme', 'dark'))
    await page.goto('/')

    const lines = page.locator('[data-hero-line]')
    await expect(lines).toHaveCount(3)
    const lineMetrics = await lines.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return {
          bottom: box.bottom,
          fontSize: Number.parseFloat(style.fontSize),
          letterSpacing: Number.parseFloat(style.letterSpacing),
          top: box.top,
          x: box.x,
        }
      }),
    )

    expect(lineMetrics[1]!.top - lineMetrics[0]!.bottom).toBeGreaterThanOrEqual(6)
    expect(lineMetrics[2]!.top - lineMetrics[1]!.bottom).toBeGreaterThanOrEqual(3)
    expect(lineMetrics[0]!.fontSize / lineMetrics[2]!.fontSize).toBeCloseTo(0.84, 1)
    expect(lineMetrics[1]!.fontSize / lineMetrics[2]!.fontSize).toBeCloseTo(0.68, 1)
    expect(lineMetrics[2]!.fontSize).toBeGreaterThanOrEqual(86)
    expect(lineMetrics[2]!.fontSize).toBeLessThanOrEqual(90)
    expect(lineMetrics[2]!.letterSpacing / lineMetrics[2]!.fontSize).toBeGreaterThanOrEqual(-0.041)

    const button = await page.getByRole('button', { name: '进入钱包' }).boundingBox()
    expect(button).not.toBeNull()
    expect(button!.width).toBeGreaterThanOrEqual(170)
    expect(button!.width).toBeLessThanOrEqual(210)
    expect(button!.height).toBeGreaterThanOrEqual(54)
    expect(button!.height).toBeLessThanOrEqual(60)
    expect(Math.abs(button!.x - lineMetrics[0]!.x)).toBeLessThanOrEqual(1)

    const buttonMaterial = await page
      .getByRole('button', { name: '进入钱包' })
      .evaluate((element) => {
        const style = getComputedStyle(element)
        return {
          backdropFilter: style.backdropFilter,
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          borderTopWidth: style.borderTopWidth,
          boxShadow: style.boxShadow,
        }
      })
    expect(buttonMaterial.backdropFilter).toContain('blur')
    expect(buttonMaterial.backgroundColor).not.toBe('rgb(0, 113, 227)')
    expect(buttonMaterial.backgroundImage).toContain('linear-gradient')
    expect(buttonMaterial.borderTopWidth).toBe('0px')
    expect(buttonMaterial.boxShadow).not.toContain('inset')

    const contrastRatio = await page
      .getByRole('button', { name: '进入钱包' })
      .evaluate((element) => {
        const parseColor = (value: string): { alpha: number; rgb: number[] } => {
          const channels = value.match(/[\d.]+/g)!.map(Number)
          return { alpha: channels[3] ?? 1, rgb: channels.slice(0, 3) }
        }
        const composite = (
          foreground: { alpha: number; rgb: number[] },
          background: number[],
        ): number[] =>
          foreground.rgb.map(
            (channel, index) =>
              channel * foreground.alpha + background[index]! * (1 - foreground.alpha),
          )
        const luminance = (rgb: number[]): number => {
          const channels = rgb.map((channel) => {
            const value = channel! / 255
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
          })
          return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
        }
        const style = getComputedStyle(element)
        const canvas = parseColor(getComputedStyle(document.body).backgroundColor).rgb
        const backgroundRgb = composite(parseColor(style.backgroundColor), canvas)
        const foregroundRgb = composite(parseColor(style.color), backgroundRgb)
        const foreground = luminance(foregroundRgb)
        const background = luminance(backgroundRgb)
        const lighter = Math.max(foreground, background)
        const darker = Math.min(foreground, background)
        return (lighter + 0.05) / (darker + 0.05)
      })
    expect(contrastRatio).toBeGreaterThanOrEqual(4.5)
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

  test('reduced motion preserves the mathematical field without animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(page.locator('[data-grid-line]')).toHaveCount(26)
    const animation = await page.locator('[data-grid-layer="vertical"]').evaluate((element) => {
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
