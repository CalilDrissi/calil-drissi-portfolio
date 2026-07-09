// HLS / M3U proxy — adds CORS so IPTV streams and playlists play in the browser,
// and lets authenticated sources (Xtream get.php, basic-auth URLs) work too.
//   /api/tv?url=<encoded stream or playlist URL>
// For .m3u8 playlists it rewrites every variant/segment/key URL to route back
// through this proxy, so the whole HLS chain is same-origin + CORS-clean.
// ponytail: personal-scale proxy; all video flows through the Function (fine for
// light traffic). Cap upgrade path: move to a dedicated stream proxy if it grows.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

const self = (u) => '/api/tv?url=' + encodeURIComponent(u);
const abs = (line, base) => { try { return new URL(line, base).href; } catch { return line; } };

function rewriteM3U(text, baseUrl) {
  const out = [];
  for (let raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line) { out.push(line); continue; }
    if (line[0] === '#') {
      // Rewrite URIs embedded in tags (encryption keys, alternate media renditions).
      out.push(line.replace(/URI="([^"]+)"/g, (_, u) => 'URI="' + self(abs(u, baseUrl)) + '"'));
    } else {
      // A bare line is a variant-playlist or segment URL.
      out.push(self(abs(line, baseUrl)));
    }
  }
  return out.join('\n');
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const target = url.searchParams.get('url');
  if (!target) return new Response('missing url', { status: 400, headers: CORS });
  let targetUrl;
  try { targetUrl = new URL(target); } catch { return new Response('bad url', { status: 400, headers: CORS }); }
  if (!/^https?:$/.test(targetUrl.protocol)) return new Response('bad scheme', { status: 400, headers: CORS });

  // Forward Range (seek/segment) requests; spoof a player UA so pickier servers respond.
  const fwd = { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20', 'Accept': '*/*' };
  const range = request.headers.get('Range');
  if (range) fwd.Range = range;

  let upstream;
  try {
    upstream = await fetch(targetUrl.href, { headers: fwd, redirect: 'follow' });
  } catch (e) {
    return new Response('upstream fetch failed: ' + (e && e.message), { status: 502, headers: CORS });
  }
  if (!upstream.ok && upstream.status !== 206) {
    return new Response('upstream ' + upstream.status, { status: upstream.status, headers: CORS });
  }

  const ct = (upstream.headers.get('content-type') || '').toLowerCase();
  const isPlaylist = /mpegurl|m3u8|x-mpegurl/.test(ct) || /\.m3u8($|\?)/i.test(targetUrl.pathname);

  if (isPlaylist) {
    const text = await upstream.text();
    return new Response(rewriteM3U(text, upstream.url || targetUrl.href), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/vnd.apple.mpegurl' },
    });
  }

  // Segment / media: stream through untouched, preserving range/type headers.
  const h = new Headers(CORS);
  for (const k of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges', 'Cache-Control']) {
    const v = upstream.headers.get(k);
    if (v) h.set(k, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers: h });
}
