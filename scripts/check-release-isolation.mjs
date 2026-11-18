import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import {resolveSettingsPreview,configureHealthPreview} from './resolve-health-preview-settings.mjs'

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
  const checkoutCount = [...c.matchAll(/uses:\s+actions\/checkout@[a-f0-9]{40}/g)].length
  assert.equal(c.split('persist-credentials: false').length - 1, checkoutCount,
    file + ': checkout must not leave a reusable GitHub token in the workspace')
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
  assert.match(c, /npx wrangler preview --name staging/)
  const config = JSON.parse(readFileSync(`apps/${surface}/package.json`, 'utf8'))
  assert.equal(config.scripts.deploy, undefined,
    `${surface}: remove implicit unreviewed Production deploy script`)
  assert.match(config.scripts['deploy:staging'], /wrangler preview --name staging/)
  assert.doesNotMatch(c, /npx wrangler deploy\s*$/m,
    `${surface}: scaffold Preview must not deploy Production`)
}
const settings=JSON.parse(readFileSync('apps/settings/wrangler.jsonc','utf8'))
const health=JSON.parse(readFileSync('apps/health/wrangler.jsonc','utf8'))
assert.equal(settings.main,'./src/entrypoint.ts')
assert.equal(settings.services,undefined)
assert.equal(settings.env,undefined)
assert.equal(settings.preview_urls,true)
assert.equal(settings.workers_dev,false)
assert.equal(settings.route,undefined)
assert.equal(settings.routes,undefined)
assert.equal(settings.vars,undefined)
assert.deepEqual(settings.durable_objects.bindings,[{name:'WORKSPACE_STATE',class_name:'WorkspaceState'}])
assert.deepEqual(settings.previews.durable_objects.bindings,settings.durable_objects.bindings)
assert.ok(settings.migrations.some(m=>m.new_sqlite_classes.includes('WorkspaceState')))
assert.deepEqual(settings.previews.vars,{ALOHA_WORKSPACE_MODE:'preview'})
assert.deepEqual(health.services.find(x=>x.binding==='ALOHA_WORKSPACE'),{binding:'ALOHA_WORKSPACE',service:settings.name,entrypoint:'WorkspaceReader'})
assert.equal(health.previews.services,undefined)
assert.deepEqual(health.previews.vars,{ALOHA_WORKSPACE_MODE:'preview'})
assert.equal(health.vars,undefined)
const healthPreview=read('deploy-health.yml').split('\n  production:')[0]
assert.match(healthPreview,/ALOHA_SETTINGS_PREVIEW_URL/)
assert.match(healthPreview,/ALOHA_SETTINGS_ACCESS_CLIENT_ID/)
assert.match(healthPreview,/ALOHA_SETTINGS_ACCESS_CLIENT_SECRET/)
assert.match(healthPreview,/Health Preview must not have a production Service Binding/)
assert.match(healthPreview,/node scripts\/resolve-health-preview-settings\.mjs/)
assert.doesNotMatch(healthPreview,/vars\.ALOHA_SETTINGS_STAGING_URL/)
assert.ok(healthPreview.indexOf('node scripts/resolve-health-preview-settings.mjs')<healthPreview.indexOf('npm run build:health'))
const sample=(surface,account='synthetic')=>[{name:'staging',deployed_on:'2026-01-01T00:00:00Z',urls:['https://staging-aloha-app-'+surface+'.'+account+'.workers.dev/']}]
const settingsUrl=resolveSettingsPreview(sample('health'),sample('settings'))
assert.equal(settingsUrl,'https://staging-aloha-app-settings.synthetic.workers.dev/settings/')
assert.throws(()=>resolveSettingsPreview(sample('health'),sample('settings','other')),/suffix mismatch/)
assert.throws(()=>resolveSettingsPreview(sample('health'),[]),/one deployed/)
assert.throws(()=>resolveSettingsPreview(sample('health'),[{...sample('settings')[0],deployed_on:null}]),/one deployed/)
assert.throws(()=>resolveSettingsPreview(sample('health'),[{...sample('settings')[0],urls:['https://aloha-app-settings.synthetic.workers.dev/']}]),/canonical/)
assert.throws(()=>resolveSettingsPreview(sample('health'),[{...sample('settings')[0],urls:['https://staging-aloha-app-settings.synthetic.workers.dev/?x=1']}]),/canonical/)
const configured=configureHealthPreview(health,settingsUrl)
assert.equal(configured.previews.vars.ALOHA_SETTINGS_PREVIEW_URL,settingsUrl)
assert.equal(configured.vars,undefined)
assert.deepEqual(configured.services,health.services)
assert.throws(()=>configureHealthPreview({...health,previews:{...health.previews,services:health.services}},settingsUrl),/Unsafe/)
console.log('ALOHA Actions: six independent workflows and isolated Preview HTTPS / Production binding verified')
