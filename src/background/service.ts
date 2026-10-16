// The API logic the background worker runs, kept free of chrome.* so it can be unit tested.
// Name lookups and salary checks share one cache store and one rate-limit pause.

import type { ApiResult } from '../api/client'
import type { LookupResult, SalaryFloors } from '../api/types'
import type { LookupOutcome, Outcome, SalaryOutcome } from '../shared/messages'
import { cacheKey, isCheckableName } from '../shared/names'

/** The subset of chrome.storage.session this needs; swapped for a Map in tests. */
export interface KeyValueStore {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
}

interface ServiceDeps<A, T> {
  store: KeyValueStore
  call: (arg: A) => Promise<ApiResult<T>>
  /** Cache key for an argument, or null to skip it without calling the API. */
  key: (arg: A) => string | null
  now?: () => number
}

const PAUSE_KEY = 'paused_until' // epoch ms; set from Retry-After after a 429

function createCachedService<A, T>(deps: ServiceDeps<A, T>): (arg: A) => Promise<Outcome<T>> {
  const now = deps.now ?? Date.now
  // Two callers asking for the same thing at once share one request.
  const inFlight = new Map<string, Promise<Outcome<T>>>()

  async function run(arg: A, key: string): Promise<Outcome<T>> {
    const cached = await deps.store.get(key)
    if (cached) return { kind: 'ok', result: cached as T }

    // After a 429 every call waits out Retry-After, not just the one that was refused.
    const pausedUntil = await deps.store.get(PAUSE_KEY)
    if (typeof pausedUntil === 'number' && now() < pausedUntil) {
      const retryAfterSeconds = Math.ceil((pausedUntil - now()) / 1000)
      return { kind: 'unavailable', reason: 'rate_limited', retryAfterSeconds }
    }

    const result = await deps.call(arg)
    if (result.kind === 'ok') {
      // Only answers are cached; a failure is retried next time.
      await deps.store.set(key, result.data)
      return { kind: 'ok', result: result.data }
    }
    if (result.kind === 'rate_limited') {
      await deps.store.set(PAUSE_KEY, now() + result.retryAfterSeconds * 1000)
      return { kind: 'unavailable', reason: 'rate_limited', retryAfterSeconds: result.retryAfterSeconds }
    }
    return { kind: 'unavailable', reason: result.kind }
  }

  return async (arg) => {
    const key = deps.key(arg)
    if (key === null) return { kind: 'skipped' }
    const pending = inFlight.get(key)
    if (pending) return pending
    const promise = run(arg, key).finally(() => inFlight.delete(key))
    inFlight.set(key, promise)
    return promise
  }
}

export interface LookupDeps {
  store: KeyValueStore
  lookup: (name: string) => Promise<ApiResult<LookupResult>>
  now?: () => number
}

export function createLookupService(deps: LookupDeps): (name: string) => Promise<LookupOutcome> {
  const service = createCachedService<string, LookupResult>({
    store: deps.store,
    now: deps.now,
    call: deps.lookup,
    key: (name) => (isCheckableName(name) ? cacheKey(name) : null),
  })
  return (rawName) => service(rawName.trim())
}

export interface SalaryDeps {
  store: KeyValueStore
  salaryCheck: (amount: number) => Promise<ApiResult<SalaryFloors>>
  now?: () => number
}

export function createSalaryService(deps: SalaryDeps): (amount: number) => Promise<SalaryOutcome> {
  return createCachedService<number, SalaryFloors>({
    store: deps.store,
    now: deps.now,
    call: deps.salaryCheck,
    key: (amount) => (Number.isFinite(amount) && amount > 0 ? `salary:${amount}` : null),
  })
}
