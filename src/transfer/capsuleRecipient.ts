import {
  COMMITTEE_CAPSULE_ORG_ID,
  parseCapsuleAddress,
  verifyCapsuleAddress,
  type CapsulePublicKey,
} from '@/protocol-v2/capsule'
import type { TransferMode } from './core'

export interface CapsuleAuthorityGateway {
  getCommitteePublicKey(): Promise<unknown>
  getOrganizationPublicKey(orgID: string): Promise<unknown>
}

export interface ResolvedTransferRecipient {
  address: string
  kind: 'raw' | 'capsule'
  capsule?: string
  orgID?: string
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function authority(value: unknown, expectedOrgID: string): CapsulePublicKey {
  const root = object(value)
  const data = object(root.data)
  const envelope = Object.keys(data).length ? data : root
  const responseOrgID = String(envelope.org_id ?? envelope.OrgID ?? expectedOrgID)
  if (responseOrgID !== expectedOrgID) throw new Error('胶囊地址的组织身份不匹配。')
  const key = object(envelope.public_key ?? envelope.PublicKey)
  if (key.X == null || key.Y == null) throw new Error('胶囊地址的签名公钥不可用。')
  const curveName = String(key.CurveName ?? key.curve_name ?? '').trim()
  if (!curveName) throw new Error('胶囊地址的签名公钥曲线不可用。')
  return {
    CurveName: curveName,
    X: key.X as string,
    Y: key.Y as string,
  }
}

export async function resolveTransferRecipient(
  input: string,
  mode: TransferMode,
  gateway: CapsuleAuthorityGateway,
): Promise<ResolvedTransferRecipient> {
  const value = input.trim()
  if (mode === 'cross') {
    if (value.includes('@')) throw new Error('跨链转账暂不支持胶囊地址，请使用原始地址。')
    return { address: value, kind: 'raw' }
  }
  if (/^[0-9a-f]{40}$/i.test(value)) return { address: value.toLowerCase(), kind: 'raw' }
  if (!value.includes('@')) throw new Error('请输入有效的40位地址或胶囊地址。')

  const parsed = parseCapsuleAddress(value)
  const response =
    parsed.orgID === COMMITTEE_CAPSULE_ORG_ID
      ? await gateway.getCommitteePublicKey()
      : await gateway.getOrganizationPublicKey(parsed.orgID)
  const verified = verifyCapsuleAddress(value, authority(response, parsed.orgID))
  return {
    address: verified.address,
    capsule: value,
    kind: 'capsule',
    orgID: parsed.orgID,
  }
}
