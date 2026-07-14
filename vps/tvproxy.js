// tvproxy — HLS/M3U proxy on the getprivateride VPS (regular IP), so IPTV
// providers that block Cloudflare's egress IPs still work. Runs in Docker
// (node:20-alpine), bound to localhost, exposed via Cloudflare Tunnel at
// tvproxy.khalildrissi.com. No deps (Node 20 global fetch + streams).
//
// Routes:
//   /?url=<u>            proxy + rewrite an HLS/M3U for playback (segments same-origin, LIVE — no cache)
//   /?url=<u>&raw=1      fetch a playlist/JSON as raw text (NO rewrite), with a disk cache + serve-stale.
//                        Used to parse a source M3U or Xtream player_api.php JSON. Rate-limited IPTV
//                        providers return an empty 200 after a fetch or two; caching + serve-stale means
//                        the app keeps working instead of showing "server returned nothing".
//   /tv-store  GET ?p=   return the password-stored source (kind:url|text, value)
//   /tv-store  POST      {password, kind, value} -> store the source on the server
//   /health             ok
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const { Readable } = require('stream');

const STORE_PASS = 'Google101';
const STORE_FILE = '/data/stored.json';   // { kind:'url'|'text', value:'...' }
const CACHE_DIR = '/data/cache';          // raw=1 cache; filenames are URL hashes (URL contains creds)
const FRESH_MS = 6 * 3600 * 1000;         // serve cache without hitting upstream for 6h
try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch (e) {}

const CORS_BASE = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, X-TV-Source, X-TV-Age',
  'Vary': 'Origin',
};
// Reflect the request origin when it's one of ours (prod, GitHub Pages staging, or localhost dev).
const ALLOW_EXACT = ['https://khalildrissi.com', 'https://calildrissi.github.io'];
function corsFor(origin) {
  origin = origin || '';
  var ok = ALLOW_EXACT.indexOf(origin) !== -1 || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return Object.assign({ 'Access-Control-Allow-Origin': ok ? origin : 'https://khalildrissi.com' }, CORS_BASE);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const selfUrl = (u) => '/?url=' + encodeURIComponent(u);
const absUrl = (line, base) => { try { return new URL(line, base).href; } catch { return line; } };
function rewriteM3U(text, base) {
  return text.split('\n').map(function (raw) {
    const line = raw.replace(/\r$/, '');
    if (!line) return line;
    if (line[0] === '#') return line.replace(/URI="([^"]+)"/g, function (_, u) { return 'URI="' + selfUrl(absUrl(u, base)) + '"'; });
    return selfUrl(absUrl(line, base));
  }).join('\n');
}
function sendJson(res, status, obj, cors) {
  res.writeHead(status, Object.assign({}, cors, { 'Content-Type': 'application/json' }));
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise(function (resolve) {
    let b = ''; req.on('data', function (c) { b += c; if (b.length > 8e6) req.destroy(); });
    req.on('end', function () { resolve(b); }); req.on('error', function () { resolve(''); });
  });
}

