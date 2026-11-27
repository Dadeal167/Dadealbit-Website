import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderEditorShell, renderEditorWorker } from './package-editor-startup.mjs'

const [, , inputPath, version] = process.argv
if (!inputPath || !/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  throw new Error('Usage: node scripts/package-editor.mjs <dist/online directory> <version>')
}

const input = resolve(inputPath)
const output = fileURLToPath(new URL('../editor/', import.meta.url))
const html = await readFile(join(input, 'index.html'), 'utf8')
const manifestSource = await readFile(join(input, '.vite', 'manifest.json'), 'utf8')
const manifest = JSON.parse(manifestSource)
const files = await listBuildFiles(input)
const releaseFiles = new Set(files)
const coreFiles = new Set()
const staticImports = new Set()
const fontFamily = file => file.replace(/-[a-z0-9_-]{8}\.[^.]+$/i, '')
const woff2Families = new Set(files.filter(file => file.endsWith('.woff2')).map(fontFamily))
const woffFamilies = new Set(files.filter(file => file.endsWith('.woff')).map(fontFamily))
collectCore('index.html')

function collectCore(key) {
  if (staticImports.has(key)) return
  const chunk = manifest[key]
  if (!chunk) throw new Error(`Missing Vite manifest entry: ${key}`)
  staticImports.add(key)

  for (const file of [chunk.file, ...(chunk.css ?? []), ...(chunk.assets ?? [])]) {
    if (!releaseFiles.has(file)) throw new Error(`Missing build file: ${file}`)
    // The CSS offers legacy font formats as alternatives to WOFF2.
    const family = fontFamily(file)
    if (file.endsWith('.woff') && woff2Families.has(family)) continue
    if (file.endsWith('.ttf') && (woff2Families.has(family) || woffFamilies.has(family))) continue
    coreFiles.add(file)
  }
  for (const dependency of chunk.imports ?? []) collectCore(dependency)
}

async function listBuildFiles(directory, prefix = '') {
  const files = []
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const name = prefix + entry.name
    if (name === 'index.html' || name === '.vite') continue
    if (entry.isDirectory()) files.push(...await listBuildFiles(join(directory, entry.name), `${name}/`))
    else if (entry.isFile()) files.push(name)
  }
  return files.sort()
}

// Include all copied content and the shell/worker template in the immutable release ID.
const digest = createHash('sha256').update(html).update(manifestSource)
digest.update(await readFile(new URL(import.meta.url)))
digest.update(await readFile(new URL('./package-editor-startup.mjs', import.meta.url)))
for (const file of files) digest.update(file).update(await readFile(join(input, file)))
const release = `${version}-${digest.digest('hex').slice(0, 12)}`
const releasePath = `releases/${release}/`
const offlineShell = `shell-${release}.html`
const shell = renderEditorShell(html, releasePath, releaseFiles)
const worker = renderEditorWorker({ release, releasePath, files, coreFiles: [...coreFiles], offlineShell })

const releaseRoot = join(output, releasePath)
const directories = new Set(files.map(file => dirname(join(releaseRoot, file))))
for (const directory of directories) await mkdir(directory, { recursive: true })
await Promise.all(files.map(file => copyFile(join(input, file), join(releaseRoot, file))))
await writeFile(join(output, offlineShell), shell)
await writeFile(join(output, 'sw.js'), worker)
await writeFile(join(output, 'index.html'), shell)

console.log(`Packaged online editor ${release}: ${coreFiles.size} core files, ${files.length} total assets`)
