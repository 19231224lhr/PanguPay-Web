import { readFileSync } from 'node:fs'
import process from 'node:process'

export interface RealFixtureUser {
  accountID: string
  accountPrivateKey: string
  address: string
  addressRootSeedHex: string
  balance: number
}

export interface RealFixture {
  gatewayBase: string
  groupID: string
  alice: RealFixtureUser
  bob: RealFixtureUser
}

export interface RealEnvironment {
  baseURL: string
  gatewayBase: string
  groupID: string
  lightRecipient: string
  lightRPC: string
  lightUnitsPerPGC: bigint
  password: string
  runDir: string
  fixture: RealFixture
  headless: boolean
}

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`missing required real E2E environment variable: ${name}`)
  return value
}

export function loadRealEnvironment(): RealEnvironment {
  const fixturePath = required('PANGU_REAL_E2E_FIXTURE')
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as RealFixture
  if (!fixture.alice?.accountPrivateKey || !fixture.alice.addressRootSeedHex) {
    throw new Error('real E2E fixture does not contain an importable Alice account')
  }
  if (!fixture.bob?.accountPrivateKey || !fixture.bob.addressRootSeedHex) {
    throw new Error('real E2E fixture does not contain an importable retail funding account')
  }
  return {
    baseURL: required('PANGU_REAL_E2E_BASE_URL').replace(/\/+$/, ''),
    gatewayBase: (process.env.PANGU_REAL_E2E_GATEWAY || fixture.gatewayBase).replace(/\/+$/, ''),
    groupID: process.env.PANGU_REAL_E2E_GROUP_ID || fixture.groupID,
    lightRecipient: required('PANGU_REAL_E2E_LIGHT_RECIPIENT'),
    lightRPC: required('PANGU_REAL_E2E_LIGHT_RPC').replace(/\/+$/, ''),
    lightUnitsPerPGC: BigInt(
      process.env.PANGU_REAL_E2E_LIGHT_UNITS_PER_PGC || '1000000000000000000',
    ),
    password: required('PANGU_REAL_E2E_WALLET_PASSWORD'),
    runDir: required('PANGU_REAL_E2E_RUN_DIR'),
    fixture,
    headless: process.env.PANGU_REAL_E2E_HEADLESS === '1',
  }
}
