import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..', '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')

describe('real E2E configuration safety', () => {
  it('does not embed the deployment target or wallet password', () => {
    const orchestrator = source('scripts/run-real-e2e.mjs')
    const capsule = source('scripts/check-capsule-real-backend.mjs')
    const environment = source('e2e-real/env.ts')

    expect(orchestrator).not.toMatch(/PANGU_REAL_E2E_LIGHT_GRPC_HOST\s*\|\|/)
    expect(orchestrator).not.toMatch(/PANGU_REAL_E2E_LIGHT_(?:RPC|RECIPIENT)'\s*,/)
    expect(environment).toContain("password: required('PANGU_REAL_E2E_WALLET_PASSWORD')")
    expect(capsule).not.toMatch(/argument\('--base-url'\s*,/)
    expect(capsule).not.toMatch(/const password\s*=\s*['"]/)
    expect(capsule).toContain('process.env.PANGU_REAL_E2E_WALLET_PASSWORD?.trim()')
  })

  it('redacts deployment origins from persisted evidence', () => {
    const evidence = source('e2e-real/evidence.ts')
    const capsule = source('scripts/check-capsule-real-backend.mjs')

    expect(evidence).not.toContain('requestURL.origin')
    expect(capsule).not.toMatch(/\n\s+baseURL,\s*\n/)
    expect(capsule).not.toMatch(/\n\s+gatewayBase:\s*fixture\.gatewayBase,\s*\n/)
    expect(capsule).not.toContain('response.text()')
    expect(capsule).not.toContain('${response.url()}')
    expect(capsule).toContain('new URL(response.url()).pathname')

    const orchestrator = source('scripts/run-real-e2e.mjs')
    expect(orchestrator).not.toContain('backend ready: ${ready.gatewayBase}')
  })
})
