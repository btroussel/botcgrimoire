import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    // The store tests open IndexedDB; fake-indexeddb gives Node one.
    setupFiles: ['fake-indexeddb/auto'],
  },
})
