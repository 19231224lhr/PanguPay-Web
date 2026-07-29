import { canonicalJSONStringify } from '@/protocol-v2/canonical'

export interface GatewayClientOptions {
  baseURL?: string
  fetcher?: typeof fetch
}

export class GatewayRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    const detail =
      body && typeof body === 'object' && !Array.isArray(body)
        ? String(
            (body as Record<string, unknown>).error ??
              (body as Record<string, unknown>).message ??
              '',
          )
        : String(body ?? '')
    super(detail || `Gateway request failed with status ${status}`)
    this.name = 'GatewayRequestError'
  }
}

/** Go's legacy ECDSA fields are JSON integers and cannot pass through JSON.stringify(BigInt). */
export function stringifyGatewayJSON(value: unknown): string {
  return canonicalJSONStringify(value)
}

function defaultGatewayURL(): string {
  return String(import.meta.env.VITE_GATEWAY_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '')
}

export function parseGatewayJSON(input: string): unknown {
  let output = ''
  let inString = false
  let escaped = false
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!
    if (inString) {
      output += character
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') {
      inString = true
      output += character
      continue
    }
    if (character === '-' || /\d/.test(character)) {
      const match = input.slice(index).match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/)
      if (match) {
        const token = match[0]
        const digits = token.replace(/^-/, '')
        output += /^-?\d+$/.test(token) && digits.length > 15 ? `"${token}"` : token
        index += token.length - 1
        continue
      }
    }
    output += character
  }
  return JSON.parse(output)
}

export class GatewayClient {
  private readonly baseURL: string
  private readonly fetcher: typeof fetch

  constructor(options: GatewayClientOptions = {}) {
    this.baseURL = (options.baseURL ?? defaultGatewayURL()).replace(/\/+$/, '')
    this.fetcher = options.fetcher ?? fetch.bind(globalThis)
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await this.fetcher(`${this.baseURL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      signal: AbortSignal.timeout(6_000),
    })
    const contentType = response.headers.get('content-type') ?? ''
    const text = await response.text()
    let body: unknown = text
    if (contentType.includes('json')) {
      try {
        body = parseGatewayJSON(text)
      } catch {
        body = text
      }
    }
    if (!response.ok) throw new GatewayRequestError(response.status, body)
    return body
  }

  health(): Promise<unknown> {
    return this.request('/health')
  }

  committeeEndpoint(): Promise<unknown> {
    return this.request('/api/v1/committee/endpoint')
  }

  groups(): Promise<unknown> {
    return this.request('/api/v1/groups')
  }

  group(groupID: string): Promise<unknown> {
    return this.request(`/api/v1/groups/${encodeURIComponent(groupID)}`)
  }

  reOnline(message: unknown): Promise<unknown> {
    return this.request('/api/v1/re-online', {
      method: 'POST',
      body: stringifyGatewayJSON(message),
    })
  }

  registerNoGroupAddress(message: unknown): Promise<unknown> {
    return this.request('/api/v1/com/register-address', {
      method: 'POST',
      body: stringifyGatewayJSON(message),
    })
  }

  joinGroup(groupID: string, message: unknown): Promise<unknown> {
    return this.request(`/api/v1/${encodeURIComponent(groupID)}/assign/flow-apply`, {
      method: 'POST',
      body: stringifyGatewayJSON(message),
    })
  }

  registerGroupAddress(groupID: string, message: unknown): Promise<unknown> {
    return this.request(`/api/v1/${encodeURIComponent(groupID)}/assign/new-address`, {
      method: 'POST',
      body: stringifyGatewayJSON(message),
    })
  }

  unbindGroupAddress(groupID: string, message: unknown): Promise<unknown> {
    return this.request(`/api/v1/${encodeURIComponent(groupID)}/assign/unbind-address`, {
      method: 'POST',
      body: stringifyGatewayJSON(message),
    })
  }

  queryAddresses(addresses: string[]): Promise<unknown> {
    return this.request('/api/v1/com/query-address', {
      method: 'POST',
      body: stringifyGatewayJSON({ address: addresses }),
    })
  }

  queryAddressGroups(addresses: string[]): Promise<unknown> {
    return this.request('/api/v1/com/query-address-group', {
      method: 'POST',
      body: stringifyGatewayJSON({ address: addresses }),
    })
  }

  accountUpdates(groupID: string, userID: string): Promise<unknown> {
    const query = new URLSearchParams({ userID, since: '0', limit: '100', consume: 'false' })
    return this.request(`/api/v1/${encodeURIComponent(groupID)}/assign/account-update?${query}`)
  }

  groupInfo(groupID: string): Promise<unknown> {
    return this.request(`/api/v1/${encodeURIComponent(groupID)}/assign/group-info`)
  }

  generateGroupCapsule(groupID: string, message: unknown): Promise<unknown> {
    return this.request(`/api/v1/${encodeURIComponent(groupID)}/assign/capsule/generate`, {
      method: 'POST',
      body: stringifyGatewayJSON(message),
    })
  }

  generateRetailCapsule(message: unknown): Promise<unknown> {
    return this.request('/api/v1/com/capsule/generate', {
      method: 'POST',
      body: stringifyGatewayJSON(message),
    })
  }

  getOrganizationPublicKey(orgID: string): Promise<unknown> {
    const query = new URLSearchParams({ org_id: orgID })
    return this.request(`/api/v1/org/publickey?${query}`)
  }

  getCommitteePublicKey(): Promise<unknown> {
    return this.request('/api/v1/com/public-key')
  }

  txCerStatuses(groupID: string, userID: string): Promise<unknown> {
    const query = new URLSearchParams({ userID })
    return this.request(`/api/v1/${encodeURIComponent(groupID)}/assign/txcer-statuses?${query}`)
  }

  issuanceRecords(groupID: string, userID: string): Promise<unknown> {
    const query = new URLSearchParams({ userID, includeProof: 'true' })
    return this.request(
      `/api/v1/${encodeURIComponent(groupID)}/aggr/txcer-issuance-records?${query}`,
    )
  }

  certifiers(groupID: string): Promise<unknown> {
    return this.request(`/api/v1/${encodeURIComponent(groupID)}/assign/certifiers`)
  }

  submitAssignTransaction(groupID: string, message: unknown): Promise<unknown> {
    return this.request(`/api/v1/${encodeURIComponent(groupID)}/assign/submit-tx`, {
      method: 'POST',
      body: stringifyGatewayJSON(message),
    })
  }

  assignTransactionStatus(groupID: string, txID: string): Promise<unknown> {
    return this.request(
      `/api/v1/${encodeURIComponent(groupID)}/assign/tx-status/${encodeURIComponent(txID)}`,
    )
  }

  gqncStatus(): Promise<unknown> {
    return this.request('/api/v1/committee/gqnc/status')
  }

  gqncCertifiedBlock(height: number): Promise<unknown> {
    return this.request(
      `/api/v1/committee/gqnc/certified-block/${encodeURIComponent(String(height))}`,
    )
  }

  submitNoGroupTransaction(message: unknown): Promise<unknown> {
    return this.request('/api/v1/com/submit-noguargroup-tx', {
      method: 'POST',
      body: stringifyGatewayJSON(message),
    })
  }

  pollCrossOrganizationTXCers(groupID: string, userID: string): Promise<unknown> {
    const query = new URLSearchParams({ userID, consume: 'false' })
    return this.request(
      `/api/v1/${encodeURIComponent(groupID)}/assign/poll-cross-org-txcers?${query}`,
    )
  }
}
