// Puts one badge next to the employer on a job page and keeps it right as the page changes.
// Free of chrome.* so it can be tested with jsdom; index.ts wires it to the extension.

import { badgeFor } from '../shared/badge'
import type { LookupOutcome } from '../shared/messages'
import { attribution, badgeElement, details } from '../shared/render'
import { clean, type Extractor } from './extract'
import { CSS } from './styles'

export interface InjectorDeps {
  doc: Document
  extract: Extractor
  lookup: (name: string) => Promise<LookupOutcome>
}

export const HOST_ATTRIBUTE = 'data-sponsor-badge'

interface Placed {
  name: string
  anchor: Element
  host: HTMLElement
}

export function createInjector({ doc, extract, lookup }: InjectorDeps): { scan(): void } {
  let placed: Placed | null = null

  function scan(): void {
    // Still the same job (its name link is in the page with the same text): keep the badge, even
    // if the extractor can't confirm it right now, e.g. because LinkedIn retitled the tab. If the
    // page re-rendered over the badge, put the same one back without a new lookup.
    if (placed && placed.anchor.isConnected && clean(placed.anchor.textContent) === placed.name) {
      if (!placed.host.isConnected) placed.anchor.insertAdjacentElement('afterend', placed.host)
      return
    }

    const found = extract(doc)
    if (!found) {
      // No job open (e.g. LinkedIn between views): drop the badge rather than leave a stale one.
      placed?.host.remove()
      placed = null
      return
    }
    // Same job, badge still in the page: nothing to do. This is also what stops our own
    // insertion, which the page's MutationObserver sees, from looping.
    if (placed && placed.anchor === found.anchor && placed.name === found.name &&
        placed.host.isConnected) {
      return
    }

    placed?.host.remove()
    const host = doc.createElement('span')
    host.setAttribute(HOST_ATTRIBUTE, '')
    const root = host.attachShadow({ mode: 'open' })
    const style = doc.createElement('style')
    style.textContent = CSS
    const badge = badgeElement(doc, { tone: 'neutral', label: 'Checking sponsor licence...' },
      'button')
    root.append(style, badge)
    found.anchor.insertAdjacentElement('afterend', host)
    placed = { name: found.name, anchor: found.anchor, host }

    lookup(found.name)
      .catch((): LookupOutcome => ({ kind: 'unavailable', reason: 'network' }))
      .then((outcome) => {
        // The user may have moved to another job while this was in flight.
        if (placed?.host === host) render(root, outcome)
      })
  }

  function render(root: ShadowRoot, outcome: LookupOutcome): void {
    const badge = badgeElement(doc, badgeFor(outcome), 'button')
    badge.setAttribute('aria-expanded', 'false')
    const panel = doc.createElement('div')
    panel.className = 'panel'
    panel.hidden = true
    panel.append(...details(doc, outcome), attribution(doc))

    badge.addEventListener('click', (event) => {
      // Keep the job board from treating this as a click on its own element.
      event.preventDefault()
      event.stopPropagation()
      panel.hidden = !panel.hidden
      badge.setAttribute('aria-expanded', String(!panel.hidden))
    })
    root.replaceChildren(root.querySelector('style')!, badge, panel)
  }

  return { scan }
}
