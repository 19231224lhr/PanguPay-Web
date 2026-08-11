import process from 'node:process'

import { defineConfig } from '@playwright/test'

const runDir = process.env.PANGU_REAL_E2E_RUN_DIR || 'artifacts/real-e2e/manual'
const baseURL = process.env.PANGU_REAL_E2E_BASE_URL || 'http://127.0.0.1:5174'

export default defineConfig({
  testDir: './e2e-real',
  testIgnore: '**/*.unit.spec.ts',
  timeout: 12 * 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  outputDir: `${runDir}/test-results`,
  reporter: [
    ['list'],
    ['json', { outputFile: `${runDir}/playwright-results.json` }],
    ['html', { outputFolder: `${runDir}/html-report`, open: 'never' }],
  ],
  use: {
    baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    screenshot: 'only-on-failure',
  },
  webServer: process.env.PANGU_REAL_E2E_EXTERNAL_FRONTEND
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 5174',
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
})
