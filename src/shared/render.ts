// DOM for the badge and the details panel, shared by the popup and the on-page panel. Everything
// is written with textContent, never innerHTML: register names and notes are untrusted text.

import { badgeFor, panelFor, type BadgeView } from './badge'
import type { LookupOutcome } from './messages'
import type { SalaryView } from './salaryView'

const OGL = 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/'

export function badgeElement(doc: Document, view: BadgeView, tag = 'span'): HTMLElement {
  return el(doc, tag, view.label, `badge ${view.tone}`)
}

/** The matched name, the facts table and the notes for one outcome. */
export function details(doc: Document, outcome: LookupOutcome): Node[] {
  const view = badgeFor(outcome)
  const parts: Node[] = []
  if (view.legalName) parts.push(el(doc, 'p', view.legalName, 'matched'))

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
    const list = doc.createElement('dl')
    for (const [term, value] of rows) {
      if (value === null) continue
      list.append(el(doc, 'dt', term), el(doc, 'dd', value))
    }
    list.append(el(doc, 'dt', 'Source'), wrap(doc, 'dd', link(doc, 'Official register on GOV.UK',
      panel.registerUrl)))
    parts.push(list)

    const notes = doc.createElement('ul')
    notes.className = 'notes'
    for (const note of panel.notes) notes.append(el(doc, 'li', note))
    parts.push(notes)
  } else if (outcome.kind === 'unavailable' && outcome.retryAfterSeconds) {
    parts.push(el(doc, 'p',
      `Too many checks just now. Try again in ${outcome.retryAfterSeconds} s.`))
  }
  return parts
}

/** The salary part of the panel: a heading, the comparison rows and the API's salary notes. */
export function salarySection(doc: Document, view: SalaryView): HTMLElement {
  const section = doc.createElement('section')
  section.className = 'salary'
  section.append(el(doc, 'h3', 'Salary'))
  const list = doc.createElement('dl')
  for (const [term, value] of view.rows) list.append(el(doc, 'dt', term), el(doc, 'dd', value))
  section.append(list)
  if (view.notes.length) {
    const notes = doc.createElement('ul')
    notes.className = 'notes'
    for (const note of view.notes) notes.append(el(doc, 'li', note))
    section.append(notes)
  }
  return section
}

/** "Not immigration advice" and the Open Government Licence attribution. */
export function attribution(doc: Document): HTMLElement {
  const footer = doc.createElement('footer')
  const advice = el(doc, 'p', '')
  advice.append(el(doc, 'strong', 'This is not immigration advice.'))
  const data = el(doc, 'p', 'Data: Home Office register of licensed sponsors. Contains public ' +
    'sector information licensed under the ')
  data.append(link(doc, 'Open Government Licence v3.0', OGL), '.')
  footer.append(advice, data)
  return footer
}

function link(doc: Document, text: string, href: string): HTMLAnchorElement {
  const a = el(doc, 'a', text) as HTMLAnchorElement
  a.href = href
  a.target = '_blank'
  a.rel = 'noopener'
  return a
}

function el(doc: Document, tag: string, text: string, className?: string): HTMLElement {
  const node = doc.createElement(tag)
  node.textContent = text
  if (className) node.className = className
  return node
}

function wrap(doc: Document, tag: string, child: Node): HTMLElement {
  const node = doc.createElement(tag)
  node.append(child)
  return node
}
