import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

// Exercises the actual Workers runtime, not the in-memory SQL mock.
export default defineConfig({
  plugins:[cloudflareTest({wrangler:{configPath:'./wrangler.test.jsonc'}})],
  test:{include:['test/**/*.workers.test.ts']},
})
