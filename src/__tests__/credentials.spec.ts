import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { bytesToHex, decodeBackendBytes } from '@/protocol-v2/canonical'
import { computeTXCerFastEvidenceHashV2, verifyTXCerIssuanceAck } from '@/protocol-v2/evidence'
import type { TXCerAuthoritySnapshot } from '@/protocol-v2/security'
import { extractIssuanceRecords, normalizeCredentialSummaries } from '@/wallet/credentials'

function quoteUnsafeJsonIntegers(input: string): string {
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
  return output
}

const golden = JSON.parse(
  quoteUnsafeJsonIntegers(
    fs.readFileSync(path.resolve('tests/fixtures/protocol-v2-golden.json'), 'utf8'),
  ),
)

describe('wallet credential summaries', () => {
  it('verifies and exposes exact TXCer evidence from the Go vector', () => {
    const evidence = golden.evidence
    expect(bytesToHex(decodeBackendBytes(evidence.assignAck.evidenceHash))).toBe(
      bytesToHex(computeTXCerFastEvidenceHashV2(evidence.fastEvidence)),
    )
    expect(
      verifyTXCerIssuanceAck(evidence.assignAck, evidence.fastEvidence, evidence.publicKey),
    ).toBe(true)
    const records = extractIssuanceRecords({
      records: [{ ...evidence.issuanceRecord, ack: evidence.assignAck }],
    })
    const publicKey = evidence.publicKey
    const authority: TXCerAuthoritySnapshot = {
      groupID: 'group-source',
      signerSetID: evidence.liabilityReceipt.SignerSetID,
      members: evidence.liabilityAuthority,
      threshold: evidence.liabilityThreshold,
      publicKeys: {
        aggregation: publicKey,
        certifier: publicKey,
        'certifier-v2': publicKey,
        'certifier:certifier-v2': publicKey,
        'assign-target': publicKey,
      },
      sourceAggregationPublicKey: publicKey,
      sourceAssignPublicKey: publicKey,
      targetAssignPublicKey: publicKey,
      capturedAt: 1,
    }

    const summaries = normalizeCredentialSummaries(
      records,
      { statuses: [{ TXCerID: evidence.txCerID, Status: 'Active' }] },
      { [evidence.txCerID]: authority },
      2,
    )

    expect(summaries[0]?.error).toBe('')
    expect(summaries[0]).toMatchObject({
      txCerId: evidence.txCerID,
      lifecycle: 'Active',
      amount: '90071992.54740993',
      fastEvidenceStatus: 'Verified',
      cfaaAuditStatus: 'Verified',
      hasFastEvidence: true,
      hasAssignAck: true,
      hasLiabilityReceipt: true,
      hasCFAAProof: true,
    })
    expect(summaries[0]?.exposureShares).toHaveLength(2)
  })
})
