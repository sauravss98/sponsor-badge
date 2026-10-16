// @vitest-environment jsdom
import { readFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

import { extractIndeed, extractLinkedIn } from '../src/content/extract'
import { createInjector, HOST_ATTRIBUTE, PANEL_ATTRIBUTE, pageTheme } from '../src/content/inject'
import type { LookupOutcome } from '../src/shared/messages'
import { amazonPossible, starling } from './fixtures'

function load(file: string): Document {
  document.documentElement.innerHTML = new DOMParser()
    .parseFromString(readFileSync(`fixtures/${file}`, 'utf8'), 'text/html')
    .documentElement.innerHTML
  return document
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function hosts(doc: Document): HTMLElement[] {
  return [...doc.querySelectorAll<HTMLElement>(`[${HOST_ATTRIBUTE}]`)]
}

function panels(doc: Document): HTMLElement[] {
  return [...doc.querySelectorAll<HTMLElement>(`[${PANEL_ATTRIBUTE}]`)]
}

function badgeText(host: HTMLElement): string {
  return host.shadowRoot!.querySelector('.badge')!.textContent!
}

function setup(file: string, extract = extractLinkedIn, outcome: LookupOutcome = { kind: 'ok', result: starling }) {
  const doc = load(file)
  const lookup = vi.fn<(name: string) => Promise<LookupOutcome>>().mockResolvedValue(outcome)
  return { doc, lookup, injector: createInjector({ doc, extract, lookup }) }
}

describe('injector', () => {
  it('puts one badge right after the employer name and looks the name up', async () => {
    const { doc, lookup, injector } = setup('linkedin-3.html')
    injector.scan()
    expect(lookup).toHaveBeenCalledWith('Deliveroo')
    const [host] = hosts(doc)
    expect(host!.previousElementSibling).toBe(doc.querySelector('a.topcard__org-name-link'))
    expect(badgeText(host!)).toBe('Checking sponsor licence...')
    await flush()
    expect(badgeText(host!)).toBe('Licensed sponsor (A-rated): Skilled Worker')
  })

  it('does nothing on a rescan of the same job (no duplicates, no extra lookups)', async () => {
    const { doc, lookup, injector } = setup('linkedin-1.html')
    injector.scan()
    await flush()
    injector.scan()
    injector.scan()
    expect(hosts(doc)).toHaveLength(1)
    expect(lookup).toHaveBeenCalledTimes(1)
  })

  it('follows the page to another job without a reload', async () => {
    const { doc, lookup, injector } = setup('linkedin-1.html')
    injector.scan()
    doc.querySelector('a.topcard__org-name-link')!.textContent = 'Amazon'
    injector.scan()
    expect(lookup).toHaveBeenLastCalledWith('Amazon')
    expect(hosts(doc)).toHaveLength(1)
  })

  it('puts the same badge back if the page re-renders over it, without a new lookup', () => {
    const { doc, lookup, injector } = setup('linkedin-2.html')
    injector.scan()
    const [host] = hosts(doc)
    host!.remove()
    injector.scan()
    expect(hosts(doc)).toEqual([host])
    expect(lookup).toHaveBeenCalledTimes(1)
  })

  it('keeps the badge while the same job is open, even if the extractor stops confirming it', () => {
    const doc = load('linkedin-2.html')
    const lookup = vi.fn<(name: string) => Promise<LookupOutcome>>()
      .mockResolvedValue({ kind: 'ok', result: starling })
    let confirm = true
    const injector = createInjector({ doc, lookup, extract: (d) => (confirm ? extractLinkedIn(d) : null) })
    injector.scan()
    confirm = false // e.g. LinkedIn retitled the tab
    injector.scan()
    expect(hosts(doc)).toHaveLength(1)
  })

  it('removes the badge when no job is open', () => {
    const { doc, injector } = setup('linkedin-2.html')
    injector.scan()
    doc.querySelector('a.topcard__org-name-link')!.remove()
    injector.scan()
    expect(hosts(doc)).toHaveLength(0)
  })

  it('ignores an answer that arrives after the user moved on', async () => {
    const { doc, lookup, injector } = setup('linkedin-1.html')
    let answerFirst!: (o: LookupOutcome) => void
    lookup.mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)))
    lookup.mockResolvedValueOnce({ kind: 'ok', result: amazonPossible })
    injector.scan()
    doc.querySelector('a.topcard__org-name-link')!.textContent = 'Amazon'
    injector.scan()
    await flush()
    answerFirst({ kind: 'ok', result: starling })
    await flush()
    expect(badgeText(hosts(doc)[0]!)).toBe('Possible match: check')
  })

  it('shows a failed lookup as "Couldn\'t check"', async () => {
    const { doc, injector } = setup('indeed-1.html', extractIndeed, { kind: 'unavailable', reason: 'timeout' })
    injector.scan()
    await flush()
    expect(badgeText(hosts(doc)[0]!)).toBe("Couldn't check")
  })

  it('opens the details panel on click, attached to the page body so no container clips it', async () => {
    const { doc, injector } = setup('indeed-3.html', extractIndeed)
    injector.scan()
    await flush()
    const badge = hosts(doc)[0]!.shadowRoot!.querySelector<HTMLElement>('.badge')!
    expect(panels(doc)).toHaveLength(0)
    badge.click()
    const [panelHost] = panels(doc)
    expect(panelHost!.parentElement).toBe(doc.body)
    expect(badge.getAttribute('aria-expanded')).toBe('true')
    const text = panelHost!.shadowRoot!.textContent!
    expect(text).toContain('STARLING BANK LIMITED')
    expect(text).toContain('Open Government Licence v3.0')
    expect(text).toContain('This is not immigration advice.')
  })

  it.each([
    ['a second click on the badge', (badge: HTMLElement) => badge.click()],
    ['Escape', () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))],
    ['a click elsewhere', () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }))],
  ])('closes the panel on %s', async (_case, close) => {
    const { doc, injector } = setup('indeed-1.html', extractIndeed)
    injector.scan()
    await flush()
    const badge = hosts(doc)[0]!.shadowRoot!.querySelector<HTMLElement>('.badge')!
    badge.click()
    close(badge)
    expect(panels(doc)).toHaveLength(0)
    expect(badge.getAttribute('aria-expanded')).toBe('false')
  })

  it('keeps the panel open and under the badge when the page scrolls', async () => {
    const { doc, injector } = setup('indeed-1.html', extractIndeed)
    injector.scan()
    await flush()
    hosts(doc)[0]!.shadowRoot!.querySelector<HTMLElement>('.badge')!.click()
    doc.body.dispatchEvent(new Event('scroll')) // e.g. Indeed's job pane scrolling
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(panels(doc)).toHaveLength(1)
  })

  it('closes the panel when the user moves to another job', async () => {
    const { doc, injector } = setup('linkedin-1.html')
    injector.scan()
    await flush()
    hosts(doc)[0]!.shadowRoot!.querySelector<HTMLElement>('.badge')!.click()
    doc.querySelector('a.topcard__org-name-link')!.textContent = 'Amazon'
    injector.scan()
    expect(panels(doc)).toHaveLength(0)
  })

})

describe('pageTheme', () => {
  function inside(background: string): Element {
    document.body.innerHTML = `<div style="background-color: ${background}"><p><a>Acme</a></p></div>`
    return document.querySelector('a')!
  }

  it.each([
    ['rgb(255, 255, 255)', 'light'],
    ['rgb(29, 34, 38)', 'dark'], // LinkedIn's dark mode
    ['rgba(0, 0, 0, 0)', 'light'], // transparent all the way up: assume light
  ])('%s -> %s', (background, theme) => {
    expect(pageTheme(inside(background))).toBe(theme)
  })
})
