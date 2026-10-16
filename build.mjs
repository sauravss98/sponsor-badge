// Bundles the extension into dist/ (load that folder with "Load unpacked").
//   node build.mjs            one-off build
//   node build.mjs --watch    rebuild on change
//   node build.mjs --prod     point at the deployed API instead of the local one
// SPONSOR_BADGE_API_BASE overrides either.
import { build, context } from 'esbuild'
import { cp, mkdir, rm } from 'node:fs/promises'

const PROD_API = 'https://sponsor-check.onrender.com'
const LOCAL_API = 'http://127.0.0.1:8000'
const apiBase =
  process.env.SPONSOR_BADGE_API_BASE ?? (process.argv.includes('--prod') ? PROD_API : LOCAL_API)

const options = {
  entryPoints: { background: 'src/background/index.ts', popup: 'src/popup/popup.ts' },
  bundle: true,
  format: 'esm',
  target: 'chrome102',
  outdir: 'dist',
  sourcemap: true,
  define: { __API_BASE__: JSON.stringify(apiBase) },
  logLevel: 'info',
}

await rm('dist', { recursive: true, force: true })
await mkdir('dist', { recursive: true })
await cp('static', 'dist', { recursive: true })

if (process.argv.includes('--watch')) {
  await (await context(options)).watch()
} else {
  await build(options)
}
