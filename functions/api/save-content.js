// Cloudflare Pages Function: save-content
// Handles reading and writing content files to the GitHub repo
// ENV vars needed: GITHUB_TOKEN, GITHUB_REPO, ADMIN_PASSWORD

const GITHUB_API = 'https://api.github.com';

async function githubRequest(method, path, body, env) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers: {
      'Authorization': `token ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `GitHub API error: ${res.status}`);
  return data;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    },
  });
}

// CORS preflight
export async function onRequestOptions() {
  return jsonResponse({});
}

// GET: Read a file or list a directory
export async function onRequestGet(context) {
  const { env } = context;
  const url = new URL(context.request.url);
  const repo = env.GITHUB_REPO;

  if (!repo || !env.GITHUB_TOKEN || !env.ADMIN_PASSWORD) {
    return jsonResponse({ error: 'Server not configured' }, 500);
  }

  const filePath = url.searchParams.get('file');
  const listDir = url.searchParams.get('list');

  // List directory contents
  if (listDir) {
    if (!listDir.startsWith('content/')) return jsonResponse({ error: 'Access denied' }, 403);
    try {
      const data = await githubRequest('GET', `/repos/${repo}/contents/${listDir}`, null, env);
      if (!Array.isArray(data)) return jsonResponse({ files: [] });
      const files = data.filter(f => f.name.endsWith('.json')).map(f => f.name);
      return jsonResponse({ files });
    } catch (e) {
      if (e.message.includes('Not Found')) return jsonResponse({ files: [] });
      return jsonResponse({ error: e.message }, 500);
    }
  }

  // Read single file
  if (!filePath) return jsonResponse({ error: 'Missing file parameter' }, 400);
  if (!filePath.startsWith('content/')) return jsonResponse({ error: 'Access denied' }, 403);

  try {
    const data = await githubRequest('GET', `/repos/${repo}/contents/${filePath}`, null, env);
    const content = JSON.parse(atob(data.content));
    return jsonResponse({ content, sha: data.sha });
  } catch (e) {
    if (e.message.includes('Not Found')) return jsonResponse({ error: 'File not found' }, 404);
    return jsonResponse({ error: e.message }, 500);
  }
}

// POST: Write a file to the repo
export async function onRequestPost(context) {
  const { env } = context;
  const repo = env.GITHUB_REPO;

  if (!repo || !env.GITHUB_TOKEN || !env.ADMIN_PASSWORD) {
    return jsonResponse({ error: 'Server not configured' }, 500);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (body.password !== env.ADMIN_PASSWORD) {
    return jsonResponse({ error: 'Invalid password' }, 401);
  }

  const { file, content } = body;
  if (!file || content === undefined) {
    return jsonResponse({ error: 'Missing file or content' }, 400);
  }

  if (!file.startsWith('content/')) {
    return jsonResponse({ error: 'Access denied' }, 403);
  }

  try {
    let sha;
    try {
      const existing = await githubRequest('GET', `/repos/${repo}/contents/${file}`, null, env);
      sha = existing.sha;
    } catch {
      // File doesn't exist yet
    }

    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2))));
    const result = await githubRequest('PUT', `/repos/${repo}/contents/${file}`, {
      message: `CMS: Update ${file}`,
      content: encoded,
      sha,
    }, env);

    return jsonResponse({ success: true, sha: result.content.sha });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

// DELETE: Remove a file from the repo
export async function onRequestDelete(context) {
  const { env } = context;
  const repo = env.GITHUB_REPO;

  if (!repo || !env.GITHUB_TOKEN || !env.ADMIN_PASSWORD) {
    return jsonResponse({ error: 'Server not configured' }, 500);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (body.password !== env.ADMIN_PASSWORD) {
    return jsonResponse({ error: 'Invalid password' }, 401);
  }

  const { file } = body;
  if (!file || !file.startsWith('content/blog/')) {
    return jsonResponse({ error: 'Can only delete blog posts' }, 403);
  }

  try {
    const existing = await githubRequest('GET', `/repos/${repo}/contents/${file}`, null, env);
    await githubRequest('DELETE', `/repos/${repo}/contents/${file}`, {
      message: `CMS: Delete ${file}`,
      sha: existing.sha,
    }, env);
    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}
