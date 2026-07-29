import { ec as EC } from 'elliptic'
import { describe, expect, it, vi } from 'vitest'

import {
  bytesToBase64,
  canonicalJSONStringify,
  hexToBytes,
  sha256Bytes,
} from '@/protocol-v2/canonical'
import { verifyCanonicalMaterial } from '@/transfer'
import type { WalletRecord } from '@/wallet/types'
import { deriveAddressFromRootSeed } from '@/wallet/identity'
import {
  createGatewayWalletEntryService,
  type WalletEntryGatewayPort,
} from '@/services/walletEntryGateway'
import { stringifyGatewayJSON } from '@/services/gatewayClient'

const ec = new EC('p256')
const accountPrivateScalar = '1'.padStart(64, '0')
const rootSeed = '22'.repeat(32)
const derivedAddress = deriveAddressFromRootSeed(rootSeed, 0)
const accountPublicKey = bytesToBase64(
  hexToBytes(ec.keyFromPrivate(accountPrivateScalar, 'hex').getPublic().encode('hex', false)),
)

const record: WalletRecord = {
  account_id: '47065319',
  account_private_scalar: bytesToBase64(hexToBytes(accountPrivateScalar)),
  addresses: [
    { address: derivedAddress.address, type: '0', root_seed: bytesToBase64(hexToBytes(rootSeed)) },
  ],
}

function gateway(overrides: Partial<WalletEntryGatewayPort> = {}): WalletEntryGatewayPort {
  return {
    groups: vi.fn<WalletEntryGatewayPort['groups']>(async () => ({ success: true, groups: [] })),
    group: vi.fn<WalletEntryGatewayPort['group']>(async () => ({})),
    reOnline: vi.fn<WalletEntryGatewayPort['reOnline']>(async () => ({
      IsInGroup: false,
      GuarantorGroupID: '',
    })),
    queryAddressGroups: vi.fn<WalletEntryGatewayPort['queryAddressGroups']>(async () => ({
      Addresstogroup: {},
    })),
    queryAddresses: vi.fn<WalletEntryGatewayPort['queryAddresses']>(async (addresses) => ({
      AddressData: Object.fromEntries(
        addresses.map((address) => [
          address,
          { SignPublicKeyV2: { Algorithm: 'ecdsa_p256', PublicKey: accountPublicKey } },
        ]),
      ),
    })),
    joinGroup: vi.fn<WalletEntryGatewayPort['joinGroup']>(async () => ({ result: true })),
    registerGroupAddress: vi.fn<WalletEntryGatewayPort['registerGroupAddress']>(async () => ({
      result: true,
    })),
    unbindGroupAddress: vi.fn<WalletEntryGatewayPort['unbindGroupAddress']>(async () => ({
      result: true,
    })),
    registerNoGroupAddress: vi.fn<WalletEntryGatewayPort['registerNoGroupAddress']>(async () => ({
      success: true,
    })),
    ...overrides,
  }
}

function verifyLegacySignature(material: unknown, signature: { R: bigint; S: bigint }): boolean {
  const key = ec.keyFromPrivate(accountPrivateScalar, 'hex')
  return key.verify(sha256Bytes(canonicalJSONStringify(material)), {
    r: signature.R.toString(16),
    s: signature.S.toString(16),
  })
}

