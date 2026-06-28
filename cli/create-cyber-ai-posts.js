// Creates 4 EN + 4 FR cross-linked blog posts (Polylang), with web-optimized
// Pexels featured images and random back-dates. Run: node cli/create-cyber-ai-posts.js
const fs = require('fs');
const path = require('path');
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const env = {};
envFile.split('\n').forEach(l => { const i = l.indexOf('='); if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
const WP_URL = env.WP_URL, WP_USER = env.WP_USER, WP_APP_PASSWORD = env.WP_APP_PASSWORD;
const AUTH = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');
const PEXELS_KEY = env.PEXELS_KEY; // stored in .env (gitignored) — never commit the key

async function wpAPI(method, endpoint, body) {
  const opts = { method, headers: { 'Authorization': `Basic ${AUTH}`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${WP_URL}/wp-json/wp/v2/${endpoint}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

async function getOrCreateTerm(taxonomy, name) {
  const search = await wpAPI('GET', `${taxonomy}?search=${encodeURIComponent(name)}&per_page=5`);
  const found = search.find(t => t.name.toLowerCase() === name.toLowerCase());
  if (found) return found.id;
  try { return (await wpAPI('POST', taxonomy, { name })).id; }
  catch { const retry = await wpAPI('GET', `${taxonomy}?search=${encodeURIComponent(name)}&per_page=5`); const f = retry.find(t => t.name.toLowerCase() === name.toLowerCase()); return f ? f.id : null; }
}

// Pexels -> web-optimized 1200x630 JPEG -> WP media library
async function uploadFeaturedImage(title, query, idx) {
  try {
    const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&orientation=landscape`, { headers: { Authorization: PEXELS_KEY } });
    const data = await r.json();
    const photos = (data.photos || []).filter(p => p.src && p.src.original);
    if (!photos.length) throw new Error('no pexels results');
    const photo = photos[idx % photos.length];
    const optimized = `${photo.src.original}?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=630`;
    const imgRes = await fetch(optimized);
    if (!imgRes.ok) throw new Error(`img fetch ${imgRes.status}`);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const filename = `blog-${query.replace(/\s+/g, '-').toLowerCase()}-${idx}.jpg`;
    const up = await fetch(`${WP_URL}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${AUTH}`, 'Content-Disposition': `attachment; filename="${filename}"`, 'Content-Type': 'image/jpeg' },
      body: buffer,
    });
    const media = await up.json();
    if (!up.ok) throw new Error(`upload ${JSON.stringify(media).slice(0, 120)}`);
    await wpAPI('POST', `media/${media.id}`, { alt_text: title, caption: `Photo: ${photo.photographer} / Pexels` });
    console.log(`    image ${(buffer.length / 1024).toFixed(0)}KB by ${photo.photographer}`);
    return media.id;
  } catch (e) { console.log(`    Warning: image failed: ${e.message.slice(0, 90)}`); return null; }
}

function randomDate(seed) {
  // random back-date between 2025-11-05 and 2026-06-18
  const start = Date.parse('2025-11-05'), end = Date.parse('2026-06-18');
  const t = start + Math.random() * (end - start);
  const d = new Date(t);
  const hh = String(8 + Math.floor(Math.random() * 9)).padStart(2, '0');
  return d.toISOString().slice(0, 10) + `T${hh}:00:00`;
}

const enPosts = require('./content-cyber-ai-en.js');
const frPosts = require('./content-cyber-ai-fr.js');

(async () => {
  console.log('=== Cyber/AI Blog Posts: EN + FR (Polylang) ===\n');
  const allCats = [...new Set([...enPosts.map(p => p.category), ...frPosts.map(p => p.category)])];
  const allTags = [...new Set([...enPosts.flatMap(p => p.tags), ...frPosts.flatMap(p => p.tags)])];
  const catMap = {}, tagMap = {};
  for (const c of allCats) catMap[c] = await getOrCreateTerm('categories', c);
  for (const t of allTags) tagMap[t] = await getOrCreateTerm('tags', t);
  console.log('Categories/tags ready.\n');

  // shared random date per topic pair
  const dates = enPosts.map((_, i) => randomDate(i));

  const enIds = [], frIds = [];
  console.log('=== EN posts ===');
  for (let i = 0; i < enPosts.length; i++) {
    const p = enPosts[i];
    console.log(`[EN ${i + 1}/${enPosts.length}] ${p.title}`);
    try {
      const media = await uploadFeaturedImage(p.title, p.pexels, i);
      const created = await wpAPI('POST', 'posts', {
        title: p.title, slug: p.slug, content: p.content, excerpt: p.excerpt || '',
        status: 'publish', date: dates[i],
        categories: catMap[p.category] ? [catMap[p.category]] : [],
        tags: p.tags.map(t => tagMap[t]).filter(Boolean),
        ...(media && { featured_media: media }), lang: 'en',
      });
      enIds.push(created.id); console.log(`  ✓ EN #${created.id} ${p.slug} (${dates[i].slice(0,10)})`);
    } catch (e) { console.error(`  ✗ ${e.message}`); enIds.push(null); }
  }

  console.log('\n=== FR posts ===');
  for (let i = 0; i < frPosts.length; i++) {
    const p = frPosts[i];
    console.log(`[FR ${i + 1}/${frPosts.length}] ${p.title}`);
    try {
      const media = await uploadFeaturedImage(p.title, p.pexels, i + 4);
      const created = await wpAPI('POST', 'posts', {
        title: p.title, slug: p.slug, content: p.content, excerpt: p.excerpt || '',
        status: 'publish', date: dates[i],
        categories: catMap[p.category] ? [catMap[p.category]] : [],
        tags: p.tags.map(t => tagMap[t]).filter(Boolean),
        ...(media && { featured_media: media }), lang: 'fr',
      });
      frIds.push(created.id); console.log(`  ✓ FR #${created.id} ${p.slug} (${dates[i].slice(0,10)})`);
    } catch (e) { console.error(`  ✗ ${e.message}`); frIds.push(null); }
  }

  console.log('\n=== Linking EN <-> FR (Polylang) ===');
  for (let i = 0; i < enIds.length; i++) {
    if (!enIds[i] || !frIds[i]) { console.log(`  skip pair ${i + 1}`); continue; }
    try {
      await wpAPI('POST', `posts/${enIds[i]}`, { lang: 'en' });
      await wpAPI('POST', `posts/${frIds[i]}`, { lang: 'fr' });
      const res = await fetch(`${WP_URL}/wp-json/pll/v1/post/${enIds[i]}`, {
        method: 'POST', headers: { 'Authorization': `Basic ${AUTH}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ translations: { en: enIds[i], fr: frIds[i] } }),
      });
      console.log(`  linked EN ${enIds[i]} <-> FR ${frIds[i]}${res.ok ? '' : ' (lang set; pll link may be manual)'}`);
    } catch (e) { console.log(`  note: ${e.message.slice(0, 80)}`); }
  }
  console.log(`\nDone. EN ${enIds.filter(Boolean).length}/4, FR ${frIds.filter(Boolean).length}/4`);
})();
