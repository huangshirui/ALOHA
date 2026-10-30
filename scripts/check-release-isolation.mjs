import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

// Runs without credentials on PRs and on main. Keep the public release surface small.
const root = '.github/workflows/'
const read = file => readFileSync(root + file, 'utf8')
const expected = [
  'ci.yml', 'deploy.yml', 'deploy-finance.yml', 'deploy-health.yml',
  'deploy-settings.yml', 'deploy-things.yml',
]
assert.deepEqual(readdirSync(root).filter(file => /\.ya?ml$/.test(file)).sort(),
  [...expected].sort(), 'Unexpected or leftover GitHub Actions workflow; review it explicitly')

const checkout = 'd23441a48e516b6c34aea4fa41551a30e30af803'
const node = '249970729cb0ef3589644e2896645e5dc5ba9c38'
for (const file of expected) {
  const c = read(file)
  assert.match(c, /permissions:\n  contents: read\n/, file + ': read-only contents required')
  assert.doesNotMatch(c, /pull_request_target:|workflow_run:|repository_dispatch:/,
    file + ': untrusted privileged trigger prohibited')
  assert.doesNotMatch(c, /set -x\b|curl\s+(-v|--verbose)|\bprintenv\b|upload-artifact|--fail-with-body/,
    file + ': disallow verbose or log-bearing secret operations')
  for (const match of c.matchAll(/uses:\s+([^\s#]+)/g)) {
    assert.ok([ `actions/checkout@${checkout}`, `actions/setup-node@${node}` ].includes(match[1]),
      file + ': external Actions must use audited immutable commit SHAs')
  }
  assert.match(c, /actions\/checkout@[a-f0-9]{40}/, file + ': checkout action missing')
  const setupCount = [...c.matchAll(/uses:\s+actions\/setup-node@[a-f0-9]{40}/g)].length
  assert.equal(c.split('package-manager-cache: false').length - 1, setupCount,
    file + ': setup-node v6 must not cache without a checked-in lockfile')
  if (file !== 'ci.yml') {
    assert.match(c, /WRANGLER_LOG: error/, file + ': quiet Wrangler logging required')
    assert.match(c, /WRANGLER_LOG_SANITIZE: 'true'/,
      file + ': Wrangler log sanitization must stay enabled')
    assert.match(c, /WRANGLER_SEND_METRICS: 'false'/, file + ': disable telemetry')
    assert.match(c, /environment: (production|preview)/, file + ': environment missing')
  }
}

const ci = read('ci.yml')
assert.match(ci, /pull_request:/)
assert.doesNotMatch(ci, /secrets\./, 'PR CI must not reference credentials')
assert.match(ci, /fetch-depth: 0/)
assert.match(ci, /git --redact --no-banner/)
assert.match(ci, /\$GITHUB_WORKSPACE:\/repo:ro/, 'Secret scanner must read checkout as read-only')

const assistant = read('deploy.yml')
const assistantHeader = assistant.split('\npermissions:')[0]
const pathsBlock = assistantHeader.match(/  push:\n    branches: \[main\]\n    paths:\n((?:      - '[^']+'\n)+)/)
assert.ok(pathsBlock, 'Assistant auto-deploy requires narrow path filters')
assert.deepEqual([...pathsBlock[1].matchAll(/^      - '([^']+)'$/gm)].map(x => x[1]), [
  'apps/assistant/**', 'workers/gateway/**', 'workers/agent-control/**',
], 'Health/Settings/common packages must never auto-deploy Assistant')
assert.match(assistantHeader, /  workflow_dispatch:/)
assert.match(assistant, /if: github.ref == 'refs\/heads\/main'/)
assert.match(assistant, /environment: production/)
assert.doesNotMatch(assistant, /bootstrap|Renamed aloha-gateway|Ensure Edge Worker deployment name|Verify deployed M[12]/i,
  'One-time migration/bootstrap steps must not recur on Assistant releases')
assert.deepEqual([...assistant.matchAll(/working-directory: ([^\n]+)/g)].map(x => x[1]), [
  'workers/agent-control', 'workers/gateway', 'workers/agent-control', 'workers/gateway',
], 'Assistant can deploy only Agent Control and its transitional Gateway')
assert.equal([...assistant.matchAll(/npx wrangler deploy(?:\s|$)/gm)].length, 4,
  'Assistant must use two dry-runs and two production deployments')

for(const surface of ['health', 'settings']){
  const source=read(`deploy-${surface}.yml`)
  const upper=surface.toUpperCase()
  const preview=source.split('\n  production:')[0]
  const prod=source.split('\n  production:')[1]
  assert.ok(prod, `${surface}: Production job missing`)
  assert.match(source, /^on:\n  workflow_dispatch:/m)
  assert.doesNotMatch(source.split('\npermissions:')[0], /  push:/,
    'Domain releases must remain manual')
  assert.match(preview, new RegExp(`DEPLOY_ALOHA_${upper}_STAGING_PREVIEW`))
  assert.match(preview, /environment: preview/)
  assert.match(preview, /npx wrangler preview --name staging/)
  assert.doesNotMatch(preview, /npx wrangler deploy\s*$/m,
    `${surface}: Preview must not publish Production`)
  assert.match(prod, /github.ref == 'refs\/heads\/main'/)
  assert.match(prod, new RegExp(`DEPLOY_ALOHA_${upper}_PRODUCTION`))
  assert.match(prod, /environment: production/)
  assert.match(prod, new RegExp(`const worker = 'aloha-app-${surface}'`))
  assert.match(prod, /LIFESPACE_APPLICATION_CREDENTIAL/)
  assert.match(prod, /config.keep_vars !== true/)
  assert.deepEqual([...prod.matchAll(/working-directory: ([^\n]+)/g)].map(x => x[1]),
    [`apps/${surface}`, `apps/${surface}`],
    `${surface}: only its own Worker may be deployed`)
  assert.equal([...prod.matchAll(/npx wrangler deploy(?:\s|$)/gm)].length, 2,
    `${surface}: exactly one dry-run and one deploy`)
  assert.match(prod, new RegExp(`npm run typecheck -w @aloha/${surface}`))
  assert.match(prod, new RegExp(`npm run test -w @aloha/${surface}`))
  if(surface==='health')assert.match(prod,/VITE_HEALTH_DATA_MODE: live/)
  assert.doesNotMatch(source,/bootstrap|BOOTSTRAP_/i,
    `${surface}: remove obsolete temporary Production bootstrap`)
}

for (const surface of ['finance','things']) {
  const c=read(`deploy-${surface}.yml`)
  assert.match(c, new RegExp(`DEPLOY_ALOHA_${surface.toUpperCase()}_STAGING_PREVIEW`))
  assert.match(c, /environment: preview/)
  assert.match(c, /wrangler@4\.135\.0 preview --name staging/)
  assert.doesNotMatch(c, /npx wrangler deploy\s*$/m,
    `${surface}: scaffold Preview must not deploy Production`)
}
console.log('ALOHA Actions: six explicit, independent, least-privilege, sanitized workflows verified')
