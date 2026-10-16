# CLAUDE.md

Chrome MV3 extension that badges UK employers by sponsor-licence status. The plan and milestones
are in `docs/PLAN-sponsor-badge.md`. The API it consumes lives in the sibling repo
`D:\Projects\AI\sponsor-check\sponsor-check` (`/v1` endpoints in `src/sponsor_check/api.py`).

## Commands

```bash
npm run check    # typecheck + unit tests + build; must pass before saying you're done
npm run e2e      # real Chromium + real local API at 127.0.0.1:8000 (start sponsor-check-api first)
```

## Layout

```
src/api/         types.ts (hand-mirrored /v1 contract), client.ts (fetch -> typed result)
src/background/  index.ts (chrome wiring only), service.ts (cache, 429 pause, dedupe; testable)
src/shared/      badge.ts (outcome -> badge/panel view), names.ts (placeholder skip, cache key),
                 messages.ts (worker message types)
src/content/     extract.ts (selectors per site), inject.ts (badge in a shadow root, follows
                 page changes; testable), index.ts (MutationObserver + chrome wiring), styles.ts
src/shared/render.ts  badge/panel DOM shared by the popup and the on-page panel
src/popup/       popup.ts (thin)
fixtures/        real job pages saved logged out, cleaned by scripts/clean-fixture.mjs
static/          manifest.json, popup.html, popup.css (copied to dist/ by build.mjs)
tests/           Vitest unit tests, API mocked; fixtures.ts holds real /v1 responses
e2e/             Playwright smoke test, needs the local API
```

## Rules (don't break these)

- Only the background worker calls the API. Content scripts and the popup send it a
  `{type: 'lookup', name}` message. One cache, one 429 pause.
- Send only the employer name. No route, URL or page text (plan section 6).
- A failure (timeout, network, 5xx, 429, bad shape) is "Couldn't check", never "Not found".
- Only `licensed` + rating `A` is green. `possible` is always amber and shows `legal_name`.
  Unknown `status`/`rating` values from a newer API are neutral, never guessed.
- Never hardcode salary thresholds; they come from `/v1/salary-check`.
- Write DOM with `textContent`, never `innerHTML`: register names are untrusted.
- Content scripts read only the employer name. Every selector in `extract.ts` is tagged
  `fixture` (tested on a saved page) or `untested`. Add a fixture before trusting a new one.
- Fixtures must be saved logged out and cleaned with `scripts/clean-fixture.mjs`; check them for
  names, emails and tokens before committing.
- The content script is built as an IIFE (Chrome doesn't run content scripts as modules); the
  worker and popup are ESM. See `build.mjs`.
- The manifest `key` pins the dev ID `kiggiklmmmlkmjfaikamcihbinjhgcpo`; the backend's CORS
  default allowlists it. If the key changes, update `DEV_EXTENSION_ORIGIN` in the backend.
- No em dashes in user-facing text. Show the OGL attribution and "not immigration advice".
- `/v1` only gains fields: ignore unknown ones. When the backend contract changes, update
  `src/api/types.ts` and `tests/fixtures.ts`.
