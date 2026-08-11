import { spawn } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const frontendRoot = process.cwd()
const backendRoot = path.resolve(
  process.env.PANGU_REAL_E2E_BACKEND_ROOT || path.join(frontendRoot, '..', 'UTXO-Area'),
)
const full = process.argv.includes('--full')
const externalBackend = process.env.PANGU_REAL_E2E_EXTERNAL_BACKEND === '1'
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const runDir = path.resolve(
  process.env.PANGU_REAL_E2E_RUN_DIR || path.join(frontendRoot, 'artifacts', 'real-e2e', stamp),
)
const privateDir = path.join(runDir, 'private')
const fixturePath = path.resolve(
  process.env.PANGU_REAL_E2E_FIXTURE || path.join(privateDir, 'fixture.json'),
)
const readyFile = path.join(privateDir, 'backend-ready.json')
const stopFile = path.join(privateDir, 'backend-stop.flag')
const controlDir = path.resolve(
  process.env.PANGU_REAL_E2E_CONTROL_DIR || path.join(privateDir, 'control'),
)
const backendLogPath = path.join(runDir, 'backend.log')

let backend
let exitCode = 1

function command(program, args, options = {}) {
  return new Promise((resolve, reject) => {
    const useShell = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(program)
    const child = spawn(program, args, {
      stdio: 'inherit',
      windowsHide: true,
      shell: useShell,
      ...options,
    })
    child.once('error', reject)
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${program} exited ${code}`)),
    )
  })
}

async function waitForJSON(file, timeoutMillis) {
  const deadline = Date.now() + timeoutMillis
  let lastError
  while (Date.now() < deadline) {
    try {
      const raw = await readFile(file, 'utf8')
      return JSON.parse(raw.replace(/^\uFEFF/, ''))
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  throw new Error(
    `timed out waiting for ${file}: ${lastError instanceof Error ? lastError.message : lastError}`,
  )
}

function requireEnvironment(name, fallback) {
  const value = process.env[name]?.trim() || fallback
  if (!value) throw new Error(`missing ${name}; the real suite will not invent a LightArea target`)
  return value
}

async function startBackend() {
  if (externalBackend) {
    return {
      gatewayBase: requireEnvironment('PANGU_REAL_E2E_GATEWAY'),
      groupID: requireEnvironment('PANGU_REAL_E2E_GROUP_ID'),
      configPath: process.env.PANGU_REAL_E2E_CONFIG || '',
    }
  }

  await rm(readyFile, { force: true })
  await rm(stopFile, { force: true })
  const logHandle = await import('node:fs').then(({ createWriteStream }) =>
    createWriteStream(backendLogPath),
  )
  const script = path.join(backendRoot, 'scripts', 'dev-backend-smoke.ps1')
  const args = [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    script,
    '-RunGQNCFlow',
    '-ExternalBusinessFlow',
    '-CommitteeNodeCount',
    '4',
    '-HoldSeconds',
    full ? '86400' : '28800',
    '-ReadyFile',
    readyFile,
    '-StopFile',
    stopFile,
    '-ControlDir',
    controlDir,
    '-LightAreaHost',
    process.env.PANGU_REAL_E2E_LIGHT_GRPC_HOST || '47.243.174.71',
  ]
  backend = spawn('powershell.exe', args, {
    cwd: backendRoot,
    windowsHide: true,
    env: { ...process.env, PANGU_LIGHT_CALLBACK_ENABLED: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  backend.stdout.pipe(logHandle)
  backend.stderr.pipe(logHandle)
  backend.once('exit', (code) => {
    if (code !== 0 && exitCode === 1)
      process.stderr.write(`backend exited early with code ${code}\n`)
  })
  return waitForJSON(readyFile, 8 * 60_000)
}

async function createFixture(ready) {
  if (externalBackend) {
    await readFile(fixturePath)
    return
  }
  await command(
    'go',
    [
      'run',
      './tools/dev-http-e2e',
      '-config',
      ready.configPath,
      '-gateway',
      ready.gatewayBase,
      '-group',
      ready.groupID,
      '-register-only',
      '-fixture-json',
      fixturePath,
    ],
    { cwd: backendRoot, env: process.env },
  )
}

async function stopBackend() {
  if (!backend) return
  await writeFile(stopFile, 'stop\n', 'utf8').catch(() => undefined)
  await Promise.race([
    new Promise((resolve) => backend.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 30_000)),
  ])
  if (backend.exitCode === null) backend.kill()
}

async function cleanSecrets() {
  const relative = path.relative(runDir, privateDir)
  if (relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('refusing to clean outside run directory')
  await Promise.all([
    rm(privateDir, { recursive: true, force: true }),
    rm(path.join(runDir, 'profiles'), { recursive: true, force: true }),
  ])
}

try {
  await Promise.all([mkdir(privateDir, { recursive: true }), mkdir(runDir, { recursive: true })])
  process.stdout.write(`[real-e2e] run directory: ${runDir}\n`)
  process.stdout.write('[real-e2e] starting fresh backend\n')
  const ready = await startBackend()
  process.stdout.write(`[real-e2e] backend ready: ${ready.gatewayBase}\n`)
  await createFixture(ready)
  process.stdout.write('[real-e2e] private fixture created\n')

  const childEnv = {
    ...process.env,
    PANGU_REAL_E2E_RUN_DIR: runDir,
    PANGU_REAL_E2E_FIXTURE: fixturePath,
    PANGU_REAL_E2E_BASE_URL: process.env.PANGU_REAL_E2E_BASE_URL || 'http://127.0.0.1:5174',
    PANGU_REAL_E2E_GATEWAY: ready.gatewayBase,
    PANGU_REAL_E2E_GROUP_ID: ready.groupID,
    PANGU_REAL_E2E_LIGHT_RECIPIENT: requireEnvironment(
      'PANGU_REAL_E2E_LIGHT_RECIPIENT',
      '0x742d35cc6634c0532925a3b844bc454e4438f44e',
    ),
    PANGU_REAL_E2E_LIGHT_RPC: requireEnvironment(
      'PANGU_REAL_E2E_LIGHT_RPC',
      'http://47.243.174.71:36054',
    ),
    PANGU_REAL_E2E_SOAK_COUNT: full ? '500' : process.env.PANGU_REAL_E2E_SOAK_COUNT || '30',
    PANGU_REAL_E2E_CONTROL_DIR: externalBackend
      ? process.env.PANGU_REAL_E2E_CONTROL_DIR || ''
      : controlDir,
    VITE_GATEWAY_URL: ready.gatewayBase,
  }

  await command('npx.cmd', ['vitest', 'run', 'e2e-real/metrics.unit.spec.ts'], {
    cwd: frontendRoot,
    env: childEnv,
  })
  process.stdout.write('[real-e2e] launching visible Edge acceptance\n')
  const testFiles = ['e2e-real/01-real-ui.spec.ts']
  if (!externalBackend || childEnv.PANGU_REAL_E2E_CONTROL_DIR)
    testFiles.push('e2e-real/02-faults.spec.ts')
  testFiles.push('e2e-real/03-soak.spec.ts')
  for (const testFile of testFiles) {
    process.stdout.write(`[real-e2e] running ${testFile}\n`)
    await command(
      'npx.cmd',
      ['playwright', 'test', '--config', 'playwright.real.config.ts', testFile],
      { cwd: frontendRoot, env: childEnv },
    )
  }
  exitCode = 0
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : error}\n`)
} finally {
  await stopBackend()
  await cleanSecrets().catch((error) => process.stderr.write(`secret cleanup failed: ${error}\n`))
}

process.exitCode = exitCode
