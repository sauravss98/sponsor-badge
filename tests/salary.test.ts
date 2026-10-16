import { describe, expect, it } from 'vitest'

import { annualise, parseSalary } from '../src/shared/salary'

// The API's current basis (hours_per_week_basis, weeks_per_year_basis); tests pass it in, the
// extension never hardcodes it.
const BASIS = { hoursPerWeek: 37.5, weeksPerYear: 52 }

describe('parseSalary', () => {
  it.each([
    // Formats seen on Indeed UK (saved pages, 2026-10-16)
    ['£40,000 - £45,000 a year', 40000, 45000, 'year'],
    ['£60,100 - £100,000 a year', 60100, 100000, 'year'],
    ['From £85,000 a year', 85000, null, 'year'],
    ['£58,500 a year', 58500, null, 'year'],
    // Formats seen on LinkedIn
    ['£66,000.00/yr - £90,000.00/yr', 66000, 90000, 'year'],
    ['£40K/yr - £45K/yr', 40000, 45000, 'year'],
    // Common ad wordings
    ['£45,000 - £55,000 per annum', 45000, 55000, 'year'],
    ['£35k', 35000, null, 'year'], // no period, but clearly yearly
    ['£32.5k-£38k pa', 32500, 38000, 'year'],
    ['GBP 50,000 to 60,000', 50000, null, 'year'], // only the first figure has a currency
    ['£2,800 per month', 2800, null, 'month'],
    ['£650 a week', 650, null, 'week'],
    ['£20.50 per hour', 20.5, null, 'hour'],
    ['£18 - £22 an hour', 18, 22, 'hour'],
    ['£25/hr', 25, null, 'hour'],
    ['£450 - £550 a day', 450, 550, 'day'],
    ['£45000 Annually', 45000, null, 'year'],
  ])('%s', (text, low, high, period) => {
    expect(parseSalary(text)).toEqual({ low, high, period })
  })

  it('keeps only the maximum for "up to"', () => {
    expect(parseSalary('Up to £58,000 a year')).toEqual({ low: null, high: 58000, period: 'year' })
  })

  it.each([
    ['', 'nothing'],
    ['Competitive', 'no figure'],
    ['40 hours a week', 'no currency'],
    ['€50,000 a year', 'not pounds'],
    ['£50 - £54', 'small figure with no period: hourly? daily?'],
  ])('rejects %j (%s)', (text) => {
    expect(parseSalary(text)).toBeNull()
  })
})

describe('annualise', () => {
  it('uses the lower figure of a yearly range as is', () => {
    expect(annualise(parseSalary('£40,000 - £45,000 a year')!, BASIS))
      .toEqual({ comparable: true, yearly: 40000, estimate: false })
  })

  it('multiplies monthly and weekly pay', () => {
    expect(annualise(parseSalary('£3,000 per month')!, BASIS)).toMatchObject({ yearly: 36000, estimate: false })
    expect(annualise(parseSalary('£650 a week')!, BASIS)).toMatchObject({ yearly: 33800, estimate: false })
  })

  it('marks an hourly conversion as an estimate', () => {
    expect(annualise(parseSalary('£20 an hour')!, BASIS))
      .toEqual({ comparable: true, yearly: 39000, estimate: true })
  })

  it.each(['£450 a day', 'Up to £58,000 a year'])('refuses to guess for %j', (text) => {
    expect(annualise(parseSalary(text)!, BASIS).comparable).toBe(false)
  })
})
