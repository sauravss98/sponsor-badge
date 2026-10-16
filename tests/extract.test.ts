import { readFileSync } from 'node:fs'

import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'

import { extractIndeed, extractLinkedIn, extractorFor } from '../src/content/extract'

// Real pages saved logged out (see scripts/clean-fixture.mjs), with the employer each one shows.
function page(file: string): Document {
  return new JSDOM(readFileSync(`fixtures/${file}`, 'utf8')).window.document
}

function html(body: string): Document {
  return new JSDOM(`<!doctype html><body>${body}</body>`).window.document
}

describe('LinkedIn', () => {
  it.each([
    ['linkedin-1.html', 'SII Group UK'],
    ['linkedin-2.html', 'Teton'],
    ['linkedin-3.html', 'Deliveroo'],
  ])('%s -> %s', (file, name) => {
    const employer = extractLinkedIn(page(file))
    expect(employer?.name).toBe(name)
    expect(employer?.anchor.tagName).toBe('A')
  })

  it('ignores the employers in "Similar jobs" when there is no top card', () => {
    const doc = page('linkedin-1.html')
    doc.querySelector('a.topcard__org-name-link')!.remove()
    expect(extractLinkedIn(doc)).toBeNull()
  })

  it('reads the logged-in markup we expect (no saved page yet)', () => {
    const doc = html(`<div class="job-details-jobs-unified-top-card__company-name">
      <a href="/company/starling-bank/">  Starling   Bank </a></div>`)
    expect(extractLinkedIn(doc)?.name).toBe('Starling Bank')
  })
})

describe('Indeed', () => {
  it.each([
    ['indeed-1.html', 'Envea'],
    ['indeed-3.html', 'JPMorganChase'],
  ])('%s -> %s (the open job, not the list)', (file, name) => {
    const employer = extractIndeed(page(file))
    expect(employer?.name).toBe(name)
    expect(employer?.anchor.tagName).toBe('A')
  })

  it('finds nothing when no job is open, even though list cards name employers', () => {
    const doc = page('indeed-1.html')
    doc.querySelector('[data-testid="desktop-job-header"]')!.remove()
    expect(extractIndeed(doc)).toBeNull()
  })

  it('does not read a LinkedIn page', () => {
    expect(extractIndeed(page('linkedin-1.html'))).toBeNull()
  })
})

describe('extractorFor', () => {
  it('picks the site extractor by hostname', () => {
    expect(extractorFor('www.linkedin.com')).toBe(extractLinkedIn)
    expect(extractorFor('uk.indeed.com')).toBe(extractIndeed)
    expect(extractorFor('www.indeed.com')).toBeNull() // UK board only
    expect(extractorFor('example.com')).toBeNull()
  })

  it('skips empty and over-long matches', () => {
    const doc = html(`<a class="topcard__org-name-link"> </a>
      <div class="job-details-jobs-unified-top-card__company-name">${'x'.repeat(201)}</div>`)
    expect(extractLinkedIn(doc)).toBeNull()
  })
})
