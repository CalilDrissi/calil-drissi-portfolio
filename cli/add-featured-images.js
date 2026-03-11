// Add featured images from Picsum to all existing WP posts that lack one
const fs = require('fs');
const envFile = fs.readFileSync(require('path').join(__dirname, '..', '.env'), 'utf8');
const env = {};
envFile.split('\n').forEach(l => { const [k,v] = l.split('='); if (k && v) env[k.trim()] = v.trim(); });
const WP_URL = env.WP_URL;
const WP_USER = env.WP_USER;
const WP_APP_PASSWORD = env.WP_APP_PASSWORD;
const AUTH = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');

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

async function uploadImage(title, seed) {
  const imageUrl = `https://picsum.photos/seed/blog${seed}/${1200}/${630}`;
  const imgRes = await fetch(imageUrl, { redirect: 'follow' });
  if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const filename = `blog-cover-${seed}.jpg`;

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
  // Fetch all posts (paginated)
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

  for (let i = 0; i < needsImage.length; i++) {
    const post = needsImage[i];
    const title = post.title.rendered || post.title;
    try {
      console.log(`[${i + 1}/${needsImage.length}] Uploading image for "${title}"...`);
      const mediaId = await uploadImage(title, post.id);
      await wpAPI('POST', `posts/${post.id}`, { featured_media: mediaId });
      console.log(`  ✓ Set featured image (media ID: ${mediaId})`);
    } catch (e) {
      console.log(`  ✗ Failed: ${e.message.substring(0, 100)}`);
    }
  }

  console.log('\n✅ Done!');
})();
