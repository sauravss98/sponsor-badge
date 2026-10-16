// Messages between extension pages/content scripts and the background service worker, which
// makes every API call so there is one cache and one rate-limit pause for the whole extension.

import type { ApiFailure } from '../api/client'
import type { LookupResult } from '../api/types'

export interface LookupRequest {
  type: 'lookup'
  name: string
}

export type LookupOutcome =
  | { kind: 'ok'; result: LookupResult }
  | { kind: 'skipped' } // empty or placeholder name: nothing was sent
  | { kind: 'unavailable'; reason: ApiFailure['kind']; retryAfterSeconds?: number }

export function isLookupRequest(message: unknown): message is LookupRequest {
  if (typeof message !== 'object' || message === null) return false
  const m = message as Record<string, unknown>
  return m.type === 'lookup' && typeof m.name === 'string'
}