// ---- raw=1 disk cache + serve-stale + single-flight ----
// The URL carries username/password, so the cache filename is a hash — creds never touch disk names.
const inflight = new Map();                                    // url -> Promise, so concurrent loads share one fetch
const cacheKey = (url) => crypto.createHash('sha256').update(url).digest('hex').slice(0, 32);
const cachePath = (key) => CACHE_DIR + '/' + key + '.m3u';
function cacheAge(p) { try { return Date.now() - fs.statSync(p).mtimeMs; } catch (e) { return Infinity; } }
function readCache(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; } }
function writeCache(p, text) { try { const t = p + '.tmp'; fs.writeFileSync(t, text); fs.renameSync(t, p); } catch (e) {} }
// A response is worth caching only if it's a real payload: an M3U (has #EXTM3U/#EXTINF) or valid JSON
// (Xtream player_api). A throttled provider returns an empty 200, which fails this and triggers serve-stale.
function isGoodBody(text, ok) {
  if (!ok) return false;
  const t = (text || '').trim();
  if (!t) return false;
  if (t.indexOf('#EXTM3U') !== -1 || t.indexOf('#EXTINF') !== -1) return true;
  if (t[0] === '{' || t[0] === '[') { try { JSON.parse(t); return true; } catch (e) { return false; } }
  return false;
}
async function fetchOnce(url) {
  const headers = { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20', 'Accept': '*/*' };
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, 45000);
  try {
    const up = await fetch(url, { headers: headers, redirect: 'follow', signal: ctrl.signal });
    const text = await up.text();
    return { ok: up.ok, text: text };
  } catch (e) { return { ok: false, text: '' }; }
  finally { clearTimeout(timer); }
}
// Returns { text, source: 'cache'|'live'|'stale'|'empty', age(sec) }.
async function getRaw(url) {
  const p = cachePath(cacheKey(url));
  const age = cacheAge(p);
  if (age < FRESH_MS) {                                        // warm cache: never hit the provider
    const c = readCache(p);
    if (c != null) return { text: c, source: 'cache', age: Math.round(age / 1000) };
  }
  if (inflight.has(url)) return inflight.get(url);             // coalesce concurrent loads (1-connection lines)
  const job = (async function () {
    let last = { ok: false, text: '' };
    for (let i = 0; i < 2; i++) {                              // 2 attempts; the line frees after a cooldown
      if (i > 0) await sleep(12000);
      last = await fetchOnce(url);
      if (isGoodBody(last.text, last.ok)) {
        writeCache(p, last.text);
        return { text: last.text, source: 'live', age: 0 };
      }
    }
    const stale = readCache(p);                                // throttled/empty → serve last good copy
    if (stale != null) return { text: stale, source: 'stale', age: Math.round(cacheAge(p) / 1000) };
    return { text: last.text, source: 'empty', age: -1 };      // nothing cached → preserve the app's error path
  })();
  inflight.set(url, job);
  try { return await job; } finally { inflight.delete(url); }
}

const server = http.createServer(async function (req, res) {
  try {
    const u = new URL(req.url, 'http://localhost');
    const CORS = corsFor(req.headers.origin);            // per-request: reflect an allowed origin
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
    if (u.pathname === '/health') { res.writeHead(200, CORS); return res.end('ok'); }

    // ---- password-gated stored source ----
    if (u.pathname === '/tv-store') {
      if (req.method === 'GET') {
        if (u.searchParams.get('p') !== STORE_PASS) return sendJson(res, 401, { error: 'unauthorized' }, CORS);
        let data = { kind: null, value: '' };
        try { data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')); } catch (e) {}
        return sendJson(res, 200, data, CORS);
      }
      if (req.method === 'POST') {
        let body = {}; try { body = JSON.parse(await readBody(req)); } catch (e) {}
        if (body.password !== STORE_PASS) return sendJson(res, 401, { error: 'wrong password' }, CORS);
        const kind = body.kind === 'text' ? 'text' : 'url';
        const value = (body.value || '').toString();
        if (!value.trim()) return sendJson(res, 400, { error: 'empty' }, CORS);
        try { fs.writeFileSync(STORE_FILE, JSON.stringify({ kind: kind, value: value })); }
        catch (e) { return sendJson(res, 500, { error: 'write failed' }, CORS); }
        return sendJson(res, 200, { ok: true }, CORS);
      }
      res.writeHead(405, CORS); return res.end('method');
    }

    // ---- HLS/M3U proxy ----
    const target = u.searchParams.get('url');
    if (!target) { res.writeHead(400, CORS); return res.end('missing url'); }
    let targetUrl;
    try { targetUrl = new URL(target); } catch (e) { res.writeHead(400, CORS); return res.end('bad url'); }
    if (!/^https?:$/.test(targetUrl.protocol)) { res.writeHead(400, CORS); return res.end('bad scheme'); }

    // Raw mode (playlist / Xtream JSON parsing): served from cache with serve-stale on throttle.
    // NOT used for live playback segments — those take the streaming path below and stay live.
    if (u.searchParams.get('raw') === '1') {
      const r = await getRaw(targetUrl.href);
      res.writeHead(200, Object.assign({}, CORS, {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-TV-Source': r.source,
        'X-TV-Age': String(r.age),
      }));
      return res.end(r.text);
    }

    // ---- live playback path (HLS rewrite + binary segments) — unchanged, never cached ----
    const headers = { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20', 'Accept': '*/*' };
    if (req.headers.range) headers.Range = req.headers.range;

    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, 45000);
    let upstream;
    try { upstream = await fetch(targetUrl.href, { headers: headers, redirect: 'follow', signal: ctrl.signal }); }
    catch (e) { clearTimeout(timer); res.writeHead(502, CORS); return res.end('upstream failed'); }
    clearTimeout(timer);

    const ct = (upstream.headers.get('content-type') || '').toLowerCase();
    const isPlaylist = /mpegurl|m3u8|x-mpegurl/.test(ct) || /\.m3u8($|\?)/i.test(targetUrl.pathname);
    if (isPlaylist) {
      const text = await upstream.text();
      res.writeHead(200, Object.assign({}, CORS, { 'Content-Type': 'application/vnd.apple.mpegurl' }));
      return res.end(rewriteM3U(text, upstream.url || targetUrl.href));
    }
    const h = Object.assign({}, CORS);
    ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'].forEach(function (k) {
      const v = upstream.headers.get(k); if (v) h[k] = v;
    });
    res.writeHead(upstream.status, h);
    if (!upstream.body) return res.end();
    Readable.fromWeb(upstream.body).pipe(res).on('error', function () { try { res.end(); } catch (e) {} });
  } catch (e) {
    try { res.writeHead(502, CORS); res.end('proxy error'); } catch (e2) {}
  }
});
server.listen(8080, '0.0.0.0', function () { console.log('tvproxy on 8080'); });
