export interface GatewayClientOptions {
  baseURL?: string
  fetcher?: typeof fetch
}

function defaultGatewayURL(): string {
  return String(import.meta.env.VITE_GATEWAY_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '')
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
    if (!response.ok) throw new Error(`Gateway ${response.status}: ${await response.text()}`)
    const contentType = response.headers.get('content-type') ?? ''
    const body = await response.text()
    return contentType.includes('json') ? parseGatewayJSON(body) : body
  }

  health(): Promise<unknown> {
    return this.request('/health')
  }

  committeeEndpoint(): Promise<unknown> {
    return this.request('/api/v1/committee/endpoint')
  }

  queryAddresses(addresses: string[]): Promise<unknown> {
    return this.request('/api/v1/com/query-address', {
      method: 'POST',
      body: JSON.stringify({ address: addresses }),
    })
  }

  queryAddressGroups(addresses: string[]): Promise<unknown> {
    return this.request('/api/v1/com/query-address-group', {
      method: 'POST',
      body: JSON.stringify({ address: addresses }),
    })
  }

  accountUpdates(groupID: string, userID: string): Promise<unknown> {
    const query = new URLSearchParams({ userID, since: '0', limit: '100', consume: 'false' })
    return this.request(`/api/v1/${encodeURIComponent(groupID)}/assign/account-update?${query}`)
  }

  groupInfo(groupID: string): Promise<unknown> {
    return this.request(`/api/v1/${encodeURIComponent(groupID)}/assign/group-info`)
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
}
