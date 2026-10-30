import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = new URL('../../../', import.meta.url)
const read = (path:string) => readFileSync(new URL(path, root), 'utf8')

describe('one Worker project / isolated staging Preview release contract', () => {
  for (const surface of ['health','finance','things']) {
    it(`${surface} Preview cannot deploy Production or choose a runtime environment`, () => {
      const wrangler = JSON.parse(read(`apps/${surface}/wrangler.jsonc`))
      expect(wrangler.name).toBe(`aloha-app-${surface}`)
      expect(wrangler.preview_urls).toBe(true)
      expect(wrangler).toHaveProperty('previews')
      expect(wrangler.env).toBeUndefined()

      const workflow = read(`.github/workflows/deploy-${surface}.yml`)
      const previewWorkflow = surface === 'health'
        ? workflow.split('\n  production:')[0]!
        : workflow
      expect(previewWorkflow).toContain('preview --name staging')
      expect(previewWorkflow).toContain('environment: preview')
      const productionDeployCommands = previewWorkflow.split('\n')
        .filter(line => /run:\s*(?:npx\s+)?wrangler\s+deploy\b/u.test(line))
        .filter(line => !/\s--dry-run(?:\s|$)/u.test(line))
      expect(productionDeployCommands).toEqual([])
      expect(previewWorkflow).not.toMatch(/command:\s*deploy\b/u)
      expect(workflow).not.toContain('STAGING_LIFESPACE_APPLICATION_CREDENTIAL')
    })
  }

  it('Health Production is a separate main-only release and never activates public routing', () => {
    const config = JSON.parse(read('apps/health/wrangler.jsonc'))
    expect(config.workers_dev).toBe(false)
    expect(config.compatibility_flags).toContain('global_fetch_strictly_public')
    expect(config.preview_urls).toBe(true)
    expect(config.route).toBeUndefined()
    expect(config.routes).toBeUndefined()
    expect(config.vars).toBeUndefined()
    expect(config.keep_vars).toBe(true)

    const workflow = read('.github/workflows/deploy-health.yml')
    const preview = workflow.split('\n  production:')[0]!
    const prod = workflow.split('\n  production:')[1]
    expect(prod).toBeDefined()
    expect(preview).not.toMatch(/run: npx wrangler deploy\s*$/mu)
    expect(prod).toContain("github.ref == 'refs/heads/main'")
    expect(prod).toContain("inputs.confirmation == 'DEPLOY_ALOHA_HEALTH_PRODUCTION'")
    expect(prod).toContain('environment: production')
    expect(prod).toContain("config.workers_dev !== false")
    expect(prod).toContain("config.route || config.routes || config.vars")
    expect(prod).toContain('working-directory: apps/health')
    expect(prod).toContain('npx wrangler deploy --dry-run')
    expect(prod).toMatch(/run: npx wrangler deploy\s*$/mu)
    expect(prod).not.toContain('preview --name staging')
    expect(prod).not.toContain('STAGING_LIFESPACE_APPLICATION_CREDENTIAL')
  })

  it('Health workspace has no implicit production deploy script', () => {
    const packageConfig = JSON.parse(read('apps/health/package.json'))
    expect(packageConfig.scripts.deploy).toBeUndefined()
    expect(packageConfig.scripts['deploy:staging']).toContain('wrangler preview --name staging')
  })

  it('Health Preview binds its own SQLite Durable Object class', () => {
    const config = JSON.parse(read('apps/health/wrangler.jsonc'))
    expect(config.durable_objects.bindings).toEqual([
      {name:'HEALTH_PRESENTATION',class_name:'HealthPresentationState'},
    ])
    expect(config.previews.durable_objects.bindings).toEqual(config.durable_objects.bindings)
    expect(config.migrations).toContainEqual({
      tag:'health-presentation-v1',new_sqlite_classes:['HealthPresentationState'],
    })
  })

  it('Health Preview builds live mode but requires trusted backend configuration', () => {
    const workflow = read('.github/workflows/deploy-health.yml')
    expect(workflow).toContain('VITE_HEALTH_DATA_MODE: live')
    expect(workflow).toContain('wrangler deploy --dry-run')
    expect(workflow).toContain('test -f apps/health/src/worker.ts')
    expect(workflow).toContain('Verify deployed Preview bindings (names only)')
    expect(workflow).toContain('Missing staging Preview bindings')
    expect(workflow).toContain('LIFESPACE_IDENTITY_BASE_URL')
    expect(workflow).toContain('LIFESPACE_CORE_BASE_URL')
    expect(workflow).toContain('LIFESPACE_APPLICATION_CREDENTIAL')
    expect(workflow).not.toContain('data_mode:')
    expect(workflow).not.toMatch(/LIFESPACE_.*(?:https?:\/\/|lsa_)/u)
  })
})
