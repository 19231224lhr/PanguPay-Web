export interface SoakSample {
  accepted: boolean
  certified: boolean
  txcerMs: number
  gqncMs: number
  frontendObservedMs: number
}

export interface LatencySummary {
  median: number
  p95: number
  p99: number
}

export interface SoakSummary {
  count: number
  accepted: number
  certified: number
  txcer: LatencySummary
  gqnc: LatencySummary
  frontendObserved: LatencySummary
  first100Median: number
  last100Median: number
  lastToFirstMedianRatio: number
}

function quantile(values: number[], percentile: number): number {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.max(0, Math.ceil(percentile * sorted.length) - 1)
  return sorted[index] ?? 0
}

function latency(values: number[]): LatencySummary {
  return {
    median: quantile(values, 0.5),
    p95: quantile(values, 0.95),
    p99: quantile(values, 0.99),
  }
}

export function summarizeSamples(samples: SoakSample[]): SoakSummary {
  const first = samples.slice(0, Math.min(100, samples.length)).map((item) => item.txcerMs)
  const last = samples.slice(Math.max(0, samples.length - 100)).map((item) => item.txcerMs)
  const first100Median = quantile(first, 0.5)
  const last100Median = quantile(last, 0.5)
  return {
    count: samples.length,
    accepted: samples.filter((item) => item.accepted).length,
    certified: samples.filter((item) => item.certified).length,
    txcer: latency(samples.map((item) => item.txcerMs)),
    gqnc: latency(samples.map((item) => item.gqncMs)),
    frontendObserved: latency(samples.map((item) => item.frontendObservedMs)),
    first100Median,
    last100Median,
    lastToFirstMedianRatio: first100Median > 0 ? last100Median / first100Median : 0,
  }
}

export function assertSoakThresholds(summary: SoakSummary): void {
  if (summary.count !== 500 || summary.accepted !== 500 || summary.certified !== 500) {
    throw new Error(
      `release soak requires 500/500 accepted and certified; got ${summary.accepted}/${summary.certified}/${summary.count}`,
    )
  }
  if (summary.txcer.p95 > 100) throw new Error(`TXCer p95 ${summary.txcer.p95}ms exceeds 100ms`)
  if (summary.gqnc.p95 > 350) throw new Error(`GQNC p95 ${summary.gqnc.p95}ms exceeds 350ms`)
  if (summary.frontendObserved.p95 > 1000) {
    throw new Error(`frontend observation p95 ${summary.frontendObserved.p95}ms exceeds 1000ms`)
  }
  if (summary.lastToFirstMedianRatio > 1.2) {
    throw new Error(
      `last 100 TXCer median grew ${(summary.lastToFirstMedianRatio * 100 - 100).toFixed(1)}%`,
    )
  }
}

const secretKey = /(password|private.?key|root.?seed|raw.?transaction|ciphertext|recovery)/i
const payloadKey = /^(postData|body|requestBody|responseBody|content)$/i

export function redactEvidence(value: unknown, key = ''): unknown {
  if (secretKey.test(key)) return '[REDACTED]'
  if (payloadKey.test(key)) return undefined
  if (Array.isArray(value)) return value.map((item) => redactEvidence(item))
  if (!value || typeof value !== 'object') return value

  const result: Record<string, unknown> = {}
  for (const [childKey, childValue] of Object.entries(value)) {
    const redacted = redactEvidence(childValue, childKey)
    if (redacted !== undefined) result[childKey] = redacted
  }
  return result
}
