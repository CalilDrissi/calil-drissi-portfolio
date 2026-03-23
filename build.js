const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'dist');
const CONTENT = path.join(__dirname, 'content');

// Load .env if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length) process.env[key.trim()] = val.join('=').trim();
  });
}

const WP_URL = process.env.WP_URL; // e.g. https://cms.drissi.xyz
const WP_USER = process.env.WP_USER;
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = 'CalilDrissi';

// ---- Helpers ----
function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => readJSON(path.join(dir, f)));
}

// ---- WordPress API ----
async function wpFetch(endpoint) {
  const url = `${WP_URL}/wp-json/wp/v2/${endpoint}`;
  const headers = {};
  if (WP_USER && WP_APP_PASSWORD) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`WP API error: ${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

function stripHTML(html) {
  return html.replace(/<[^>]*>/g, '').replace(/\n/g, ' ').trim();
}
function decodeEntities(str) {
  return str.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
            .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
            .replace(/&rsquo;/g, '\u2019').replace(/&lsquo;/g, '\u2018')
            .replace(/&rdquo;/g, '\u201D').replace(/&ldquo;/g, '\u201C')
            .replace(/&mdash;/g, '\u2014').replace(/&ndash;/g, '\u2013')
            .replace(/&hellip;/g, '\u2026');
}

// ---- GitHub Contributions ----
async function fetchGitHubContributions() {
  if (!GITHUB_TOKEN) {
    console.log('⚠ No GITHUB_TOKEN — skipping contribution graph');
    return null;
  }
  try {
    const query = `{ user(login: "${GITHUB_USERNAME}") { contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { contributionCount date } } } } } }`;
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
    const json = await res.json();
    return json.data.user.contributionsCollection.contributionCalendar;
  } catch (err) {
    console.log('⚠ GitHub contributions fetch failed:', err.message);
    return null;
  }
}

function countToLevel(count) {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

function renderGitHubGrid(calendar) {
  if (!calendar) return { json: '{}', total: 0 };

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  // Group days by month
  const monthMap = {};
  for (const week of calendar.weeks) {
    for (const day of week.contributionDays) {
      const d = new Date(day.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = monthNames[d.getMonth()] + ' ' + d.getFullYear();
      if (!monthMap[key]) monthMap[key] = { label, shortLabel: monthNames[d.getMonth()], days: [], total: 0 };
      monthMap[key].days.push({ date: day.date, count: day.contributionCount, level: countToLevel(day.contributionCount), dow: d.getDay() });
      monthMap[key].total += day.contributionCount;
    }
  }
  return { json: JSON.stringify(monthMap), total: calendar.totalContributions };
}

async function fetchWPPosts(lang) {
  try {
    // Try with Polylang lang param first, fallback to all posts
    let endpoint = `posts?per_page=100&_embed`;
    if (lang) endpoint += `&lang=${lang}`;

    const posts = await wpFetch(endpoint);
    return posts.map(post => {
      // Extract featured image from _embedded
      let coverImage = '';
      if (post._embedded && post._embedded['wp:featuredmedia'] && post._embedded['wp:featuredmedia'][0]) {
        coverImage = post._embedded['wp:featuredmedia'][0].source_url || '';
      }

      // Extract categories and tags from _embedded
      let tags = [];
      let categories = [];
      if (post._embedded && post._embedded['wp:term']) {
        post._embedded['wp:term'].forEach(termGroup => {
          termGroup.forEach(term => {
            if (term.taxonomy === 'post_tag') tags.push(decodeEntities(term.name));
            if (term.taxonomy === 'category' && term.name !== 'Uncategorized') categories.push(decodeEntities(term.name));
          });
        });
      }

      // Extract Yoast SEO meta if available
      const yoast = post.yoast_head_json || {};

      return {
        wpId: post.id,
        slug: post.slug,
        title: decodeEntities(post.title.rendered),
        date: post.date.split('T')[0],
        excerpt: yoast.description || stripHTML(post.excerpt.rendered),
        category: categories[0] || 'General',
        tags: tags.length ? tags : ['General'],
        coverImage: yoast.og_image?.[0]?.url || coverImage,
        body: post.content.rendered,
        seo: {
          title: yoast.title || post.title.rendered,
          description: yoast.description || stripHTML(post.excerpt.rendered),
          ogImage: yoast.og_image?.[0]?.url || coverImage,
        }
      };
    });
  } catch (e) {
    console.warn(`  ⚠ WordPress fetch failed for lang=${lang}: ${e.message}`);
    return null; // null = fallback to local
  }
}

// ---- Template engine (simple token replacement) ----
function render(template, data, lang, featuredPosts, ghData) {
  let html = template;

  // INTRO section
  html = html.replace(
    /<!-- INTRO -->[\s\S]*?(?=\n\s*<!-- POSITION -->)/,
    `<!-- INTRO -->
    <div class="col-section">
      <div class="col-header">${data.intro.header}</div>
      <div class="intro-identity" id="introIdentity">
        <div class="intro-hover-pill"><span class="pill-track">${data.intro.hoverPill}&nbsp;&nbsp;&nbsp;⬥&nbsp;&nbsp;&nbsp;${data.intro.hoverPill}&nbsp;&nbsp;&nbsp;⬥&nbsp;&nbsp;&nbsp;</span></div>
        <div class="cursor-video-preview" id="cursorVideoPreview">
          <video src="/video.mp4" muted playsinline loop></video>
          <div class="cvp-label"><span class="cvp-dot"></span>${lang === 'fr' ? 'Cliquer pour découvrir' : 'Click to discover'}</div>
        </div>
        <img class="intro-avatar" src="${data.intro.avatarUrl}" alt="CD" />
        <div>
          <div class="intro-name">${data.intro.name}<svg class="heartbeat-svg" viewBox="0 0 90 12"><polyline class="hb-line" points="0,6 8,6 11,6 14,1.5 17,10.5 20,4 23,8 26,6 34,6"/><text class="hb-text" x="34.5" y="7.2">memento mori</text></svg></div>
          <div class="intro-title">${data.intro.title}</div>
        </div>
      </div>
      <div class="intro-meta">
        <span><span class="flag">&#127474;&#127462;</span> ${data.intro.location}</span>
        <span>&#9679; ${data.intro.tagline}</span>
      </div>
      <div class="intro-divider"></div>
      <div class="intro-what">${data.intro.whatIDo}</div>
      <div>${data.intro.whatIDoDesc}</div>
      <div class="intro-stats">
        ${data.intro.stats.map(s => `<strong>${s.value}</strong> ${s.label}`).join('<br />\n        ')}
      </div>
    </div>
`
  );

  // POSITION section
  html = html.replace(
    /<!-- POSITION -->[\s\S]*?(?=\n\s*<!-- RECOGNITION -->)/,
    `<!-- POSITION -->
    <div class="col-section">
      <div class="col-header">${data.position.header}</div>
      <div class="position-studio">${data.position.studio}</div>
      <div class="position-revenue">${data.position.focus}</div>

      <div class="sub-label">${data.position.stackLabel}</div>
      <div class="position-cost">
        ${data.position.stack.map(s => `<span>${s}</span>`).join('\n        ')}
      </div>

      <div class="sub-label">${data.position.previousLabel}</div>
      <div class="position-prev">
        ${data.position.previous.map(s => `<span>${s}</span>`).join('\n        ')}
      </div>
    </div>
`
  );

  // VENTURES section
  html = html.replace(
    /<!-- RECOGNITION -->[\s\S]*?(?=\n\s*<!-- ARTICLES -->)/,
    `<!-- RECOGNITION -->
    <div class="col-section">
      <div class="col-header">${data.ventures.header}</div>
      <div class="ventures-list" id="venturesList">
        ${data.ventures.list.map(v => `<div class="venture-item" data-desc="${v.desc}"><span class="venture-name">${v.name}</span><span class="venture-status">${v.status}</span></div>`).join('\n        ')}
      </div>
      <div class="sub-label">${data.ventures.changelogLabel}</div>
      <div class="ventures-stats">
        ${data.ventures.changelog.map(s => `<span>${s}</span>`).join('\n        ')}
      </div>
    </div>
`
  );

  // ARTICLES section — from WP posts tagged "Featured"
  const prefix = lang === 'fr' ? '/fr' : '';
  const truncate = (s, n) => s.length > n ? s.slice(0, n).trimEnd() + '...' : s;
  const articleLinks = (featuredPosts || []).map(p =>
    `<a href="${prefix}/blog/${p.slug}/" data-img="${p.coverImage || ''}" data-title="${p.title}" data-excerpt="${p.excerpt || ''}" data-tags="${p.tags.join(', ')}" data-date="${p.date}"><span>${truncate(p.title, 40)}</span></a>`
  ).join('\n        ');
  html = html.replace(
    /<!-- ARTICLES -->[\s\S]*?(?=\n\s*<!-- CONNECT -->)/,
    `<!-- ARTICLES -->
    <div class="col-section">
      <div class="col-header">${data.articles.header}</div>
      <div class="articles-list" id="articlesList">
        ${articleLinks}
      </div>
    </div>
