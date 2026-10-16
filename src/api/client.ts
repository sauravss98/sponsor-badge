// HTTP client for the sponsor-check /v1 API.
//
// Every failure comes back as a typed result instead of a thrown error, so callers can't
// accidentally show "Not found on register" when the API simply didn't answer.

import type { LookupResult } from './types'

export type ApiFailure =
  | { kind: 'rate_limited'; retryAfterSeconds: number }
  | { kind: 'invalid' } // 4xx other than 429: we sent something the API rejects
  | { kind: 'server' } // 5xx
  | { kind: 'network' } // DNS, offline, CORS refusal
  | { kind: 'timeout' }
  | { kind: 'bad_response' } // 2xx but not the shape the contract promises

export type ApiResult<T> = { kind: 'ok'; data: T } | ApiFailure

export interface ClientOptions {
  base: string
  fetch?: typeof fetch
  timeoutMs?: number
}

// Generous because the free-tier host sleeps when idle and the first request wakes it.
export const DEFAULT_TIMEOUT_MS = 20_000
const DEFAULT_RETRY_AFTER_SECONDS = 60

export function lookup(name: string, options: ClientOptions): Promise<ApiResult<LookupResult>> {
  // Only the employer name is sent: no route (always Skilled Worker), no page URL.
  const url = `${options.base}/v1/lookup?name=${encodeURIComponent(name)}`
  return getJson(url, options, isLookupResult)
}

async function getJson<T>(
  url: string,
  options: ClientOptions,
  valid: (data: unknown) => data is T,
): Promise<ApiResult<T>> {
  const first = await getOnce(url, options, valid)
  // One retry for failures that may be a blip. Never for 4xx (it would fail the same way) or a
  // timeout (the user has already waited the full timeout once).
  if (first.kind === 'server' || first.kind === 'network') {
    return getOnce(url, options, valid)
  }
  return first
}

async function getOnce<T>(
  url: string,
  options: ClientOptions,
  valid: (data: unknown) => data is T,
): Promise<ApiResult<T>> {
  const fetchImpl = options.fetch ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  let resp: Response
  try {
    // A plain GET with no custom headers and no credentials is a CORS "simple request", so
    // there is no preflight.
    resp = await fetchImpl(url, { signal: controller.signal })
  } catch {
    return controller.signal.aborted ? { kind: 'timeout' } : { kind: 'network' }
  } finally {
    clearTimeout(timer)
  }

  if (resp.status === 429) {
    return { kind: 'rate_limited', retryAfterSeconds: retryAfter(resp.headers.get('Retry-After')) }
  }
  if (resp.status >= 500) return { kind: 'server' }
  if (!resp.ok) return { kind: 'invalid' }

  let data: unknown
  try {
    data = await resp.json()
  } catch {
    return { kind: 'bad_response' }
  }
  return valid(data) ? { kind: 'ok', data } : { kind: 'bad_response' }
}

/** Seconds to wait, from a Retry-After header in either of its two forms (seconds or a date). */
export function retryAfter(header: string | null, now: number = Date.now()): number {
  if (header) {
    const seconds = Number(header)
    if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds)
    const date = Date.parse(header)
    if (!Number.isNaN(date)) return Math.max(0, Math.ceil((date - now) / 1000))
  }
  return DEFAULT_RETRY_AFTER_SECONDS
}

export function isLookupResult(data: unknown): data is LookupResult {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return (
    typeof d.status === 'string' &&
    (d.legal_name === null || typeof d.legal_name === 'string') &&
    Array.isArray(d.routes) &&
    Array.isArray(d.notes) &&
    d.notes.every((n) => typeof n === 'string') &&
    typeof d.register_date === 'string' &&
    typeof d.confidence === 'number'
  )
}
