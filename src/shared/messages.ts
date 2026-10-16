// Messages between extension pages/content scripts and the background service worker, which
// makes every API call so there is one cache and one rate-limit pause for the whole extension.

import type { ApiFailure } from '../api/client'
import type { LookupResult, SalaryFloors } from '../api/types'

export interface LookupRequest {
  type: 'lookup'
  name: string
}

/** Only the amount is sent: never the ad's text, title or URL. */
export interface SalaryRequest {
  type: 'salary'
  amount: number
}

export type Outcome<T> =
  | { kind: 'ok'; result: T }
  | { kind: 'skipped' } // nothing worth sending (empty or placeholder name, invalid amount)
  | { kind: 'unavailable'; reason: ApiFailure['kind']; retryAfterSeconds?: number }

export type LookupOutcome = Outcome<LookupResult>
export type SalaryOutcome = Outcome<SalaryFloors>

export function isLookupRequest(message: unknown): message is LookupRequest {
  if (typeof message !== 'object' || message === null) return false
  const m = message as Record<string, unknown>
  return m.type === 'lookup' && typeof m.name === 'string'
}

export function isSalaryRequest(message: unknown): message is SalaryRequest {
  if (typeof message !== 'object' || message === null) return false
  const m = message as Record<string, unknown>
  return m.type === 'salary' && typeof m.amount === 'number'
}
