import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const backendRoot = process.env.PANGU_BACKEND_REPO
  ? path.resolve(process.env.PANGU_BACKEND_REPO)
  : path.resolve(repositoryRoot, '..', 'UTXO-Area')

const contracts = [
  {
    file: 'gateway/server.go',
    values: [
      '/health',
      '/api/v1/groups',
      '/api/v1/{groupID}/assign/submit-tx',
      '/api/v1/{groupID}/aggr/txcer-issuance-records',
      '/api/v1/committee/gqnc/status',
      '/api/v1/committee/gqnc/certified-block/{height}',
    ],
  },
  {
    file: 'core/gqnc.go',
    values: ['GQNCProtocolVersion'],
  },
]

const errors = []

for (const contract of contracts) {
  const file = path.join(backendRoot, contract.file)
  let source
  try {
    source = await fs.readFile(file, 'utf8')
  } catch (error) {
    errors.push(`${contract.file}: ${error.message}`)
    continue
  }

  for (const value of contract.values) {
    if (!source.includes(value)) errors.push(`${contract.file}: missing ${value}`)
  }
}

if (errors.length > 0) {
  console.error(`Backend contract check failed:\n${errors.map((error) => `- ${error}`).join('\n')}`)
  process.exit(1)
}

console.log(`Backend contract baseline is available at ${backendRoot}`)
