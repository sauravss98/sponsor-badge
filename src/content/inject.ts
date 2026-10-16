// Puts one badge next to the employer on a job page and keeps it right as the page changes.
// Free of chrome.* so it can be tested with jsdom; index.ts wires it to the extension.

import { badgeFor } from '../shared/badge'
import type { LookupOutcome } from '../shared/messages'
import { attribution, badgeElement, details } from '../shared/render'
import { clean, type Extractor } from './extract'
import { BADGE_CSS, PANEL_CSS } from './styles'

export interface InjectorDeps {
  doc: Document
  extract: Extractor
  lookup: (name: string) => Promise<LookupOutcome>
}

export const HOST_ATTRIBUTE = 'data-sponsor-badge'
export const PANEL_ATTRIBUTE = 'data-sponsor-badge-panel'

const PANEL_WIDTH = 320
const MARGIN = 8

interface Placed {
  name: string
  anchor: Element
  host: HTMLElement
}

export function createInjector({ doc, extract, lookup }: InjectorDeps): { scan(): void } {
  let placed: Placed | null = null
  let closePanel: (() => void) | null = null

  function scan(): void {
    // Still the same job (its name link is in the page with the same text): keep the badge, even
    // if the extractor can't confirm it right now, e.g. because LinkedIn retitled the tab. If the
    // page re-rendered over the badge, put the same one back without a new lookup.
    if (placed && placed.anchor.isConnected && clean(placed.anchor.textContent) === placed.name) {
      if (!placed.host.isConnected) placed.anchor.insertAdjacentElement('afterend', placed.host)
      return
    }

    const found = extract(doc)
    closePanel?.()
    placed?.host.remove()
    placed = null
    if (!found) return // no job open: no badge, rather than a stale one

    const host = doc.createElement('span')
    host.setAttribute(HOST_ATTRIBUTE, '')
    const root = host.attachShadow({ mode: 'open' })
    const style = doc.createElement('style')
    style.textContent = BADGE_CSS
    const badge = badgeElement(doc, { tone: 'neutral', label: 'Checking sponsor licence...' },
      'button')
    root.append(style, badge)
    found.anchor.insertAdjacentElement('afterend', host)
    host.dataset.theme = pageTheme(found.anchor)
    placed = { name: found.name, anchor: found.anchor, host }

    lookup(found.name)
      .catch((): LookupOutcome => ({ kind: 'unavailable', reason: 'network' }))
      .then((outcome) => {
        // The user may have moved to another job while this was in flight.
        if (placed?.host === host) render(host, root, outcome)
      })
  }

  function render(host: HTMLElement, root: ShadowRoot, outcome: LookupOutcome): void {
    const badge = badgeElement(doc, badgeFor(outcome), 'button')
    badge.setAttribute('aria-expanded', 'false')
    badge.addEventListener('click', (event) => {
      // Keep the job board from treating this as a click on its own element.
      event.preventDefault()
      event.stopPropagation()
      if (closePanel) closePanel()
      else openPanel(host, badge, outcome)
    })
    root.replaceChildren(root.querySelector('style')!, badge)
  }

  function openPanel(host: HTMLElement, badge: HTMLElement, outcome: LookupOutcome): void {
    const panelHost = doc.createElement('div')
    panelHost.setAttribute(PANEL_ATTRIBUTE, '')
    panelHost.dataset.theme = host.dataset.theme ?? 'light'
    const root = panelHost.attachShadow({ mode: 'open' })
    const style = doc.createElement('style')
    style.textContent = PANEL_CSS
    const panel = doc.createElement('div')
    panel.className = 'panel'
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-label', 'Sponsor licence details')
    panel.append(...details(doc, outcome), attribution(doc))
    root.append(style, panel)

    const view = doc.defaultView!
    // Below the badge, kept inside the window horizontally. Re-run whenever anything scrolls:
    // Indeed's job pane scrolls inside its own box, not the window.
    const place = () => {
      if (!badge.isConnected) return close()
      const rect = badge.getBoundingClientRect()
      const left = Math.min(Math.max(MARGIN, rect.left), view.innerWidth - PANEL_WIDTH - MARGIN)
      panelHost.style.left = `${Math.max(MARGIN, left)}px`
      panelHost.style.top = `${rect.bottom + 6}px`
    }
    place()
    doc.body.append(panelHost)
    badge.setAttribute('aria-expanded', 'true')

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    const onPointer = (event: Event) => {
      const path = event.composedPath()
      if (!path.includes(panelHost) && !path.includes(host)) close()
    }
    let frame = 0
    const onMove = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(place)
    }
    doc.addEventListener('keydown', onKey)
    doc.addEventListener('pointerdown', onPointer, true)
    doc.addEventListener('scroll', onMove, { capture: true, passive: true }) // any scroll box
    view.addEventListener('resize', onMove)

    function close(): void {
      cancelAnimationFrame(frame)
      panelHost.remove()
      badge.setAttribute('aria-expanded', 'false')
      doc.removeEventListener('keydown', onKey)
      doc.removeEventListener('pointerdown', onPointer, true)
      doc.removeEventListener('scroll', onMove, { capture: true })
      view.removeEventListener('resize', onMove)
      closePanel = null
    }
    closePanel = close
  }

  return { scan }
}

/** "dark" when the first solid background behind the element is dark, else "light". */
export function pageTheme(element: Element): 'light' | 'dark' {
  const view = element.ownerDocument.defaultView
  for (let node: Element | null = element; node && view; node = node.parentElement) {
    const rgb = parseRgb(view.getComputedStyle(node).backgroundColor)
    if (rgb && rgb[3] > 0.5) {
      const [r, g, b] = rgb
      // Relative luminance, roughly: below the midpoint reads as a dark theme.
      return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128 ? 'dark' : 'light'
    }
  }
  return 'light'
}

function parseRgb(value: string): [number, number, number, number] | null {
  const m = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/)
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])]
}
