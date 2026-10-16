// Bundles the extension into dist/ (load that folder with "Load unpacked").
//   node build.mjs            one-off build
//   node build.mjs --watch    rebuild on change
// SPONSOR_BADGE_API_BASE picks the API; it defaults to the local backend.
import { build, context } from 'esbuild'
import { cp, mkdir, rm } from 'node:fs/promises'

const apiBase = process.env.SPONSOR_BADGE_API_BASE ?? 'http://127.0.0.1:8000'

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
