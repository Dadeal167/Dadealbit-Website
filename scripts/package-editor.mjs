import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const [, , htmlPath, version] = process.argv
if (!htmlPath || !/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  throw new Error('Usage: node scripts/package-editor.mjs <online-editor-index.html> <version>')
}

const html = await readFile(htmlPath)
const digest = createHash('sha256').update(html).digest('hex')
const asset = 'editor-v' + version + '-' + digest.slice(0, 12) + '.bin'
const directory = new URL('../editor/', import.meta.url)

await mkdir(directory, { recursive: true })
await writeFile(new URL(asset, directory), gzipSync(html, { level: 9 }))
await writeFile(new URL('index.html', directory), `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dadealbit Markdown 编辑器</title>
  <style>
    :root { color-scheme: light dark; font: 1rem/1.6 system-ui, sans-serif; }
    body { margin: 0; padding: 32px; }
    p { margin: 1rem 0; }
  </style>
</head>
<body>
  <main>
    <a href="../">返回官网</a>
    <p id="status" role="status">正在加载编辑器…</p>
    <noscript>请启用 JavaScript 后重新打开编辑器。</noscript>
    <a id="fallback" href="https://github.com/Dadeal167/Dadeal.bit-Markdown-Editor/releases/latest" hidden>下载离线版</a>
  </main>
  <script type="module">
    try {
      const response = await fetch('./${asset}')
      if (!response.ok || !response.body) throw new Error('下载失败')
      const stream = response.body.pipeThrough(new DecompressionStream('gzip'))
      const bytes = await new Response(stream).arrayBuffer()
      const hash = await crypto.subtle.digest('SHA-256', bytes)
      const digest = [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('')
      if (digest !== '${digest}') throw new Error('文件校验失败')
      document.open()
      document.write(new TextDecoder().decode(bytes))
      document.close()
    } catch {
      document.getElementById('status').textContent = '编辑器加载失败。请刷新页面重试。'
      document.getElementById('fallback').hidden = false
    }
  </script>
</body>
</html>
`)
console.log('Packaged ' + asset)