`
  );

  // CONNECT section
  html = html.replace(
    /<!-- CONNECT -->[\s\S]*?<\/div>\s*\n\s*<\/div>\s*\n\s*<!-- GITHUB CONTRIBUTIONS/,
    `<!-- CONNECT -->
    <div class="col-section">
      <div class="col-header">${data.connect.header}</div>
      <div class="connect-links">
        ${data.connect.links.map(l => `<a href="${l.url}">${l.label}</a>`).join('\n        ')}
      </div>

      <div class="connect-avail">
        <strong>${data.connect.availStatus}</strong><br />
        ${data.connect.availCta}
      </div>

      <div class="connect-ctas">
        <button class="cta-btn cta-btn-primary cta-btn-terminal" id="terminalChallengeBtn">${lang === 'fr' ? 'Consultation Gratuite' : 'Win Free Consult'} &#8599;</button>
        <button class="cta-btn cta-btn-secondary" id="openScheduleBtn">${lang === 'fr' ? 'Planifier un appel' : 'Schedule a Call'} &#8599;</button>
        <button class="cta-btn" id="openCollabBtn">${lang === 'fr' ? 'Collaboration' : 'Collaboration'} &#8599;</button>
        <button class="cta-btn" id="openMessageBtn">${lang === 'fr' ? 'Laisser un message' : 'Leave a Message'} &#8599;</button>
      </div>
    </div>

  </div>

  <!-- GITHUB CONTRIBUTIONS`
  );

  // Statement text
  let statementHTML = data.statement.text
    .replace('{rotate1}', '<span class="rotate-slot" id="rotateSlot1"><em>' + data.statement.rotate1Words[0] + '</em></span>')
    .replace('{rotate2}', '<span class="rotate-slot" id="rotateSlot2"><em>' + data.statement.rotate2Words[0] + '</em></span>')
    .replace('{rotate3}', '<span class="rotate-slot" id="rotateSlot3"><em>' + data.statement.rotate3Words[0] + '</em></span>');
  html = html.replace(
    /<p class="statement">[\s\S]*?<\/p>/,
    `<p class="statement">${statementHTML}</p>`
  );

  // GitHub contribution graph — inject month data as JSON for client-side rendering
  if (ghData) {
    const { json, total } = renderGitHubGrid(ghData);
    html = html.replace(
      /· Contributions/,
      `· ${total} Contributions`
    );
    // Inject data as a script variable right before the grid
    html = html.replace(
      /<div class="gh-month-tabs" id="ghMonthTabs"><\/div>/,
      `<script>var GH_MONTH_DATA = ${json};<\/script>\n      <div class="gh-month-tabs" id="ghMonthTabs"></div>`
    );
  }

  // Project thumbs
  const thumbsHTML = data.projects.map(p =>
    `      <div class="project-thumb">
        <img src="${p.thumb}" alt="" loading="lazy" />
        <div class="project-label">${p.title}</div>
      </div>`
  ).join('\n');
  html = html.replace(
    /<div class="projects-strip" id="projectsStrip">[\s\S]*?<\/div>\s*\n\s*<\/div>\s*\n\s*<\/div>/,
    `<div class="projects-strip" id="projectsStrip">\n${thumbsHTML}\n    </div>\n  </div>\n</div>`
  );

  // Filter tabs
  html = html.replace(
    /<button class="filter-tab active">[\s\S]*?<\/button>\s*<button class="filter-tab">[\s\S]*?<\/button>/,
    `<button class="filter-tab active">${data.projectsTab.label} <span class="filter-count">${data.projectsTab.count}</span></button>
        <button class="filter-tab">${data.openSourceTab.label} <span class="filter-count">${data.openSourceTab.count}</span></button>`
  );

  // Scroll indicator
  html = html.replace(
    /<span>Scroll<\/span>/,
    `<span>${data.scrollIndicator}</span>`
  );

  // Ribbon
  const ribbonItems = [...data.ribbon, ...data.ribbon, ...data.ribbon, ...data.ribbon].map(r => `<span>${r}</span>`).join('\n    ');
  html = html.replace(
    /<div class="ribbon-track">[\s\S]*?<\/div>/,
    `<div class="ribbon-track">\n    ${ribbonItems}\n  </div>`
  );

  // About popup
  html = html.replace(
    /khalil drissi — about/,
    data.about.titlebarText
  );
  html = html.replace(
    /<a class="win-action-btn" href="mailto:khalil@drissi\.org">Email ↗<\/a>/,
    `<a class="win-action-btn" href="${data.about.emailBtn.url}">${data.about.emailBtn.label}</a>`
  );
  html = html.replace(
    />About Me<\/button>/,
    `>${data.about.tabs.bio}</button>`
  );
  html = html.replace(
    />Chat with my AI Assistant<\/button>/,
    `>${data.about.tabs.chat}</button>`
  );
  html = html.replace(
    'class="about-bio-name">Khalil Drissi</div>',
    `class="about-bio-name">${data.about.name}</div>`
  );
  html = html.replace(
    'class="about-bio-role">Software Developer · Morocco</div>',
    `class="about-bio-role">${data.about.role}</div>`
  );
  html = html.replace(
    /<div class="about-bio-text">[\s\S]*?<\/div>\s*\n\s*(?:<div class="about-video-section">[\s\S]*?<\/div>\s*\n\s*)?<div class="about-details-grid">/,
    `<div class="about-bio-text">\n        ${data.about.bio.map(p => `<p>${p}</p>`).join('\n        ')}\n      </div>\n      <div class="about-video-section">\n        <video src="/video-ai-me.mp4" controls playsinline></video>\n        <div class="about-video-label"><span class="avl-icon"></span>${lang === 'fr' ? 'Présentation vidéo' : 'Video Introduction'}</div>\n      </div>\n      <div class="about-details-grid">`
  );
  html = html.replace(
    /<div class="about-details-grid">[\s\S]*?<\/div>\s*\n\s*<\/div>\s*\n\s*<\/div>\s*\n\s*<!-- Chat Panel -->/,
    `<div class="about-details-grid">
        ${data.about.details.map(d => `<div class="about-detail-card">
          <div class="about-detail-label">${d.label}</div>
          <div class="about-detail-value">${d.value}</div>
        </div>`).join('\n        ')}
      </div>
    </div>
  </div>
  <!-- Chat Panel -->`
  );

  // Chat greeting
  html = html.replace(
    /<div class="msg-sender">Khalil's AI Assistant<\/div>\s*Hey![\s\S]*?<div class="msg-time">/,
    `<div class="msg-sender">${data.chat.senderName}</div>\n          ${data.chat.greeting}\n          <div class="msg-time">`
  );

  // Meta
  html = html.replace(
    /<title>.*?<\/title>/,
    `<title>${data.meta.title}</title>`
  );
  html = html.replace(
    /<meta name="description" content=".*?" \/>/,
    `<meta name="description" content="${data.meta.description}" />`
  );
  html = html.replace(
    /<html lang="en">/,
    `<html lang="${data.meta.lang}">`
  );

  // Inject JS data (projects, awards, chatResponses, rotateWords)
  html = html.replace(
    /const projects = \[[\s\S]*?\];(\s*\n\s*\/\/ Attach project thumb clicks)/,
    `const projects = ${JSON.stringify(data.projects)};$1`
  );
  html = html.replace(
    /const openSourceProjects = \[[\s\S]*?\];(\s*\n\s*\/\/ Store original)/,
    `const openSourceProjects = ${JSON.stringify(data.openSource)};$1`
  );
  html = html.replace(
    /const chatResponses = \{[\s\S]*?\};(\s*\n\s*function getResponse)/,
    `const chatResponses = ${JSON.stringify(data.chat.responses)};$1`
  );
  html = html.replace(
    /const rotate1Words = \[.*?\];\s*const rotate2Words = \[.*?\];\s*const rotate3Words = \[.*?\];/,
    `const rotate1Words = ${JSON.stringify(data.statement.rotate1Words)};\n  const rotate2Words = ${JSON.stringify(data.statement.rotate2Words)};\n  const rotate3Words = ${JSON.stringify(data.statement.rotate3Words)};`
  );

  // Add language toggle + blog link to the page
  const navHTML = `<div class="page-nav" style="position:fixed;top:12px;right:20px;z-index:200;display:flex;gap:8px;font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:0.06em;">
    <a href="${lang === 'fr' ? '/fr/blog/' : '/blog/'}" style="color:var(--fg-dim);text-decoration:none;padding:4px 10px;border:1px solid var(--fg-faint);border-radius:4px;">${data.nav.blog}</a>
    <a href="${data.nav.langToggle.url}" style="color:var(--fg-dim);text-decoration:none;padding:4px 10px;border:1px solid var(--fg-faint);border-radius:4px;">${data.nav.langToggle.label}</a>
  </div>`;
  html = html.replace(
    /<div class="page">/,
    `${navHTML}\n<div class="page">`
  );

  return html;
}

// ---- Blog templates ----
function blogListingHTML(data, posts, lang) {
  const prefix = lang === 'fr' ? '/fr' : '';
  const otherLang = lang === 'fr' ? { label: 'EN', url: '/blog/' } : { label: 'FR', url: '/fr/blog/' };

  const sortedPosts = posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  const postsJSON = JSON.stringify(sortedPosts.map(p => ({
    slug: p.slug,
    title: p.title,
    date: p.date,
    excerpt: p.excerpt || '',
    category: p.category || 'General',
    tags: p.tags || [],
    coverImage: p.coverImage || '',
  })));

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Blog — ${data.intro.name}</title>
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="canonical" href="https://khalildrissi.com${prefix}/blog/" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #000000; --sidebar-bg: #1a1a1a; --fg: #ffffff; --fg-dim: rgba(255,255,255,0.6);
      --fg-faint: rgba(255,255,255,0.22); --accent: #a882ff;
      --mono: 'DM Mono', monospace; --sans: 'Inter', sans-serif; --display: 'Space Grotesk', sans-serif;
    }
    html { -webkit-font-smoothing: antialiased; }
    body { background: var(--bg); color: var(--fg); font-family: var(--mono); font-size: 13px; line-height: 1.6; overflow: hidden; height: 100vh; }
    a { color: inherit; text-decoration: none; }

    .blog-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 40px; border-bottom: 1px solid rgba(255,255,255,0.06);
      flex-shrink: 0; background: var(--bg);
    }
    .blog-header-left { display: flex; align-items: center; gap: 12px; }
    .blog-header-back {
      font-size: 11px; color: var(--fg-dim); transition: color 0.2s;
      display: flex; align-items: center; gap: 5px;
    }
    .blog-header-back:hover { color: #fff; }
    .blog-header-back svg { width: 14px; height: 14px; opacity: 0.5; }
    .blog-header-sep { width: 1px; height: 16px; background: rgba(255,255,255,0.1); }
    .blog-header h1 {
      font-family: var(--mono); font-size: 11px; font-weight: 400;
      text-transform: uppercase; letter-spacing: 0.08em; color: var(--fg);
    }
    .blog-header-count {
      font-size: 10px; color: var(--fg-dim); margin-left: 6px;
      background: rgba(255,255,255,0.05); padding: 2px 7px; border-radius: 3px;
    }
    .blog-header-nav { display: flex; gap: 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
    .blog-header-nav a {
      color: var(--fg-dim); padding: 4px 10px; border: 1px solid rgba(255,255,255,0.08); border-radius: 3px;
      transition: border-color 0.2s, color 0.2s, background 0.2s;
    }
    .blog-header-nav a:hover { border-color: rgba(255,255,255,0.2); color: #fff; background: rgba(255,255,255,0.03); }

    .main-layout {
      display: flex; height: calc(100vh - 65px); overflow: hidden;
    }

    /* Graph panel */
    .graph-panel {
      flex: 7; position: relative; overflow: hidden; background: #000000;
    }
    .graph-panel canvas {
      display: block; width: 100%; height: 100%;
    }
    .graph-hint {
      position: absolute; bottom: 16px; left: 16px;
      font-size: 10px; color: rgba(255,255,255,0.2);
      pointer-events: none; text-transform: uppercase; letter-spacing: 0.05em;
    }

    /* Hover card */
    .hover-card {
      position: fixed; pointer-events: none; z-index: 100;
      background: #1a1a1a; border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px; padding: 14px 16px; max-width: 300px; min-width: 200px;
      opacity: 0; transition: opacity 0.18s ease;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    }
    .hover-card.visible { opacity: 1; }
    .hover-card-img {
      width: 160px; height: 90px; object-fit: cover; border-radius: 4px; margin-bottom: 10px;
    }
    .hover-card-title {
      font-family: var(--display); font-size: 15px; font-weight: 300; margin-bottom: 4px; letter-spacing: -0.01em;
    }
    .hover-card-date { font-size: 10px; color: var(--fg-dim); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
    .hover-card-excerpt {
      font-size: 11px; color: var(--fg-dim); line-height: 1.5; margin-bottom: 8px;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .hover-card-tags { display: flex; gap: 4px; flex-wrap: wrap; }
    .hover-card-tags span {
      font-size: 9px; padding: 1px 6px; border: 1px solid rgba(255,255,255,0.15); border-radius: 3px;
      color: var(--fg-dim); text-transform: uppercase;
    }

    /* Sidebar */
    .sidebar {
      flex: 3; display: flex; flex-direction: column; border-left: 1px solid rgba(255,255,255,0.08);
      background: var(--sidebar-bg); min-width: 260px; max-width: 380px;
    }
    .sidebar-search {
      padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0;
    }
    .sidebar-search input {
      width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px; padding: 8px 12px; color: var(--fg); font-family: var(--mono);
      font-size: 12px; outline: none; transition: border-color 0.2s;
    }
    .sidebar-search input::placeholder { color: rgba(255,255,255,0.3); }
    .sidebar-search input:focus { border-color: var(--accent); }

    .sidebar-categories {
      padding: 12px 16px 8px; display: flex; flex-wrap: wrap; gap: 6px; flex-shrink: 0;
    }
    .cat-pill {
      font-size: 11px; padding: 5px 14px; border-radius: 6px;
      color: var(--fg-dim); cursor: pointer; transition: all 0.2s;
      letter-spacing: 0.01em; background: rgba(255,255,255,0.06); border: none;
      font-family: var(--sans); font-weight: 500;
    }
    .cat-pill:hover { background: rgba(255,255,255,0.12); color: #fff; }
    .cat-pill.active { background: var(--accent); color: #fff; }

    .sidebar-filter-label {
      padding: 0 16px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em;
      color: rgba(255,255,255,0.25); font-family: var(--mono); flex-shrink: 0;
    }

    .sidebar-tags-header {
      padding: 6px 16px 0; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
    }
    .sidebar-tags-header span { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.3); font-family: var(--mono); }
    .sidebar-tags-toggle {
      font-size: 9px; color: var(--accent); cursor: pointer; background: none; border: none;
      font-family: var(--mono); padding: 2px 4px; letter-spacing: 0.02em;
    }
    .sidebar-tags-toggle:hover { text-decoration: underline; }
    .sidebar-tags {
      padding: 4px 16px 12px; border-bottom: 1px solid rgba(255,255,255,0.08);
      display: flex; flex-wrap: wrap; gap: 5px; flex-shrink: 0;
      max-height: 56px; overflow: hidden; transition: max-height 0.3s ease;
    }
    .sidebar-tags.expanded { max-height: 400px; }
    .tag-pill {
      font-size: 10px; padding: 2px 8px; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
      color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s;
      letter-spacing: 0.02em; background: transparent; font-family: var(--mono);
    }
    .tag-pill:hover { border-color: var(--accent); color: #fff; }
    .tag-pill.active { background: var(--accent); border-color: var(--accent); color: #fff; }

    .active-filters {
      padding: 8px 16px; display: none; align-items: center; gap: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0;
    }
    .active-filters.visible { display: flex; }
    .active-filters span { font-size: 10px; color: var(--fg-dim); }
    .clear-filters {
      font-size: 10px; color: var(--accent); cursor: pointer; background: none;
      border: none; font-family: var(--mono); padding: 2px 6px;
    }
    .clear-filters:hover { text-decoration: underline; }

    .sidebar-list {
      flex: 1; overflow-y: auto; padding: 8px 0;
    }
    .sidebar-list::-webkit-scrollbar { width: 3px; }
    .sidebar-list::-webkit-scrollbar-track { background: transparent; }
    .sidebar-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }

    .post-item {
      display: block; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.04);
      cursor: pointer; transition: background 0.15s;
    }
    .post-item:hover { background: rgba(255,255,255,0.04); }
    .post-item-title {
      font-family: var(--display); font-size: 13px; font-weight: 300; margin-bottom: 2px; letter-spacing: -0.01em;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .post-item-meta { font-size: 10px; color: var(--fg-dim); margin-bottom: 4px; letter-spacing: 0.02em; }
    .post-item-cat { color: var(--accent); }
    .post-item-tags { display: flex; gap: 4px; flex-wrap: wrap; }
    .post-item-tags span {
      font-size: 9px; padding: 1px 6px; border: 1px solid rgba(255,255,255,0.1); border-radius: 3px;
      color: rgba(255,255,255,0.4); text-transform: uppercase;
    }

    .sidebar-count {
      padding: 10px 16px; border-top: 1px solid rgba(255,255,255,0.08);
      font-size: 10px; color: rgba(255,255,255,0.3); text-transform: uppercase;
      letter-spacing: 0.04em; flex-shrink: 0; text-align: center;
    }

    @media (max-width: 768px) {
      body { overflow-y: auto; height: auto; }
      .main-layout { flex-direction: column; height: auto; }
      .graph-panel { height: 50vh; flex: none; }
      .sidebar { flex: none; max-width: none; min-width: 0; border-left: none; border-top: 1px solid rgba(255,255,255,0.08); }
      .sidebar-list { max-height: 60vh; }
      .blog-header { padding: 16px 20px; }
    }
  </style>
</head>
<body>
  <header class="blog-header">
    <div class="blog-header-left">
      <a class="blog-header-back" href="${prefix}/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>${lang === 'fr' ? 'Accueil' : 'Home'}</a>
      <div class="blog-header-sep"></div>
      <h1>${lang === 'fr' ? 'Blog' : 'Blog'}<span class="blog-header-count">${posts.length}</span></h1>
    </div>
    <nav class="blog-header-nav">
      <a href="${otherLang.url}">${otherLang.label}</a>
    </nav>
  </header>

  <div class="main-layout">
    <div class="graph-panel">
      <canvas id="graphCanvas"></canvas>
      <div class="graph-hint">${lang === 'fr' ? 'Glisser pour déplacer · Molette pour zoomer' : 'Drag to move · Scroll to zoom'}</div>
    </div>
    <aside class="sidebar">
      <div class="sidebar-search">
        <input type="text" id="searchInput" placeholder="${lang === 'fr' ? 'Rechercher...' : 'Search posts...'}" />
      </div>
      <div class="sidebar-categories" id="categoryFilters"></div>
      <div class="sidebar-filter-label">${lang === 'fr' ? 'Tags' : 'Tags'}</div>
      <div class="sidebar-tags-header">
        <span>${lang === 'fr' ? 'Tags' : 'Tags'}</span>
        <button class="sidebar-tags-toggle" id="tagToggle">${lang === 'fr' ? 'Voir plus' : 'Show more'}</button>
      </div>
      <div class="sidebar-tags" id="tagFilters"></div>
      <div class="active-filters" id="activeFilters">
        <span id="filterLabel"></span>
        <button class="clear-filters" id="clearFilters">${lang === 'fr' ? 'Effacer' : 'Clear'}</button>
      </div>
      <div class="sidebar-list" id="postList"></div>
      <div class="sidebar-count" id="postCount"></div>
    </aside>
  </div>

  <div class="hover-card" id="hoverCard">
    <img class="hover-card-img" id="hoverImg" src="" alt="" />
    <div class="hover-card-title" id="hoverTitle"></div>
    <div class="hover-card-date" id="hoverDate"></div>
    <div class="hover-card-excerpt" id="hoverExcerpt"></div>
    <div class="hover-card-tags" id="hoverTags"></div>
  </div>

  <script>
  const POSTS = ${postsJSON};
  const PREFIX = '${prefix}';
  const LANG = '${lang}';
  // --- Build edges from shared tags ---
  const edges = [];
  for (let i = 0; i < POSTS.length; i++) {
    for (let j = i + 1; j < POSTS.length; j++) {
      const shared = POSTS[i].tags.filter(t => POSTS[j].tags.includes(t));
      if (shared.length > 0) {
        edges.push({ source: i, target: j, weight: shared.length });
      }
    }
  }

  // --- Collect all categories and tags ---
  const allCategories = [...new Set(POSTS.map(p => p.category))].sort();
  const allTags = [...new Set(POSTS.flatMap(p => p.tags))].sort();

  // --- Nodes ---
  const NODE_RADIUS = 5;
  const NODE_COLOR = '#a882ff';
  const NODE_COLOR_R = 168, NODE_COLOR_G = 130, NODE_COLOR_B = 255;

  const nodes = POSTS.map((p, i) => {
    const angle = (i / Math.max(POSTS.length, 1)) * Math.PI * 2;
    const spread = 120 + Math.random() * 80;
    return {
      x: Math.cos(angle) * spread + (Math.random() - 0.5) * 40,
      y: Math.sin(angle) * spread + (Math.random() - 0.5) * 40,
      vx: 0, vy: 0,
      postIndex: i,
      pinned: false,
      breathPhase: Math.random() * Math.PI * 2,
    };
  });

  // --- Canvas setup ---
  const canvas = document.getElementById('graphCanvas');
  const ctx = canvas.getContext('2d');
  let W, H;
  let camX = 0, camY = 0, camZoom = 1.8;
  let hoveredNode = null, dragNode = null, dragOffset = { x: 0, y: 0 };
  let isPanning = false, panStart = { x: 0, y: 0 }, camStart = { x: 0, y: 0 };
  let sidebarHoverIndex = -1;
  let focusedIndex = -1; // from sidebar click highlight

  // Filter state
  let activeCategoryFilter = null;
  let activeTagFilters = new Set();
  let searchQuery = '';
  let visibleIndices = new Set(POSTS.map((_, i) => i));

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    W = rect.width; H = rect.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // --- Coordinate transforms ---
  function screenToWorld(sx, sy) {
    return { x: (sx - W / 2) / camZoom + camX, y: (sy - H / 2) / camZoom + camY };
  }
  function worldToScreen(wx, wy) {
    return { x: (wx - camX) * camZoom + W / 2, y: (wy - camY) * camZoom + H / 2 };
  }

  // --- Physics ---
  const REPULSION = 4000;
  const ATTRACTION = 0.004;
  const CENTER_GRAVITY = 0.008;
  const DAMPING = 0.85;
  const MIN_DIST = 30;
  const BREATHING_STRENGTH = 0.008; // very subtle drift like Obsidian
  let simAlpha = 0.15; // start gentle, ramp up smoothly
  let simTime = 0;
  let entranceFade = 0; // visual fade-in 0→1

  function simulate() {
    simTime++;

    // Smooth entrance: ramp up visual opacity
    if (entranceFade < 1) entranceFade = Math.min(1, entranceFade + 0.012);

    // Keep a minimum alpha for breathing — never fully stop
    const effectiveAlpha = Math.max(simAlpha, 0.002);
    if (simAlpha > 0.001) simAlpha *= 0.992;

    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].pinned) continue;

      // Center gravity
      nodes[i].vx -= nodes[i].x * CENTER_GRAVITY * effectiveAlpha;
      nodes[i].vy -= nodes[i].y * CENTER_GRAVITY * effectiveAlpha;

      // Subtle breathing / drift force (always active)
      const bp = nodes[i].breathPhase;
      const bx = Math.sin(simTime * 0.003 + bp) * BREATHING_STRENGTH;
      const by = Math.cos(simTime * 0.002 + bp * 1.3) * BREATHING_STRENGTH;
      nodes[i].vx += bx;
      nodes[i].vy += by;

      // Repulsion
      for (let j = i + 1; j < nodes.length; j++) {
        let dx = nodes[j].x - nodes[i].x;
        let dy = nodes[j].y - nodes[i].y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < MIN_DIST) dist = MIN_DIST;
        const force = REPULSION * effectiveAlpha / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].vx -= fx; nodes[i].vy -= fy;
        if (!nodes[j].pinned) { nodes[j].vx += fx; nodes[j].vy += fy; }
      }
    }

    // Attraction along edges
    for (const e of edges) {
      const a = nodes[e.source], b = nodes[e.target];
      let dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = dist * ATTRACTION * e.weight * effectiveAlpha;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      if (!a.pinned) { a.vx += fx; a.vy += fy; }
      if (!b.pinned) { b.vx -= fx; b.vy -= fy; }
    }

    // Apply velocity with damping (extra damping during entrance for smoothness)
    const effectiveDamping = simTime < 120 ? DAMPING * 0.92 : DAMPING;
    for (const n of nodes) {
      if (n.pinned) continue;
      n.vx *= effectiveDamping; n.vy *= effectiveDamping;
      n.x += n.vx; n.y += n.vy;
    }
  }

  // --- Drawing ---
  function draw() {
    ctx.clearRect(0, 0, W, H);
    // Pure black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    // Smooth entrance fade
    const eFade = entranceFade;

    const isFiltered = activeCategoryFilter || activeTagFilters.size > 0 || searchQuery.length > 0;
    const hIdx = hoveredNode !== null ? hoveredNode.postIndex : sidebarHoverIndex;
    const connectedToHover = new Set();
    if (hIdx >= 0) {
      connectedToHover.add(hIdx);
      for (const e of edges) {
        if (e.source === hIdx) connectedToHover.add(e.target);
        if (e.target === hIdx) connectedToHover.add(e.source);
      }
    }

    // Draw edges — Obsidian style: visible lines
    for (const e of edges) {
      const a = nodes[e.source], b = nodes[e.target];
      const sa = worldToScreen(a.x, a.y), sb = worldToScreen(b.x, b.y);

      let alpha, width;

      if (hIdx >= 0) {
        if ((e.source === hIdx || e.target === hIdx)) {
          alpha = 0.8;
          width = 1.5;
          ctx.strokeStyle = 'rgba(' + NODE_COLOR_R + ',' + NODE_COLOR_G + ',' + NODE_COLOR_B + ',' + (alpha * eFade) + ')';
        } else {
          alpha = 0.06;
          width = 0.5;
          ctx.strokeStyle = 'rgba(255,255,255,' + (alpha * eFade) + ')';
        }
      } else if (isFiltered) {
        if (!visibleIndices.has(e.source) || !visibleIndices.has(e.target)) {
          alpha = 0.04;
        } else {
          alpha = 0.25;
        }
        width = 0.8;
        ctx.strokeStyle = 'rgba(255,255,255,' + (alpha * eFade) + ')';
      } else {
        alpha = 0.18;
        width = 0.8;
        ctx.strokeStyle = 'rgba(255,255,255,' + (alpha * eFade) + ')';
      }

      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.lineWidth = width;
      ctx.stroke();
    }

    // Draw nodes — Obsidian style: always show labels
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const s = worldToScreen(n.x, n.y);
      const isHovered = hoveredNode === n || sidebarHoverIndex === i;
      const isFocused = focusedIndex === i;
      const isConnected = connectedToHover.has(i);
      const isVisible = visibleIndices.has(i);

      // Determine node opacity
      let nodeAlpha = 1;
      if (hIdx >= 0) {
        nodeAlpha = isConnected ? 1 : 0.15;
      } else if (isFiltered) {
        nodeAlpha = isVisible ? 1 : 0.15;
      }

      // Determine radius — hovered nodes are bigger like Obsidian
      const r = isHovered ? NODE_RADIUS * 1.6 : NODE_RADIUS;
      const screenR = r * camZoom;

      // Glow for hovered/focused nodes
      if (isHovered || isFocused) {
        const glowR = r * 3.5;
        const screenGlowR = glowR * camZoom;
        const grad = ctx.createRadialGradient(s.x, s.y, screenR * 0.3, s.x, s.y, screenGlowR);
        grad.addColorStop(0, 'rgba(' + NODE_COLOR_R + ',' + NODE_COLOR_G + ',' + NODE_COLOR_B + ',' + (0.35 * eFade) + ')');
        grad.addColorStop(1, 'rgba(' + NODE_COLOR_R + ',' + NODE_COLOR_G + ',' + NODE_COLOR_B + ',0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, screenGlowR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Node circle — filled dot
      ctx.beginPath();
      ctx.arc(s.x, s.y, screenR, 0, Math.PI * 2);
      ctx.globalAlpha = nodeAlpha * eFade;
      ctx.fillStyle = (isHovered || isFocused) ? '#ffffff' : NODE_COLOR;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Label — always visible, to the right of the node (Obsidian style)
      const label = POSTS[i].title.length > 30 ? POSTS[i].title.slice(0, 28) + '\u2026' : POSTS[i].title;
      let labelAlpha;
      if (isHovered || isFocused) {
        labelAlpha = 1;
      } else if (hIdx >= 0 && isConnected) {
        labelAlpha = 0.85;
      } else if (hIdx >= 0) {
        labelAlpha = 0.08;
      } else if (isFiltered && !isVisible) {
        labelAlpha = 0.08;
      } else {
        labelAlpha = 0.55;
      }

      ctx.globalAlpha = labelAlpha * eFade;
      ctx.fillStyle = '#ffffff';
      ctx.font = (isHovered ? '500 ' : '400 ') + Math.max(10, 11 / Math.max(camZoom * 0.6, 0.5)) + 'px "Space Grotesk", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, s.x + screenR + 6, s.y);
      ctx.globalAlpha = 1;
    }
  }

  // --- Animation loop ---
  function loop() {
    simulate();
    draw();
    requestAnimationFrame(loop);
  }

  // --- Mouse interactions ---
  function getNodeAt(sx, sy) {
    const w = screenToWorld(sx, sy);
    // Use a generous hit area: node radius + some padding, in world coords
    const hitPad = 6 / camZoom;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = w.x - n.x, dy = w.y - n.y;
      const hitR = NODE_RADIUS + hitPad;
      if (dx * dx + dy * dy < hitR * hitR) return n;
    }
    return null;
  }

  const hoverCard = document.getElementById('hoverCard');
  const hoverImg = document.getElementById('hoverImg');
  const hoverTitle = document.getElementById('hoverTitle');
  const hoverDate = document.getElementById('hoverDate');
  const hoverExcerpt = document.getElementById('hoverExcerpt');
  const hoverTags = document.getElementById('hoverTags');

  function populateHoverCard(postIndex) {
    const p = POSTS[postIndex];
    if (p.coverImage) { hoverImg.src = p.coverImage; hoverImg.style.display = 'block'; }
    else { hoverImg.style.display = 'none'; }
    hoverTitle.textContent = p.title;
    const locale = LANG === 'fr' ? 'fr-FR' : 'en-US';
    hoverDate.innerHTML = '<span style="color:var(--accent)">' + p.category + '</span> · ' + new Date(p.date).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
    const exc = p.excerpt.length > 120 ? p.excerpt.slice(0, 117) + '...' : p.excerpt;
    hoverExcerpt.textContent = exc;
    hoverTags.innerHTML = p.tags.map(t => '<span>' + t + '</span>').join('');
  }

  function showHoverCard(node, mx, my) {
    populateHoverCard(node.postIndex);
    let left = mx + 16, top = my - 20;
    if (left + 310 > window.innerWidth) left = mx - 320;
    if (top + 250 > window.innerHeight) top = window.innerHeight - 260;
    if (top < 10) top = 10;
    hoverCard.style.left = left + 'px';
    hoverCard.style.top = top + 'px';
    hoverCard.classList.add('visible');
  }

  function showHoverCardForSidebar(postIndex, itemEl) {
    populateHoverCard(postIndex);
    // Position over the graph panel area
    const graphRect = canvas.getBoundingClientRect();
    const itemRect = itemEl.getBoundingClientRect();
    let left = graphRect.right - 320;
    let top = itemRect.top;
    if (left < graphRect.left + 10) left = graphRect.left + 10;
    if (top + 250 > window.innerHeight) top = window.innerHeight - 260;
    if (top < 10) top = 10;
    hoverCard.style.left = left + 'px';
    hoverCard.style.top = top + 'px';
    hoverCard.classList.add('visible');
  }

  function hideHoverCard() {
    hoverCard.classList.remove('visible');
  }

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;

    if (dragNode) {
      const w = screenToWorld(mx, my);
      dragNode.x = w.x + dragOffset.x;
      dragNode.y = w.y + dragOffset.y;
      dragNode.vx = 0; dragNode.vy = 0;
      simAlpha = Math.max(simAlpha, 0.1);
      return;
    }
    if (isPanning) {
      camX = camStart.x - (e.clientX - panStart.x) / camZoom;
      camY = camStart.y - (e.clientY - panStart.y) / camZoom;
      return;
    }

    const node = getNodeAt(mx, my);
    if (node !== hoveredNode) {
      // Unpin previously hovered node (unless it's being dragged)
      if (hoveredNode && hoveredNode !== dragNode) hoveredNode.pinned = false;
      hoveredNode = node;
      // Pin hovered node so it stops moving
      if (node) node.pinned = true;
      canvas.style.cursor = node ? 'pointer' : 'grab';
      if (node) showHoverCard(node, e.clientX, e.clientY);
      else hideHoverCard();
    } else if (node) {
      showHoverCard(node, e.clientX, e.clientY);
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const node = getNodeAt(mx, my);
    if (node) {
      dragNode = node;
      node.pinned = true;
      const w = screenToWorld(mx, my);
      dragOffset.x = node.x - w.x;
      dragOffset.y = node.y - w.y;
      canvas.style.cursor = 'grabbing';
      hideHoverCard();
    } else {
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY };
      camStart = { x: camX, y: camY };
      canvas.style.cursor = 'grabbing';
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (dragNode) {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const w = screenToWorld(mx, my);
      const dx = (dragNode.x - dragOffset.x) - w.x;
      const dy = (dragNode.y - dragOffset.y) - w.y;
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
        const p = POSTS[dragNode.postIndex];
        window.location.href = PREFIX + '/blog/' + p.slug + '/';
      }
      dragNode.pinned = false;
      dragNode = null;
    }
    if (isPanning) isPanning = false;
    canvas.style.cursor = hoveredNode ? 'pointer' : 'grab';
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const w = screenToWorld(mx, my);
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    camZoom = Math.max(0.15, Math.min(5, camZoom * factor));
    camX = w.x - (mx - W / 2) / camZoom;
    camY = w.y - (my - H / 2) / camZoom;
  }, { passive: false });

  canvas.addEventListener('mouseleave', () => {
    if (hoveredNode && hoveredNode !== dragNode) hoveredNode.pinned = false;
    hoveredNode = null;
    hideHoverCard();
  });

  // --- Touch support ---
  let lastTouchDist = 0;
  let touchStartNode = null;

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const mx = t.clientX - rect.left, my = t.clientY - rect.top;
      const node = getNodeAt(mx, my);
      if (node) {
        dragNode = node;
        touchStartNode = node;
        node.pinned = true;
        const w = screenToWorld(mx, my);
        dragOffset.x = node.x - w.x;
        dragOffset.y = node.y - w.y;
      } else {
        isPanning = true;
        panStart = { x: t.clientX, y: t.clientY };
        camStart = { x: camX, y: camY };
      }
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist = Math.sqrt(dx * dx + dy * dy);
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const mx = t.clientX - rect.left, my = t.clientY - rect.top;
      if (dragNode) {
        const w = screenToWorld(mx, my);
        dragNode.x = w.x + dragOffset.x;
        dragNode.y = w.y + dragOffset.y;
        dragNode.vx = 0; dragNode.vy = 0;
        simAlpha = Math.max(simAlpha, 0.1);
      } else if (isPanning) {
        camX = camStart.x - (t.clientX - panStart.x) / camZoom;
        camY = camStart.y - (t.clientY - panStart.y) / camZoom;
      }
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastTouchDist > 0) {
        const factor = dist / lastTouchDist;
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const rect = canvas.getBoundingClientRect();
        const mx = cx - rect.left, my = cy - rect.top;
        const w = screenToWorld(mx, my);
        camZoom = Math.max(0.15, Math.min(5, camZoom * factor));
        camX = w.x - (mx - W / 2) / camZoom;
        camY = w.y - (my - H / 2) / camZoom;
      }
      lastTouchDist = dist;
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (dragNode) {
      if (touchStartNode === dragNode && e.changedTouches.length === 1) {
        const t = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        const mx = t.clientX - rect.left, my = t.clientY - rect.top;
        const w = screenToWorld(mx, my);
        const ddx = (dragNode.x - dragOffset.x) - w.x;
        const ddy = (dragNode.y - dragOffset.y) - w.y;
        if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) {
          const p = POSTS[dragNode.postIndex];
          window.location.href = PREFIX + '/blog/' + p.slug + '/';
        }
      }
      dragNode.pinned = false;
      dragNode = null;
      touchStartNode = null;
    }
    isPanning = false;
    lastTouchDist = 0;
  });

  // --- Sidebar: Categories ---
  const categoryFilters = document.getElementById('categoryFilters');
  allCategories.forEach(cat => {
    const pill = document.createElement('button');
    pill.className = 'cat-pill';
    pill.textContent = cat;
    pill.addEventListener('click', () => {
      if (activeCategoryFilter === cat) {
        activeCategoryFilter = null;
        pill.classList.remove('active');
      } else {
        activeCategoryFilter = cat;
        document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
      }
      applyFilters();
    });
    categoryFilters.appendChild(pill);
  });

  // --- Sidebar: Tags (top 20 by frequency) ---
  const tagFilters = document.getElementById('tagFilters');
  const tagToggle = document.getElementById('tagToggle');
  const tagCounts = {};
  POSTS.forEach(p => p.tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 20).map(e => e[0]).sort();
  topTags.forEach(tag => {
    const pill = document.createElement('button');
    pill.className = 'tag-pill';
    pill.textContent = tag;
    pill.addEventListener('click', () => {
      if (activeTagFilters.has(tag)) activeTagFilters.delete(tag);
      else activeTagFilters.add(tag);
      pill.classList.toggle('active');
      applyFilters();
    });
    tagFilters.appendChild(pill);
  });
  tagToggle.addEventListener('click', () => {
    const expanded = tagFilters.classList.toggle('expanded');
    tagToggle.textContent = expanded ? '${lang === 'fr' ? 'Voir moins' : 'Show less'}' : '${lang === 'fr' ? 'Voir plus' : 'Show more'}';
  });

  // --- Sidebar: Search ---
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.toLowerCase().trim();
    applyFilters();
  });

  // --- Sidebar: Active filters bar ---
  const activeFiltersEl = document.getElementById('activeFilters');
  const filterLabel = document.getElementById('filterLabel');
  const clearFilters = document.getElementById('clearFilters');
  clearFilters.addEventListener('click', () => {
    activeCategoryFilter = null;
    activeTagFilters.clear();
    searchQuery = '';
    searchInput.value = '';
    document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tag-pill').forEach(p => p.classList.remove('active'));
    applyFilters();
  });

  // --- Sidebar: Post list ---
  const postListEl = document.getElementById('postList');
  const postCountEl = document.getElementById('postCount');

  function renderPostList() {
    postListEl.innerHTML = '';
    const locale = LANG === 'fr' ? 'fr-FR' : 'en-US';
    const indices = [...visibleIndices].sort((a, b) => new Date(POSTS[b].date) - new Date(POSTS[a].date));
    for (const i of indices) {
      const p = POSTS[i];
      const item = document.createElement('div');
      item.className = 'post-item';
      item.innerHTML = '<div class="post-item-title">' + p.title + '</div>' +
        '<div class="post-item-meta"><span class="post-item-cat">' + p.category + '</span> · ' + new Date(p.date).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' }) + '</div>' +
        '<div class="post-item-tags">' + p.tags.map(t => '<span>' + t + '</span>').join('') + '</div>';
      item.addEventListener('click', () => {
        window.location.href = PREFIX + '/blog/' + p.slug + '/';
      });
      item.addEventListener('mouseenter', () => {
        sidebarHoverIndex = i;
        focusedIndex = i;
        showHoverCardForSidebar(i, item);
      });
      item.addEventListener('mouseleave', () => {
        sidebarHoverIndex = -1;
        focusedIndex = -1;
        hideHoverCard();
      });
      postListEl.appendChild(item);
    }

    const total = POSTS.length;
    const shown = indices.length;
    postCountEl.textContent = shown === total
      ? total + ' ' + (LANG === 'fr' ? 'articles' : 'posts')
      : shown + ' / ' + total;
  }

  function applyFilters() {
    visibleIndices.clear();
    for (let i = 0; i < POSTS.length; i++) {
      const p = POSTS[i];
      let match = true;
      if (activeCategoryFilter) {
        match = p.category === activeCategoryFilter;
      }
      if (match && activeTagFilters.size > 0) {
        match = [...activeTagFilters].some(t => p.tags.includes(t));
      }
      if (match && searchQuery) {
        match = p.title.toLowerCase().includes(searchQuery) ||
                p.excerpt.toLowerCase().includes(searchQuery) ||
                p.tags.some(t => t.toLowerCase().includes(searchQuery));
      }
      if (match) visibleIndices.add(i);
    }

    const hasFilters = activeCategoryFilter || activeTagFilters.size > 0 || searchQuery.length > 0;
    activeFiltersEl.classList.toggle('visible', hasFilters);
    if (hasFilters) {
      const parts = [];
      if (activeCategoryFilter) parts.push(activeCategoryFilter);
      if (searchQuery) parts.push('"' + searchQuery + '"');
      if (activeTagFilters.size) parts.push([...activeTagFilters].join(', '));
      filterLabel.textContent = parts.join(' + ');
    }

    renderPostList();
    simAlpha = Math.max(simAlpha, 0.05);
  }

  // --- Init ---
  applyFilters();
  canvas.style.cursor = 'grab';
  loop();
  </script>
</body>
</html>`;
}

