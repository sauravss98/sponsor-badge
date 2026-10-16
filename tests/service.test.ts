import { describe, expect, it, vi } from 'vitest'

import type { ApiResult } from '../src/api/client'
import type { LookupResult } from '../src/api/types'
import { createLookupService, type KeyValueStore } from '../src/background/service'
import { starling } from './fixtures'

function memoryStore(): KeyValueStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>()
  return {
    data,
    get: async (key) => data.get(key),
    set: async (key, value) => void data.set(key, value),
  }
}

function setup(...results: ApiResult<LookupResult>[]) {
  const store = memoryStore()
  const lookup = vi.fn<(name: string) => Promise<ApiResult<LookupResult>>>()
  for (const r of results) lookup.mockResolvedValueOnce(r)
  let clock = 1_000_000
  const service = createLookupService({ store, lookup, now: () => clock })
  return { service, lookup, store, advance: (ms: number) => (clock += ms) }
}

describe('lookup service', () => {
  it('sends the trimmed name and caches the answer', async () => {
    const { service, lookup } = setup({ kind: 'ok', data: starling })
    expect(await service('  Starling Bank ')).toEqual({ kind: 'ok', result: starling })
    expect(await service('starling bank')).toEqual({ kind: 'ok', result: starling })
    expect(lookup).toHaveBeenCalledTimes(1)
    expect(lookup).toHaveBeenCalledWith('Starling Bank')
  })

  it('never sends a placeholder name', async () => {
    const { service, lookup } = setup()
    expect(await service('Confidential')).toEqual({ kind: 'skipped' })
    expect(lookup).not.toHaveBeenCalled()
  })

  it('does not cache failures', async () => {
    const { service, lookup } = setup({ kind: 'network' }, { kind: 'ok', data: starling })
    expect(await service('Starling Bank')).toEqual({ kind: 'unavailable', reason: 'network' })
    expect(await service('Starling Bank')).toEqual({ kind: 'ok', result: starling })
    expect(lookup).toHaveBeenCalledTimes(2)
  })

  it('pauses every lookup until Retry-After has passed after a 429', async () => {
    const { service, lookup, advance } = setup(
      { kind: 'rate_limited', retryAfterSeconds: 30 },
      { kind: 'ok', data: starling },
    )
    expect(await service('A Ltd')).toEqual({
      kind: 'unavailable', reason: 'rate_limited', retryAfterSeconds: 30,
    })
    advance(10_000)
    expect(await service('B Ltd')).toEqual({
      kind: 'unavailable', reason: 'rate_limited', retryAfterSeconds: 20,
    })
    expect(lookup).toHaveBeenCalledTimes(1) // B was never sent

    advance(20_000)
    expect(await service('B Ltd')).toEqual({ kind: 'ok', result: starling })
  })

  it('still answers from cache while paused', async () => {
    const { service } = setup({ kind: 'ok', data: starling }, { kind: 'rate_limited', retryAfterSeconds: 60 })
    await service('Starling Bank')
    await service('Other Ltd')
    expect(await service('Starling Bank')).toEqual({ kind: 'ok', result: starling })
  })

  it('shares one request between simultaneous lookups of the same name', async () => {
    const { service, lookup } = setup({ kind: 'ok', data: starling })
    const [a, b] = await Promise.all([service('Starling Bank'), service('STARLING BANK')])
    expect(a).toEqual(b)
    expect(lookup).toHaveBeenCalledTimes(1)
  })
})
