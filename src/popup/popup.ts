// Popup: a manual search box. It asks the background worker and renders with shared/render.ts.

import { badgeFor } from '../shared/badge'
import type { LookupOutcome, LookupRequest } from '../shared/messages'
import { badgeElement, details } from '../shared/render'

const form = document.querySelector<HTMLFormElement>('#search')!
const input = document.querySelector<HTMLInputElement>('#name')!
const button = form.querySelector<HTMLButtonElement>('button')!
const output = document.querySelector<HTMLElement>('#result')!

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  button.disabled = true
  output.replaceChildren(badgeElement(document, { tone: 'neutral', label: 'Checking...' }))
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
  output.replaceChildren(badgeElement(document, badgeFor(outcome)), ...details(document, outcome))
}
