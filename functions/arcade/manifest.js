// Per-game PWA manifest, served from a real same-origin URL so Chrome reliably
// offers "Install" (blob:/data: manifests are hit-or-miss). player.html links
//   /arcade/manifest?rom=<rom>&name=<title>&core=<core>[&id=<n>]
// and the returned manifest launches straight into that one game.
export function onRequest({ request }) {
  const url = new URL(request.url);
  const p = url.searchParams;
  const rom = p.get('rom') || '';
  const name = (p.get('name') || 'Arcade Game').slice(0, 60);
  const core = p.get('core') || '';
  const id = p.get('id') || '';
  const origin = url.origin;

  const start = origin + '/arcade/player?rom=' + encodeURIComponent(rom) +
    '&name=' + encodeURIComponent(name) + '&core=' + encodeURIComponent(core) +
    (id ? '&id=' + encodeURIComponent(id) : '');

  // Distinct icon per game: the title's initial on a dark tile (SVG, no assets).
  const letter = ((name.trim()[0] || 'A').toUpperCase()).replace(/[<>&"']/g, '');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">' +
    '<rect width="512" height="512" fill="#0a0a0c"/>' +
    '<rect x="46" y="46" width="420" height="420" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="9"/>' +
    '<text x="256" y="300" font-family="system-ui,Arial,sans-serif" font-size="260" font-weight="700" ' +
    'fill="#ffffff" text-anchor="middle">' + letter + '</text></svg>';
  const icon = 'data:image/svg+xml,' + encodeURIComponent(svg);

  const manifest = {
    id: 'arcade-game-' + (id || rom),
    name: name,
    short_name: name.length > 12 ? name.slice(0, 12) : name,
    start_url: start,
    scope: origin + '/arcade/',
    display: 'standalone',
    orientation: 'landscape',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [{ src: icon, sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      'content-type': 'application/manifest+json; charset=utf-8',
      'cache-control': 'public, max-age=3600',
      'x-robots-tag': 'noindex',
    },
  });
}
