// The lookup logic the background worker runs, kept free of chrome.* so it can be unit tested.

import type { ApiResult } from '../api/client'
import type { LookupResult } from '../api/types'
import type { LookupOutcome } from '../shared/messages'
import { cacheKey, isCheckableName } from '../shared/names'

/** The subset of chrome.storage.session this needs; swapped for a Map in tests. */
export interface KeyValueStore {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
}

export interface LookupDeps {
  store: KeyValueStore
  lookup: (name: string) => Promise<ApiResult<LookupResult>>
  now?: () => number
}

const PAUSE_KEY = 'paused_until' // epoch ms; set from Retry-After after a 429

export function createLookupService(deps: LookupDeps): (name: string) => Promise<LookupOutcome> {
  const now = deps.now ?? Date.now
  // Two callers asking for the same name at once share one request.
  const inFlight = new Map<string, Promise<LookupOutcome>>()

  async function run(name: string, key: string): Promise<LookupOutcome> {
    const cached = await deps.store.get(key)
    if (cached) return { kind: 'ok', result: cached as LookupResult }

    // After a 429 every call waits out Retry-After, not just the one that was refused.
    const pausedUntil = await deps.store.get(PAUSE_KEY)
    if (typeof pausedUntil === 'number' && now() < pausedUntil) {
      const retryAfterSeconds = Math.ceil((pausedUntil - now()) / 1000)
      return { kind: 'unavailable', reason: 'rate_limited', retryAfterSeconds }
    }

    const result = await deps.lookup(name)
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

  return async (rawName) => {
    const name = rawName.trim()
    if (!isCheckableName(name)) return { kind: 'skipped' }
    const key = cacheKey(name)
    const pending = inFlight.get(key)
    if (pending) return pending
    const promise = run(name, key).finally(() => inFlight.delete(key))
    inFlight.set(key, promise)
    return promise
  }
}
