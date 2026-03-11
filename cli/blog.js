#!/usr/bin/env node
/**
 * Blog CLI — Publish posts to WordPress from the terminal.
 *
 * Usage:
 *   node cli/blog.js publish              Interactive post creation
 *   node cli/blog.js publish --file post.md   Publish from markdown file
 *   node cli/blog.js list                 List recent posts
 *   node cli/blog.js delete <id>          Trash a post
 *   node cli/blog.js categories           List categories
 *   node cli/blog.js tags                 List tags
 *   node cli/blog.js upload <file>        Upload media, print URL
 *
 * Markdown file front-matter (YAML between ---):
 *   title, excerpt, category, tags (comma-sep), lang (en|fr),
 *   featured_image (local path or URL), status (draft|publish)
 *
 * Requires: WP_URL, WP_USER, WP_APP_PASSWORD in ../.env
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const https = require('https');
const http = require('http');

// ── Load .env ──────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  });
}

const WP_URL = process.env.WP_URL;
const WP_USER = process.env.WP_USER;
const WP_PASS = process.env.WP_APP_PASSWORD;

if (!WP_URL || !WP_USER || !WP_PASS) {
  console.error('Missing WP_URL, WP_USER, or WP_APP_PASSWORD in .env');
  process.exit(1);
}

const AUTH = 'Basic ' + Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');
const API = `${WP_URL}/wp-json/wp/v2`;

// ── Helpers ────────────────────────────────────────────

function ask(question, defaultVal) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultVal ? ` [${defaultVal}]` : '';
  return new Promise(resolve => {
    rl.question(`${question}${suffix}: `, answer => {
      rl.close();
      resolve(answer.trim() || defaultVal || '');
    });
  });
}

function askMultiline(prompt) {
  console.log(`${prompt} (end with an empty line):`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const lines = [];
  return new Promise(resolve => {
    rl.on('line', line => {
      if (line === '') { rl.close(); resolve(lines.join('\n')); }
      else lines.push(line);
    });
  });
}

function wpFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API}${endpoint}`;
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const headers = { Authorization: AUTH, ...options.headers };
    if (options.json) {
      headers['Content-Type'] = 'application/json';
    }
    const req = mod.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers,
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        try {
          const data = JSON.parse(body);
          if (res.statusCode >= 400) reject(new Error(`WP ${res.statusCode}: ${data.message || body}`));
          else resolve(data);
        } catch {
          if (res.statusCode >= 400) reject(new Error(`WP ${res.statusCode}: ${body}`));
          else resolve(body);
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function wpUploadMedia(filePath) {
  const fileName = path.basename(filePath);
  const fileData = fs.readFileSync(filePath);
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4', '.pdf': 'application/pdf',
  };
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  return new Promise((resolve, reject) => {
    const parsed = new URL(`${API}/media`);
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        Authorization: AUTH,
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileData.length,
      },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        try {
          const data = JSON.parse(body);
          if (res.statusCode >= 400) reject(new Error(`Upload failed: ${data.message || body}`));
          else resolve(data);
        } catch {
          reject(new Error(`Upload failed: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(fileData);
    req.end();
  });
}

async function getOrCreateCategory(name) {
  const cats = await wpFetch(`/categories?search=${encodeURIComponent(name)}&per_page=100`);
  const match = cats.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (match) return match.id;
  try {
    const created = await wpFetch('/categories', {
      method: 'POST', json: true,
      body: JSON.stringify({ name }),
    });
    return created.id;
  } catch (err) {
    console.log(`  ⚠ Could not create category "${name}": ${err.message}`);
    return 0;
  }
}

async function getOrCreateTag(name) {
  const tags = await wpFetch(`/tags?search=${encodeURIComponent(name)}&per_page=100`);
  const match = tags.find(t => t.name.toLowerCase() === name.toLowerCase());
  if (match) return match.id;
  try {
    const created = await wpFetch('/tags', {
      method: 'POST', json: true,
      body: JSON.stringify({ name }),
    });
    return created.id;
  } catch (err) {
    console.log(`  ⚠ Could not create tag "${name}": ${err.message}`);
    return 0;
  }
}

async function getOrCreateTagIds(tagString) {
  if (!tagString) return [];
  const names = tagString.split(',').map(t => t.trim()).filter(Boolean);
  const ids = [];
  for (const name of names) {
    const id = await getOrCreateTag(name);
    if (id) ids.push(id);
  }
  return ids;
}

// ── Polylang helpers ───────────────────────────────────

let polylangAvailable = null;

async function checkPolylang() {
  if (polylangAvailable !== null) return polylangAvailable;
  try {
    // Check for Polylang REST API routes
    const index = await wpFetch(`${WP_URL}/wp-json/`);
    const routes = Object.keys(index.routes || {});
    polylangAvailable = routes.some(r => r.includes('pll') || r.includes('polylang'));
  } catch {
    polylangAvailable = false;
  }
  return polylangAvailable;
}

async function setPostLanguage(postId, lang) {
  const hasPll = await checkPolylang();
  if (!hasPll) {
    console.log('  ⚠ Polylang not detected — skipping language assignment');
    return null;
  }
  // Polylang Pro REST: set lang via post meta or dedicated endpoint
  // Try setting via post update with `lang` field (Polylang REST integration)
  try {
    await wpFetch(`/posts/${postId}`, {
      method: 'POST', json: true,
      body: JSON.stringify({ lang }),
    });
    console.log(`  ✓ Language set to ${lang}`);
  } catch (err) {
    // Fallback: try Polylang's own endpoint
    try {
      await wpFetch(`${WP_URL}/wp-json/pll/v1/posts/${postId}`, {
        method: 'POST', json: true,
        body: JSON.stringify({ lang }),
      });
      console.log(`  ✓ Language set to ${lang} (via pll)`);
    } catch {
      console.log(`  ⚠ Could not set language: ${err.message}`);
    }
  }
}

async function linkTranslations(postIdA, langA, postIdB, langB) {
  const hasPll = await checkPolylang();
  if (!hasPll) return;
  try {
    // Polylang Pro REST: link translations
    const translations = { [langA]: postIdA, [langB]: postIdB };
    await wpFetch(`${WP_URL}/wp-json/pll/v1/posts/${postIdA}`, {
      method: 'POST', json: true,
      body: JSON.stringify({ translations }),
    });
    console.log(`  ✓ Linked ${langA}:${postIdA} ↔ ${langB}:${postIdB}`);
  } catch (err) {
    console.log(`  ⚠ Could not link translations: ${err.message}`);
  }
}

// ── Markdown front-matter parser ───────────────────────

function parseMarkdown(content) {
  const frontMatter = {};
  let body = content;
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (match) {
    match[1].split('\n').forEach(line => {
      const m = line.match(/^(\w[\w_]*)\s*:\s*(.*)$/);
      if (m) frontMatter[m[1].trim()] = m[2].trim();
    });
    body = match[2];
  }
  return { frontMatter, body };
}

// ── Inline images: find ![alt](path) and upload ───────

async function processInlineImages(body, basePath) {
  // Strip code blocks before scanning for images
  const codeBlocks = [];
  const stripped = body.replace(/```[\s\S]*?```/g, m => { codeBlocks.push(m); return `__CODE_BLOCK_${codeBlocks.length - 1}__`; });
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let result = stripped;
  const matches = [...stripped.matchAll(imgRegex)];

  for (const m of matches) {
    const imgPath = m[2];
    // Skip URLs
    if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) continue;

    const absPath = path.isAbsolute(imgPath) ? imgPath : path.resolve(basePath, imgPath);
    if (!fs.existsSync(absPath)) {
      console.log(`  ⚠ Image not found: ${absPath}`);
      continue;
    }

    console.log(`  ↑ Uploading inline image: ${path.basename(absPath)}`);
    const media = await wpUploadMedia(absPath);
    const wpUrl = media.source_url;
    console.log(`    → ${wpUrl}`);
    result = result.replace(m[0], `![${m[1]}](${wpUrl})`);
  }

  // Restore code blocks
  codeBlocks.forEach((block, i) => { result = result.replace(`__CODE_BLOCK_${i}__`, block); });
  return result;
}

// ── Simple Markdown to HTML ────────────────────────────

function mdToHtml(md) {
  let html = md
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="language-${lang || 'text'}">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim()}</code></pre>`)
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr />')
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Unordered list
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Ordered list
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Wrap remaining bare lines in <p>
  html = html.split('\n\n').map(block => {
    block = block.trim();
    if (!block) return '';
    if (block.startsWith('<')) return block;
    return `<p>${block.replace(/\n/g, '<br />')}</p>`;
  }).join('\n\n');

  return html;
}

// ── Commands ───────────────────────────────────────────

async function cmdList() {
  const posts = await wpFetch('/posts?per_page=20&orderby=date&order=desc');
  if (!posts.length) { console.log('No posts found.'); return; }
  console.log('\n  ID     Status    Date         Title');
  console.log('  ' + '─'.repeat(60));
  posts.forEach(p => {
    const date = p.date.slice(0, 10);
    const status = p.status.padEnd(9);
    console.log(`  ${String(p.id).padEnd(6)} ${status} ${date}   ${p.title.rendered}`);
  });
  console.log();
}

async function cmdCategories() {
  const cats = await wpFetch('/categories?per_page=100');
  console.log('\n  Categories:');
  cats.forEach(c => console.log(`    ${c.id}: ${c.name} (${c.count} posts)`));
  console.log();
}

async function cmdTags() {
  const tags = await wpFetch('/tags?per_page=100');
  if (!tags.length) { console.log('No tags yet.'); return; }
  console.log('\n  Tags:');
  tags.forEach(t => console.log(`    ${t.id}: ${t.name} (${t.count} posts)`));
  console.log();
}

async function cmdUpload(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }
  console.log(`Uploading ${path.basename(filePath)}...`);
  const media = await wpUploadMedia(filePath);
  console.log(`  ✓ Uploaded: ${media.source_url}`);
  console.log(`  ID: ${media.id}`);
}

async function cmdDelete(id) {
  if (!id) { console.error('Usage: blog.js delete <post-id>'); process.exit(1); }
  await wpFetch(`/posts/${id}`, { method: 'DELETE', json: true, body: JSON.stringify({ force: false }) });
  console.log(`  ✓ Post ${id} moved to trash.`);
}

async function cmdPublish(filePath) {
  let title, excerpt, body, category, tags, lang, status, featuredImagePath;

  if (filePath && fs.existsSync(filePath)) {
    // ── From markdown file ─────────────────────────────
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = parseMarkdown(raw);
    const fm = parsed.frontMatter;

    title = fm.title || path.basename(filePath, path.extname(filePath));
    excerpt = fm.excerpt || '';
    category = fm.category || '';
    tags = fm.tags || '';
    lang = fm.lang || 'en';
    status = fm.status || 'draft';
    featuredImagePath = fm.featured_image || '';

    // Process inline images (upload local paths)
    const basePath = path.dirname(path.resolve(filePath));
    body = await processInlineImages(parsed.body, basePath);
  } else {
    // ── Interactive mode ───────────────────────────────
    console.log('\n  ✎ New Blog Post\n');
    title = await ask('  Title');
    if (!title) { console.error('Title is required.'); process.exit(1); }
    excerpt = await ask('  Excerpt (short summary)');
    category = await ask('  Category', 'Uncategorized');
    tags = await ask('  Tags (comma-separated)');
    lang = await ask('  Language', 'en');
    status = await ask('  Status (draft/publish)', 'draft');
    featuredImagePath = await ask('  Featured image (local path or URL, or blank)');
    console.log();
    body = await askMultiline('  Post body (Markdown)');
  }

  console.log('\n  Publishing...');

  // Upload featured image if local path
  let featuredMediaId = 0;
  if (featuredImagePath) {
    if (featuredImagePath.startsWith('http://') || featuredImagePath.startsWith('https://')) {
      console.log('  ⚠ Featured image is a URL — upload it first with `blog.js upload`');
    } else {
      const absPath = path.isAbsolute(featuredImagePath) ? featuredImagePath : path.resolve(featuredImagePath);
      if (fs.existsSync(absPath)) {
        console.log(`  ↑ Uploading featured image: ${path.basename(absPath)}`);
        const media = await wpUploadMedia(absPath);
        featuredMediaId = media.id;
        console.log(`    → ${media.source_url}`);
      } else {
        console.log(`  ⚠ Featured image not found: ${absPath}`);
      }
    }
  }

  // Convert markdown body to HTML
  const htmlContent = mdToHtml(body);

  // Resolve category
  const categoryId = category ? await getOrCreateCategory(category) : 0;
  console.log(`  ✓ Category: ${category || 'none'} (ID: ${categoryId})`);

  // Resolve tags
  const tagIds = await getOrCreateTagIds(tags);
  if (tagIds.length) console.log(`  ✓ Tags: ${tags} (IDs: ${tagIds.join(', ')})`);

  // Create post
  const postData = {
    title,
    content: htmlContent,
    excerpt,
    status,
    categories: categoryId ? [categoryId] : [],
    tags: tagIds,
  };
  if (featuredMediaId) postData.featured_media = featuredMediaId;

  const post = await wpFetch('/posts', {
    method: 'POST', json: true,
    body: JSON.stringify(postData),
  });

  console.log(`  ✓ Post created: ID ${post.id}`);
  console.log(`    Title: ${post.title.rendered}`);
  console.log(`    Status: ${post.status}`);
  console.log(`    URL: ${post.link}`);

  // Set language if Polylang is available
  if (lang) {
    await setPostLanguage(post.id, lang);
  }

  // Ask about translation
  if (lang === 'en') {
    const translateFr = await ask('\n  Create French translation too? (y/n)', 'n');
    if (translateFr.toLowerCase() === 'y') {
      console.log('\n  ✎ French Translation\n');
      const frTitle = await ask('  Title (FR)');
      const frExcerpt = await ask('  Excerpt (FR)', excerpt);
      const frBody = await askMultiline('  Post body in French (Markdown)');
      const frHtml = mdToHtml(frBody);

      const frPostData = {
        title: frTitle || title,
        content: frHtml,
        excerpt: frExcerpt,
        status,
        categories: categoryId ? [categoryId] : [],
        tags: tagIds,
      };
      if (featuredMediaId) frPostData.featured_media = featuredMediaId;

      const frPost = await wpFetch('/posts', {
        method: 'POST', json: true,
        body: JSON.stringify(frPostData),
      });
      console.log(`  ✓ FR post created: ID ${frPost.id}`);
      console.log(`    URL: ${frPost.link}`);

      await setPostLanguage(frPost.id, 'fr');
      await linkTranslations(post.id, 'en', frPost.id, 'fr');
    }
  } else if (lang === 'fr') {
    const translateEn = await ask('\n  Create English translation too? (y/n)', 'n');
    if (translateEn.toLowerCase() === 'y') {
      console.log('\n  ✎ English Translation\n');
      const enTitle = await ask('  Title (EN)');
      const enExcerpt = await ask('  Excerpt (EN)', excerpt);
      const enBody = await askMultiline('  Post body in English (Markdown)');
      const enHtml = mdToHtml(enBody);

      const enPostData = {
        title: enTitle || title,
        content: enHtml,
        excerpt: enExcerpt,
        status,
        categories: categoryId ? [categoryId] : [],
        tags: tagIds,
      };
      if (featuredMediaId) enPostData.featured_media = featuredMediaId;

      const enPost = await wpFetch('/posts', {
        method: 'POST', json: true,
        body: JSON.stringify(enPostData),
      });
      console.log(`  ✓ EN post created: ID ${enPost.id}`);
      console.log(`    URL: ${enPost.link}`);

      await setPostLanguage(enPost.id, 'en');
      await linkTranslations(enPost.id, 'en', post.id, 'fr');
    }
  }

  // Rebuild site
  const rebuild = await ask('\n  Rebuild site now? (y/n)', 'y');
  if (rebuild.toLowerCase() === 'y') {
    console.log('\n  Building site...');
    const { execSync } = require('child_process');
    try {
      execSync('node build.js', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
      console.log('  ✓ Site rebuilt');
    } catch {
      console.log('  ⚠ Build failed');
    }
  }

  console.log('\n  Done!\n');
}

// ── Main ───────────────────────────────────────────────

const [,, cmd, ...args] = process.argv;

(async () => {
  try {
    switch (cmd) {
      case 'publish':  await cmdPublish(args.find(a => !a.startsWith('-')) || (args.includes('--file') ? args[args.indexOf('--file') + 1] : null)); break;
      case 'list':     await cmdList(); break;
      case 'categories': await cmdCategories(); break;
      case 'tags':     await cmdTags(); break;
      case 'upload':   await cmdUpload(args[0]); break;
      case 'delete':   await cmdDelete(args[0]); break;
      default:
        console.log(`
  Blog CLI — Publish to WordPress from the terminal

  Usage:
    node cli/blog.js publish                 Interactive post creation
    node cli/blog.js publish post.md         Publish from markdown file
    node cli/blog.js list                    List recent posts
    node cli/blog.js delete <id>             Trash a post
    node cli/blog.js categories              List categories
    node cli/blog.js tags                    List tags
    node cli/blog.js upload <file>           Upload media

  Markdown front-matter:
    ---
    title: My Post Title
    excerpt: A short summary
    category: Development
    tags: React, TypeScript, Tutorial
    lang: en
    status: draft
    featured_image: ./images/hero.jpg
    ---
    Your markdown content here...
`);
    }
  } catch (err) {
    console.error(`\n  ✗ Error: ${err.message}\n`);
    process.exit(1);
  }
})();
