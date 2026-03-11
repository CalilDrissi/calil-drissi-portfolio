// Add topic-relevant featured images to all WP posts that lack one
// Uses LoremFlickr for free, topic-relevant images
const fs = require('fs');
const envFile = fs.readFileSync(require('path').join(__dirname, '..', '.env'), 'utf8');
const env = {};
envFile.split('\n').forEach(l => { const [k,v] = l.split('='); if (k && v) env[k.trim()] = v.trim(); });
const WP_URL = env.WP_URL;
const WP_USER = env.WP_USER;
const WP_APP_PASSWORD = env.WP_APP_PASSWORD;
const AUTH = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');

// Map post slugs/keywords to relevant image search terms
const TOPIC_KEYWORDS = {
  'webassembly': 'programming,binary,code',
  'microservice': 'server,network,infrastructure',
  'css-grid': 'web,design,layout',
  'css-grid-avance': 'web,design,layout',
  'api-rest': 'security,lock,shield',
  'securiser': 'security,lock,shield',
  'securing': 'security,lock,shield',
  'react-server': 'javascript,react,framework',
  'database': 'database,server,data',
  'indexation': 'database,server,data',
  'docker': 'container,shipping,technology',
  'typescript': 'code,programming,typescript',
  'generiques': 'code,programming,typescript',
  'cloudflare': 'cloud,globe,network',
  'testing': 'checklist,quality,testing',
  'tests': 'checklist,quality,testing',
  'design-system': 'design,components,ui',
  'systemes-design': 'design,components,ui',
  'web-vitals': 'performance,speed,dashboard',
  'core-web': 'performance,speed,dashboard',
  'event-driven': 'architecture,messaging,queue',
  'git': 'collaboration,team,workflow',
  'workflow': 'collaboration,team,workflow',
  'api-design': 'api,architecture,diagram',
  'conception-api': 'api,architecture,diagram',
  'animation': 'motion,animation,creative',
  'kubernetes': 'container,orchestration,cloud',
  'websocket': 'realtime,connection,network',
  'temps-reel': 'realtime,connection,network',
  'monorepo': 'repository,code,organization',
  'turborepo': 'repository,code,organization',
  'error': 'debugging,error,fix',
  'erreurs': 'debugging,error,fix',
  'claude-code': 'artificial,intelligence,robot',
};

function getImageKeywords(slug, title) {
  const text = `${slug} ${title}`.toLowerCase();
  for (const [key, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (text.includes(key)) return keywords;
  }
  return 'technology,code,programming';
}

async function wpAPI(method, endpoint, body) {
  const url = `${WP_URL}/wp-json/wp/v2/${endpoint}`;
  const opts = {
    method,
    headers: {
      'Authorization': `Basic ${AUTH}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function uploadImage(title, slug, postId) {
  const keywords = getImageKeywords(slug, title);
  // LoremFlickr with lock parameter to get consistent image per post
  const imageUrl = `https://loremflickr.com/1200/630/${keywords}?lock=${postId}`;
  const imgRes = await fetch(imageUrl, { redirect: 'follow' });
  if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const filename = `cover-${slug.substring(0, 40)}-${postId}.jpg`;

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
  if (!uploadRes.ok) throw new Error(`Upload failed: ${JSON.stringify(media)}`);
  await wpAPI('POST', `media/${media.id}`, { alt_text: title });
  return media.id;
}

(async () => {
  let allPosts = [];
  let page = 1;
  while (true) {
    const batch = await wpAPI('GET', `posts?per_page=100&page=${page}&_fields=id,title,featured_media,slug`);
    if (batch.length === 0) break;
    allPosts = allPosts.concat(batch);
    if (batch.length < 100) break;
    page++;
  }

  const needsImage = allPosts.filter(p => !p.featured_media);
  console.log(`Found ${allPosts.length} posts, ${needsImage.length} without featured images.\n`);

  let success = 0, fail = 0;
  for (let i = 0; i < needsImage.length; i++) {
    const post = needsImage[i];
    const title = post.title.rendered || post.title;
    try {
      const keywords = getImageKeywords(post.slug, title);
      console.log(`[${i + 1}/${needsImage.length}] "${title}" → ${keywords}`);
      const mediaId = await uploadImage(title, post.slug, post.id);
      await wpAPI('POST', `posts/${post.id}`, { featured_media: mediaId });
      console.log(`  ✓ Set featured image (media ID: ${mediaId})`);
      success++;
    } catch (e) {
      console.log(`  ✗ Failed: ${e.message.substring(0, 100)}`);
      fail++;
    }
  }

  console.log(`\n✅ Done! ${success} succeeded, ${fail} failed.`);
})();
