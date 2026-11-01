import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tools/browser',
  // The specs share the test server's current release, so they run one at a time.
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: { baseURL: 'http://127.0.0.1:4173', locale: 'en-US', trace: 'retain-on-failure' },
  webServer: {
    command: 'node tools/browser/server.mjs',
    url: 'http://127.0.0.1:4173/__test__/ready',
    env: { WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_PATH: '.wrangler/test-logs' },
    timeout: 60_000,
  },
})
