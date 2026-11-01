import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tools/browser',
  // Only pwa.spec.mjs lets the service worker in, and a file's tests run in order on one worker,
  // so its switch of the server's release reaches no other spec while every other spec blocks
  // service workers. Two workers halve the run; four made layout specs time out under the load.
  workers: 2,
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