describe('Gateway wallet entry adapter', () => {
  it('serializes Go legacy signatures as raw JSON integers without changing field order', () => {
    expect(stringifyGatewayJSON({ UserID: '47065319', Sig: { R: 12n, S: 34n } })).toBe(
      '{"UserID":"47065319","Sig":{"R":12,"S":34}}',
    )
  })

  it('recovers authoritative membership with the signed Go re-online material', async () => {
    let sent: Record<string, unknown> | undefined
    const port = gateway({
      reOnline: vi.fn<WalletEntryGatewayPort['reOnline']>(async (message) => {
        sent = message as Record<string, unknown>
        return { UserID: record.account_id, IsInGroup: true, GuarantorGroupID: 'group-a' }
      }),
      queryAddressGroups: vi.fn<WalletEntryGatewayPort['queryAddressGroups']>(
        async (addresses) => ({
          UserID: record.account_id,
          Addresstogroup: { [addresses[0]!]: { GroupID: 'group-a' } },
        }),
      ),
    })
    const service = createGatewayWalletEntryService({
      gateway: port,
      getWalletRecord: () => record,
    })

    await expect(service.recover()).resolves.toEqual({
      reOnline: { isInGroup: true, groupId: 'group-a' },
      addressGroupIds: ['group-a'],
    })
    expect(sent).toBeDefined()
    const sentMessage = sent as Record<string, unknown> & { Sig: { R: bigint; S: bigint } }
    expect(Object.keys(sentMessage)).toEqual(['UserID', 'FromPeerID', 'Address', 'Sig'])
    expect(sentMessage.FromPeerID).toBe('')
    const { Sig, ...material } = sentMessage
    expect(verifyLegacySignature({ ...material, Sig: { R: null, S: null } }, Sig)).toBe(true)
  })

  it('maps BootNode groups without inventing unavailable runtime data', async () => {
    const port = gateway({
      groups: vi.fn<WalletEntryGatewayPort['groups']>(async () => ({
        groups: [{ group_id: 'b' }, { group_id: 'a' }, { group_id: '1' }],
      })),
    })
    const service = createGatewayWalletEntryService({
      gateway: port,
      getWalletRecord: () => record,
    })

    await expect(service.listOrganizations()).resolves.toEqual([
      { id: 'a', name: '担保组织 a' },
      { id: 'b', name: '担保组织 b' },
    ])
  })

  it('maps an authoritative group detail without inventing ratings or fees', async () => {
    const port = gateway({
      group: vi.fn<WalletEntryGatewayPort['group']>(async () => ({
        PeerGroupID: 'topic-a',
        AssiID: 'assign-a',
        AssiPeerID: 'assign-peer-a',
        AggrID: 'aggregation-a',
        AggrPeerID: 'aggregation-peer-a',
        PledgeAddress: 'pledge-address-a',
        PledgeAmount: '1250.00000000',
        GuarTable: { guarantorA: 'peer-a', guarantorB: 'peer-b' },
        Certifiers: {
          certifierA: {
            certifierID: 'txcer-a',
            peerID: 'txcer-peer-a',
            apiEndpoint: 'http://txcer-a.test',
            status: 'active',
          },
          certifierB: { peerID: 'txcer-peer-b', status: 'active' },
          certifierC: { peerID: 'txcer-peer-c', status: 'standby' },
        },
        AssignAPIEndpoint: 'http://assign.test',
        AggrAPIEndpoint: 'http://aggr.test',
      })),
    })
    const service = createGatewayWalletEntryService({
      gateway: port,
      getWalletRecord: () => record,
    })

    await expect(service.organization('group-a', '星河担保组织')).resolves.toEqual({
      id: 'group-a',
      name: '星河担保组织',
      pledgeAmount: '1250.00000000',
      pledgeAddress: 'pledge-address-a',
      guarantorCount: 2,
      certifierCount: 3,
      assignAvailable: true,
      aggregationAvailable: true,
      assignEndpoint: 'http://assign.test',
      aggregationEndpoint: 'http://aggr.test',
      peerGroupId: 'topic-a',
      nodes: [
        {
          role: 'assign',
          id: 'assign-a',
          peerId: 'assign-peer-a',
          endpoint: 'http://assign.test',
        },
        {
          role: 'aggregation',
          id: 'aggregation-a',
          peerId: 'aggregation-peer-a',
          endpoint: 'http://aggr.test',
        },
        {
          role: 'txcer',
          id: 'txcer-a',
          peerId: 'txcer-peer-a',
          endpoint: 'http://txcer-a.test',
          status: 'active',
        },
        { role: 'txcer', id: 'certifierB', peerId: 'txcer-peer-b', status: 'active' },
        { role: 'txcer', id: 'certifierC', peerId: 'txcer-peer-c', status: 'standby' },
        { role: 'guarantor', id: 'guarantorA', peerId: 'peer-a' },
        { role: 'guarantor', id: 'guarantorB', peerId: 'peer-b' },
      ],
    })
  })

  it('registers every wallet address as no-group with address ownership signatures', async () => {
    const requests: Array<Record<string, unknown>> = []
    const port = gateway({
      registerNoGroupAddress: vi.fn<WalletEntryGatewayPort['registerNoGroupAddress']>(
        async (message) => {
          requests.push(message as Record<string, unknown>)
          return { success: true }
        },
      ),
      queryAddressGroups: vi.fn<WalletEntryGatewayPort['queryAddressGroups']>(
        async (addresses) => ({
          Addresstogroup: Object.fromEntries(
            addresses.map((address) => [address, { GroupID: '1' }]),
          ),
        }),
      ),
    })
    const service = createGatewayWalletEntryService({
      gateway: port,
      getWalletRecord: () => record,
      timestamp: () => 123_456,
      confirmationAttempts: 1,
    })

    await service.registerNoGroup()

    expect(requests).toHaveLength(1)
    const request = requests[0]!
    expect(request).not.toHaveProperty('Sig')
    expect(Object.keys(request)).toEqual([
      'Address',
      'PublicKeyNew',
      'GroupID',
      'TimeStamp',
      'Type',
      'SeedAnchor',
      'SeedChainStep',
      'DefaultSpendAlgorithm',
      'SignPublicKeyV2',
      'AddressOwnershipSig',
    ])
    const { AddressOwnershipSig, ...material } = request as typeof request & {
      AddressOwnershipSig: { Algorithm: string; Signature: string }
    }
    expect(
      verifyCanonicalMaterial(material, {
        signature: AddressOwnershipSig,
        publicKey: {
          Algorithm: 'ecdsa_p256',
          PublicKey: bytesToBase64(hexToBytes(derivedAddress.publicKeyHex)),
        },
      }),
    ).toBe(true)
  })

  it('refreshes the idempotent no-group authorization when routing already says group 1', async () => {
    let groupChecks = 0
    const requests: Array<Record<string, unknown>> = []
    const port = gateway({
      queryAddressGroups: vi.fn<WalletEntryGatewayPort['queryAddressGroups']>(async (addresses) => {
        groupChecks += 1
        return {
          Addresstogroup: Object.fromEntries(
            addresses.map((address) => [address, { GroupID: '1' }]),
          ),
        }
      }),
      queryAddresses: vi.fn<WalletEntryGatewayPort['queryAddresses']>(async () => ({
        AddressData: {},
      })),
      registerNoGroupAddress: vi.fn<WalletEntryGatewayPort['registerNoGroupAddress']>(
        async (message) => {
          requests.push(message as Record<string, unknown>)
          return { success: true }
        },
      ),
    })
    const timestamp = vi
      .fn<() => number>()
      .mockReturnValueOnce(123_456)
      .mockReturnValueOnce(789_012)
    const service = createGatewayWalletEntryService({
      gateway: port,
      getWalletRecord: () => record,
      timestamp,
      confirmationAttempts: 1,
      sleep: async () => undefined,
    })

    await service.registerNoGroup()
    await service.registerNoGroup()

    expect(groupChecks).toBe(2)
    expect(port.registerNoGroupAddress).toHaveBeenCalledTimes(2)
    expect(requests[1]).toEqual(requests[0])
    expect(port.queryAddresses).not.toHaveBeenCalled()
  })

  it('submits the exact Go UserFlowMsg and waits for authoritative membership', async () => {
    let joined: Record<string, unknown> | undefined
    let membershipChecks = 0
    const port = gateway({
      joinGroup: vi.fn<WalletEntryGatewayPort['joinGroup']>(async (_groupID, message) => {
        joined = message as Record<string, unknown>
        return { result: true }
      }),
      reOnline: vi.fn<WalletEntryGatewayPort['reOnline']>(async () => {
        membershipChecks += 1
        return membershipChecks < 2
          ? { IsInGroup: false, GuarantorGroupID: '' }
          : { IsInGroup: true, GuarantorGroupID: 'group-a' }
      }),
      queryAddressGroups: vi.fn<WalletEntryGatewayPort['queryAddressGroups']>(
        async (addresses) => ({
          Addresstogroup: Object.fromEntries(
            addresses.map((address) => [
              address,
              { GroupID: membershipChecks < 2 ? '0' : 'group-a' },
            ]),
          ),
        }),
      ),
    })
    const service = createGatewayWalletEntryService({
      gateway: port,
      getWalletRecord: () => record,
      timestamp: () => 123_456,
      confirmationAttempts: 2,
      sleep: async () => undefined,
    })

    await service.join('group-a')

    expect(joined).toBeDefined()
    const joinedMessage = joined as Record<string, unknown> & {
      UserSig: { R: bigint; S: bigint }
    }
    expect(Object.keys(joinedMessage)).toEqual([
      'Status',
      'UserID',
      'UserPeerID',
      'GuarGroupID',
      'UserPublicKey',
      'SignPublicKeyV2',
      'AddressMsg',
      'TimeStamp',
      'UserSig',
    ])
    expect(joinedMessage.UserPeerID).toBe('')
    const { UserSig, ...material } = joinedMessage
    expect(verifyLegacySignature({ ...material, UserSig: { R: null, S: null } }, UserSig)).toBe(
      true,
    )
    expect(membershipChecks).toBe(2)
  })

  it('registers a new member address with the exact UserNewAddressInfo material', async () => {
    let sent: Record<string, unknown> | undefined
    const port = gateway({
      registerGroupAddress: vi.fn<WalletEntryGatewayPort['registerGroupAddress']>(
        async (_groupID, message) => {
          sent = message as Record<string, unknown>
          return { result: true }
        },
      ),
      queryAddressGroups: vi.fn<WalletEntryGatewayPort['queryAddressGroups']>(
        async (addresses) => ({
          Addresstogroup: { [addresses[0]!]: { GroupID: 'group-a' } },
        }),
      ),
    })
    const service = createGatewayWalletEntryService({
      gateway: port,
      getWalletRecord: () => record,
      confirmationAttempts: 1,
    })

    await service.registerAddress(derivedAddress.address, 'group-a')

    expect(port.registerGroupAddress).toHaveBeenCalledWith('group-a', expect.any(Object))
    const message = sent as Record<string, unknown> & { Sig: { R: bigint; S: bigint } }
    expect(Object.keys(message)).toEqual([
      'NewAddress',
      'PublicKeyNew',
      'UserID',
      'Type',
      'SignPublicKeyV2',
      'SeedAnchor',
      'SeedChainStep',
      'DefaultSpendAlgorithm',
      'Sig',
    ])
    const { Sig, ...material } = message
    expect(verifyLegacySignature({ ...material, Sig: { R: null, S: null } }, Sig)).toBe(true)
  })

  it('signs address unbind and organization exit without changing the wallet record', async () => {
    let unbind: Record<string, unknown> | undefined
    let leave: Record<string, unknown> | undefined
    const port = gateway({
      unbindGroupAddress: vi.fn<WalletEntryGatewayPort['unbindGroupAddress']>(
        async (_groupID, message) => {
          unbind = message as Record<string, unknown>
          return { result: true }
        },
      ),
      joinGroup: vi.fn<WalletEntryGatewayPort['joinGroup']>(async (_groupID, message) => {
        leave = message as Record<string, unknown>
        return { result: true }
      }),
      reOnline: vi.fn<WalletEntryGatewayPort['reOnline']>(async () => ({ IsInGroup: false })),
    })
    const service = createGatewayWalletEntryService({
      gateway: port,
      getWalletRecord: () => record,
      timestamp: () => 123_456,
      confirmationAttempts: 1,
    })

    await service.unbindAddress(derivedAddress.address, 'group-a')
    await service.leave('group-a')

    const unbindMessage = unbind as Record<string, unknown> & { Sig: { R: bigint; S: bigint } }
    const { Sig, ...unbindMaterial } = unbindMessage
    expect(unbindMessage.Op).toBe(0)
    expect(verifyLegacySignature({ ...unbindMaterial, Sig: { R: null, S: null } }, Sig)).toBe(true)
    const leaveMessage = leave as Record<string, unknown> & {
      UserSig: { R: bigint; S: bigint }
    }
    const { UserSig, ...leaveMaterial } = leaveMessage
    expect(leaveMessage.Status).toBe(0)
    expect(
      verifyLegacySignature({ ...leaveMaterial, UserSig: { R: null, S: null } }, UserSig),
    ).toBe(true)
    expect(record.addresses).toHaveLength(1)
  })
})
