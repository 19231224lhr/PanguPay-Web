import { ec as EC } from 'elliptic'
import { describe, expect, it, vi } from 'vitest'

import { canonicalJSONStringify, sha256Bytes } from '@/protocol-v2/canonical'
import { generateWalletCapsule } from '@/services/capsuleService'
import type { WalletRecord } from '@/wallet/types'

const ec = new EC('p256')
const capsule =
  '10000000@2apx2zLGg1P9xxxuNPZRcpuDY4etJjoGgkkUXCNHBaHiGVgvm28tPR9oi5mK63eH7akBjRSNKiVpbeKhRXtzj6iu4vt2U78Ggnc5VrbADFY8cwpiGtuEBzPgj'
const publicKey = {
  CurveName: 'P256',
  X: '48439561293906451759052585252797914202762949526041747995844080717082404635286',
  Y: '36134250956749795798585127919587881956611106672985015071877198253568414405109',
}
const wallet: WalletRecord = {
  account_id: '12345678',
  account_private_scalar: Buffer.from(
    new Uint8Array(32).fill(0).map((_, index) => (index === 31 ? 1 : 0)),
  ).toString('base64'),
  addresses: [
    {
      address: '00112233445566778899aabbccddeeff00112233',
      type: '0',
      root_seed: Buffer.from(new Uint8Array(32)).toString('base64'),
    },
  ],
}

describe('capsule generation service', () => {
  it('signs a member request and verifies the returned capsule before exposing it', async () => {
    let request: Record<string, unknown> | undefined
    const gateway = {
      generateGroupCapsule: vi.fn<(_groupID: string, value: unknown) => Promise<unknown>>(
        async (_groupID: string, value: unknown) => {
          request = value as Record<string, unknown>
          return { Success: true, OrgID: '10000000', CapsuleAddr: capsule }
        },
      ),
      generateRetailCapsule: vi.fn<(request: unknown) => Promise<unknown>>(),
      getOrganizationPublicKey: vi.fn<(orgID: string) => Promise<unknown>>().mockResolvedValue({
        org_id: '10000000',
        public_key: publicKey,
      }),
      getCommitteePublicKey: vi.fn<() => Promise<unknown>>(),
    }

    await expect(
      generateWalletCapsule({
        address: wallet.addresses[0]!.address,
        gateway,
        groupID: '10000000',
        timestamp: () => 42,
        wallet,
      }),
    ).resolves.toEqual({ capsule, orgID: '10000000', signer: 'organization' })

    expect(gateway.generateGroupCapsule).toHaveBeenCalledWith('10000000', expect.any(Object))
    expect(request).toMatchObject({
      Address: wallet.addresses[0]!.address,
      Timestamp: 42,
      UserID: wallet.account_id,
    })
    const signature = request?.Sig as { R: bigint; S: bigint }
    const material = { ...request, Sig: { R: null, S: null } }
    const accountPublicKey = ec.keyFromPrivate('1', 'hex').getPublic()
    expect(
      ec
        .keyFromPublic({
          x: accountPublicKey.getX().toString('hex'),
          y: accountPublicKey.getY().toString('hex'),
        })
        .verify(sha256Bytes(canonicalJSONStringify(material)), {
          r: signature.R.toString(16),
          s: signature.S.toString(16),
        }),
    ).toBe(true)
  })
})
