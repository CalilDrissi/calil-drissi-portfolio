// Cloudflare Pages Function — per-post view counter using KV
// KV namespace binding: VIEWS (must be configured in Cloudflare dashboard)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

// GET /api/views/:slug — return current count
export async function onRequestGet(context) {
  const slug = context.params.slug;
  if (!slug) return new Response(JSON.stringify({ error: 'Missing slug' }), { status: 400, headers: CORS_HEADERS });

  const count = parseInt(await context.env.VIEWS.get(slug) || '0', 10);
  return new Response(JSON.stringify({ slug, views: count }), { headers: CORS_HEADERS });
}

// POST /api/views/:slug — increment and return new count
export async function onRequestPost(context) {
  const slug = context.params.slug;
  if (!slug) return new Response(JSON.stringify({ error: 'Missing slug' }), { status: 400, headers: CORS_HEADERS });

  const current = parseInt(await context.env.VIEWS.get(slug) || '0', 10);
  const next = current + 1;
  await context.env.VIEWS.put(slug, String(next));
  return new Response(JSON.stringify({ slug, views: next }), { headers: CORS_HEADERS });
}
