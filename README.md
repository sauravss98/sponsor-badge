# Sponsor Badge

A Chrome extension (Manifest V3, TypeScript) for international students and graduates looking
for UK jobs. It shows whether an employer is on the Home Office register of licensed visa
sponsors, using the [sponsor-check](https://github.com/sauravss98/sponsor-check) API.

Status: Milestone 4 of [the plan](docs/PLAN-sponsor-badge.md). A badge appears next to the
employer on LinkedIn and Indeed UK job pages, and the popup has a manual search. Click a badge
for the details. Salary checks come in M5.

## What the badge means

| Badge | Meaning |
|---|---|
| Green: "Licensed sponsor (A-rated): Skilled Worker" | Exact name match, A-rated on the Skilled Worker route |
| Amber: "Possible match: check" | Only a similar name was found. The matched name is shown so you can judge it |
| Amber: B-rated, provisional or unclear rating | Licensed, but check with the employer |
| Grey: "Licensed, but not for Skilled Worker" | Licensed on other routes only |
| Grey: "Not found on register" | No close match. The employer may use a different legal name |
| Neutral: "Couldn't check" | The API didn't answer. This is never shown as "not found" |

Being on the register means an employer can sponsor, not that it will sponsor a particular job.
This is not immigration advice.

## Privacy

- The extension sends only the employer name. No URLs, page content, browsing history or user
  identifiers.
- No analytics. Results are cached in `chrome.storage.session`, which is cleared when the browser
  closes.
- Permissions: `storage`, plus a content script on `www.linkedin.com` and `uk.indeed.com` only.
  LinkedIn needs the whole site because it moves from the feed to a job without a page load.
  The API is reached through CORS, so it needs no host permission.

## Development

You need Node 22 and the sponsor-check API running locally:

```powershell
# in the sponsor-check repo
pip install -e ".[dev]"
sponsor-check-api                      # http://127.0.0.1:8000

# in this repo
npm install
npm run build                          # writes dist/
```

Then open `chrome://extensions`, turn on Developer mode, choose **Load unpacked** and pick
`dist/`. The `key` in `static/manifest.json` pins the extension ID to
`kiggiklmmmlkmjfaikamcihbinjhgcpo`, which the API allows through CORS by default.

| Command | What it does |
|---|---|
| `npm run build` / `npm run watch` | Bundle `src/` with esbuild and copy `static/` into `dist/` |
| `npm run build:prod` | Same, pointed at the deployed API (`https://sponsor-check.onrender.com`) |
| `npm test` | Unit tests (Vitest), offline, with the API mocked |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | All three |
| `npm run e2e` | Loads `dist/` in Chromium (Playwright) and searches against the local API |

`SPONSOR_BADGE_API_BASE` changes the API the build points at (default `http://127.0.0.1:8000`).

### Test pages

`fixtures/` holds real job pages, saved logged out, that the extractor tests read. To add one:
open the job in a private window, press Ctrl+S, save as "Webpage, Complete" into `fixtures/`,
then run `node scripts/clean-fixture.mjs fixtures/<file>.html`. That strips scripts, styles and
tracking tokens. The `_files` folder Chrome saves alongside is ignored by git.

Supported layouts:
- LinkedIn logged out and Indeed UK's search page with a job open: tested against saved pages.
- LinkedIn logged in: its class names are scrambled and change every release, so the extension
  uses the page title ("Job | Company | LinkedIn") and the plain company link in the job pane
  instead. Tested against the structure measured on a real page, not a saved copy.
- Indeed's standalone job page: best-guess selectors, marked `untested` in
  `src/content/extract.ts`.

Whenever the extension can't confirm the employer, no badge appears. It never guesses.

## Licence

MIT. Register data: contains public sector information licensed under the
[Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
