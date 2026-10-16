import { describe, expect, it } from 'vitest'

import { parseSalary } from '../src/shared/salary'
import { requestAmount, salaryView } from '../src/shared/salaryView'
import { floors } from './fixtures'

const ok = { kind: 'ok' as const, result: floors }

function view(text: string, outcome?: Parameters<typeof salaryView>[2]) {
  return salaryView(text, parseSalary(text)!, outcome)
}

describe('requestAmount', () => {
  it.each([
    ['£40,000 - £45,000 a year', 40000], // the lower figure
    ['£3,000 per month', 36000],
    ['£650 a week', 650], // sent as is; converted with the basis the API returns
    ['£20 an hour', 20],
    ['£450 a day', null], // never sent: can't be compared
    ['Up to £58,000 a year', null],
  ])('%s -> %s', (text, amount) => {
    expect(requestAmount(parseSalary(text)!)).toBe(amount)
  })
})

describe('salaryView', () => {
  it('compares the lower figure of a range with both floors', () => {
    expect(view('£40,000 - £45,000 a year', ok)).toEqual({
      rows: [
        ['Advertised', '£40,000 - £45,000 a year'],
        ['Checked', '£40,000 a year, the lower figure'],
        ['General threshold, £41,700', 'Below it'],
        ['New entrant floor, £33,400', 'Clears it'],
        ['Thresholds published', '2025-11-11'],
      ],
      notes: floors.notes,
    })
  })

  it('counts exactly the threshold as clearing it', () => {
    expect(view('£41,700 a year', ok).rows).toContainEqual(['General threshold, £41,700', 'Clears it'])
  })

  it('labels an hourly conversion as an estimate, with the basis from the API', () => {
    expect(view('£22 an hour', ok).rows).toContainEqual(
      ['Checked', '£42,900 a year (estimate: assumes a 37.5-hour week, 52 weeks a year)'])
  })

  it.each([
    ['£450 a day', "A daily rate can't be compared: the ad doesn't say how many days a week."],
    ['Up to £58,000 a year', 'Only a maximum is given, so there is no lower figure to check.'],
  ])('explains why %j is not compared', (text, reason) => {
    expect(view(text).rows).toEqual([['Advertised', text], ['Salary check', reason]])
  })

  it('shows checking, then a failure, without ever guessing', () => {
    expect(view('£45,000 a year').rows).toContainEqual(['Salary check', 'Checking...'])
    expect(view('£45,000 a year', { kind: 'unavailable', reason: 'timeout' }).rows)
      .toContainEqual(['Salary check', "Couldn't check the salary right now."])
  })
})
