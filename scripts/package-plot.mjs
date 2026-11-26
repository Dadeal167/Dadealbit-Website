import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(new URL('../../Dadealbit/package.json', import.meta.url))
const { build } = require('esbuild')
const input = fileURLToPath(new URL('../plot/plot.js', import.meta.url))
const output = fileURLToPath(new URL('../plot/plot.bundle.js', import.meta.url))
const katexLicense = await readFile(resolve(dirname(require.resolve('katex')), '../LICENSE'), 'utf8')

await build({
  entryPoints: [input],
  outfile: output,
  bundle: true,
  format: 'iife',
  charset: 'utf8',
  minify: true,
  nodePaths: [fileURLToPath(new URL('../../Dadealbit/node_modules/', import.meta.url))],
  banner: { js: `// Generated from plot/plot.js by scripts/package-plot.mjs.\n/* KaTeX license\n${katexLicense.trim()}\n*/` },
})
