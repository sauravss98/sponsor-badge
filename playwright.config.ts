import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000, // the first lookup can wait on the API building its register
  workers: 1, // one browser with the extension loaded, shared by the tests
})
