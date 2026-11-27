export function renderEditorShell(html, releasePath, files) {
  const hostedHtml = html.replace(/\b(src|href)=(['"])\.\/([^'"]+)\2/g, (attribute, name, quote, file) => (
    files.has(file) ? `${name}=${quote}./${releasePath}${file}${quote}` : attribute
  ))
  return hostedHtml
    .replace(/<link\s+rel="icon"\s+href="data:,"\s*\/?>/i, '<link rel="icon" href="../assets/mark.webp" type="image/webp">')
    .replace(/<meta\s+charset=[^>]+>/i, match => `${match}\n${startupHead}`)
    .replace('</body>', () => `${startupBody}\n  </body>`)
}

const startupHead = `<script>
    if (location.protocol === 'http:' && ['dadealbit.xyz', 'www.dadealbit.xyz'].includes(location.hostname)) {
      const secureUrl = new URL(location.href)
      secureUrl.protocol = 'https:'
      location.replace(secureUrl.href)
    }
  </script>
  <style>
    #editor-startup {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: grid;
      place-items: center;
      overflow: auto;
      box-sizing: border-box;
      padding: 24px;
      color-scheme: light;
      color: #18213b;
      background: radial-gradient(ellipse at 50% 26%, #fff, #f3f7ff 70%);
      font: 1rem/1.6 system-ui, "Microsoft YaHei", sans-serif;
    }
    #editor-startup section {
      box-sizing: border-box;
      width: min(100%, 30rem);
      padding: clamp(1.5rem, 6vw, 2.5rem);
      border: 1px solid #dce4f2;
      border-radius: 1.5rem;
      background: #fff;
      box-shadow: 0 .5rem 2.5rem #3158d714;
      text-align: center;
    }
    #editor-startup h1 { margin: 0; color: inherit; font-size: clamp(1.25rem, 5vw, 1.5rem); line-height: 1.35; }
    #editor-startup p { margin: .75rem 0 0; color: #566078; }
    #editor-startup [hidden] { display: none; }
    #editor-startup a, #editor-startup button {
      display: inline-flex;
      min-height: 44px;
      align-items: center;
      margin-top: .75rem;
      padding-inline: .75rem;
      border-radius: .625rem;
      color: #3158d7;
      font: inherit;
      font-size: .875rem;
    }
    #editor-startup button { border: 0; background: #3158d7; color: #fff; cursor: pointer; }
    #editor-startup :focus-visible { outline: 2px solid #3158d7; outline-offset: 3px; }
  </style>`

const startupBody = `<aside id="editor-startup" aria-labelledby="startup-title">
    <section>
      <h1 id="startup-title">Dadealbit Markdown 编辑器</h1>
      <p id="startup-status" role="status">正在加载编辑器…</p>
      <button id="startup-retry" type="button" hidden>重新加载</button>
      <a href="../">返回官网</a>
      <a id="startup-fallback" href="https://github.com/Dadeal167/Dadeal.bit-Markdown-Editor/releases/latest" hidden>下载离线版</a>
      <noscript><p>请启用 JavaScript 后重新打开编辑器。</p></noscript>
    </section>
  </aside>
  <script>
    (() => {
      const root = document.getElementById('root');
      const startup = document.getElementById('editor-startup');
      const status = document.getElementById('startup-status');
      const retry = document.getElementById('startup-retry');
      const fallback = document.getElementById('startup-fallback');
      const timeout = setTimeout(() => {
        status.textContent = '编辑器启动超时。请检查网络连接后重试。';
        retry.hidden = false;
        fallback.hidden = false;
      }, 30000);
      retry.onclick = () => location.reload();

      function registerOfflineCache() {
        if (!('serviceWorker' in navigator)) return;
        navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
      }

      function finishStartup() {
        if (!root.firstElementChild) return;
        observer.disconnect();
        clearTimeout(timeout);
        startup.remove();
        if (document.readyState === 'complete') registerOfflineCache();
        else window.addEventListener('load', registerOfflineCache, { once: true });
      }

      const observer = new MutationObserver(finishStartup);
      observer.observe(root, { childList: true });
      finishStartup();
    })();
  </script>`

export function renderEditorWorker({ release, releasePath, files, coreFiles, offlineShell }) {
  return `const scope = new URL(self.registration.scope);
const cachePrefix = 'dadealbit-editor:' + scope.pathname + ':';
const cacheName = cachePrefix + ${JSON.stringify(release)};
const localUrl = path => new URL(path, scope).href;
const shellUrl = localUrl(${JSON.stringify(offlineShell)});
const core = ${JSON.stringify(coreFiles.map(file => releasePath + file))}.map(localUrl);
const assets = new Set(${JSON.stringify(files.map(file => releasePath + file))}.map(localUrl));

self.addEventListener('install', event => {
  const requests = [shellUrl, ...core].map(url => new Request(url, { redirect: 'error' }));
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(requests)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(cachePrefix) && name !== cacheName)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function openEditor(request) {
  const shell = await caches.open(cacheName).then(cache => cache.match(shellUrl)).catch(() => null);
  if (!shell) return fetch(request);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(request, { signal: controller.signal });
    if (response.ok) return response;
  } catch {
    // The last complete shell is still usable when the network is down.
  } finally {
    clearTimeout(timeout);
  }
  return shell;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin) return;

  if (request.mode === 'navigate' && [scope.pathname, scope.pathname + 'index.html'].includes(url.pathname)) {
    event.respondWith(openEditor(request));
  } else if (assets.has(url.href) && !request.headers.has('range')) {
    event.respondWith((async () => {
      let cache;
      try {
        cache = await caches.open(cacheName);
        const saved = await cache.match(request);
        if (saved) return saved;
      } catch {
        // The editor still loads normally when browser storage is unavailable.
      }

      const response = await fetch(request);
      if (cache && response.ok && response.type === 'basic' && !response.redirected) {
        event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
      }
      return response;
    })());
  }
});
`;
}
