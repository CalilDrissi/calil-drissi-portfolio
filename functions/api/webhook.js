// Cloudflare Pages Function: WordPress webhook handler
// Receives post publish/update/delete events from WP and triggers GitHub Actions rebuild
// ENV vars needed: GITHUB_TOKEN, GITHUB_REPO, WEBHOOK_SECRET

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Webhook-Secret',
    },
  });
}

export async function onRequestOptions() {
  return jsonResponse({});
}

export async function onRequestPost(context) {
  const { env } = context;
  const { GITHUB_TOKEN, GITHUB_REPO, WEBHOOK_SECRET } = env;

  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    return jsonResponse({ error: 'Server not configured' }, 500);
  }

  // Verify webhook secret
  if (WEBHOOK_SECRET) {
    const secret = context.request.headers.get('X-Webhook-Secret');
    if (secret !== WEBHOOK_SECRET) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
  }

  // Parse the payload (WP sends post data, but we only need the action)
  let payload;
  try {
    payload = await context.request.json();
  } catch {
    // Some WP plugins send form-encoded data
    payload = {};
  }

  // Trigger GitHub repository_dispatch
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'khalildrissi-webhook',
      },
      body: JSON.stringify({
        event_type: 'wordpress_publish',
        client_payload: {
          action: payload.action || 'unknown',
          post_id: payload.post_id || payload.ID || null,
          timestamp: new Date().toISOString(),
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return jsonResponse({ error: `GitHub API error: ${res.status}`, details: text }, 502);
    }

    return jsonResponse({ success: true, message: 'Rebuild triggered' });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}
