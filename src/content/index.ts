// Content script for the supported job boards. It reads only the employer name from the page and
// asks the background worker about it; nothing else leaves the page.

import type { LookupOutcome, LookupRequest } from '../shared/messages'
import { extractorFor } from './extract'
import { createInjector } from './inject'

const SCAN_DELAY_MS = 300 // job boards re-render in bursts; wait for the burst to settle

const extract = extractorFor(location.hostname)

if (extract) {
  const injector = createInjector({
    doc: document,
    extract,
    lookup: (name) => chrome.runtime.sendMessage<LookupRequest, LookupOutcome>({ type: 'lookup', name }),
  })

  let timer: ReturnType<typeof setTimeout> | undefined
  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(() => injector.scan(), SCAN_DELAY_MS)
  }

  // LinkedIn and Indeed swap the job pane without a page load, so watch the DOM, not the URL.
  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  })
  schedule()
}
