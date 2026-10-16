// Content script for the supported job boards. It reads only the employer name from the page and
// asks the background worker about it; nothing else leaves the page.

import type { LookupOutcome, LookupRequest } from '../shared/messages'
import { clean, extractorFor, type Extractor } from './extract'
import { createInjector, HOST_ATTRIBUTE } from './inject'

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
    timer = setTimeout(() => {
      injector.scan()
      diagnose(extract)
    }, SCAN_DELAY_MS)
  }

  // LinkedIn and Indeed swap the job pane without a page load, so watch the DOM, not the URL.
  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  })
  schedule()
}

// TEMPORARY, while fixing logged-in LinkedIn (remove before publishing, M6): one Console line
// whenever what the extractor sees changes. It stays in the user's own DevTools; nothing is sent.
let lastDiagnosis = ''
function diagnose(extractor: Extractor): void {
  const links = [...document.querySelectorAll('main a[href*="/company/"]')]
  const first = links.slice(0, 3).map((a) =>
    `${a.querySelector('img') ? 'logo' : 'text'}${a.hasAttribute('aria-label') ? '+aria' : ''}:` +
    `${clean(a.textContent).slice(0, 30)}@${a.getAttribute('href')?.split('?')[0]}`)
  const line = [
    `found=${extractor(document)?.name ?? 'none'}`,
    `badges=${document.querySelectorAll(`[${HOST_ATTRIBUTE}]`).length}`,
    `title="${document.title}"`,
    `main=${document.querySelectorAll('main').length}`,
    `companyLinks=${links.length} (all pages: ${document.querySelectorAll('a[href*="/company/"]').length})`,
    `first=[${first.join(', ')}]`,
  ].join(' ')
  if (line !== lastDiagnosis) {
    lastDiagnosis = line
    console.info('[Sponsor Badge]', line)
  }
}
