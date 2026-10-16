// Reads the salary text on a job ad ("£45,000 - £55,000 a year", "£40k", "£20.50 per hour") and
// turns it into a yearly figure to compare with the Skilled Worker thresholds. Pure, so every
// format is unit tested. No threshold or basis is hardcoded here: they come from the API.

export type Period = 'year' | 'month' | 'week' | 'day' | 'hour'

export interface ParsedSalary {
  low: number | null // null for "up to £X": only a maximum is given
  high: number | null
  period: Period
}

// Longest phrases first, so "per annum" wins over "a".
const PERIODS: [RegExp, Period][] = [
  [/\b(?:per\s+annum|p\.?\s?a\.?|annum|annual(?:ly)?|(?:a|per)\s+year|\/\s?(?:yr|year)|yearly)\b/i, 'year'],
  [/\b(?:(?:a|per)\s+month|\/\s?(?:mo|month)|monthly|pcm)\b/i, 'month'],
  [/\b(?:(?:a|per)\s+week|\/\s?(?:wk|week)|weekly)\b/i, 'week'],
  [/\b(?:(?:a|per)\s+day|\/\s?day|daily)\b/i, 'day'],
  [/\b(?:(?:an|per)\s+hour|\/\s?(?:hr|hour)|hourly|p\/?h)\b/i, 'hour'],
]

// "£45,000", "£45000.00", "£40k", "£40.5K", "GBP 40,000"
const AMOUNT = /(?:£|\bGBP\s?)\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s?([kK])?\b/g

// Below this, a figure with no period is too ambiguous to call yearly ("£50 - £54").
const MIN_UNLABELLED_YEARLY = 10_000

export function parseSalary(text: string): ParsedSalary | null {
  const amounts = [...text.matchAll(AMOUNT)].map((m) => {
    const whole = Number(m[1]!.replace(/,/g, ''))
    const value = m[2] ? Number(`${whole}.${m[2]}`) : whole
    return m[3] ? value * 1000 : value
  })
  if (amounts.length === 0 || amounts.some((n) => !Number.isFinite(n) || n <= 0)) return null

  let period = PERIODS.find(([pattern]) => pattern.test(text))?.[1]
  if (!period) {
    if (amounts[0]! < MIN_UNLABELLED_YEARLY) return null
    period = 'year'
  }

  const [first, second] = amounts as [number, number | undefined]
  if (/\bup\s+to\b/i.test(text) && second === undefined) return { low: null, high: first, period }
  const high = second !== undefined && second >= first ? second : null
  return { low: first, high, period }
}

export interface Basis {
  hoursPerWeek: number // from /v1/salary-check: hours_per_week_basis
  weeksPerYear: number // from /v1/salary-check: weeks_per_year_basis
}

export type Annual =
  | { comparable: true; yearly: number; estimate: boolean }
  | { comparable: false; reason: string }

/** The lower figure as a yearly amount, or why it can't be compared fairly. */
export function annualise(salary: ParsedSalary, basis: Basis): Annual {
  if (salary.low === null) {
    return { comparable: false, reason: 'Only a maximum is given, so there is no lower figure to check.' }
  }
  switch (salary.period) {
    case 'year':
      return { comparable: true, yearly: salary.low, estimate: false }
    case 'month':
      return { comparable: true, yearly: salary.low * 12, estimate: false }
    case 'week':
      return { comparable: true, yearly: salary.low * basis.weeksPerYear, estimate: false }
    case 'hour':
      // The ad rarely states the hours, so this assumes a full-time week: an estimate.
      return {
        comparable: true,
        yearly: Math.round(salary.low * basis.hoursPerWeek * basis.weeksPerYear),
        estimate: true,
      }
    case 'day':
      return { comparable: false, reason: 'A daily rate can\'t be compared: the ad doesn\'t say how many days a week.' }
  }
}

export function formatPounds(amount: number): string {
  return `£${amount.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`
}
