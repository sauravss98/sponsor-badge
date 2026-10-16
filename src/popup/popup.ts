// Popup: a manual search box. It asks the background worker and renders the view models from
// shared/badge.ts. Everything is written with textContent, never innerHTML: register names are
// untrusted text.

import { badgeFor, panelFor, type BadgeView } from '../shared/badge'
import type { LookupOutcome, LookupRequest } from '../shared/messages'

const form = document.querySelector<HTMLFormElement>('#search')!
const input = document.querySelector<HTMLInputElement>('#name')!
const button = form.querySelector<HTMLButtonElement>('button')!
const output = document.querySelector<HTMLElement>('#result')!

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  button.disabled = true
  output.replaceChildren(badge({ tone: 'neutral', label: 'Checking...' }))
  try {
    const request: LookupRequest = { type: 'lookup', name: input.value }
    const outcome: LookupOutcome = await chrome.runtime.sendMessage(request)
    render(outcome)
  } catch {
    // The worker didn't answer at all: still a failure, never "not found".
    render({ kind: 'unavailable', reason: 'network' })
  } finally {
    button.disabled = false
  }
})

function render(outcome: LookupOutcome): void {
  const view = badgeFor(outcome)
  const parts: Node[] = [badge(view)]

  if (view.legalName) parts.push(el('p', view.legalName, 'matched'))

  if (outcome.kind === 'ok') {
    const panel = panelFor(outcome.result)
    const rows: [string, string | null][] = [
      ['Town', panel.town],
      ['Rating', panel.rating],
      ['Routes', panel.routes.join(', ') || null],
      // A name-similarity score, not a probability, so not shown as a percentage.
      ['Name match', panel.legalName ? `${panel.confidence}/100` : null],
      ['Register date', panel.registerDate || null],
    ]
    const list = document.createElement('dl')
    for (const [term, value] of rows) {
      if (value === null) continue
      list.append(el('dt', term), el('dd', value))
    }
    const link = el('a', 'Official register on GOV.UK') as HTMLAnchorElement
    link.href = panel.registerUrl
    link.target = '_blank'
    link.rel = 'noopener'
    list.append(el('dt', 'Source'), wrap('dd', link))
    parts.push(list)

    const notes = document.createElement('ul')
    notes.className = 'notes'
    for (const note of panel.notes) notes.append(el('li', note))
    parts.push(notes)
  } else if (outcome.kind === 'unavailable' && outcome.retryAfterSeconds) {
    parts.push(el('p', `Too many checks just now. Try again in ${outcome.retryAfterSeconds} s.`))
  }

  output.replaceChildren(...parts)
}

function badge(view: BadgeView): HTMLElement {
  return el('span', view.label, `badge ${view.tone}`)
}

function el(tag: string, text: string, className?: string): HTMLElement {
  const node = document.createElement(tag)
  node.textContent = text
  if (className) node.className = className
  return node
}

function wrap(tag: string, child: Node): HTMLElement {
  const node = document.createElement(tag)
  node.append(child)
  return node
}
