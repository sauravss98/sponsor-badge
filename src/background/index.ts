// Background service worker: the only part of the extension that talks to the API.

import { lookup } from '../api/client'
import { isLookupRequest } from '../shared/messages'
import { createLookupService, type KeyValueStore } from './service'

declare const __API_BASE__: string // set by build.mjs

// chrome.storage.session lives in memory and is cleared when the browser closes. By default only
// extension pages and this worker can read it, not content scripts on job boards.
const sessionStore: KeyValueStore = {
  async get(key) {
    return (await chrome.storage.session.get(key))[key]
  },
  async set(key, value) {
    await chrome.storage.session.set({ [key]: value })
  },
}

const lookupEmployer = createLookupService({
  store: sessionStore,
  lookup: (name) => lookup(name, { base: __API_BASE__ }),
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isLookupRequest(message)) return false
  lookupEmployer(message.name).then(sendResponse)
  return true // keeps the channel open for the async response
})
