// Per-game ROM cache. EmulatorJS loads ROMs with HTTP Range requests, so this
// worker caches the WHOLE file (Cache Storage API) on first use and serves the
// requested byte-ranges out of it — a cached game replays instantly and stays
// until cleared, per game. Files bigger than MAX_CACHE_BYTES (e.g. 448MB PS1
// discs) are NOT cached: slicing them in memory would OOM the tab, so they pass
// straight through to the network. Great for small carts (Game Boy, NES, GBA).
const CACHE = 'arcade-rom-cache-v1';
const MAX_CACHE_BYTES = 120 * 1024 * 1024;

function isRom(url) {
  return /\.(chd|zip|pbp|bin|cue|iso|7z|img|ecm|gb|gbc|gba|nes|sfc|smc|n64|z64|md|gg|sms)(\?|$)/i.test(url);
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('message', (event) => {
  const { type, url } = event.data || {};
  const reply = (d) => event.ports[0] && event.ports[0].postMessage(d);
  if (type === 'list') {
    caches.open(CACHE).then((c) => c.keys()).then((k) => reply(k.map((r) => r.url))).catch(() => reply([]));
  } else if (type === 'clear' && url) {
    caches.open(CACHE).then((c) => c.delete(url)).then((ok) => reply({ ok })).catch(() => reply({ ok: false }));
  } else if (type === 'clearAll') {
    caches.delete(CACHE).then((ok) => reply({ ok })).catch(() => reply({ ok: false }));
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !isRom(req.url)) return;
  event.respondWith(handle(req));
});

async function handle(req) {
  const range = req.headers.get('range');
  const cache = await caches.open(CACHE);
  let full = await cache.match(req.url, { ignoreVary: true, ignoreSearch: false });

  if (!full) {
    // Cache-miss: only cache if the file is small enough to slice in memory.
    let size = 0;
    try { const h = await fetch(req.url, { method: 'HEAD' }); size = +(h.headers.get('content-length') || 0); } catch (_) {}
    if (size && size <= MAX_CACHE_BYTES) {
      try {
        const res = await fetch(req.url); // full download
        if (res.ok && res.status === 200) { await cache.put(req.url, res.clone()); full = res; }
      } catch (_) {}
    }
    if (!full) return fetch(req); // too big / failed → passthrough (keeps the Range)
  }

  if (!range) return full.clone();

  // Serve the requested byte range out of the cached full file.
  const buf = await full.clone().arrayBuffer();
  const m = /bytes=(\d+)-(\d*)/.exec(range);
  const start = m ? +m[1] : 0;
  const end = (m && m[2]) ? Math.min(+m[2], buf.byteLength - 1) : buf.byteLength - 1;
  const chunk = buf.slice(start, end + 1);
  return new Response(chunk, {
    status: 206,
    headers: {
      'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(chunk.byteLength),
      'Content-Type': full.headers.get('Content-Type') || 'application/octet-stream',
    },
  });
}
