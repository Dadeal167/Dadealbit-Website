const scope = new URL(self.registration.scope);
const cachePrefix = 'dadealbit-editor:' + scope.pathname + ':';
const cacheName = cachePrefix + "1.2.1-cc1e2c88af6e";
const localUrl = path => new URL(path, scope).href;
const shellUrl = localUrl("shell-1.2.1-cc1e2c88af6e.html");
const core = ["releases/1.2.1-cc1e2c88af6e/assets/index-DRxJxeLo.js","releases/1.2.1-cc1e2c88af6e/assets/index-CAkJkD80.css","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_AMS-Regular-BQhdFMY1.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Caligraphic-Bold-Dq_IR9rO.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Caligraphic-Regular-Di6jR-x-.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Fraktur-Bold-CL6g_b3V.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Fraktur-Regular-CTYiF6lA.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Main-Bold-Cx986IdX.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Main-BoldItalic-DxDJ3AOS.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Main-Italic-NWA7e6Wa.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Main-Regular-B22Nviop.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Math-BoldItalic-CZnvNsCZ.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Math-Italic-t53AETM-.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_SansSerif-Bold-D1sUS0GD.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_SansSerif-Italic-C3H0VqGB.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_SansSerif-Regular-DDBCnlJ7.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Script-Regular-D3wIWfF6.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Size1-Regular-mCD8mA8B.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Size2-Regular-Dy4dx90m.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Size3-Regular-CTq5MqoE.woff","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Size4-Regular-Dl5lxZxV.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Typewriter-Regular-CO6r4hn1.woff2"].map(localUrl);
const assets = new Set(["releases/1.2.1-cc1e2c88af6e/LICENSE","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_AMS-Regular-BQhdFMY1.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_AMS-Regular-DMm9YOAa.woff","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_AMS-Regular-DRggAlZN.ttf","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Caligraphic-Bold-ATXxdsX0.ttf","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Caligraphic-Bold-BEiXGLvX.woff","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Caligraphic-Bold-Dq_IR9rO.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Caligraphic-Regular-CTRA-rTL.woff","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Caligraphic-Regular-Di6jR-x-.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Caligraphic-Regular-wX97UBjC.ttf","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Fraktur-Bold-BdnERNNW.ttf","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Fraktur-Bold-BsDP51OF.woff","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Fraktur-Bold-CL6g_b3V.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Fraktur-Regular-CB_wures.ttf","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Fraktur-Regular-CTYiF6lA.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Fraktur-Regular-Dxdc4cR9.woff","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Main-Bold-Cx986IdX.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Main-Bold-Jm3AIy58.woff","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Main-Bold-waoOVXN0.ttf","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Main-BoldItalic-DxDJ3AOS.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Main-BoldItalic-DzxPMmG6.ttf","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Main-BoldItalic-SpSLRI95.woff","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Main-Italic-3WenGoN9.ttf","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Main-Italic-BMLOBm91.woff","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Main-Italic-NWA7e6Wa.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Main-Regular-B22Nviop.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Main-Regular-Dr94JaBh.woff","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Main-Regular-ypZvNtVU.ttf","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Math-BoldItalic-B3XSjfu4.ttf","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Math-BoldItalic-CZnvNsCZ.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Math-BoldItalic-iY-2wyZ7.woff","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Math-Italic-DA0__PXp.woff","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Math-Italic-flOr_0UB.ttf","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Math-Italic-t53AETM-.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_SansSerif-Bold-CFMepnvq.ttf","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_SansSerif-Bold-D1sUS0GD.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_SansSerif-Bold-DbIhKOiC.woff","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_SansSerif-Italic-C3H0VqGB.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_SansSerif-Italic-DN2j7dab.woff","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_SansSerif-Italic-YYjJ1zSn.ttf","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_SansSerif-Regular-BNo7hRIc.ttf","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_SansSerif-Regular-CS6fqUqJ.woff","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_SansSerif-Regular-DDBCnlJ7.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Script-Regular-C5JkGWo-.ttf","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Script-Regular-D3wIWfF6.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Script-Regular-D5yQViql.woff","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Size1-Regular-C195tn64.woff","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Size1-Regular-Dbsnue_I.ttf","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Size1-Regular-mCD8mA8B.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Size2-Regular-B7gKUWhC.ttf","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Size2-Regular-Dy4dx90m.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Size2-Regular-oD1tc_U0.woff","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Size3-Regular-CTq5MqoE.woff","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Size3-Regular-DgpXs0kz.ttf","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Size4-Regular-BF-4gkZK.woff","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Size4-Regular-DWFBv043.ttf","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Size4-Regular-Dl5lxZxV.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Typewriter-Regular-C0xS9mPB.woff","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Typewriter-Regular-CO6r4hn1.woff2","releases/1.2.1-cc1e2c88af6e/assets/KaTeX_Typewriter-Regular-D3Ib7_Hf.ttf","releases/1.2.1-cc1e2c88af6e/assets/LobbyControls-Ds9C4h4p.js","releases/1.2.1-cc1e2c88af6e/assets/abnfDiagram-S7VZAUFO-DBZHA5bR.js","releases/1.2.1-cc1e2c88af6e/assets/architectureDiagram-YGSQEFNW-BvHAcYS4.js","releases/1.2.1-cc1e2c88af6e/assets/blockDiagram-APKKGZFW-C1XxuUyz.js","releases/1.2.1-cc1e2c88af6e/assets/bpmnIcons-APHXDYXF-ByGoYv9M.js","releases/1.2.1-cc1e2c88af6e/assets/browser-DMN3_0Vc.js","releases/1.2.1-cc1e2c88af6e/assets/c4Diagram-KJ2TOQU5-CHz-6S4a.js","releases/1.2.1-cc1e2c88af6e/assets/chunk-2Q5K7J3B-GnZ0TsSO.js","releases/1.2.1-cc1e2c88af6e/assets/chunk-5VM5RSS4-BzTl0OO6.js","releases/1.2.1-cc1e2c88af6e/assets/chunk-HFQBQIA3-DkD3GHIh.js","releases/1.2.1-cc1e2c88af6e/assets/chunk-JWPE2WC7-CsndrCid.js","releases/1.2.1-cc1e2c88af6e/assets/chunk-KQLB2F66-D4neu6JZ.js","releases/1.2.1-cc1e2c88af6e/assets/chunk-KS47KZWR-7S5NeFBB.js","releases/1.2.1-cc1e2c88af6e/assets/chunk-OY52VR5R-ek6KPPiR.js","releases/1.2.1-cc1e2c88af6e/assets/chunk-TU62E6Q5-ChR-B3Lx.js","releases/1.2.1-cc1e2c88af6e/assets/chunk-XXDRQBXY-34kTc1bF.js","releases/1.2.1-cc1e2c88af6e/assets/classDiagram-v2-L25IHNXF-C-b1xRMH.js","releases/1.2.1-cc1e2c88af6e/assets/cose-bilkent-JH36ORCC-BmwZWLwX.js","releases/1.2.1-cc1e2c88af6e/assets/cynefin-EF2NZ3EQ-DgdJlMza.js","releases/1.2.1-cc1e2c88af6e/assets/cynefinDiagram-L36ESFBY-Ds8fxdKM.js","releases/1.2.1-cc1e2c88af6e/assets/cytoscape.esm-BHa1VTXv.js","releases/1.2.1-cc1e2c88af6e/assets/d3-scale-4DPf7zan.js","releases/1.2.1-cc1e2c88af6e/assets/dagre-SPEB5RXH-CXnW4WrR.js","releases/1.2.1-cc1e2c88af6e/assets/diagram-3B7GL73J-Bt6HtYmD.js","releases/1.2.1-cc1e2c88af6e/assets/diagram-DNEMPZML-Bl86WwU3.js","releases/1.2.1-cc1e2c88af6e/assets/diagram-L3MUGCDN-Di-aPjW2.js","releases/1.2.1-cc1e2c88af6e/assets/diagram-LA4NIPWU-5KdbXZMh.js","releases/1.2.1-cc1e2c88af6e/assets/diagram-MHCOC4E2-yP0wdQWL.js","releases/1.2.1-cc1e2c88af6e/assets/diagram-XPFHEONP-CfhXvHPm.js","releases/1.2.1-cc1e2c88af6e/assets/ebnfDiagram-UZSYDL2S-CTYLnz_c.js","releases/1.2.1-cc1e2c88af6e/assets/elk-XV6XMXQE-Do5dMTeN.js","releases/1.2.1-cc1e2c88af6e/assets/erDiagram-EYBAPDEH-BsEOJs5D.js","releases/1.2.1-cc1e2c88af6e/assets/exportWord-DwuerRG1.js","releases/1.2.1-cc1e2c88af6e/assets/flowDiagram-MALGAFMO-C65FFz5L.js","releases/1.2.1-cc1e2c88af6e/assets/ganttDiagram-23REXITY-DyrSe7v3.js","releases/1.2.1-cc1e2c88af6e/assets/gitGraphDiagram-STJD7YCW-d41LmboA.js","releases/1.2.1-cc1e2c88af6e/assets/graph-D8UmR1vK.js","releases/1.2.1-cc1e2c88af6e/assets/index-CAkJkD80.css","releases/1.2.1-cc1e2c88af6e/assets/index-DRxJxeLo.js","releases/1.2.1-cc1e2c88af6e/assets/infoDiagram-KBXO4MBG--Y2HtX9c.js","releases/1.2.1-cc1e2c88af6e/assets/ishikawaDiagram-M35NCXHK-C9wy9sub.js","releases/1.2.1-cc1e2c88af6e/assets/journeyDiagram-OPLOXDXO-B2Ed21dX.js","releases/1.2.1-cc1e2c88af6e/assets/kanban-definition-BZKZHSQY-DuQzkvFx.js","releases/1.2.1-cc1e2c88af6e/assets/katex-DbHk1ER-.js","releases/1.2.1-cc1e2c88af6e/assets/mermaid.core-DlYJZDkT.js","releases/1.2.1-cc1e2c88af6e/assets/mindmap-definition-I2QAS2VK-Di8mnArm.js","releases/1.2.1-cc1e2c88af6e/assets/pegDiagram-FD4XPPHP-Bf4MFlFA.js","releases/1.2.1-cc1e2c88af6e/assets/pieDiagram-J4AKIIQI-AzkNgRGh.js","releases/1.2.1-cc1e2c88af6e/assets/quadrantDiagram-XTYBLID2-DbPAtNBp.js","releases/1.2.1-cc1e2c88af6e/assets/railroadDiagram-MRQ6NCDL-DkF0amTq.js","releases/1.2.1-cc1e2c88af6e/assets/requirementDiagram-Y7LWUY3S-lG8LDZUw.js","releases/1.2.1-cc1e2c88af6e/assets/sankeyDiagram-WGJFYUXA-CPqdsiew.js","releases/1.2.1-cc1e2c88af6e/assets/sequenceDiagram-5NDRBG5M-STiCpJgu.js","releases/1.2.1-cc1e2c88af6e/assets/sizeCapture-INFHLROL-BHXdp6K-.js","releases/1.2.1-cc1e2c88af6e/assets/stateDiagram-v2-FJ4FJNEA-oXhgFmhE.js","releases/1.2.1-cc1e2c88af6e/assets/swimlanes-UMQ2AFYF-w6aEELWF.js","releases/1.2.1-cc1e2c88af6e/assets/swimlanesDiagram-OMPLPG4O-DXf2GG3m.js","releases/1.2.1-cc1e2c88af6e/assets/timeline-definition-SEUHKTQE-CSEu6uRF.js","releases/1.2.1-cc1e2c88af6e/assets/usecaseDiagram-AFA6YXN4-CvCyhvW6.js","releases/1.2.1-cc1e2c88af6e/assets/vennDiagram-NNMJR3RB-6pspJIV7.js","releases/1.2.1-cc1e2c88af6e/assets/wardleyDiagram-S7YFUSEH-DprLHYP4.js","releases/1.2.1-cc1e2c88af6e/assets/xychartDiagram-GGNKY7IX-D4-vh4Ip.js"].map(localUrl));

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
