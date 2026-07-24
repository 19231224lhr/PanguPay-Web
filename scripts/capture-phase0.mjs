import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { chromium } from '@playwright/test'

const baseURL = process.env.PANGUPAY_PREVIEW_URL || 'http://127.0.0.1:5174'
const outputDirectory = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(os.tmpdir(), 'pangupay-phase0-visual')

await fs.mkdir(outputDirectory, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge', headless: true })

async function capture({ file, locale, route, theme, viewport }) {
  const context = await browser.newContext({ viewport })
  await context.addInitScript(
    ({ nextLocale, nextTheme }) => {
      localStorage.setItem('pangupay.locale', nextLocale)
      localStorage.setItem('pangupay.theme', nextTheme)
    },
    { nextLocale: locale, nextTheme: theme },
  )
  const page = await context.newPage()
  await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: path.join(outputDirectory, file), fullPage: true })
  await context.close()
}

try {
  await capture({
    file: 'landing-dark-desktop.png',
    locale: 'zh-CN',
    route: '/',
    theme: 'dark',
    viewport: { width: 1440, height: 900 },
  })
  await capture({
    file: 'ledger-light-desktop.png',
    locale: 'zh-CN',
    route: '/__ledger-preview',
    theme: 'light',
    viewport: { width: 1440, height: 900 },
  })
  await capture({
    file: 'foundation-dark-desktop.png',
    locale: 'en-US',
    route: '/__foundation',
    theme: 'dark',
    viewport: { width: 1440, height: 900 },
  })
  await capture({
    file: 'landing-dark-mobile.png',
    locale: 'zh-CN',
    route: '/',
    theme: 'dark',
    viewport: { width: 390, height: 844 },
  })
  await capture({
    file: 'ledger-light-mobile.png',
    locale: 'en-US',
    route: '/__ledger-preview',
    theme: 'light',
    viewport: { width: 390, height: 844 },
  })
  console.log(outputDirectory)
} finally {
  await browser.close()
}
