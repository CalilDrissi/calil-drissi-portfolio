// Replace all featured images with curated, visually distinct Unsplash photos
// Each topic gets a unique, high-quality image
const fs = require('fs');
const envFile = fs.readFileSync(require('path').join(__dirname, '..', '.env'), 'utf8');
const env = {};
envFile.split('\n').forEach(l => { const [k,v] = l.split('='); if (k && v) env[k.trim()] = v.trim(); });
const WP_URL = env.WP_URL;
const AUTH = Buffer.from(`${env.WP_USER}:${env.WP_APP_PASSWORD}`).toString('base64');

// Curated Unsplash photo IDs — each visually distinct, relevant to topic
// Format: slug keyword → Unsplash photo ID (from unsplash.com/photos/{id})
const PHOTO_MAP = {
  // EN posts
  'understanding-webassembly': 'iar-afB0QQw',        // abstract binary/digital
  'building-resilient-microservices': 'M5tzZtFCOfs',  // server rack
  'advanced-css-grid': 'hGV2TfOh0ns',                 // geometric grid pattern
  'securing-rest-apis': 'FnA5pAzqhMM',                // padlock security
  'react-server-components': 'xkBaqlcqeb4',           // React/JS code on screen
  'database-indexing': 'fPkvU7RDmCo',                  // data center
  'docker-containers': '4Mw7nkQDByk',                  // shipping containers
  'typescript-generics': 'OqtafYT5kTw',               // code on dark screen
  'cloudflare-workers': 'aOC7TSLb1o8',                 // cloud sky
  'testing-strategies': 'IClZBVw5W5A',                 // checklist/quality
  'design-systems': 'bzdhc5b3Bxs',                     // design tools/UI
  'core-web-vitals': 'JKUTrJ4vK00',                    // speed/dashboard
  'event-driven-architecture': 'ZiQkhI7417A',          // network/connections
  'git-workflows': 'wX2L8L-fGeA',                      // team collaboration
  'api-design-rest': 'EaB4Ml7C7fE',                    // architecture/blueprint
  'ui-animations': 'E8Ufcyxz514',                      // creative/motion
  'kubernetes-production': 'jOqJbvo1P9g',              // container orchestration
  'websockets-production': 'sRGRSjg5eYc',             // fiber optics/connection
  'monorepo-turborepo': 'p-xSl33Wxyc',                // code organization
  'error-handling': '52jRtc2S_VE',                      // debugging
  'claude-code-multi-agent': 'N6HTCyN50p0',           // AI/robot

  // FR posts — different photos for same topics
  'comprendre-webassembly': 'FO7JIlwjOtU',            // tech/binary
  'construire-microservices': 'dBI_My696Rk',           // network infrastructure
  'css-grid-avance': 'UYsBCu9RP3Y',                    // geometric/design
  'securiser-api-rest': 'didJMDiF_Qw',                 // cybersecurity
  'react-server-components-implications': 'Im7lZjxeLhg', // web development
  'strategies-indexation': 'uv5_bsypFUM',              // database/storage
  'docker-conteneurs': 'tjX_sniNzgQ',                  // logistics/containers
  'typescript-generiques': 'vpOeXr5wmR4',              // programming
  'cloudflare-workers-edge': 'C1HhAQrbykQ',            // global network
  'strategies-tests': '5fNmWej4tAA',                    // testing/QA
  'systemes-design': 'RLw-UC03Grg',                    // design system
  'core-web-vitals-performance-fr': 'eveI7MOcSmw',     // performance metrics
  'architecture-event-driven': '1K6IQsQbizI',          // architecture
  'workflows-git': 'QBpZGqEMsKg',                      // teamwork
  'conception-api': 'g5_rxRjvKmg',                     // API/diagram
  'animations-ui': 'bU6JyhSI6zo',                      // motion/art
  'kubernetes-guide': 'HSANBYMNgPo',                    // cloud infrastructure
  'websockets-production-temps': '2EJCSULRwC8',        // real-time data
  'monorepo-turborepo-guide': 'f77Bh3inUpE',           // monorepo/structure
  'patterns-gestion-erreurs': 'BfrQnKBulYQ',           // error/fix
  'claude-code-workflows-multi': 'ND9Ffc5Jugc',        // AI technology
};

function getPhotoId(slug) {
  for (const [key, photoId] of Object.entries(PHOTO_MAP)) {
    if (slug.includes(key) || key.includes(slug.substring(0, 20))) return photoId;
  }
  return null;
}

async function wpAPI(method, endpoint, body) {
  const url = `${WP_URL}/wp-json/wp/v2/${endpoint}`;
  const opts = {
    method,
    headers: { 'Authorization': `Basic ${AUTH}`, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data).substring(0, 200)}`);
  return data;
}

async function downloadAndUpload(photoId, title, slug) {
  // Unsplash direct image URL with size parameters
  const imageUrl = `https://images.unsplash.com/photo-${photoId}?w=1200&h=630&fit=crop&auto=format&q=80`;
  const res = await fetch(imageUrl, { redirect: 'follow' });
  if (!res.ok) {
    // Fallback: try LoremFlickr with unique random param
    const fallbackUrl = `https://loremflickr.com/1200/630/technology,code?random=${Date.now()}-${slug}`;
    const fbRes = await fetch(fallbackUrl, { redirect: 'follow' });
    if (!fbRes.ok) throw new Error(`Both image sources failed: ${res.status} / ${fbRes.status}`);
    var buffer = Buffer.from(await fbRes.arrayBuffer());
  } else {
    var buffer = Buffer.from(await res.arrayBuffer());
  }

  const filename = `cover-${slug.substring(0, 50)}.jpg`;
  const uploadRes = await fetch(`${WP_URL}/wp-json/wp/v2/media`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${AUTH}`,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type': 'image/jpeg',
    },
    body: buffer,
  });
  const media = await uploadRes.json();
  if (!uploadRes.ok) throw new Error(`Upload failed: ${JSON.stringify(media).substring(0, 200)}`);
  await wpAPI('POST', `media/${media.id}`, { alt_text: title });
  return media.id;
}

(async () => {
  // Fetch all posts
  let allPosts = [];
  let page = 1;
  while (true) {
    const batch = await wpAPI('GET', `posts?per_page=100&page=${page}&_fields=id,title,slug,featured_media`);
    if (batch.length === 0) break;
    allPosts = allPosts.concat(batch);
    if (batch.length < 100) break;
    page++;
  }
  console.log(`Updating featured images for ${allPosts.length} posts...\n`);

  let success = 0, fail = 0;
  for (let i = 0; i < allPosts.length; i++) {
    const post = allPosts[i];
    const title = post.title.rendered || post.title;
    const photoId = getPhotoId(post.slug);

    try {
      console.log(`[${i + 1}/${allPosts.length}] ${post.slug} → photo ${photoId || 'fallback'}`);
      const mediaId = await downloadAndUpload(photoId, title, post.slug);
      await wpAPI('POST', `posts/${post.id}`, { featured_media: mediaId });
      console.log(`  ✓ media ID ${mediaId}`);
      success++;
    } catch (e) {
      console.log(`  ✗ ${e.message.substring(0, 120)}`);
      fail++;
    }
  }

  console.log(`\nDone: ${success} updated, ${fail} failed.`);
})();
