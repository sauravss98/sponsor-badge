// Smoke test of the built extension in a real Chromium, against a running sponsor-check API at
// http://127.0.0.1:8000 (`sponsor-check-api` in the backend repo). Not offline: run it with
// `npm run e2e` once the API is up. The unit tests in tests/ mock the API instead.

import { expect, test, type BrowserContext } from '@playwright/test'

import { EXTENSION_ID, launchWithExtension } from './extension'

let context: BrowserContext

test.beforeAll(async () => {
  context = await launchWithExtension()
})

test.afterAll(async () => {
  await context.close()
})

async function search(name: string) {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${EXTENSION_ID}/popup.html`)
  await page.fill('#name', name)
  await page.click('button[type=submit]')
  await expect(page.locator('.badge')).not.toHaveText('Checking...')
  return page
}

test('the manifest key pins the extension ID', async () => {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
  expect(new URL(worker.url()).host).toBe(EXTENSION_ID)
})

test('Starling Bank is a green, A-rated licensed sponsor', async () => {
  const page = await search('Starling Bank')
  await expect(page.locator('.badge')).toHaveText('Licensed sponsor (A-rated): Skilled Worker')
  await expect(page.locator('.badge')).toHaveClass(/green/)
  await expect(page.locator('.matched')).toHaveText('STARLING BANK LIMITED')
  await expect(page.locator('ul.notes li').last()).toContainText('not that it will sponsor')
  await expect(page.getByRole('link', { name: 'Official register on GOV.UK' })).toHaveAttribute(
    'href', 'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers')
})

test('a fuzzy match is amber and names the company it matched', async () => {
  const page = await search('Amazon')
  await expect(page.locator('.badge')).toHaveText('Possible match: check')
  await expect(page.locator('.badge')).toHaveClass(/amber/)
  await expect(page.locator('.matched')).toHaveText('Maxico Uk limited t/a The Amazon')
})

test('a placeholder name is never sent', async () => {
  const page = await search('Confidential')
  await expect(page.locator('.badge')).toHaveText('No employer name to check')
})
