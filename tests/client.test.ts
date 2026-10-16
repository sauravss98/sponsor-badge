import { describe, expect, it, vi } from 'vitest'

import { isLookupResult, lookup, retryAfter } from '../src/api/client'
import { starling } from './fixtures'

const BASE = 'http://api.test'

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers })
}

function fetchReturning(...responses: (Response | Error)[]) {
  const fn = vi.fn<typeof fetch>()
  for (const r of responses) {
    if (r instanceof Error) fn.mockRejectedValueOnce(r)
    else fn.mockResolvedValueOnce(r)
  }
  return fn
}

describe('lookup', () => {
  it('returns the result and sends only the encoded name, with no headers', async () => {
    const fetch = fetchReturning(json(starling))
    const result = await lookup('Starling Bank & Co', { base: BASE, fetch })
    expect(result).toEqual({ kind: 'ok', data: starling })
    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe(`${BASE}/v1/lookup?name=Starling%20Bank%20%26%20Co`)
    expect(init).toEqual({ signal: expect.any(AbortSignal) }) // simple request: no preflight
  })

  it('reports a 429 with its Retry-After and does not retry it', async () => {
    const fetch = fetchReturning(json({ error: 'Rate limit exceeded' }, 429, { 'Retry-After': '42' }))
    expect(await lookup('x', { base: BASE, fetch })).toEqual({
      kind: 'rate_limited',
      retryAfterSeconds: 42,
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not retry a 422', async () => {
    const fetch = fetchReturning(json({ detail: [] }, 422))
    expect(await lookup('x', { base: BASE, fetch })).toEqual({ kind: 'invalid' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('retries a 5xx once, then reports it', async () => {
    const fetch = fetchReturning(json({}, 503), json({}, 502))
    expect(await lookup('x', { base: BASE, fetch })).toEqual({ kind: 'server' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('recovers when the retry succeeds', async () => {
    const fetch = fetchReturning(new TypeError('Failed to fetch'), json(starling))
    expect(await lookup('x', { base: BASE, fetch })).toEqual({ kind: 'ok', data: starling })
  })

  it('reports a network failure after one retry', async () => {
    const fetch = fetchReturning(new TypeError('Failed to fetch'), new TypeError('Failed to fetch'))
    expect(await lookup('x', { base: BASE, fetch })).toEqual({ kind: 'network' })
  })

  it('times out without retrying', async () => {
    const hanging = vi.fn<typeof fetch>((_url, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }))
    expect(await lookup('x', { base: BASE, fetch: hanging, timeoutMs: 10 })).toEqual({
      kind: 'timeout',
    })
    expect(hanging).toHaveBeenCalledTimes(1)
  })

  it('rejects a 200 that is not the promised shape', async () => {
    const fetch = fetchReturning(new Response('<html>sleeping</html>', { status: 200 }))
    expect(await lookup('x', { base: BASE, fetch })).toEqual({ kind: 'bad_response' })
    const fetch2 = fetchReturning(json({ status: 'licensed' }))
    expect(await lookup('x', { base: BASE, fetch: fetch2 })).toEqual({ kind: 'bad_response' })
  })

  it('ignores fields it does not know about', async () => {
    const fetch = fetchReturning(json({ ...starling, added_in_v1_5: true }))
    expect((await lookup('x', { base: BASE, fetch })).kind).toBe('ok')
  })
})

describe('retryAfter', () => {
  it.each([
    ['60', 60],
    ['0', 0],
    ['1.2', 2],
    [null, 60],
    ['soon', 60],
  ])('%s -> %i seconds', (header, expected) => {
    expect(retryAfter(header)).toBe(expected)
  })

  it('reads the HTTP-date form', () => {
    const now = Date.parse('2026-10-16T12:00:00Z')
    expect(retryAfter('Fri, 16 Oct 2026 12:00:30 GMT', now)).toBe(30)
  })
})

describe('isLookupResult', () => {
  it('accepts a not_found result with nulls', () => {
    expect(isLookupResult({ ...starling, status: 'not_found', legal_name: null })).toBe(true)
  })

  it.each([null, 'x', [], { ...starling, notes: 'caveat' }, { ...starling, confidence: '100' }])(
    'rejects %j',
    (value) => {
      expect(isLookupResult(value)).toBe(false)
    },
  )
})
