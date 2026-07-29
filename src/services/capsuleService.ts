import { ec as EC } from 'elliptic'

import {
  canonicalJSONStringify,
  bytesToHex,
  decodeBackendBytes,
  sha256Bytes,
} from '@/protocol-v2/canonical'
import { COMMITTEE_CAPSULE_ORG_ID } from '@/protocol-v2/capsule'
import { resolveTransferRecipient, type CapsuleAuthorityGateway } from '@/transfer/capsuleRecipient'
import { deriveAddressFromRootSeed } from '@/wallet/identity'
import type { WalletRecord } from '@/wallet/types'

const ec = new EC('p256')
const PANGU_EPOCH_SECONDS = Date.UTC(2020, 0, 1) / 1_000

export interface CapsuleGenerationGateway extends CapsuleAuthorityGateway {
  generateGroupCapsule(groupID: string, request: unknown): Promise<unknown>
  generateRetailCapsule(request: unknown): Promise<unknown>
}

export interface GeneratedWalletCapsule {
  capsule: string
  orgID: string
  signer: 'organization' | 'committee'
}

export interface GenerateWalletCapsuleOptions {
  address: string
  gateway: CapsuleGenerationGateway
  groupID?: string
  timestamp?: () => number
  wallet: WalletRecord
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function secretHex(value: string, label: string): string {
  const bytes = decodeBackendBytes(value)
  if (bytes.length !== 32) throw new Error(`${label} 必须为32字节。`)
  return bytesToHex(bytes)
}

function sign(material: unknown, privateKeyHex: string): { R: bigint; S: bigint } {
  const signature = ec
    .keyFromPrivate(privateKeyHex, 'hex')
    .sign(sha256Bytes(canonicalJSONStringify(material)))
  return {
    R: BigInt(`0x${signature.r.toString(16)}`),
    S: BigInt(`0x${signature.s.toString(16)}`),
  }
}

function responseCapsule(value: unknown): { capsule: string; orgID: string } {
  const root = record(value)
  const data = record(root.data)
  const source = Object.keys(data).length ? data : root
  const success = Boolean(source.Success ?? source.success)
  const capsule = String(source.CapsuleAddr ?? source.capsuleAddr ?? source.capsule ?? '').trim()
  const orgID = String(source.OrgID ?? source.orgID ?? source.org_id ?? '').trim()
  if (!success || !capsule) {
    throw new Error(
      String(source.ErrorMsg ?? source.error ?? source.message ?? '胶囊地址生成失败。'),
    )
  }
  return { capsule, orgID }
}

function isMemberGroup(groupID?: string): groupID is string {
  return Boolean(groupID && !['0', '1', COMMITTEE_CAPSULE_ORG_ID].includes(groupID))
}

export async function generateWalletCapsule({
  address,
  gateway,
  groupID,
  timestamp = () => Math.max(0, Math.floor(Date.now() / 1_000 - PANGU_EPOCH_SECONDS)),
  wallet,
}: GenerateWalletCapsuleOptions): Promise<GeneratedWalletCapsule> {
  const normalized = address.trim().toLowerCase()
  const stored = wallet.addresses.find((item) => item.address.trim().toLowerCase() === normalized)
  if (!stored || !/^[0-9a-f]{40}$/.test(normalized))
    throw new Error('请选择当前钱包中的有效原始地址。')

  const member = isMemberGroup(groupID)
  let privateKeyHex: string
  if (member) {
    privateKeyHex = secretHex(wallet.account_private_scalar, '账户私钥')
  } else {
    const type = Number(stored.type)
    const derived = deriveAddressFromRootSeed(secretHex(stored.root_seed, '地址 RootSeed'), type)
    if (derived.address !== normalized) throw new Error('地址 RootSeed 与当前地址不匹配。')
    privateKeyHex = derived.privateScalarHex
  }

  const material = {
    UserID: member ? wallet.account_id : '',
    Address: normalized,
    Timestamp: timestamp(),
    Sig: { R: null, S: null },
  }
  const request = { ...material, Sig: sign(material, privateKeyHex) }
  const response = member
    ? await gateway.generateGroupCapsule(groupID, request)
    : await gateway.generateRetailCapsule(request)
  const generated = responseCapsule(response)
  const expectedOrgID = member ? groupID : COMMITTEE_CAPSULE_ORG_ID
  if (generated.orgID && generated.orgID !== expectedOrgID)
    throw new Error('服务返回了不匹配的胶囊组织身份。')

  const verified = await resolveTransferRecipient(generated.capsule, 'normal', gateway)
  if (verified.address !== normalized || verified.orgID !== expectedOrgID)
    throw new Error('服务返回的胶囊地址未绑定当前收款地址。')
  return {
    capsule: generated.capsule,
    orgID: expectedOrgID,
    signer: member ? 'organization' : 'committee',
  }
}
