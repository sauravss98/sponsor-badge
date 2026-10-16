import { readFileSync } from 'node:fs'

import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'

import { companyFromTitle, extractIndeed, extractLinkedIn, extractorFor } from '../src/content/extract'

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

})

// Logged-in LinkedIn, rebuilt from the structure measured on a real /jobs/search-results page on
// 2026-10-16 (link targets, images, aria-labels; the scrambled class names are made up).
function loggedIn(title: string, company = 'Teton'): Document {
  const doc = html(`<main>
    <ul class="iiik16"><li class="iiimdi">Software Engineer, Some Other Ltd</li></ul>
    <div class="iiil4g">
      <a class="iiimuy" href="/company/teton-ai/life/"><img alt="${company}"> ${company}</a>
      <a class="iiigaj" href="/company/teton-ai/life/">${company}</a>
      <h1>Software Engineer (Backend) - London</h1>
      <a class="iiimuy" href="/company/teton-ai/life/"><img alt="">${company}12,038 followers</a>
      <a class="iiimdi" href="/company/teton-ai/life/" aria-label="Show more about the company">Show more</a>
    </div></main>`)
  doc.title = title
  return doc
}

describe('LinkedIn, logged in (scrambled class names)', () => {
  it('takes the plain company link that matches the page title', () => {
    const doc = loggedIn('(2) Software Engineer (Backend) - London | Teton | LinkedIn')
    const employer = extractLinkedIn(doc)
    expect(employer?.name).toBe('Teton')
    expect(employer?.anchor.querySelector('img')).toBeNull() // not the logo link
  })

  it('shows no badge when the title names a different company (e.g. mid-navigation)', () => {
    expect(extractLinkedIn(loggedIn('Data Engineer | Deliveroo | LinkedIn'))).toBeNull()
  })

  it('shows no badge when the title names no company, rather than guess a link', () => {
    expect(extractLinkedIn(loggedIn('Jobs | LinkedIn'))).toBeNull()
  })

  it('ignores company links outside the main content', () => {
    const doc = html('<nav><a href="/company/acme/">Acme</a></nav><main></main>')
    doc.title = 'Engineer | Acme | LinkedIn'
    expect(extractLinkedIn(doc)).toBeNull()
  })
})

describe('companyFromTitle', () => {
  it.each([
    ['Software Engineer (Backend) - London | Teton | LinkedIn', 'Teton'],
    ['(3) Engineer | Analyst | Roofoods Ltd | LinkedIn', 'Roofoods Ltd'],
    ['Jobs | LinkedIn', null],
    ['Teton | Glassdoor', null],
  ])('%s -> %s', (title, expected) => {
    expect(companyFromTitle(title)).toBe(expected)
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
