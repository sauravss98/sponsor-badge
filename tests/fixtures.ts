// Real /v1/lookup responses from sponsor-check (register of 2026-09-29), trimmed only where noted.

import type { LookupResult, SalaryFloors } from '../src/api/types'

const CAVEAT =
  'Being on the register means the employer can sponsor, not that it will sponsor this ' +
  'particular role.'
const SOURCE =
  'https://assets.publishing.service.gov.uk/media/6abb7089fe72ed1e2b02f19e/' +
  'SP_-_Worker_and_Temporary_Worker_Web_Register_-_2026-09-29.csv'
const REGISTER =
  'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers'

export const starling: LookupResult = {
  status: 'licensed',
  legal_name: 'STARLING BANK LIMITED',
  town: 'London',
  rating: 'A',
  routes: [{ route: 'Skilled Worker', rating: 'A', type: 'Worker (A rating)' }],
  register_date: '2026-09-29',
  source_url: SOURCE,
  register_url: REGISTER,
  confidence: 100,
  notes: [CAVEAT],
}

export const amazonPossible: LookupResult = {
  ...starling,
  status: 'possible',
  legal_name: 'Maxico Uk limited t/a The Amazon',
  town: 'Port Talbot',
  confidence: 99,
  notes: ['No exact name match. Check which (if any) of these is the employer\'s legal entity, ' +
          'e.g. on Companies House or the job ad\'s footer.', CAVEAT],
}

export const notFound: LookupResult = {
  ...starling,
  status: 'not_found',
  legal_name: null,
  town: null,
  rating: null,
  routes: [],
  confidence: 0,
}

export function withStatus(status: string, rating: string | null = 'A'): LookupResult {
  return { ...starling, status, rating }
}

// A real /v1/salary-check response (production, 2026-10-16), amount 38000, notes trimmed.
export const floors: SalaryFloors = {
  salary: 38000,
  route: 'Skilled Worker',
  general_threshold: 41700,
  meets_general: false,
  new_entrant_threshold: 33400,
  meets_new_entrant: true,
  hours_per_week_basis: 37.5,
  weeks_per_year_basis: 52,
  thresholds: { effective_date: '2025-11-11', source_url: 'https://www.gov.uk/skilled-worker-visa/your-job' },
  notes: ['These are the flat salary floors only.', 'This is not immigration advice.'],
}
