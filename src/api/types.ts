// The sponsor-check /v1 contract, mirrored by hand from the Pydantic models LookupResult and
// SalaryFloors in sponsor-check's src/sponsor_check/api.py. /v1 only ever gains fields, so
// unknown fields are ignored and unknown status/rating values are handled, never trusted.

export const STATUSES = ['licensed', 'licensed_other_routes', 'possible', 'not_found'] as const
export const RATINGS = ['A', 'B', 'Provisional', 'Unknown'] as const

export type LookupStatus = (typeof STATUSES)[number]
export type Rating = (typeof RATINGS)[number]

export interface Licence {
  route: string
  rating: string
  type: string // raw register text, e.g. "Worker (A rating)"
}

export interface LookupResult {
  // Typed as string, not LookupStatus: a newer server may send a value this build doesn't know.
  status: string
  legal_name: string | null
  town: string | null
  rating: string | null
  routes: Licence[]
  register_date: string // "YYYY-MM-DD", may be ""
  source_url: string // the register CSV
  register_url?: string // the GOV.UK publication page (added in K8)
  confidence: number // 0-100; 100 only for exact matches
  notes: string[]
}

export interface SalaryFloors {
  salary: number
  route: string
  general_threshold: number
  meets_general: boolean
  new_entrant_threshold: number
  meets_new_entrant: boolean
  hours_per_week_basis: number
  weeks_per_year_basis: number
  thresholds: { effective_date: string; source_url: string }
  notes: string[]
}

export const REGISTER_PAGE =
  'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers'

export function isKnownStatus(value: string): value is LookupStatus {
  return (STATUSES as readonly string[]).includes(value)
}

export function isKnownRating(value: string): value is Rating {
  return (RATINGS as readonly string[]).includes(value)
}
