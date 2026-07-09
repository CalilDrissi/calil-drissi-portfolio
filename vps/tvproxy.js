// tvproxy — HLS/M3U proxy on the getprivateride VPS (regular IP), so IPTV
// providers that block Cloudflare's egress IPs still work. Runs in Docker
// (node:20-alpine), bound to localhost, exposed via Cloudflare Tunnel at
// tvproxy.khalildrissi.com. No deps (Node 20 global fetch + streams).
//
// Routes:
//   /?url=<u>            proxy + rewrite an HLS/M3U for playback (segments same-origin)
//   /?url=<u>&raw=1      fetch a playlist as raw text (NO rewrite) — for parsing a source M3U
//   /tv-store  GET ?p=   return the password-stored M3U (kind:url|text, value)
//   /tv-store  POST      {password, kind, value} -> store the M3U on the server
//   /health             ok
const http = require('http');
const fs = require('fs');
const { Readable } = require('stream');

const STORE_PASS = 'Google101';
const STORE_FILE = '/data/stored.json';   // { kind:'url'|'text', value:'...' }

const CORS = {
  'Access-Control-Allow-Origin': 'https://khalildrissi.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
  'Vary': 'Origin',
};
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
function sendJson(res, status, obj) {
  res.writeHead(status, Object.assign({}, CORS, { 'Content-Type': 'application/json' }));
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise(function (resolve) {
    let b = ''; req.on('data', function (c) { b += c; if (b.length > 8e6) req.destroy(); });
    req.on('end', function () { resolve(b); }); req.on('error', function () { resolve(''); });
  });
}

const server = http.createServer(async function (req, res) {
  try {
    const u = new URL(req.url, 'http://localhost');
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
    if (u.pathname === '/health') { res.writeHead(200, CORS); return res.end('ok'); }

    // ---- password-gated stored M3U ----
    if (u.pathname === '/tv-store') {
      if (req.method === 'GET') {
        if (u.searchParams.get('p') !== STORE_PASS) return sendJson(res, 401, { error: 'unauthorized' });
        let data = { kind: null, value: '' };
        try { data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')); } catch (e) {}
        return sendJson(res, 200, data);
      }
      if (req.method === 'POST') {
        let body = {}; try { body = JSON.parse(await readBody(req)); } catch (e) {}
        if (body.password !== STORE_PASS) return sendJson(res, 401, { error: 'wrong password' });
        const kind = body.kind === 'text' ? 'text' : 'url';
        const value = (body.value || '').toString();
        if (!value.trim()) return sendJson(res, 400, { error: 'empty' });
        try { fs.writeFileSync(STORE_FILE, JSON.stringify({ kind: kind, value: value })); }
        catch (e) { return sendJson(res, 500, { error: 'write failed' }); }
        return sendJson(res, 200, { ok: true });
      }
      res.writeHead(405, CORS); return res.end('method');
    }

    // ---- HLS/M3U proxy ----
    const target = u.searchParams.get('url');
    if (!target) { res.writeHead(400, CORS); return res.end('missing url'); }
    let targetUrl;
    try { targetUrl = new URL(target); } catch (e) { res.writeHead(400, CORS); return res.end('bad url'); }
    if (!/^https?:$/.test(targetUrl.protocol)) { res.writeHead(400, CORS); return res.end('bad scheme'); }

    const headers = { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20', 'Accept': '*/*' };
    if (req.headers.range) headers.Range = req.headers.range;

    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, 45000);
    let upstream;
    try { upstream = await fetch(targetUrl.href, { headers: headers, redirect: 'follow', signal: ctrl.signal }); }
    catch (e) { clearTimeout(timer); res.writeHead(502, CORS); return res.end('upstream failed'); }
    clearTimeout(timer);

    // Raw mode: return the fetched playlist as text WITHOUT rewriting (parse a source M3U).
    if (u.searchParams.get('raw') === '1') {
      const text = await upstream.text();
      res.writeHead(200, Object.assign({}, CORS, { 'Content-Type': 'text/plain; charset=utf-8' }));
      return res.end(text);
    }

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
