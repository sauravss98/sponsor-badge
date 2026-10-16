// Shrinks a job page saved with Chrome's "Save as > Webpage, Complete" into a test fixture.
//   node scripts/clean-fixture.mjs fixtures/linkedin-4.html [more files...]
//
// Keeps the page structure the extractors read and removes what tests don't need: scripts (which
// also carry tracking and session data), styles, iframes and preload links. Rewrites in place.
import { readFile, writeFile } from 'node:fs/promises'

import { JSDOM } from 'jsdom'

const DROP = 'script, style, noscript, iframe, link, template'

for (const file of process.argv.slice(2)) {
  const before = await readFile(file, 'utf8')
  const dom = new JSDOM(before)
  for (const node of dom.window.document.querySelectorAll(DROP)) node.remove()
  // Job boards put search-tracking tokens on cards and in link queries; tests need neither.
  for (const node of dom.window.document.querySelectorAll('[data-mobtk]')) {
    node.removeAttribute('data-mobtk')
  }
  for (const a of dom.window.document.querySelectorAll('a[href*="?"]')) {
    const href = a.getAttribute('href')
    a.setAttribute('href', href.slice(0, href.indexOf('?')))
  }
  const after = dom.serialize()
  await writeFile(file, after)
  console.log(`${file}: ${(before.length / 1024).toFixed(0)} KB -> ${(after.length / 1024).toFixed(0)} KB`)
}