function blogPostHTML(data, post, lang, allPosts, postIndex) {
  const prefix = lang === 'fr' ? '/fr' : '';
  const seo = post.seo || {};
  const prevPost = postIndex > 0 ? allPosts[postIndex - 1] : null;
  const nextPost = postIndex < allPosts.length - 1 ? allPosts[postIndex + 1] : null;
  const prevLabel = lang === 'fr' ? 'PRÉCÉDENT' : 'PREVIOUS';
  const nextLabel = lang === 'fr' ? 'SUIVANT' : 'NEXT';
  const wpId = post.wpId || 0;
  const wpUrl = process.env.WP_URL || '';
  const i18n = {
    comments: lang === 'fr' ? 'Commentaires' : 'Comments',
    noComments: lang === 'fr' ? 'Aucun commentaire pour le moment.' : 'No comments yet.',
    beFirst: lang === 'fr' ? 'Soyez le premier a commenter.' : 'Be the first to comment.',
    leave: lang === 'fr' ? 'Laisser un commentaire' : 'Leave a comment',
    name: lang === 'fr' ? 'Nom' : 'Name',
    email: lang === 'fr' ? 'Courriel' : 'Email',
    comment: lang === 'fr' ? 'Commentaire' : 'Comment',
    submit: lang === 'fr' ? 'Publier' : 'Submit',
    sending: lang === 'fr' ? 'Envoi...' : 'Submitting...',
    success: lang === 'fr' ? 'Commentaire envoyé ! Il sera visible après modération.' : 'Comment submitted! It will appear after moderation.',
    error: lang === 'fr' ? 'Erreur. Veuillez réessayer.' : 'Error. Please try again.',
    views: lang === 'fr' ? 'vues' : 'views',
    reply: lang === 'fr' ? 'Répondre' : 'Reply',
    ago: lang === 'fr' ? 'il y a' : 'ago',
  };
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${seo.title || post.title} — ${data.intro.name}</title>
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <meta name="description" content="${seo.description || post.excerpt}" />
  ${seo.ogImage ? `<meta property="og:image" content="${seo.ogImage}" />` : ''}
  <meta property="og:title" content="${seo.title || post.title}" />
  <meta property="og:description" content="${seo.description || post.excerpt}" />
  <meta property="og:type" content="article" />
  <link rel="canonical" href="https://khalildrissi.com${prefix}/blog/${post.slug}/" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #0e0e0e; --fg: #ffffff; --fg-dim: rgba(255,255,255,0.7);
      --fg-faint: rgba(255,255,255,0.30); --accent: #7c4dff;
      --mono: 'DM Mono', monospace; --sans: 'Inter', sans-serif; --display: 'Space Grotesk', sans-serif;
    }
    html { -webkit-font-smoothing: antialiased; scroll-behavior: smooth; }
    body { background: var(--bg); color: var(--fg); font-family: var(--mono); font-size: 13px; line-height: 1.7; }
    a { color: var(--accent); }
    img { display: block; max-width: 100%; }
    .post-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 20px 40px; border-bottom: 1px solid rgba(255,255,255,0.08);
      font-size: 12px;
    }
    .post-header a { color: var(--fg-dim); text-decoration: none; }
    .post-header a:hover { color: #fff; }
    .post-hero-wrap {
      position: relative; width: 100%; min-height: 340px; max-height: 520px;
      display: flex; align-items: flex-end; overflow: hidden;
    }
    .post-hero-wrap img {
      position: absolute; inset: 0; width: 100%; height: 100%;
      object-fit: cover; z-index: 0;
    }
    .post-hero-wrap::after {
      content: ''; position: absolute; inset: 0; z-index: 1;
      background: linear-gradient(0deg, var(--bg) 0%, rgba(10,10,10,0.88) 40%, rgba(10,10,10,0.5) 70%, rgba(10,10,10,0.25) 100%);
    }
    .post-hero-content {
      position: relative; z-index: 2; max-width: 720px;
      padding: 0 40px 40px; width: 100%;
      margin: 0 auto;
    }
    .post-hero-wrap .post-date {
      font-size: 11px; color: rgba(255,255,255,0.72); text-transform: uppercase;
      letter-spacing: 0.06em; font-family: var(--mono); margin-bottom: 12px; display: block;
    }
    .post-hero-wrap .post-title {
      font-family: var(--display); font-size: clamp(28px, 5vw, 44px); font-weight: 400;
      margin-bottom: 16px; line-height: 1.15; letter-spacing: -0.02em; color: #fff;
      text-shadow: 0 1px 8px rgba(0,0,0,0.4);
    }
    .post-hero-wrap .post-meta-bottom {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 0;
    }
    .post-no-hero { padding-top: 40px; }
    .post-no-hero .post-date {
      font-size: 11px; color: var(--fg-dim); text-transform: uppercase;
      letter-spacing: 0.06em; font-family: var(--mono); margin-bottom: 12px; display: block;
    }
    .post-no-hero .post-title {
      font-family: var(--display); font-size: clamp(28px, 5vw, 44px); font-weight: 400;
      margin-bottom: 16px; line-height: 1.15; letter-spacing: -0.02em;
    }
    .post-no-hero .post-meta-bottom {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 36px;
    }
    .post-container { max-width: 720px; margin: 0 auto; padding: 40px 20px 80px; }
    .post-category { font-size: 11px; color: var(--accent); font-family: var(--mono); letter-spacing: 0.02em; }
    .post-meta-sep { font-size: 10px; color: rgba(255,255,255,0.25); }
    .post-tags { display: flex; gap: 5px; flex-wrap: wrap; }
    .post-tags span {
      font-size: 10px; padding: 2px 8px; border-radius: 20px;
      color: rgba(255,255,255,0.65); background: rgba(255,255,255,0.12);
      letter-spacing: 0.01em; font-family: var(--mono);
    }
    .post-body h2 { font-family: var(--display); font-size: 24px; font-weight: 300; margin: 32px 0 12px; letter-spacing: -0.01em; }
    .post-body h3 { font-size: 14px; font-weight: 500; margin: 24px 0 8px; text-transform: uppercase; letter-spacing: 0.03em; }
    .post-body p { color: var(--fg-dim); margin-bottom: 16px; }
    .post-body ul, .post-body ol { color: var(--fg-dim); margin: 0 0 16px 20px; }
    .post-body li { margin-bottom: 6px; }
    .post-body strong { color: var(--fg); }
    .post-body pre {
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 6px; padding: 16px; overflow-x: auto; margin: 16px 0; font-size: 12px;
    }
    .post-body code { font-family: var(--mono); font-size: 12px; }
    .post-body img { border-radius: 8px; margin: 20px 0; }

    /* Download buttons */
    .formation-downloads { margin: 32px 0; padding: 24px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; }
    .formation-downloads h2 { margin-top: 0 !important; }
    .download-buttons { display: flex; gap: 12px; flex-wrap: wrap; }
    .download-btn {
      display: inline-flex; align-items: center; gap: 10px;
      padding: 14px 24px; border-radius: 6px;
      background: rgba(124,77,255,0.12); border: 1px solid rgba(124,77,255,0.3);
      color: #fff; font-family: var(--mono); font-size: 13px; font-weight: 500;
      text-decoration: none; transition: background 0.2s, border-color 0.2s, transform 0.15s;
      letter-spacing: 0.01em;
    }
    .download-btn:hover { background: rgba(124,77,255,0.22); border-color: rgba(124,77,255,0.5); transform: translateY(-1px); }
    .download-btn svg { flex-shrink: 0; opacity: 0.8; }

    /* ---- Listen (TTS) ---- */
    .listen-bar {
      max-width: 720px; margin: 0 auto; padding: 0 20px;
    }
    .listen-player {
      display: flex; align-items: center; gap: 12px;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px; padding: 10px 16px; margin-bottom: 4px;
    }
    .listen-btn {
      width: 32px; height: 32px; border-radius: 50%;
      background: var(--accent); border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: opacity 0.2s;
    }
    .listen-btn:hover { opacity: 0.85; }
    .listen-btn svg { width: 14px; height: 14px; fill: #fff; }
    .listen-info { flex: 1; min-width: 0; }
    .listen-title {
      font-size: 11px; font-family: var(--mono); color: var(--fg-dim);
      letter-spacing: 0.03em; text-transform: uppercase; margin-bottom: 3px;
    }
    .listen-progress-wrap {
      width: 100%; height: 3px; background: rgba(255,255,255,0.1);
      border-radius: 2px; overflow: hidden; cursor: pointer;
    }
    .listen-progress {
      height: 100%; width: 0%; background: var(--accent);
      border-radius: 2px; transition: width 0.3s linear;
    }
    .listen-time {
      font-size: 11px; font-family: var(--mono); color: var(--fg-faint);
      flex-shrink: 0; font-variant-numeric: tabular-nums;
    }
    .listen-speed {
      font-size: 10px; font-family: var(--mono); color: var(--fg-dim);
      background: rgba(255,255,255,0.08); border: none; cursor: pointer;
      padding: 3px 8px; border-radius: 4px; transition: background 0.2s;
    }
    .listen-speed:hover { background: rgba(255,255,255,0.14); }

    /* ---- TOC ---- */
    .toc {
      position: fixed; left: 24px; top: 50%; transform: translateY(-50%);
      display: flex; flex-direction: column; gap: 12px; z-index: 100;
      opacity: 0; pointer-events: none;
      transition: opacity 0.5s ease;
    }
    .toc.visible { opacity: 1; pointer-events: auto; }
    .toc-item {
      display: flex; align-items: center; gap: 6px; cursor: pointer;
      text-decoration: none; height: 32px; overflow: visible;
    }
    .toc-num {
      width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,0.08); color: var(--fg-dim); font-size: 11px;
      font-family: var(--mono); border-radius: 4px; flex-shrink: 0;
      transition: background 0.4s ease, color 0.4s ease;
    }
    .toc-label {
      font-size: 11px; font-family: var(--mono); color: var(--fg);
      white-space: nowrap; max-width: 0; overflow: hidden;
      transition: max-width 0.3s cubic-bezier(0.25, 0.1, 0.25, 1), padding 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
      padding: 0; background: var(--accent); border-radius: 4px;
      height: 32px; display: flex; align-items: center;
    }
    .toc-label-inner {
      display: inline-block; white-space: nowrap;
      transition: transform 0s linear;
    }
    .toc-label-inner.scrolling {
      animation: tocMarquee var(--scroll-dur, 4s) linear infinite;
    }
    @keyframes tocMarquee {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    .toc-item:hover .toc-label,
    .toc-item.peek .toc-label { max-width: 260px; padding: 0 12px; }
    .toc-item.active .toc-num { background: var(--accent); color: #fff; }

    /* ---- Comments ---- */
    .comments-section {
      max-width: 720px; margin: 0 auto; padding: 0 20px 60px;
    }
    .comments-header {
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--fg-dim); margin-bottom: 24px; padding-bottom: 12px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .comments-header span { color: var(--fg-faint); margin-left: 6px; }
    .comment {
      padding: 16px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .comment-head {
      display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
    }
    .comment-avatar {
      width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.08);
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; color: var(--fg-dim); flex-shrink: 0;
    }
    .comment-author { font-size: 12px; color: var(--fg); font-weight: 500; }
    .comment-date { font-size: 10px; color: var(--fg-faint); }
    .comment-body { font-size: 12px; color: var(--fg-dim); line-height: 1.6; padding-left: 38px; }
    .comment-body p { margin-bottom: 8px; }
    .comment-reply { margin-left: 38px; }
    .comment-reply-btn {
      font-size: 10px; color: var(--fg-faint); background: none; border: none;
      cursor: pointer; font-family: var(--mono); text-transform: uppercase;
      letter-spacing: 0.06em; padding: 4px 0;
    }
    .comment-reply-btn:hover { color: var(--accent); }
    .comment-children { margin-left: 38px; border-left: 1px solid rgba(255,255,255,0.06); padding-left: 16px; }
    .comments-empty {
      font-size: 12px; color: var(--fg-faint); padding: 20px 0; text-align: center;
    }
    .comment-form {
      margin-top: 24px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.08);
    }
    .comment-form-title {
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--fg-dim); margin-bottom: 16px;
    }
    .comment-form-row { display: flex; gap: 12px; margin-bottom: 12px; }
    .comment-form-row input {
      flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 4px; padding: 8px 12px; color: var(--fg); font-family: var(--mono);
      font-size: 12px; outline: none;
    }
    .comment-form-row input:focus { border-color: var(--accent); }
    .comment-form textarea {
      width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 4px; padding: 10px 12px; color: var(--fg); font-family: var(--mono);
      font-size: 12px; outline: none; resize: vertical; min-height: 80px; margin-bottom: 12px;
    }
    .comment-form textarea:focus { border-color: var(--accent); }
    .comment-form button {
      background: var(--accent); color: #fff; border: none; border-radius: 4px;
      padding: 8px 20px; font-family: var(--mono); font-size: 11px; cursor: pointer;
      text-transform: uppercase; letter-spacing: 0.06em;
      transition: opacity 0.2s;
    }
    .comment-form button:hover { opacity: 0.85; }
    .comment-form button:disabled { opacity: 0.5; cursor: not-allowed; }
    .comment-form-status {
      font-size: 11px; margin-top: 8px; min-height: 16px;
    }
    .comment-form-status.success { color: #4ade80; }
    .comment-form-status.error { color: #f87171; }

    /* ---- Post Nav ---- */
    .post-nav {
      border-top: 1px solid rgba(255,255,255,0.08);
      display: flex; align-items: center; justify-content: space-between;
      padding: 24px 40px; position: relative; gap: 24px;
    }
    .post-nav-link {
      display: flex; align-items: center; gap: 12px;
      text-decoration: none; color: var(--fg-dim); position: relative;
      transition: color 0.2s; flex: 1; min-width: 0; max-width: 42%;
    }
    .post-nav-link:hover { color: var(--fg); }
    .post-nav-link svg { width: 16px; height: 16px; flex-shrink: 0; }
    .post-nav-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .post-nav-label {
      font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--fg-dim); font-family: var(--mono);
    }
    .post-nav-title {
      font-size: 13px; font-family: var(--mono); color: var(--fg);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
    }
    .post-nav-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 3px;
      width: 18px; height: 18px; text-decoration: none; flex-shrink: 0;
    }
    .post-nav-grid span {
      background: rgba(255,255,255,0.3); border-radius: 1px;
      transition: background 0.2s;
    }
    .post-nav-grid:hover span { background: var(--accent); }
    .post-nav-prev { text-align: left; }
    .post-nav-next { text-align: right; flex-direction: row-reverse; }

    /* Preview card on hover */
    .post-nav-preview {
      position: absolute; bottom: 100%; margin-bottom: 12px;
      width: 280px; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px; overflow: hidden; opacity: 0; pointer-events: none;
      transform: translateY(8px); transition: opacity 0.25s, transform 0.25s;
      z-index: 10;
    }
    .post-nav-prev .post-nav-preview { left: 0; }
    .post-nav-next .post-nav-preview { right: 0; }
    .post-nav-link:hover .post-nav-preview { opacity: 1; transform: translateY(0); pointer-events: auto; }
    .post-nav-preview img {
      width: 100%; height: 140px; object-fit: cover;
    }
    .post-nav-preview-body { padding: 12px; }
    .post-nav-preview-title {
      font-size: 12px; font-family: var(--mono); color: var(--fg);
      margin-bottom: 4px; line-height: 1.4;
    }
    .post-nav-preview-excerpt {
      font-size: 11px; color: var(--fg-dim); line-height: 1.5;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }

    @media (max-width: 900px) {
      .toc { display: none; }
    }
    @media (max-width: 900px) and (min-width: 641px) {
      .post-nav { padding: 20px; }
      .post-nav-title { font-size: 12px; }
      .post-nav-preview { display: none; }
    }
    @media (max-width: 640px) {
      .post-header { padding: 16px 20px; }
      .post-hero-wrap { min-height: 280px; }
      .post-hero-content { padding: 0 20px 28px; }
      .post-container { padding: 24px 16px 60px; }
      .post-nav { padding: 20px 16px; flex-wrap: wrap; gap: 16px; }
      .post-nav-link { flex: 1 1 100%; max-width: 100%; }
      .post-nav-next { flex-direction: row; text-align: left; }
      .post-nav-next .post-nav-info { text-align: right; }
      .post-nav-grid { order: -1; margin: 0 auto; }
      .post-nav-preview { display: none; }
      .comment-form-row { flex-direction: column; }
    }
  </style>
</head>
<body>
  <header class="post-header">
    <a href="${prefix}/blog/">&larr; ${lang === 'fr' ? 'Retour au blog' : 'Back to blog'}</a>
    <a href="${prefix}/">${data.intro.name}</a>
  </header>
  ${post.coverImage ? `
  <div class="post-hero-wrap">
    <img src="${post.coverImage}" alt="" />
    <div class="post-hero-content">
      <span class="post-date">${new Date(post.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
      <h1 class="post-title">${post.title}</h1>
      <div class="post-meta-bottom">
        <span class="post-category">${post.category || ''}</span>
        <span class="post-meta-sep">·</span>
        <div class="post-tags">${post.tags.filter(t => t.toLowerCase() !== 'featured').map(t => `<span>${t}</span>`).join('')}</div>
      </div>
    </div>
  </div>` : `
  <div class="post-no-hero" style="max-width:720px;margin:0 auto;padding-left:20px;padding-right:20px;">
    <span class="post-date">${new Date(post.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
    <h1 class="post-title">${post.title}</h1>
    <div class="post-meta-bottom">
      <span class="post-category">${post.category || ''}</span>
      <span class="post-meta-sep">·</span>
      <div class="post-tags">${post.tags.filter(t => t.toLowerCase() !== 'featured').map(t => `<span>${t}</span>`).join('')}</div>
    </div>
  </div>`}
  <div class="listen-bar">
    <div class="listen-player" id="listenPlayer">
      <button class="listen-btn" id="listenBtn" aria-label="${lang === 'fr' ? 'Écouter l\'article' : 'Listen to article'}">
        <svg viewBox="0 0 24 24" id="listenIcon"><polygon points="6,4 20,12 6,20" /></svg>
      </button>
      <div class="listen-info">
        <div class="listen-title">${lang === 'fr' ? 'Écouter l\'article' : 'Listen to article'}</div>
        <div class="listen-progress-wrap" id="listenProgressWrap">
          <div class="listen-progress" id="listenProgress"></div>
        </div>
      </div>
      <span class="listen-time" id="listenTime">0:00</span>
      <button class="listen-speed" id="listenSpeed">1×</button>
    </div>
  </div>
  <article class="post-container">
    <div class="post-body">${post.body}</div>
  </article>

  <!-- Comments -->
  <section class="comments-section" id="commentsSection">
    <div class="comments-header">${i18n.comments}<span id="commentCount"></span></div>
    <div id="commentsList"></div>
    <div class="comment-form" id="commentForm">
      <div class="comment-form-title">${i18n.leave}</div>
      <div class="comment-form-row">
        <input type="text" id="cmtName" placeholder="${i18n.name}" />
        <input type="email" id="cmtEmail" placeholder="${i18n.email}" />
      </div>
      <textarea id="cmtBody" placeholder="${i18n.comment}"></textarea>
      <input type="hidden" id="cmtParent" value="0" />
      <button id="cmtSubmit">${i18n.submit}</button>
      <div class="comment-form-status" id="cmtStatus"></div>
    </div>
  </section>

  <nav class="post-nav">
    ${prevPost ? `<a class="post-nav-link post-nav-prev" href="${prefix}/blog/${prevPost.slug}/">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      <div class="post-nav-info">
        <span class="post-nav-label">${prevLabel}</span>
        <span class="post-nav-title">${prevPost.title}</span>
      </div>
      <div class="post-nav-preview">
        ${prevPost.coverImage ? `<img src="${prevPost.coverImage}" alt="" />` : ''}
        <div class="post-nav-preview-body">
          <div class="post-nav-preview-title">${prevPost.title}</div>
          <div class="post-nav-preview-excerpt">${prevPost.excerpt || ''}</div>
        </div>
      </div>
    </a>` : '<div style="flex:1"></div>'}

    <a class="post-nav-grid" href="${prefix}/blog/" title="${lang === 'fr' ? 'Tous les articles' : 'All posts'}">
      <span></span><span></span><span></span><span></span>
    </a>

    ${nextPost ? `<a class="post-nav-link post-nav-next" href="${prefix}/blog/${nextPost.slug}/">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      <div class="post-nav-info">
        <span class="post-nav-label">${nextLabel}</span>
        <span class="post-nav-title">${nextPost.title}</span>
      </div>
      <div class="post-nav-preview">
        ${nextPost.coverImage ? `<img src="${nextPost.coverImage}" alt="" />` : ''}
        <div class="post-nav-preview-body">
          <div class="post-nav-preview-title">${nextPost.title}</div>
          <div class="post-nav-preview-excerpt">${nextPost.excerpt || ''}</div>
        </div>
      </div>
    </a>` : '<div style="flex:1"></div>'}
  </nav>

  <nav class="toc" id="toc"></nav>

  <script>
  (function() {
    var SLUG = '${post.slug}';
    var WP_ID = ${wpId};
    var WP_URL = '${wpUrl}';
    var I18N = ${JSON.stringify(i18n)};

    // ---- Listen (TTS) ----
    (function() {
      var synth = window.speechSynthesis;
      if (!synth) { document.getElementById('listenPlayer').style.display = 'none'; return; }

      var btn = document.getElementById('listenBtn');
      var icon = document.getElementById('listenIcon');
      var progress = document.getElementById('listenProgress');
      var progressWrap = document.getElementById('listenProgressWrap');
      var timeEl = document.getElementById('listenTime');
      var speedBtn = document.getElementById('listenSpeed');
      var titleEl = document.querySelector('.listen-title');

      var playing = false, paused = false, utterance = null;
      var speeds = [1, 1.25, 1.5, 1.75, 2];
      var speedIdx = 0;
      var startTime = 0, elapsed = 0, totalEstimate = 0;
      var tickInterval = null;
      var keepAliveInterval = null;
      var textContent = '';
      var voicesReady = false;

      // Wait for voices to load (Chrome loads them async)
      function ensureVoices(cb) {
        var voices = synth.getVoices();
        if (voices.length > 0) { voicesReady = true; cb(); return; }
        synth.addEventListener('voiceschanged', function handler() {
          voicesReady = true;
          synth.removeEventListener('voiceschanged', handler);
          cb();
        });
        // Fallback: try anyway after 1s even if no voices event
        setTimeout(function() { if (!voicesReady) { voicesReady = true; cb(); } }, 1000);
      }

      // Extract plain text from article
      var body = document.querySelector('.post-body');
      if (body) {
        textContent = body.innerText || body.textContent || '';
        textContent = textContent.replace(/\\s+/g, ' ').trim();
      }

      // Estimate reading time in seconds (150 words per min at 1x)
      var wordCount = textContent.split(/\\s+/).length;
      totalEstimate = Math.round((wordCount / 150) * 60);

      function fmt(secs) {
        var m = Math.floor(secs / 60);
        var s = Math.floor(secs % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
      }

      timeEl.textContent = fmt(totalEstimate);

      var playPath = '<polygon points="6,4 20,12 6,20" />';
      var pausePath = '<rect x="5" y="4" width="4" height="16" /><rect x="13" y="4" width="4" height="16" />';

      function tick() {
        if (!playing || paused) return;
        elapsed = (Date.now() - startTime) / 1000;
        var pct = Math.min(100, (elapsed / (totalEstimate / speeds[speedIdx])) * 100);
        progress.style.width = pct + '%';
        var remaining = Math.max(0, (totalEstimate / speeds[speedIdx]) - elapsed);
        timeEl.textContent = fmt(remaining);
      }

      // Pre-split text into chunks (smaller for reliability)
      var chunks = [];
      var maxLen = 160;
      var words = textContent.split(' ');
      var chunk = '';
      for (var i = 0; i < words.length; i++) {
        if ((chunk + ' ' + words[i]).length > maxLen && chunk) {
          chunks.push(chunk);
          chunk = words[i];
        } else {
          chunk = chunk ? chunk + ' ' + words[i] : words[i];
        }
      }
      if (chunk) chunks.push(chunk);
      var currentChunk = 0;
      var speakGeneration = 0;

      // Chrome bug workaround: synth stops after ~15s of continuous speech.
      // Periodically pause/resume to keep it alive.
      function startKeepAlive() {
        stopKeepAlive();
        keepAliveInterval = setInterval(function() {
          if (synth.speaking && !synth.paused && playing && !paused) {
            synth.pause();
            synth.resume();
          }
        }, 10000);
      }
      function stopKeepAlive() {
        if (keepAliveInterval) { clearInterval(keepAliveInterval); keepAliveInterval = null; }
      }

      function speakFrom(idx) {
        synth.cancel();
        currentChunk = idx;
        var gen = ++speakGeneration;
        startKeepAlive();
        function speakNext() {
          if (gen !== speakGeneration) return;
          if (currentChunk >= chunks.length) {
            stopSpeech();
            return;
          }
          utterance = new SpeechSynthesisUtterance(chunks[currentChunk]);
          utterance.lang = '${lang === 'fr' ? 'fr-FR' : 'en-US'}';
          utterance.rate = speeds[speedIdx];
          utterance.onend = function() {
            if (gen !== speakGeneration) return;
            currentChunk++;
            speakNext();
          };
          utterance.onerror = function(e) {
            if (gen !== speakGeneration) return;
            if (e.error !== 'canceled' && e.error !== 'interrupted') stopSpeech();
          };
          synth.speak(utterance);
        }
        speakNext();
      }

      function startSpeech() {
        ensureVoices(function() {
          totalEstimate = Math.round((wordCount / 150) * 60);
          playing = true; paused = false;
          startTime = Date.now();
          elapsed = 0;
          icon.innerHTML = pausePath;
          titleEl.textContent = '${lang === 'fr' ? 'Lecture en cours...' : 'Playing...'}';
          tickInterval = setInterval(tick, 250);
          speakFrom(0);
        });
      }

      function stopSpeech() {
        synth.cancel();
        stopKeepAlive();
        playing = false; paused = false;
        icon.innerHTML = playPath;
        progress.style.width = '0%';
        timeEl.textContent = fmt(totalEstimate);
        titleEl.textContent = '${lang === 'fr' ? "Écouter l\\'article" : 'Listen to article'}';
        if (tickInterval) clearInterval(tickInterval);
      }

      btn.addEventListener('click', function() {
        if (!playing) {
          startSpeech();
        } else if (!paused) {
          synth.pause();
          paused = true;
          stopKeepAlive();
          icon.innerHTML = playPath;
          titleEl.textContent = '${lang === 'fr' ? 'En pause' : 'Paused'}';
          if (tickInterval) clearInterval(tickInterval);
        } else {
          synth.resume();
          paused = false;
          startKeepAlive();
          icon.innerHTML = pausePath;
          titleEl.textContent = '${lang === 'fr' ? 'Lecture en cours...' : 'Playing...'}';
          startTime = Date.now() - (elapsed * 1000);
          tickInterval = setInterval(tick, 250);
        }
      });

      speedBtn.addEventListener('click', function() {
        var oldSpeed = speeds[speedIdx];
        speedIdx = (speedIdx + 1) % speeds.length;
        speedBtn.textContent = speeds[speedIdx] + '\\u00d7';
        if (playing && !paused) {
          speakFrom(currentChunk);
          startTime = Date.now() - (elapsed * 1000 * (oldSpeed / speeds[speedIdx]));
        }
      });

      // Cleanup on navigate away
      window.addEventListener('beforeunload', function() { synth.cancel(); stopKeepAlive(); });
    })();

    // ---- TOC ----
    var headings = document.querySelectorAll('.post-body h2');
    var toc = document.getElementById('toc');
    if (headings.length >= 2) {
      headings.forEach(function(h, i) {
        var id = 'section-' + i;
        h.id = id;
        var a = document.createElement('a');
        a.className = 'toc-item';
        a.href = '#' + id;
        a.innerHTML = '<span class="toc-num">' + (i + 1) + '</span>'
          + '<span class="toc-label"><span class="toc-label-inner">' + h.textContent + '</span></span>';
        toc.appendChild(a);
      });

      // --- Label marquee for overflow ---
      var scrollTimers = new Map();
      var peekTimer = null;

      function startScroll(inner) {
        if (scrollTimers.has(inner)) return;
        var label = inner.parentElement;
        var t1 = setTimeout(function() {
          var overflow = inner.scrollWidth / 2 - label.clientWidth;
          if (overflow <= 5) { scrollTimers.delete(inner); return; }
          var dur = Math.max(4, inner.scrollWidth / 2 / 25);
          inner.style.setProperty('--scroll-dur', dur + 's');
          var t2 = setTimeout(function() {
            inner.classList.add('scrolling');
            scrollTimers.set(inner, null);
          }, 600);
          scrollTimers.set(inner, t2);
        }, 550);
        scrollTimers.set(inner, t1);
      }

      function stopScroll(inner) {
        var t = scrollTimers.get(inner);
        if (t) clearTimeout(t);
        scrollTimers.delete(inner);
        inner.classList.remove('scrolling');
      }

      // Duplicate label text for seamless looping
      toc.querySelectorAll('.toc-label-inner').forEach(function(inner) {
        var text = inner.textContent;
        inner.textContent = text + '   ·   ' + text + '   ·   ';
      });

      toc.querySelectorAll('.toc-item').forEach(function(item) {
        var inner = item.querySelector('.toc-label-inner');
        item.addEventListener('mouseenter', function() { startScroll(inner); });
        item.addEventListener('mouseleave', function() { stopScroll(inner); });
      });

      // --- Active section tracking with peek ---
      var items = toc.querySelectorAll('.toc-item');
      var active = -1;
      var tocVisible = false;
      var activeInner = null;

      function updateToc() {
        var firstH2Top = headings[0].getBoundingClientRect().top;
        var shouldShow = firstH2Top < window.innerHeight * 0.5;
        if (shouldShow !== tocVisible) {
          tocVisible = shouldShow;
          toc.classList.toggle('visible', shouldShow);
        }
        if (!shouldShow) return;

        var current = 0;
        var scrollOffset = window.innerHeight * 0.35;
        headings.forEach(function(h, i) { if (h.getBoundingClientRect().top < scrollOffset) current = i; });
        if (current !== active) {
          // Stop scroll & peek on previous active
          if (activeInner) stopScroll(activeInner);
          if (active >= 0) items[active].classList.remove('peek');
          if (peekTimer) clearTimeout(peekTimer);

          active = current;
          items.forEach(function(item, i) { item.classList.toggle('active', i === current); });

          // Peek: briefly show active label, then hide
          var currentItem = items[current];
          activeInner = currentItem.querySelector('.toc-label-inner');
          currentItem.classList.add('peek');
          startScroll(activeInner);

          peekTimer = setTimeout(function() {
            currentItem.classList.remove('peek');
            stopScroll(activeInner);
          }, 800);
        }
      }
      window.addEventListener('scroll', updateToc, { passive: true });
      updateToc();
    } else {
      toc.style.display = 'none';
    }

    // ---- Comments (WordPress REST API) ----
    if (!WP_ID || !WP_URL) {
      document.getElementById('commentsSection').style.display = 'none';
      return;
    }

    var listEl = document.getElementById('commentsList');
    var countEl = document.getElementById('commentCount');

    function timeAgo(dateStr) {
      var diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
      if (diff < 60) return I18N.ago + ' ' + Math.floor(diff) + 's';
      if (diff < 3600) return I18N.ago + ' ' + Math.floor(diff / 60) + 'm';
      if (diff < 86400) return I18N.ago + ' ' + Math.floor(diff / 3600) + 'h';
      if (diff < 2592000) return I18N.ago + ' ' + Math.floor(diff / 86400) + 'd';
      return new Date(dateStr).toLocaleDateString();
    }

    function renderComment(c, depth) {
      var html = '<div class="comment">'
        + '<div class="comment-head">'
        + '<div class="comment-avatar">' + (c.author_name || '?').charAt(0).toUpperCase() + '</div>'
        + '<span class="comment-author">' + (c.author_name || 'Anonymous') + '</span>'
        + '<span class="comment-date">' + timeAgo(c.date) + '</span>'
        + '</div>'
        + '<div class="comment-body">' + c.content.rendered + '</div>';
      if (depth < 2) {
        html += '<div class="comment-reply">'
          + '<button class="comment-reply-btn" data-parent="' + c.id + '">' + I18N.reply + '</button>'
          + '</div>';
      }
      if (c._children && c._children.length) {
        html += '<div class="comment-children">';
        c._children.forEach(function(child) { html += renderComment(child, depth + 1); });
        html += '</div>';
      }
      html += '</div>';
      return html;
    }

    function loadComments() {
      fetch(WP_URL + '/wp-json/wp/v2/comments?post=' + WP_ID + '&per_page=100&orderby=date_gmt&order=asc')
        .then(function(r) { return r.json(); })
        .then(function(comments) {
          if (!Array.isArray(comments)) { comments = []; }
          countEl.textContent = '(' + comments.length + ')';
          if (!comments.length) {
            listEl.innerHTML = '<div class="comments-empty">' + I18N.noComments + ' ' + I18N.beFirst + '</div>';
            return;
          }
          // Build tree
          var map = {}, roots = [];
          comments.forEach(function(c) { c._children = []; map[c.id] = c; });
          comments.forEach(function(c) {
            if (c.parent && map[c.parent]) map[c.parent]._children.push(c);
            else roots.push(c);
          });
          listEl.innerHTML = roots.map(function(c) { return renderComment(c, 0); }).join('');
          // Reply buttons
          listEl.querySelectorAll('.comment-reply-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
              document.getElementById('cmtParent').value = btn.dataset.parent;
              document.getElementById('cmtBody').focus();
              document.getElementById('cmtBody').placeholder = I18N.reply + '...';
            });
          });
        })
        .catch(function() {
          listEl.innerHTML = '<div class="comments-empty">' + I18N.noComments + '</div>';
        });
    }
    loadComments();

    // Submit comment
    var submitBtn = document.getElementById('cmtSubmit');
    var statusEl = document.getElementById('cmtStatus');
    submitBtn.addEventListener('click', function() {
      var name = document.getElementById('cmtName').value.trim();
      var email = document.getElementById('cmtEmail').value.trim();
      var body = document.getElementById('cmtBody').value.trim();
      var parent = parseInt(document.getElementById('cmtParent').value) || 0;
      if (!name || !email || !body) { statusEl.textContent = I18N.error; statusEl.className = 'comment-form-status error'; return; }
      submitBtn.disabled = true;
      submitBtn.textContent = I18N.sending;
      statusEl.textContent = '';
      statusEl.className = 'comment-form-status';
      fetch(WP_URL + '/wp-json/wp/v2/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post: WP_ID, author_name: name, author_email: email, content: body, parent: parent })
      })
      .then(function(r) {
        if (r.ok || r.status === 201) {
          statusEl.textContent = I18N.success;
          statusEl.className = 'comment-form-status success';
          document.getElementById('cmtBody').value = '';
          document.getElementById('cmtParent').value = '0';
          setTimeout(loadComments, 1000);
        } else {
          return r.json().then(function(d) { throw new Error(d.message || 'Error'); });
        }
      })
      .catch(function() {
        statusEl.textContent = I18N.error;
        statusEl.className = 'comment-form-status error';
      })
      .finally(function() {
        submitBtn.disabled = false;
        submitBtn.textContent = I18N.submit;
      });
    });
  })();
  </script>
