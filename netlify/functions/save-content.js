// Netlify Function: save-content
// Handles reading and writing content files to the GitHub repo
// ENV vars needed: GITHUB_TOKEN, GITHUB_REPO, ADMIN_PASSWORD

const GITHUB_API = 'https://api.github.com';

async function githubRequest(method, path, body) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers: {
      'Authorization': `token ${process.env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `GitHub API error: ${res.status}`);
  return data;
}

function cors(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return cors({});
  }

  const repo = process.env.GITHUB_REPO; // e.g. "KhalilDrissi/khalil-drissi-portfolio"
  if (!repo || !process.env.GITHUB_TOKEN || !process.env.ADMIN_PASSWORD) {
    return cors({ error: 'Server not configured' }, 500);
  }

  // GET: Read a file or list a directory
  if (event.httpMethod === 'GET') {
    const filePath = event.queryStringParameters?.file;
    const listDir = event.queryStringParameters?.list;

    // List directory contents
    if (listDir) {
      if (!listDir.startsWith('content/')) return cors({ error: 'Access denied' }, 403);
      try {
        const data = await githubRequest('GET', `/repos/${repo}/contents/${listDir}`);
        if (!Array.isArray(data)) return cors({ files: [] });
        const files = data.filter(f => f.name.endsWith('.json')).map(f => f.name);
        return cors({ files });
      } catch (e) {
        if (e.message.includes('Not Found')) return cors({ files: [] });
        return cors({ error: e.message }, 500);
      }
    }

    // Read single file
    if (!filePath) return cors({ error: 'Missing file parameter' }, 400);
    if (!filePath.startsWith('content/')) return cors({ error: 'Access denied' }, 403);

    try {
      const data = await githubRequest('GET', `/repos/${repo}/contents/${filePath}`);
      const content = Buffer.from(data.content, 'base64').toString('utf8');
      return cors({ content: JSON.parse(content), sha: data.sha });
    } catch (e) {
      if (e.message.includes('Not Found')) return cors({ error: 'File not found' }, 404);
      return cors({ error: e.message }, 500);
    }
  }

  // POST: Write a file to the repo
  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return cors({ error: 'Invalid JSON' }, 400);
    }

    // Authenticate
    if (body.password !== process.env.ADMIN_PASSWORD) {
      return cors({ error: 'Invalid password' }, 401);
    }

    const { file, content } = body;
    if (!file || content === undefined) {
      return cors({ error: 'Missing file or content' }, 400);
    }

    // Validate path
    if (!file.startsWith('content/')) {
      return cors({ error: 'Access denied' }, 403);
    }

    try {
      // Get current file SHA (needed for updates)
      let sha;
      try {
        const existing = await githubRequest('GET', `/repos/${repo}/contents/${file}`);
        sha = existing.sha;
      } catch {
        // File doesn't exist yet — that's fine for new blog posts
      }

      const encoded = Buffer.from(JSON.stringify(content, null, 2)).toString('base64');
      const result = await githubRequest('PUT', `/repos/${repo}/contents/${file}`, {
        message: `CMS: Update ${file}`,
        content: encoded,
        sha,
      });

      return cors({ success: true, sha: result.content.sha });
    } catch (e) {
      return cors({ error: e.message }, 500);
    }
  }

  // DELETE: Remove a file from the repo
  if (event.httpMethod === 'DELETE') {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return cors({ error: 'Invalid JSON' }, 400);
    }

    if (body.password !== process.env.ADMIN_PASSWORD) {
      return cors({ error: 'Invalid password' }, 401);
    }

    const { file } = body;
    if (!file || !file.startsWith('content/blog/')) {
      return cors({ error: 'Can only delete blog posts' }, 403);
    }

    try {
      const existing = await githubRequest('GET', `/repos/${repo}/contents/${file}`);
      await githubRequest('DELETE', `/repos/${repo}/contents/${file}`, {
        message: `CMS: Delete ${file}`,
        sha: existing.sha,
      });
      return cors({ success: true });
    } catch (e) {
      return cors({ error: e.message }, 500);
    }
  }

  return cors({ error: 'Method not allowed' }, 405);
};
