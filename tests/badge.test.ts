import { describe, expect, it } from 'vitest'

import { badgeFor, panelFor } from '../src/shared/badge'
import { amazonPossible, notFound, starling, withStatus } from './fixtures'

const ok = (result: typeof starling) => ({ kind: 'ok' as const, result })

describe('badgeFor', () => {
  it('is green only for an A-rated licensed sponsor', () => {
    expect(badgeFor(ok(starling))).toEqual({
      tone: 'green',
      label: 'Licensed sponsor (A-rated): Skilled Worker',
      legalName: 'STARLING BANK LIMITED',
    })
  })

  it.each([
    ['B', 'Licensed sponsor (B-rated): ask the employer'],
    ['Provisional', 'Provisional licence: check with the employer'],
    ['Unknown', 'Licensed sponsor: rating unclear'],
  ])('is amber for a licensed sponsor rated %s', (rating, label) => {
    expect(badgeFor(ok(withStatus('licensed', rating)))).toMatchObject({ tone: 'amber', label })
  })

  it('never shows a fuzzy match as confirmed, and names the match', () => {
    expect(badgeFor(ok(amazonPossible))).toEqual({
      tone: 'amber',
      label: 'Possible match: check',
      legalName: 'Maxico Uk limited t/a The Amazon',
    })
  })

  it('is grey when licensed only on other routes', () => {
    expect(badgeFor(ok(withStatus('licensed_other_routes', null)))).toMatchObject({
      tone: 'grey',
      label: 'Licensed, but not for Skilled Worker',
    })
  })

  it('is grey when not found, with no legal name', () => {
    expect(badgeFor(ok(notFound))).toEqual({ tone: 'grey', label: 'Not found on register' })
  })

  it.each([
    ['an unknown status', withStatus('suspended')],
    ['an unknown rating', withStatus('licensed', 'A+')],
    ['a licensed result with no rating', withStatus('licensed', null)],
  ])('is neutral for %s, never a guess', (_case, result) => {
    expect(badgeFor(ok(result))).toEqual({ tone: 'neutral', label: "Couldn't check" })
  })

  it.each(['network', 'timeout', 'server', 'bad_response', 'invalid'] as const)(
    'shows a %s failure as "Couldn\'t check", never as not found',
    (reason) => {
      expect(badgeFor({ kind: 'unavailable', reason })).toEqual({
        tone: 'neutral',
        label: "Couldn't check",
      })
    },
  )

  it('shows rate limiting as a temporary state', () => {
    expect(badgeFor({ kind: 'unavailable', reason: 'rate_limited', retryAfterSeconds: 30 }))
      .toEqual({ tone: 'neutral', label: "Couldn't check right now" })
  })

  it('says when there was no name to check', () => {
    expect(badgeFor({ kind: 'skipped' }).tone).toBe('neutral')
  })
})

describe('panelFor', () => {
  it('carries everything the panel must show', () => {
    expect(panelFor(starling)).toEqual({
      legalName: 'STARLING BANK LIMITED',
      town: 'London',
      rating: 'A',
      routes: ['Skilled Worker (A)'],
      registerDate: '2026-09-29',
      registerUrl:
        'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers',
      confidence: 100,
      notes: starling.notes,
    })
  })

  it('lists each route once when the register repeats a licence', () => {
    const sw = { route: 'Skilled Worker', rating: 'A', type: 'Worker (A rating)' }
    expect(panelFor({ ...starling, routes: [sw, sw] }).routes).toEqual(['Skilled Worker (A)'])
  })

  it('falls back to the publication page when an older server sends no register_url', () => {
    const { register_url: _omitted, ...older } = starling
    expect(panelFor(older).registerUrl).toBe(
      'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers',
    )
  })
})
