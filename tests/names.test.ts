import { describe, expect, it } from 'vitest'

import { cacheKey, isCheckableName } from '../src/shared/names'

describe('isCheckableName', () => {
  it.each(['Starling Bank', 'Private Healthcare Ltd', 'The Hidden Gem Cafe', 'Hays'])(
    'checks a real name: %s',
    (name) => {
      expect(isCheckableName(name)).toBe(true)
    },
  )

  it.each(['', '   ', 'Confidential', 'CONFIDENTIAL.', 'Company name hidden', 'Undisclosed', 'N/A',
    '---', 'x'.repeat(201)])('skips %j', (name) => {
    expect(isCheckableName(name)).toBe(false)
  })
})

describe('cacheKey', () => {
  it('shares one entry across case, spacing and punctuation', () => {
    expect(cacheKey('Starling  Bank')).toBe(cacheKey(' starling bank. '))
  })

  it('keeps different names apart', () => {
    expect(cacheKey('Amazon')).not.toBe(cacheKey('The Amazon'))
  })
})
