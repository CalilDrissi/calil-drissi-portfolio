// Redirect .pages.dev to custom domain
export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.hostname.endsWith('.pages.dev')) {
    const destination = `https://khalildrissi.com${url.pathname}${url.search}`;
    return Response.redirect(destination, 301);
  }

  return context.next();
}
