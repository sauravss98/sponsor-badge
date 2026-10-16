# To do

Where things stand on 2026-10-16. M1 to M4 are done; M5 is half done.

## For you (Saurav)

### 1. Indeed pages with a salary (needed to finish M5)
1. Open a private window: Ctrl + Shift + N (you need to be logged out).
2. Go to uk.indeed.com and open a job whose details pane, on the right, **shows a salary**.
3. Press Ctrl + S, choose **Webpage, Complete**, and save it as `indeed-4` in
   `D:\Projects\AI\sponsor-badge\fixtures`.
4. Do the same for one more job as `indeed-5`.

### 2. Where LinkedIn shows the salary (needed to finish M5)
1. On LinkedIn, logged in as normal, open a job that **shows a salary**.
2. Press F12, open the **Console** tab, paste this as one line and press Enter:
   ```
   copy(JSON.stringify([...document.querySelectorAll('main *')].filter(e => e.children.length === 0 && e.textContent.includes('£')).slice(0, 10).map(e => ({ text: e.textContent.trim().slice(0, 60), tag: e.tagName, parent: e.parentElement.tagName, aria: e.closest('[aria-label]')?.getAttribute('aria-label')?.slice(0, 40), pos: [Math.round(e.getBoundingClientRect().left), Math.round(e.getBoundingClientRect().top)] })), null, 1))
   ```
3. Paste the result (Ctrl + V) to Claude. It only lists text on the page containing "£".

### 3. Decisions
- **Third job board**: Reed, Totaljobs, Glassdoor or another? Then save 2 or 3 pages from it
  the same way as in step 1.
- **Rate-limit spoofing on the live API**: a client can dodge the 60-a-minute limit by forging
  `CF-Connecting-IP`. The fix needs two production deploys (a temporary diagnostic route, then
  the fix). Go ahead, or leave it? Normal users aren't affected.

### 4. Tidy up
- Delete `D:\Projects\AI\sponsor-check\bug` (the screenshot shows your name; it's in no repo).

## For Claude, when Saurav is back

- **M5, part 2**: from the pages above, fill in `INDEED_SALARY` and `LINKEDIN_SALARY` in
  `src/content/extract.ts` (logged-in LinkedIn scrambles class names: use structure, as
  `linkedInLoggedIn()` does), add fixture tests, then a browser test showing the panel's
  Salary section. Clean new pages with `node scripts/clean-fixture.mjs` and check them for
  names, emails and tokens before committing.
- **Third board**: extractor plus fixtures, like LinkedIn and Indeed.
- **Backend K5** (if approved): deploy `/_debug/forwarded` to see which forwarding header Render
  sets that a client can't forge, key the rate limit on it, remove the route in the same fix,
  then rerun `python scripts/check_deploy.py https://sponsor-check.onrender.com`.
- **M6, publish**: README screenshots/GIF, the Web Store listing, then add the Web Store
  extension ID to `SPONSOR_CHECK_CORS_ORIGINS` on Render (the store may assign its own ID, and
  may not accept our manifest `key`; unverified).
- **Latency**: cached lookups measured 215 to 243 ms median from here, p95 262 to 540 ms
  (target under 300 ms). Nearly all of it is the network trip to Render; check which region
  the service runs in.
