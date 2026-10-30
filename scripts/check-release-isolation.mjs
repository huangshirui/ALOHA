import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (name) => readFileSync(name, 'utf8')
const workflows = '.github/workflows/'
const assistant = read(workflows + 'deploy.yml')
const header = assistant.split('\npermissions:')[0]
const pathsBlock = header.match(/  push:\n    branches: \[main\]\n    paths:\n((?:      - '[^']+'\n)+)/)
assert.ok(pathsBlock, 'Assistant automatic release must use explicit paths')
const assistantPaths = [...pathsBlock[1].matchAll(/^      - '([^']+)'$/gm)].map((match) => match[1])
assert.deepEqual(assistantPaths, [
  'apps/assistant/**',
  'workers/gateway/**',
  'workers/agent-control/**',
], 'Only Assistant-owned code can trigger automatic Assistant deployment')
assert.match(header, /  workflow_dispatch:/, 'Assistant retains manual release')
assert.ok(!existsSync(workflows + 'deploy-health-settings-production.yml'),
  'Health and Settings must not have a coupled production workflow')

for (const surface of ['health', 'settings']) {
  const source = read(workflows + `deploy-${surface}-production.yml`)
  const trigger = source.split('\npermissions:')[0]
  const upper = surface.toUpperCase()
  assert.match(trigger, /^on:\n  workflow_dispatch:/m)
  assert.doesNotMatch(trigger, /\n  push:/, `${surface} production must not auto-release`)
  assert.ok(source.includes(`inputs.confirmation == 'DEPLOY_ALOHA_${upper}_PRODUCTION'`))
  assert.ok(source.includes("github.ref == 'refs/heads/main'"))
  assert.ok(source.includes('environment: production'))
  assert.ok(source.includes(`const worker = 'aloha-app-${surface}'`))
  assert.ok(source.includes('LIFESPACE_APPLICATION_CREDENTIAL'))
  assert.ok(source.includes('config.keep_vars !== true'))
  const directories = [...source.matchAll(/working-directory: (\S+)/g)].map((match) => match[1])
  assert.deepEqual(directories, [`apps/${surface}`, `apps/${surface}`],
    `${surface} can build/deploy only its own Worker`)
  assert.equal([...source.matchAll(/npx wrangler deploy/g)].length, 2,
    `${surface} must have exactly one dry run and one deployment`)
  assert.ok(source.includes(`npm run typecheck -w @aloha/${surface}`))
  assert.ok(source.includes(`npm run test -w @aloha/${surface}`))
  if (surface === 'health') assert.ok(source.includes('VITE_HEALTH_DATA_MODE: live'))
}

console.log('Independent ALOHA release boundaries verified')
