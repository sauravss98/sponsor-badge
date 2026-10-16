// Styles for the on-page badge and its details panel. Each lives in its own shadow root, so the
// job board's CSS can't restyle them and they can't leak into the page.
//
// Colours follow the page, not the OS: the host gets data-theme="dark" when the background behind
// the badge is dark (see pageTheme in inject.ts). LinkedIn and Indeed have their own themes.

const TOKENS = `
:host {
  --text: #1f2328; --muted: #59636e; --bg: #ffffff; --border: #d1d9e0; --accent: #0b57d0;
  --green-bg: #dafbe1; --green-text: #116329;
  --amber-bg: #fff1c2; --amber-text: #7a4b00;
  --grey-bg: #eef1f4; --grey-text: #3d444d;
  --neutral-bg: #f6f8fa; --neutral-text: #59636e;
}
:host([data-theme="dark"]) {
  --text: #e6edf3; --muted: #9198a1; --bg: #1b1f24; --border: #3d444d; --accent: #7cacf8;
  --green-bg: #12361f; --green-text: #7ee2a0;
  --amber-bg: #3d2c00; --amber-text: #f2c661;
  --grey-bg: #2a3038; --grey-text: #c9d1d9;
  --neutral-bg: #22272e; --neutral-text: #9198a1;
}
* { box-sizing: border-box; }
`

export const BADGE_CSS = `${TOKENS}
:host {
  all: initial;
  display: inline-block;
  margin-left: 8px;
  vertical-align: middle;
  font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
}
.badge {
  display: inline-block;
  padding: 2px 9px;
  border: 0;
  border-radius: 999px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.badge:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.badge.green { background: var(--green-bg); color: var(--green-text); }
.badge.amber { background: var(--amber-bg); color: var(--amber-text); }
.badge.grey { background: var(--grey-bg); color: var(--grey-text); }
.badge.neutral { background: var(--neutral-bg); color: var(--neutral-text); }
`

// The panel host is attached to <body> and positioned against the viewport, so a job board's
// overflow: hidden containers can't clip it.
export const PANEL_CSS = `${TOKENS}
:host {
  all: initial;
  position: fixed;
  z-index: 2147483647;
  font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
}
.panel {
  width: 320px;
  max-height: min(70vh, 520px);
  overflow: auto;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}
.matched { margin: 0; font-weight: 600; }
dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; margin: 8px 0 0; }
dt { color: var(--muted); }
dd { margin: 0; overflow-wrap: anywhere; }
ul.notes { margin: 8px 0 0; padding-left: 18px; }
ul.notes li + li { margin-top: 4px; }
p { margin: 0; }
a { color: var(--accent); }
footer {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 12px;
}
footer p + p { margin-top: 4px; }
`
