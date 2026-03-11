// GET /api/views/ — return all view counts
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
  const list = await context.env.VIEWS.list();
  const views = {};
  for (const key of list.keys) {
    views[key.name] = parseInt(await context.env.VIEWS.get(key.name) || '0', 10);
  }
  return new Response(JSON.stringify(views), { headers: CORS_HEADERS });
}
