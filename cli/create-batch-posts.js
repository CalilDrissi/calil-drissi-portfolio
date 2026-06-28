// Publishes the 20-topic batch (EN+FR) to WordPress with Polylang, web-optimized
// Pexels images, and random back-dates. Run: node cli/create-batch-posts.js
const fs = require('fs');
const path = require('path');
const env = {};
fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n').forEach(l => { const i = l.indexOf('='); if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
const WP_URL = env.WP_URL, AUTH = Buffer.from(`${env.WP_USER}:${env.WP_APP_PASSWORD}`).toString('base64');
const PEXELS_KEY = env.PEXELS_KEY;

async function wpAPI(method, endpoint, body) {
  const opts = { method, headers: { 'Authorization': `Basic ${AUTH}`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${WP_URL}/wp-json/wp/v2/${endpoint}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data).slice(0, 180)}`);
  return data;
}
async function getOrCreateTerm(tax, name) {
  const s = await wpAPI('GET', `${tax}?search=${encodeURIComponent(name)}&per_page=5`);
  const f = s.find(t => t.name.toLowerCase() === name.toLowerCase());
  if (f) return f.id;
  try { return (await wpAPI('POST', tax, { name })).id; }
  catch { const r = await wpAPI('GET', `${tax}?search=${encodeURIComponent(name)}&per_page=5`); const g = r.find(t => t.name.toLowerCase() === name.toLowerCase()); return g ? g.id : null; }
}
async function uploadFeaturedImage(title, query, idx) {
  try {
    const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&orientation=landscape`, { headers: { Authorization: PEXELS_KEY } });
    const d = await r.json();
    const photos = (d.photos || []).filter(p => p.src && p.src.original);
    if (!photos.length) throw new Error('no pexels results');
    const photo = photos[idx % photos.length];
    const imgRes = await fetch(`${photo.src.original}?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=630`);
    if (!imgRes.ok) throw new Error(`img ${imgRes.status}`);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const up = await fetch(`${WP_URL}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${AUTH}`, 'Content-Disposition': `attachment; filename="blog-${query.replace(/\s+/g, '-').toLowerCase()}-${idx}.jpg"`, 'Content-Type': 'image/jpeg' },
      body: buffer,
    });
    const media = await up.json();
    if (!up.ok) throw new Error('upload failed');
    await wpAPI('POST', `media/${media.id}`, { alt_text: title, caption: `Photo: ${photo.photographer} / Pexels` });
    return media.id;
  } catch (e) { console.log(`    img warn: ${e.message.slice(0, 70)}`); return null; }
}
function randomDate() {
  const start = Date.parse('2025-09-01'), end = Date.parse('2026-06-15');
  const d = new Date(start + Math.random() * (end - start));
  const hh = String(8 + Math.floor(Math.random() * 9)).padStart(2, '0');
  return d.toISOString().slice(0, 10) + `T${hh}:00:00`;
}

const enPosts = [
  ...require('./content-howto-en.js'), ...require('./content-bestpractices-en.js'),
  ...require('./content-lowlevel-en.js'), ...require('./content-flutter-en.js'),
];
const frPosts = [
  ...require('./content-howto-fr.js'), ...require('./content-bestpractices-fr.js'),
  ...require('./content-lowlevel-fr.js'), ...require('./content-flutter-fr.js'),
];

(async () => {
  console.log(`=== Batch publish: ${enPosts.length} EN + ${frPosts.length} FR ===\n`);
  const cats = [...new Set([...enPosts, ...frPosts].map(p => p.category))];
  const tags = [...new Set([...enPosts, ...frPosts].flatMap(p => p.tags))];
  const catMap = {}, tagMap = {};
  for (const c of cats) catMap[c] = await getOrCreateTerm('categories', c);
  for (const t of tags) tagMap[t] = await getOrCreateTerm('tags', t);
  console.log('Categories/tags ready.\n');

  const dates = enPosts.map(() => randomDate());
  const enIds = [], frIds = [];

  for (let i = 0; i < enPosts.length; i++) {
    const p = enPosts[i];
    try {
      const media = await uploadFeaturedImage(p.title, p.pexels, i);
      const c = await wpAPI('POST', 'posts', { title: p.title, slug: p.slug, content: p.content, excerpt: p.excerpt || '', status: 'publish', date: dates[i], categories: catMap[p.category] ? [catMap[p.category]] : [], tags: p.tags.map(t => tagMap[t]).filter(Boolean), ...(media && { featured_media: media }), lang: 'en' });
      enIds.push(c.id); console.log(`EN ${i + 1}/20 #${c.id} ${p.slug} (${dates[i].slice(0,10)})`);
    } catch (e) { console.error(`EN ${i + 1} FAIL ${p.slug}: ${e.message}`); enIds.push(null); }
  }
  for (let i = 0; i < frPosts.length; i++) {
    const p = frPosts[i];
    try {
      const media = await uploadFeaturedImage(p.title, p.pexels, i + 100);
      const c = await wpAPI('POST', 'posts', { title: p.title, slug: p.slug, content: p.content, excerpt: p.excerpt || '', status: 'publish', date: dates[i], categories: catMap[p.category] ? [catMap[p.category]] : [], tags: p.tags.map(t => tagMap[t]).filter(Boolean), ...(media && { featured_media: media }), lang: 'fr' });
      frIds.push(c.id); console.log(`FR ${i + 1}/20 #${c.id} ${p.slug}`);
    } catch (e) { console.error(`FR ${i + 1} FAIL ${p.slug}: ${e.message}`); frIds.push(null); }
  }
  console.log('\nLinking translations...');
  for (let i = 0; i < enIds.length; i++) {
    if (!enIds[i] || !frIds[i]) continue;
    try {
      await wpAPI('POST', `posts/${enIds[i]}`, { lang: 'en' });
      await wpAPI('POST', `posts/${frIds[i]}`, { lang: 'fr' });
      await fetch(`${WP_URL}/wp-json/pll/v1/post/${enIds[i]}`, { method: 'POST', headers: { 'Authorization': `Basic ${AUTH}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ translations: { en: enIds[i], fr: frIds[i] } }) });
    } catch {}
  }
  console.log(`\nDone. EN ${enIds.filter(Boolean).length}/20, FR ${frIds.filter(Boolean).length}/20`);
})();
