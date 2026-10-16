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

const LINKEDIN = [
  'a.topcard__org-name-link', // fixture: logged-out /jobs/view page
  '.job-details-jobs-unified-top-card__company-name a', // untested: logged-in job view
  '.job-details-jobs-unified-top-card__company-name', // untested: logged in, no company page
]

const INDEED = [
  // fixture: search results with the job open in the right-hand pane. Only the open job's header
  // is searched; every card in the list also has a company name.
  '[data-testid="desktop-job-header"] [data-testid="company-info-metadata"] a',
  '[data-testid="inlineHeader-companyName"] a', // untested: standalone /viewjob page
  '[data-testid="inlineHeader-companyName"]', // untested: standalone page, no company page
]

export const extractLinkedIn: Extractor = (doc) => firstMatch(doc, LINKEDIN)
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
      const name = (anchor.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (name && name.length <= MAX_NAME_LENGTH) return { name, anchor }
    }
  }
  return null
}
