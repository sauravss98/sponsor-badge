// Finds the employer on a job page. Each site lists CSS selectors to try in order; the first one
// that matches an element with text wins. The element is also where the badge goes (after it).
//
// Selectors marked "fixture" are tested against real pages saved in fixtures/. Ones marked
// "untested" are a best guess at markup we have no saved page for yet: if they're wrong, the
// extractor returns null and no badge appears, which is the safe failure.

import { MAX_NAME_LENGTH } from '../shared/names'

export interface Employer {
  name: string
  anchor: Element
}

export type Extractor = (doc: Document) => Employer | null

const LINKEDIN_LOGGED_OUT = ['a.topcard__org-name-link'] // fixture: logged-out /jobs/view page

const INDEED = [
  // fixture: search results with the job open in the right-hand pane. Only the open job's header
  // is searched; every card in the list also has a company name.
  '[data-testid="desktop-job-header"] [data-testid="company-info-metadata"] a',
  '[data-testid="inlineHeader-companyName"] a', // untested: standalone /viewjob page
  '[data-testid="inlineHeader-companyName"]', // untested: standalone page, no company page
]

export const extractLinkedIn: Extractor = (doc) =>
  firstMatch(doc, LINKEDIN_LOGGED_OUT) ?? linkedInLoggedIn(doc)

/**
 * Logged-in LinkedIn scrambles its class names ("iiimuy iiimux") and changes them every release,
 * so this uses only what it can't scramble. Measured on /jobs/search-results on 2026-10-16:
 * - the title is "<job title> | <company> | LinkedIn"
 * - the open job's pane links the company name to /company/<slug>/: once as the logo (an <img>
 *   inside), once as the plain name (the one we want), and further down as the "followers" card
 *   (logo inside) and "Show more" (has an aria-label). The job list has no company links.
 */
function linkedInLoggedIn(doc: Document): Employer | null {
  const named: Employer[] = []
  for (const anchor of doc.querySelectorAll('main a[href*="/company/"]')) {
    if (anchor.querySelector('img') || anchor.hasAttribute('aria-label')) continue
    const name = clean(anchor.textContent)
    if (name && name.length <= MAX_NAME_LENGTH) named.push({ name, anchor })
  }
  // Only a link the title confirms will do. Without that check, a page with no open job would
  // badge the first company under "Similar jobs": no badge beats a wrong one.
  const fromTitle = companyFromTitle(doc.title)
  if (!fromTitle) return null
  return named.find((e) => e.name.toLowerCase() === fromTitle.toLowerCase()) ?? null
}

/** "(3) Job title | Company | LinkedIn" -> "Company"; null for any other shape. */
export function companyFromTitle(title: string): string | null {
  const parts = title.split(' | ').map((p) => p.trim())
  if (parts.length < 3 || parts[parts.length - 1] !== 'LinkedIn') return null
  return parts[parts.length - 2] || null
}

function clean(text: string | null): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}
export const extractIndeed: Extractor = (doc) => firstMatch(doc, INDEED)

/** The extractor for a hostname, or null on sites we don't support. */
export function extractorFor(hostname: string): Extractor | null {
  if (hostname === 'www.linkedin.com' || hostname === 'linkedin.com') return extractLinkedIn
  if (hostname === 'uk.indeed.com') return extractIndeed
  return null
}

function firstMatch(doc: Document, selectors: string[]): Employer | null {
  for (const selector of selectors) {
    for (const anchor of doc.querySelectorAll(selector)) {
      const name = clean(anchor.textContent)
      if (name && name.length <= MAX_NAME_LENGTH) return { name, anchor }
    }
  }
  return null
}
