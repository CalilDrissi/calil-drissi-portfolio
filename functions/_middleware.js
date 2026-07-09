// Redirect .pages.dev to custom domain + enforce canonical
export async function onRequest(context) {
  const url = new URL(context.request.url);

  // 301 redirect all .pages.dev requests with noindex header
  if (url.hostname.endsWith('.pages.dev')) {
    const destination = `https://khalildrissi.com${url.pathname}${url.search}`;
    return new Response(null, {
      status: 301,
      headers: {
        'Location': destination,
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  // Arcade: pass through untouched. Re-wrapping the response would drop the
  // WebSocket upgrade on /arcade/relay, and the arcade is intentionally noindex
  // (set via _headers), so don't force the canonical index/follow header here.
  if (url.pathname.startsWith('/arcade/')) return context.next();

  // On the custom domain, add canonical link header
  const response = await context.next();
  const canonical = `https://khalildrissi.com${url.pathname}`;
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Link', `<${canonical}>; rel="canonical"`);
  newResponse.headers.set('X-Robots-Tag', 'index, follow');
  return newResponse;
}
