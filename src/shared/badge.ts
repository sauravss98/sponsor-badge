// What the badge and panel say for each API outcome. Pure, so every mapping is unit tested.
//
// The rule behind every choice: only an exact match with an A rating on Skilled Worker is
// green. A fuzzy match must never look confirmed, and a failure must never look like an answer.

import { REGISTER_PAGE, isKnownRating, isKnownStatus, type LookupResult } from '../api/types'
import type { LookupOutcome } from './messages'

export const ROUTE = 'Skilled Worker' // the only route the MVP checks (the API's default)

export type Tone = 'green' | 'amber' | 'grey' | 'neutral'

export interface BadgeView {
  tone: Tone
  label: string
  /** The matched register name, shown next to every match so a wrong match can be spotted. */
  legalName?: string
}

const COULD_NOT_CHECK: BadgeView = { tone: 'neutral', label: "Couldn't check" }

export function badgeFor(outcome: LookupOutcome): BadgeView {
  if (outcome.kind === 'skipped') return { tone: 'neutral', label: 'No employer name to check' }
  if (outcome.kind === 'unavailable') {
    return outcome.reason === 'rate_limited'
      ? { tone: 'neutral', label: "Couldn't check right now" }
      : COULD_NOT_CHECK
  }
  return badgeForResult(outcome.result)
}

function badgeForResult(result: LookupResult): BadgeView {
  // Unknown values from a newer server get the neutral style, never a guess.
  if (!isKnownStatus(result.status)) return COULD_NOT_CHECK
  const legalName = result.legal_name ?? undefined

  switch (result.status) {
    case 'licensed': {
      const view = licensedBadge(result.rating)
      return view === COULD_NOT_CHECK ? view : { ...view, legalName }
    }
    case 'licensed_other_routes':
      // Grey, not amber: it cannot sponsor this route today.
      return { tone: 'grey', label: `Licensed, but not for ${ROUTE}`, legalName }
    case 'possible':
      return { tone: 'amber', label: 'Possible match: check', legalName }
    case 'not_found':
      return { tone: 'grey', label: 'Not found on register' }
  }
}

function licensedBadge(rating: string | null): BadgeView {
  if (rating === null || !isKnownRating(rating)) return COULD_NOT_CHECK
  switch (rating) {
    case 'A':
      return { tone: 'green', label: `Licensed sponsor (A-rated): ${ROUTE}` }
    case 'B':
      return { tone: 'amber', label: 'Licensed sponsor (B-rated): ask the employer' }
    case 'Provisional':
      return { tone: 'amber', label: 'Provisional licence: check with the employer' }
    case 'Unknown':
      return { tone: 'amber', label: 'Licensed sponsor: rating unclear' }
  }
}

export interface PanelView {
  legalName: string | null
  town: string | null
  rating: string | null
  routes: string[] // e.g. "Skilled Worker (A)"
  registerDate: string
  registerUrl: string
  confidence: number
  notes: string[]
}

export function panelFor(result: LookupResult): PanelView {
  return {
    legalName: result.legal_name,
    town: result.town,
    rating: result.rating,
    routes: result.routes.map((r) => `${r.route} (${r.rating})`),
    registerDate: result.register_date,
    registerUrl: result.register_url ?? REGISTER_PAGE,
    confidence: result.confidence,
    notes: result.notes,
  }
}