</body>
</html>`;
}

// ---- Main build ----
async function build() {
  console.log('Building site...');

  // Clean dist
  if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
  mkdirp(DIST);

  // Read template (current index.html)
  const template = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

  // Fetch WordPress posts (try WP first, fallback to local JSON)
  let wpPostsEN = null;
  let wpPostsFR = null;

  // Fetch GitHub contributions
  console.log('  Fetching GitHub contributions...');
  const ghData = await fetchGitHubContributions();
  if (ghData) console.log(`  ✓ ${ghData.totalContributions} contributions in the last year`);

  if (WP_URL) {
    console.log(`  Fetching posts from ${WP_URL}...`);
    [wpPostsEN, wpPostsFR] = await Promise.all([
      fetchWPPosts('en'),
      fetchWPPosts('fr'),
    ]);

    // If Polylang isn't active, lang param may be ignored — posts return for both
    // In that case, use same posts for EN (FR will fallback to local)
    if (wpPostsEN && wpPostsFR && JSON.stringify(wpPostsEN) === JSON.stringify(wpPostsFR)) {
      console.log('  ℹ Polylang not detected — using WP posts for EN only, local for FR');
      wpPostsFR = null;
    }

    if (wpPostsEN) console.log(`  ✓ Fetched ${wpPostsEN.length} EN posts from WordPress`);
    if (wpPostsFR) console.log(`  ✓ Fetched ${wpPostsFR.length} FR posts from WordPress`);
  }

  // Build for each language
  const languages = [
    { code: 'en', file: 'en.json', outDir: DIST, wpPosts: wpPostsEN },
    { code: 'fr', file: 'fr.json', outDir: path.join(DIST, 'fr'), wpPosts: wpPostsFR },
  ];

  for (const lang of languages) {
    const data = readJSON(path.join(CONTENT, lang.file));

    // Use WP posts only — no local fallback
    const posts = lang.wpPosts || [];
    const source = lang.wpPosts ? 'WordPress' : 'none';

    // Portfolio page — filter featured posts (tagged "Featured")
    const featuredPosts = posts.filter(p => p.tags.some(t => t.toLowerCase() === 'featured'));
    mkdirp(lang.outDir);
    const portfolioHTML = render(template, data, lang.code, featuredPosts, ghData);
    fs.writeFileSync(path.join(lang.outDir, 'index.html'), portfolioHTML);
    console.log(`  ✓ ${lang.code === 'en' ? '/' : '/fr/'}index.html`);

    // Blog listing
    const blogDir = path.join(lang.outDir, 'blog');
    mkdirp(blogDir);
    fs.writeFileSync(path.join(blogDir, 'index.html'), blogListingHTML(data, posts, lang.code));
    console.log(`  ✓ ${lang.code === 'en' ? '' : '/fr'}/blog/index.html (${posts.length} posts from ${source})`);

    // Blog posts
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const postDir = path.join(blogDir, post.slug);
      mkdirp(postDir);
      fs.writeFileSync(path.join(postDir, 'index.html'), blogPostHTML(data, post, lang.code, posts, i));
      console.log(`  ✓ ${lang.code === 'en' ? '' : '/fr'}/blog/${post.slug}/`);
    }
  }

  // Copy admin folder
  const adminSrc = path.join(__dirname, 'admin');
  const adminDist = path.join(DIST, 'admin');
  if (fs.existsSync(adminSrc)) {
    mkdirp(adminDist);
    for (const f of fs.readdirSync(adminSrc)) {
      fs.copyFileSync(path.join(adminSrc, f), path.join(adminDist, f));
    }
    console.log('  ✓ /admin/');
  }

  // Copy _redirects (Cloudflare Pages SEO redirects)
  const redirectsSrc = path.join(__dirname, '_redirects');
  if (fs.existsSync(redirectsSrc)) {
    fs.copyFileSync(redirectsSrc, path.join(DIST, '_redirects'));
    console.log('  ✓ /_redirects');
  }

  // Copy static assets (images, favicon)
  const staticFiles = ['profile.png', 'favicon.png', 'apple-touch-icon.png', 'loader-avatar.png', 'video.mp4', 'video-ai-me.mp4'];
  for (const f of staticFiles) {
    const src = path.join(__dirname, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(DIST, f));
      console.log(`  ✓ /${f}`);
    }
  }

  console.log('Done!');
}

build();
