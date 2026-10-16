// What the panel says about an advertised salary. Pure, so every case is unit tested.
//
// Thresholds, their date and the hours/weeks basis all come from /v1/salary-check. The extension
// only compares the ad's lower figure with them (">=", as the API does).

import type { SalaryOutcome } from './messages'
import { annualise, formatPounds, type ParsedSalary } from './salary'

export interface SalaryView {
  rows: [string, string][]
  notes: string[]
}

/** Whether the API is needed at all: daily rates and "up to" amounts can't be compared. */
export function needsCheck(salary: ParsedSalary): boolean {
  return salary.low !== null && salary.period !== 'day'
}

/** The amount to send. Weekly and hourly figures go as they are: the panel converts them with
 *  the basis the API returns, and compares locally. */
export function requestAmount(salary: ParsedSalary): number | null {
  if (!needsCheck(salary)) return null
  return salary.period === 'month' ? salary.low! * 12 : salary.low!
}

export function salaryView(advertised: string, salary: ParsedSalary, outcome?: SalaryOutcome): SalaryView {
  const rows: [string, string][] = [['Advertised', advertised]]

  if (!needsCheck(salary)) {
    // No basis is used for these cases, so none is passed.
    const result = annualise(salary, { hoursPerWeek: Number.NaN, weeksPerYear: Number.NaN })
    if (!result.comparable) rows.push(['Salary check', result.reason])
    return { rows, notes: [] }
  }
  if (!outcome) {
    rows.push(['Salary check', 'Checking...'])
    return { rows, notes: [] }
  }
  if (outcome.kind !== 'ok') {
    rows.push(['Salary check', "Couldn't check the salary right now."])
    return { rows, notes: [] }
  }

  const floors = outcome.result
  const basis = { hoursPerWeek: floors.hours_per_week_basis, weeksPerYear: floors.weeks_per_year_basis }
  const yearly = annualise(salary, basis)
  if (!yearly.comparable) {
    rows.push(['Salary check', yearly.reason])
    return { rows, notes: floors.notes }
  }

  let checked = `${formatPounds(yearly.yearly)} a year`
  if (yearly.estimate) {
    checked += ` (estimate: assumes a ${basis.hoursPerWeek}-hour week, ${basis.weeksPerYear} weeks a year)`
  }
  if (salary.high !== null) checked += ', the lower figure'
  const verdict = (threshold: number) => (yearly.yearly >= threshold ? 'Clears it' : 'Below it')

  rows.push(
    ['Checked', checked],
    [`General threshold, ${formatPounds(floors.general_threshold)}`, verdict(floors.general_threshold)],
    [`New entrant floor, ${formatPounds(floors.new_entrant_threshold)}`,
      verdict(floors.new_entrant_threshold)],
    ['Thresholds published', floors.thresholds.effective_date],
  )
  return { rows, notes: floors.notes }
}
