// Rules for the employer name before it is sent to the API.

export const MAX_NAME_LENGTH = 200 // the API rejects longer names with 422

// Job boards show these instead of an employer. Sending them would fuzzy-match a real company
// ("Confidential" matches ENTIA LTD at 90), so they are never looked up.
const PLACEHOLDERS = new Set([
  'anonymous',
  'company confidential',
  'company name confidential',
  'company name hidden',
  'confidential',
  'confidential company',
  'confidential employer',
  'hidden',
  'n a',
  'not disclosed',
  'private',
  'undisclosed',
  'undisclosed company',
  'unknown',
  'withheld',
])

/** Lowercased, punctuation to spaces, whitespace collapsed. Only for local comparisons. */
export function normaliseName(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

/** Whether a name is worth sending: present, not a placeholder, and within the API's limit. */
export function isCheckableName(name: string): boolean {
  const trimmed = name.trim()
  return (
    trimmed.length > 0 &&
    trimmed.length <= MAX_NAME_LENGTH &&
    normaliseName(trimmed) !== '' &&
    !PLACEHOLDERS.has(normaliseName(trimmed))
  )
}

/** Cache key, so "Starling Bank" and "starling  bank" share one cached answer. */
export function cacheKey(name: string): string {
  return `lookup:${normaliseName(name)}`
}
