// @vitest-environment jsdom
import { readFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

import { extractIndeed, extractLinkedIn } from '../src/content/extract'
import { createInjector, HOST_ATTRIBUTE } from '../src/content/inject'
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

  it('opens the details panel on click, with the attribution', async () => {
    const { doc, injector } = setup('indeed-3.html', extractIndeed)
    injector.scan()
    await flush()
    const root = hosts(doc)[0]!.shadowRoot!
    const panel = root.querySelector<HTMLElement>('.panel')!
    expect(panel.hidden).toBe(true)
    root.querySelector<HTMLElement>('.badge')!.click()
    expect(panel.hidden).toBe(false)
    expect(panel.textContent).toContain('STARLING BANK LIMITED')
    expect(panel.textContent).toContain('Open Government Licence v3.0')
    expect(panel.textContent).toContain('This is not immigration advice.')
  })
})
