import { describe, expect, it } from 'vitest'

import { parseGatewayJSON } from '@/services/gatewayClient'

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
