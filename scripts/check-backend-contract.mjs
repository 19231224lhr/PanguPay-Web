import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const backendRoot = process.env.PANGU_BACKEND_REPO
  ? path.resolve(process.env.PANGU_BACKEND_REPO)
  : path.resolve(repositoryRoot, '..', 'UTXO-Area')

const routes = [
  ['GET', '/health'],
  ['GET', '/api/v1/committee/endpoint'],
  ['GET', '/api/v1/groups'],
  ['GET', '/api/v1/groups/{id}'],
  ['POST', '/api/v1/re-online'],
  ['POST', '/api/v1/com/register-address'],
  ['POST', '/api/v1/{groupID}/assign/flow-apply'],
  ['POST', '/api/v1/com/query-address'],
  ['POST', '/api/v1/com/query-address-group'],
  ['GET', '/api/v1/{groupID}/assign/account-update'],
  ['GET', '/api/v1/{groupID}/assign/group-info'],
  ['GET', '/api/v1/{groupID}/assign/txcer-statuses'],
  ['GET', '/api/v1/{groupID}/aggr/txcer-issuance-records'],
  ['GET', '/api/v1/{groupID}/assign/certifiers'],
  ['POST', '/api/v1/{groupID}/assign/submit-tx'],
  ['GET', '/api/v1/{groupID}/assign/tx-status/{txID}'],
  ['GET', '/api/v1/{groupID}/aggr/txcer-spend-ready/{txID}'],
  ['GET', '/api/v1/committee/gqnc/status'],
  ['GET', '/api/v1/committee/gqnc/certified-block/{height}'],
  ['POST', '/api/v1/com/submit-noguargroup-tx'],
  ['GET', '/api/v1/{groupID}/assign/poll-cross-org-txcers'],
]

const errors = []
let serverSource = ''
try {
  serverSource = await fs.readFile(path.join(backendRoot, 'gateway/server.go'), 'utf8')
} catch (error) {
  errors.push(`gateway/server.go: ${error.message}`)
}

const registered = new Map()
const routePattern = /HandleFunc\(\s*"([^"]+)"[\s\S]*?\)\.Methods\(([^)]*)\)/g
for (const match of serverSource.matchAll(routePattern)) {
  const methods = [...match[2].matchAll(/"([A-Z]+)"/g)].map((item) => item[1])
  registered.set(match[1], new Set(methods))
}

for (const [method, route] of routes) {
  const methods = registered.get(route)
  if (!methods) errors.push(`gateway/server.go: missing route ${route}`)
  else if (!methods.has(method)) errors.push(`gateway/server.go: ${route} does not allow ${method}`)
}

try {
  const protocol = await fs.readFile(path.join(backendRoot, 'core/gqnc.go'), 'utf8')
  if (!protocol.includes('GQNCProtocolVersion'))
    errors.push('core/gqnc.go: missing GQNCProtocolVersion')
} catch (error) {
  errors.push(`core/gqnc.go: ${error.message}`)
}

if (errors.length > 0) {
  console.error(`Backend contract check failed:\n${errors.map((error) => `- ${error}`).join('\n')}`)
  process.exit(1)
}

console.log(`Verified ${routes.length} method/path contracts against ${backendRoot}`)
