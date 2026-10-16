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
  const links = [...doc.querySelectorAll('main a[href*="/company/"]')]

  // 1. A plain link whose name the title confirms.
  const fromTitle = companyFromTitle(doc.title)
  if (fromTitle) {
    for (const anchor of links) {
      const employer = plainLink(anchor)
      if (employer && employer.name.toLowerCase() === fromTitle.toLowerCase()) return employer
    }
  }

  // 2. The job header's own shape, for when the title says something else (LinkedIn retitles the
  //    tab, e.g. with notification counts): the first company link on the page is the logo and
  //    the next is the plain name, both to the same company page. "Similar jobs" comes later in
  //    the page, so it can't match. Anything else: no badge beats a wrong one.
  const [logo, name] = links
  if (logo?.querySelector('img') && name && name.getAttribute('href') === logo.getAttribute('href')) {
    return plainLink(name)
  }
  return null
}

/** A company link showing just the name: no logo inside, no "Show more"-style aria-label. */
function plainLink(anchor: Element): Employer | null {
  if (anchor.querySelector('img') || anchor.hasAttribute('aria-label')) return null
  const name = clean(anchor.textContent)
  return name && name.length <= MAX_NAME_LENGTH ? { name, anchor } : null
}

/** "(3) Job title | Company | LinkedIn" -> "Company"; null for any other shape. */
export function companyFromTitle(title: string): string | null {
  const parts = title.split(' | ').map((p) => p.trim())
  if (parts.length < 3 || parts[parts.length - 1] !== 'LinkedIn') return null
  return parts[parts.length - 2] || null
}

export function clean(text: string | null): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}
export const extractIndeed: Extractor = (doc) => firstMatch(doc, INDEED)

/** Reads the open job's advertised salary text, or null when the page shows none. */
export type SalaryExtractor = (doc: Document) => string | null

const INDEED_SALARY: string[] = [] // filled in from a saved page showing an open job's salary
const LINKEDIN_SALARY: string[] = [] // filled in once the logged-in layout has been measured

export function salaryExtractorFor(hostname: string): SalaryExtractor {
  const selectors = hostname === 'uk.indeed.com' ? INDEED_SALARY
    : hostname === 'www.linkedin.com' || hostname === 'linkedin.com' ? LINKEDIN_SALARY
    : []
  return (doc) => {
    for (const selector of selectors) {
      for (const node of doc.querySelectorAll(selector)) {
        const text = clean(node.textContent)
        if (text.includes('£')) return text
      }
    }
    return null
  }
}

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
