import { describe, expect, it, vi } from 'vitest'

import { isCapsuleAddress, parseCapsuleAddress, verifyCapsuleAddress } from '@/protocol-v2/capsule'
import { sha256Bytes } from '@/protocol-v2/canonical'
import { resolveTransferRecipient } from '@/transfer/capsuleRecipient'

const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function decodeBase58(value: string): number[] {
  let number = 0n
  for (const character of value) number = number * 58n + BigInt(alphabet.indexOf(character))
  const bytes: number[] = []
  while (number > 0n) {
    bytes.unshift(Number(number & 0xffn))
    number >>= 8n
  }
  for (const character of value) {
    if (character !== '1') break
    bytes.unshift(0)
  }
  return bytes
}

function encodeBase58(bytes: number[]): string {
  let number = bytes.reduce((value, byte) => (value << 8n) | BigInt(byte), 0n)
  let encoded = ''
  while (number > 0n) {
    encoded = alphabet[Number(number % 58n)]! + encoded
    number /= 58n
  }
  for (const byte of bytes) {
    if (byte !== 0) break
    encoded = `1${encoded}`
  }
  return encoded || '1'
}

function capsuleWithMutatedPayload(index: number): string {
  const encoded = vector.capsule.slice(9)
  const decoded = decodeBase58(encoded)
  const payload = decoded.slice(0, -4)
  payload[index] = payload[index]! ^ 1
  const checksum = sha256Bytes(sha256Bytes(payload)).slice(0, 4)
  return `${vector.orgID}@${encodeBase58([...payload, ...checksum])}`
}

const vector = {
  address: '00112233445566778899aabbccddeeff00112233',
  capsule:
    '10000000@2apx2zLGg1P9xxxuNPZRcpuDY4etJjoGgkkUXCNHBaHiGVgvm28tPR9oi5mK63eH7akBjRSNKiVpbeKhRXtzj6iu4vt2U78Ggnc5VrbADFY8cwpiGtuEBzPgj',
  orgID: '10000000',
  publicKey: {
    CurveName: 'P256',
    X: '48439561293906451759052585252797914202762949526041747995844080717082404635286',
    Y: '36134250956749795798585127919587881956611106672985015071877198253568414405109',
  },
} as const

describe('capsule protocol', () => {
  it('parses and verifies the Go-compatible capsule vector', () => {
    expect(parseCapsuleAddress(vector.capsule)).toEqual({
      orgID: vector.orgID,
      payload: vector.capsule.slice(9),
    })
    expect(isCapsuleAddress(vector.capsule)).toBe(true)
    expect(verifyCapsuleAddress(vector.capsule, vector.publicKey)).toEqual({
      address: vector.address,
      orgID: vector.orgID,
    })
  })

  it('fails closed for checksum, payload signature, curve, and key tampering', () => {
    expect(() => verifyCapsuleAddress(`${vector.capsule.slice(0, -1)}1`, vector.publicKey)).toThrow(
      '胶囊地址',
    )
    expect(() => verifyCapsuleAddress(capsuleWithMutatedPayload(52), vector.publicKey)).toThrow(
      '签名验证失败',
    )
    expect(() => verifyCapsuleAddress(vector.capsule, { ...vector.publicKey, X: '1' })).toThrow(
      '公钥无效',
    )
    expect(() =>
      verifyCapsuleAddress(vector.capsule, { ...vector.publicKey, CurveName: 'P384' }),
    ).toThrow('公钥曲线无效')
    expect(isCapsuleAddress('10000000@not-base58-0')).toBe(false)
  })

  it('rejects malformed organization IDs and payload lengths', () => {
    expect(() => parseCapsuleAddress(`1000000@${vector.capsule.slice(9)}`)).toThrow('格式无效')
    const shortPayload = Array.from({ length: 83 }, () => 0)
    const checksum = sha256Bytes(sha256Bytes(shortPayload)).slice(0, 4)
    expect(() =>
      parseCapsuleAddress(`10000000@${encodeBase58([...shortPayload, ...checksum])}`),
    ).toThrow('载荷长度无效')
  })
})

describe('capsule transfer recipient resolution', () => {
  it('keeps raw addresses on the zero-request path', async () => {
    const gateway = {
      getCommitteePublicKey: vi.fn<() => Promise<unknown>>(),
      getOrganizationPublicKey: vi.fn<(orgID: string) => Promise<unknown>>(),
    }

    await expect(resolveTransferRecipient(vector.address, 'normal', gateway)).resolves.toEqual({
      address: vector.address,
      kind: 'raw',
    })
    expect(gateway.getCommitteePublicKey).not.toHaveBeenCalled()
    expect(gateway.getOrganizationPublicKey).not.toHaveBeenCalled()
  })

  it('resolves a verified capsule before transaction construction', async () => {
    const gateway = {
      getCommitteePublicKey: vi.fn<() => Promise<unknown>>(),
      getOrganizationPublicKey: vi.fn<(orgID: string) => Promise<unknown>>().mockResolvedValue({
        org_id: vector.orgID,
        public_key: vector.publicKey,
      }),
    }

    await expect(resolveTransferRecipient(vector.capsule, 'quick', gateway)).resolves.toEqual({
      address: vector.address,
      capsule: vector.capsule,
      kind: 'capsule',
      orgID: vector.orgID,
    })
    expect(gateway.getOrganizationPublicKey).toHaveBeenCalledWith(vector.orgID)
  })

  it('rejects capsule addresses for cross-chain transfers before key lookup', async () => {
    const gateway = {
      getCommitteePublicKey: vi.fn<() => Promise<unknown>>(),
      getOrganizationPublicKey: vi.fn<(orgID: string) => Promise<unknown>>(),
    }

    await expect(resolveTransferRecipient(vector.capsule, 'cross', gateway)).rejects.toThrow(
      '跨链转账暂不支持胶囊地址',
    )
    expect(gateway.getOrganizationPublicKey).not.toHaveBeenCalled()
  })

  it('rejects an authority response bound to another organization', async () => {
    const gateway = {
      getCommitteePublicKey: vi.fn<() => Promise<unknown>>(),
      getOrganizationPublicKey: vi.fn<(orgID: string) => Promise<unknown>>().mockResolvedValue({
        org_id: '99999999',
        public_key: vector.publicKey,
      }),
    }

    await expect(resolveTransferRecipient(vector.capsule, 'normal', gateway)).rejects.toThrow(
      '组织身份不匹配',
    )
  })
})
