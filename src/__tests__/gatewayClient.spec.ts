import { describe, expect, it } from 'vitest'

import { GatewayClient, GatewayRequestError, parseGatewayJSON } from '@/services/gatewayClient'

describe('Gateway protocol JSON', () => {
  it('preserves unsafe integers as exact decimal strings', () => {
    expect(
      parseGatewayJSON('{"R":123456789012345678901234567890,"safe":42,"amount":"1.00000001"}'),
    ).toEqual({
      R: '123456789012345678901234567890',
      safe: 42,
      amount: '1.00000001',
    })
  })
})

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
}

describe('Gateway Phase 2 contracts', () => {
  it('uses the current local Gateway port by default', async () => {
    const calls: string[] = []
    const client = new GatewayClient({
      fetcher: async (input) => {
        calls.push(String(input))
        return jsonResponse([])
      },
    })

    await client.groups()

    expect(calls).toEqual(['http://127.0.0.1:3001/api/v1/groups'])
  })

  it('preserves an HTTP rejection as a structured response error', async () => {
    const client = new GatewayClient({
      baseURL: 'http://gateway.test',
      fetcher: async () =>
        new Response(JSON.stringify({ error: 'signature rejected' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 400,
        }),
    })

    await expect(client.submitNoGroupTransaction({})).rejects.toEqual(
      expect.objectContaining<Partial<GatewayRequestError>>({
        status: 400,
        body: { error: 'signature rejected' },
      }),
    )
  })

  it('uses the authoritative organization entry routes', async () => {
    const calls: Array<{ body?: string; method: string; url: string }> = []
    const client = new GatewayClient({
      baseURL: 'http://gateway.test',
      fetcher: async (input, init) => {
        calls.push({
          body: typeof init?.body === 'string' ? init.body : undefined,
          method: init?.method ?? 'GET',
          url: String(input),
        })
        return jsonResponse({ result: true })
      },
    })

    await client.groups()
    await client.group('group/a')
    await client.reOnline({ UserID: 'alice', UserSig: { R: 1, S: 2 } })
    await client.registerNoGroupAddress({ Address: 'abc', AddressOwnershipSig: {} })
    await client.joinGroup('group/a', { Status: 1, UserID: 'alice' })

    expect(calls).toEqual([
      { method: 'GET', url: 'http://gateway.test/api/v1/groups' },
      { method: 'GET', url: 'http://gateway.test/api/v1/groups/group%2Fa' },
      {
        body: JSON.stringify({ UserID: 'alice', UserSig: { R: 1, S: 2 } }),
        method: 'POST',
        url: 'http://gateway.test/api/v1/re-online',
      },
      {
        body: JSON.stringify({ Address: 'abc', AddressOwnershipSig: {} }),
        method: 'POST',
        url: 'http://gateway.test/api/v1/com/register-address',
      },
      {
        body: JSON.stringify({ Status: 1, UserID: 'alice' }),
        method: 'POST',
        url: 'http://gateway.test/api/v1/group%2Fa/assign/flow-apply',
      },
    ])
  })

  it('uses the real Assign and no-group transaction routes', async () => {
    const calls: Array<{ body?: string; method: string; url: string }> = []
    const client = new GatewayClient({
      baseURL: 'http://gateway.test',
      fetcher: async (input, init) => {
        calls.push({
          body: typeof init?.body === 'string' ? init.body : undefined,
          method: init?.method ?? 'GET',
          url: String(input),
        })
        return jsonResponse({ success: true })
      },
    })

    await client.submitAssignTransaction('g 1', { TX: { TXID: 'a'.repeat(64) } })
    await client.assignTransactionStatus('g 1', 'b'.repeat(64))
    await client.txCerSpendReadyStatus('g 1', 'b'.repeat(64))
    await client.schedulerDAGEvents('g 1', 'b'.repeat(64), 7, 25)
    await client.submitNoGroupTransaction({ TXHash: 'c'.repeat(64) })
    await client.pollCrossOrganizationTXCers('g 1', 'alice')
    await client.gqncStatus()
    await client.gqncCertifiedBlock(7)
    await client.gqncPerformance()
    await client.crossChainTransferStatus('d'.repeat(64))

    expect(calls).toEqual([
      {
        body: JSON.stringify({ TX: { TXID: 'a'.repeat(64) } }),
        method: 'POST',
        url: 'http://gateway.test/api/v1/g%201/assign/submit-tx',
      },
      {
        method: 'GET',
        url: `http://gateway.test/api/v1/g%201/assign/tx-status/${'b'.repeat(64)}`,
      },
      {
        method: 'GET',
        url: `http://gateway.test/api/v1/g%201/aggr/txcer-spend-ready/${'b'.repeat(64)}`,
      },
      {
        method: 'GET',
        url: `http://gateway.test/api/v1/g%201/assign/scheduler-dag-events?txID=${'b'.repeat(64)}&afterSeq=7&limit=25`,
      },
      {
        body: JSON.stringify({ TXHash: 'c'.repeat(64) }),
        method: 'POST',
        url: 'http://gateway.test/api/v1/com/submit-noguargroup-tx',
      },
      {
        method: 'GET',
        url: 'http://gateway.test/api/v1/g%201/assign/poll-cross-org-txcers?userID=alice&consume=false',
      },
      {
        method: 'GET',
        url: 'http://gateway.test/api/v1/committee/gqnc/status',
      },
      {
        method: 'GET',
        url: 'http://gateway.test/api/v1/committee/gqnc/certified-block/7',
      },
      {
        method: 'GET',
        url: 'http://gateway.test/api/v1/committee/gqnc/performance',
      },
      {
        method: 'GET',
        url: `http://gateway.test/api/v1/committee/cross-chain/transfers/${'d'.repeat(64)}`,
      },
    ])
  })

  it('reads the committee cross-chain readiness before transfer preparation', async () => {
    const calls: string[] = []
    const client = new GatewayClient({
      baseURL: 'http://gateway.test',
      fetcher: async (input) => {
        calls.push(String(input))
        return jsonResponse({
          status: 'ok',
          cross_chain: {
            enabled: true,
            ready: false,
            reason_code: 'BUILDER_UNAVAILABLE',
          },
        })
      },
    })

    await expect(client.crossChainCapability()).resolves.toEqual({
      enabled: true,
      ready: false,
      reasonCode: 'BUILDER_UNAVAILABLE',
    })
    expect(calls).toEqual(['http://gateway.test/api/v1/com/health'])
  })

  it('uses the existing capsule generation and authority routes', async () => {
    const calls: Array<{ body?: string; method: string; url: string }> = []
    const client = new GatewayClient({
      baseURL: 'http://gateway.test',
      fetcher: async (input, init) => {
        calls.push({
          body: typeof init?.body === 'string' ? init.body : undefined,
          method: init?.method ?? 'GET',
          url: String(input),
        })
        return jsonResponse({ Success: true })
      },
    })

    await client.generateGroupCapsule('g 1', { Address: 'abc' })
    await client.generateRetailCapsule({ Address: 'def' })
    await client.getOrganizationPublicKey('g 1')
    await client.getCommitteePublicKey()

    expect(calls).toEqual([
      {
        body: JSON.stringify({ Address: 'abc' }),
        method: 'POST',
        url: 'http://gateway.test/api/v1/g%201/assign/capsule/generate',
      },
      {
        body: JSON.stringify({ Address: 'def' }),
        method: 'POST',
        url: 'http://gateway.test/api/v1/com/capsule/generate',
      },
      {
        method: 'GET',
        url: 'http://gateway.test/api/v1/org/publickey?org_id=g+1',
      },
      {
        method: 'GET',
        url: 'http://gateway.test/api/v1/com/public-key',
      },
    ])
  })
})
