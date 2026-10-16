// Shared setup for the browser tests: Chromium with the built extension from dist/ loaded.

import path from 'node:path'

import { chromium, type BrowserContext } from '@playwright/test'

// Derived from the public "key" in static/manifest.json, and allowlisted by the API's CORS default.
export const EXTENSION_ID = 'kiggiklmmmlkmjfaikamcihbinjhgcpo'

export async function launchWithExtension(): Promise<BrowserContext> {
  const dist = path.resolve('dist')
  return chromium.launchPersistentContext('', {
    channel: 'chromium', // the full build: the headless shell can't load extensions
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
  })
}
