// The content script on saved job pages, served at their real URLs so Chrome injects it exactly
// as on the live sites. Lookups go to the local API (start `sponsor-check-api` first), so the
// expected badges depend on the register it has loaded.

import { readFileSync } from 'node:fs'

import { expect, test, type BrowserContext, type Page } from '@playwright/test'

import { launchWithExtension } from './extension'

let context: BrowserContext

test.beforeAll(async () => {
  context = await launchWithExtension()
})

test.afterAll(async () => {
  await context.close()
})

async function open(url: string, fixture: string): Promise<Page> {
  const page = await context.newPage()
  // Serve the saved page; block everything else the page asks for, so nothing reaches the board.
  await page.route('**/*', (route) =>
    route.request().url() === url
      ? route.fulfill({ contentType: 'text/html', body: readFileSync(`fixtures/${fixture}`, 'utf8') })
      : route.abort())
  await page.goto(url)
  return page
}

// Playwright locators pierce the badge's open shadow root.
const badge = (page: Page) => page.locator('[data-sponsor-badge] .badge')

test('LinkedIn: Deliveroo gets a green badge next to its name', async () => {
  const page = await open('https://www.linkedin.com/jobs/view/1/', 'linkedin-3.html')
  await expect(badge(page)).toHaveText('Licensed sponsor (A-rated): Skilled Worker')
  await expect(badge(page)).toHaveClass(/green/)
  await expect(page.locator('[data-sponsor-badge]')).toHaveCount(1)

  await badge(page).click()
  await expect(page.locator('[data-sponsor-badge] .panel')).toBeVisible()
  await expect(page.locator('[data-sponsor-badge] .panel')).toContainText('This is not immigration advice.')
})

test('LinkedIn: the badge follows the page to another job without a reload', async () => {
  const page = await open('https://www.linkedin.com/jobs/view/2/', 'linkedin-1.html')
  await expect(badge(page)).not.toHaveText('Checking sponsor licence...')
  // What LinkedIn does when you click another job in the list: the top card's text changes.
  await page.locator('a.topcard__org-name-link').evaluate((a) => { a.textContent = 'Starling Bank' })
  await expect(badge(page)).toHaveText('Licensed sponsor (A-rated): Skilled Worker')
  await expect(page.locator('[data-sponsor-badge]')).toHaveCount(1)
})

test('Indeed: the open job gets the badge, not the list', async () => {
  const page = await open('https://uk.indeed.com/jobs?q=software', 'indeed-3.html')
  await expect(page.locator('[data-sponsor-badge]')).toHaveCount(1)
  await expect(badge(page)).not.toHaveText('Checking sponsor licence...')
  const header = page.locator('[data-testid="desktop-job-header"]')
  await expect(header.locator('[data-sponsor-badge]')).toHaveCount(1)
})
