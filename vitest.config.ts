import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'], // e2e/ is Playwright's, and needs a running API
  },
})
