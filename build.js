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

      // Extract tags from _embedded
      let tags = [];
      if (post._embedded && post._embedded['wp:term']) {
        post._embedded['wp:term'].forEach(termGroup => {
          termGroup.forEach(term => {
            if (term.taxonomy === 'post_tag') tags.push(term.name);
          });
        });
      }

      // Extract Yoast SEO meta if available
      const yoast = post.yoast_head_json || {};

      return {
        slug: post.slug,
        title: post.title.rendered,
        date: post.date.split('T')[0],
        excerpt: yoast.description || stripHTML(post.excerpt.rendered),
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
function render(template, data, lang) {
  let html = template;

  // INTRO section
  html = html.replace(
    /<!-- INTRO -->[\s\S]*?(?=\n\s*<!-- POSITION -->)/,
    `<!-- INTRO -->
    <div class="col-section">
      <div class="col-header">${data.intro.header}</div>
      <div class="intro-identity" id="introIdentity">
        <div class="intro-hover-pill"><span class="pill-track">${data.intro.hoverPill}&nbsp;&nbsp;&nbsp;⬥&nbsp;&nbsp;&nbsp;${data.intro.hoverPill}&nbsp;&nbsp;&nbsp;⬥&nbsp;&nbsp;&nbsp;</span></div>
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
        ${data.position.stack.join('<br />\n        ')}
      </div>

      <div class="sub-label">${data.position.previousLabel}</div>
      <div class="position-prev">
        ${data.position.previous.join('<br />\n        ')}
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

  // ARTICLES section
  html = html.replace(
    /<!-- ARTICLES -->[\s\S]*?(?=\n\s*<!-- CONNECT -->)/,
    `<!-- ARTICLES -->
    <div class="col-section">
      <div class="col-header">${data.articles.header}</div>
      <div class="articles-list" id="articlesList">
        ${data.articles.list.map(a => `<a href="${a.href}" data-img="${a.img}" data-title="${a.title}" data-excerpt="${a.excerpt}" data-tags="${a.tags}" data-date="${a.date}">${a.label}</a>`).join('\n        ')}
      </div>
    </div>
`
  );

  // CONNECT section
  html = html.replace(
    /<!-- CONNECT -->[\s\S]*?<\/div>\s*\n\s*<\/div>\s*\n\s*<\/div>\s*\n\s*<!-- STATEMENT -->/,
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
        ${data.connect.buttons.map(b => `<a href="${b.url}" class="cta-btn">${b.label}</a>`).join('\n        ')}
        <button class="cta-btn" id="openMessageBtn">Leave a Message &#8599;</button>
        <button class="cta-btn cta-btn-flair" id="terminalChallengeBtn">Free Consult &#8599;</button>
      </div>
    </div>

  </div>

  <!-- STATEMENT -->`
  );

  // Statement text
  const statementHTML = data.statement.text.replace('{rotate}', '<span class="rotate-slot" id="rotateSlot"><em>' + data.statement.rotateWords[0] + '</em></span>');
  html = html.replace(
    /<p class="statement">[\s\S]*?<\/p>/,
    `<p class="statement">${statementHTML}</p>`
  );

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
        <button class="filter-tab">${data.awardsTab.label} <span class="filter-count">${data.awardsTab.count}</span></button>`
  );

  // Scroll indicator
  html = html.replace(
    /<span>Scroll<\/span>/,
    `<span>${data.scrollIndicator}</span>`
  );

  // Ribbon
  const ribbonItems = [...data.ribbon, ...data.ribbon].map(r => `<span>${r}</span>`).join('\n    ');
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
    /<a class="win-action-btn" href="mailto:hello@khalildrissi\.com">Email ↗<\/a>/,
    `<a class="win-action-btn" href="${data.about.emailBtn.url}">${data.about.emailBtn.label}</a>`
  );
  html = html.replace(
    /<a class="win-action-btn primary" href="#">Resume ↗<\/a>/,
    `<a class="win-action-btn primary" href="${data.about.resumeBtn.url}">${data.about.resumeBtn.label}</a>`
  );
  html = html.replace(
    />About Me<\/button>/,
    `>${data.about.tabs.bio}</button>`
  );
  html = html.replace(
    />Chat with AI Assistant<\/button>/,
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
    /<div class="about-bio-text">[\s\S]*?<\/div>\s*\n\s*<div class="about-details-grid">/,
    `<div class="about-bio-text">\n        ${data.about.bio.map(p => `<p>${p}</p>`).join('\n        ')}\n      </div>\n      <div class="about-details-grid">`
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
    /const awards = \[[\s\S]*?\];(\s*\n\s*\/\/ Store original)/,
    `const awards = ${JSON.stringify(data.awards)};$1`
  );
  html = html.replace(
    /const chatResponses = \{[\s\S]*?\};(\s*\n\s*function getResponse)/,
    `const chatResponses = ${JSON.stringify(data.chat.responses)};$1`
  );
  html = html.replace(
    /const rotateWords = \[.*?\];/,
    `const rotateWords = ${JSON.stringify(data.statement.rotateWords)};`
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
    tags: p.tags || [],
    coverImage: p.coverImage || '',
  })));

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Blog — ${data.intro.name}</title>
  <link rel="canonical" href="https://khalildrissi.com${prefix}/blog/" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #000000; --sidebar-bg: #1a1a1a; --fg: #ffffff; --fg-dim: rgba(255,255,255,0.6);
      --fg-faint: rgba(255,255,255,0.22); --accent: #a882ff;
      --mono: 'DM Mono', monospace; --serif: 'Instrument Serif', serif;
    }
    html { -webkit-font-smoothing: antialiased; }
    body { background: var(--bg); color: var(--fg); font-family: var(--mono); font-size: 13px; line-height: 1.6; overflow: hidden; height: 100vh; }
    a { color: inherit; text-decoration: none; }

    .blog-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 20px 40px; border-bottom: 1px solid rgba(255,255,255,0.08);
      flex-shrink: 0; background: var(--bg);
    }
    .blog-header-left { display: flex; align-items: center; gap: 16px; }
    .blog-header-left a { font-size: 12px; color: var(--fg-dim); }
    .blog-header-left a:hover { color: #fff; }
    .blog-header h1 { font-family: var(--serif); font-size: 24px; font-weight: 400; font-style: italic; }
    .blog-header-nav { display: flex; gap: 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
    .blog-header-nav a {
      color: var(--fg-dim); padding: 4px 10px; border: 1px solid var(--fg-faint); border-radius: 4px;
      transition: border-color 0.2s, color 0.2s;
    }
    .blog-header-nav a:hover { border-color: var(--accent); color: #fff; }

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
      font-family: var(--serif); font-size: 16px; font-style: italic; margin-bottom: 4px;
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

    .sidebar-tags {
      padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.08);
      display: flex; flex-wrap: wrap; gap: 6px; flex-shrink: 0;
    }
    .tag-pill {
      font-size: 10px; padding: 3px 10px; border: 1px solid rgba(255,255,255,0.15); border-radius: 12px;
      color: var(--fg-dim); cursor: pointer; transition: all 0.2s; text-transform: uppercase;
      letter-spacing: 0.03em; background: transparent; font-family: var(--mono);
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
      font-family: var(--serif); font-size: 14px; font-style: italic; margin-bottom: 2px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .post-item-date { font-size: 10px; color: var(--fg-dim); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.04em; }
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
      <a href="${prefix}/">&larr; ${data.intro.name}</a>
      <h1>Blog</h1>
    </div>
    <nav class="blog-header-nav">
      <a href="${prefix}/">${lang === 'fr' ? 'Portfolio' : 'Portfolio'}</a>
      <a href="${otherLang.url}">${otherLang.label}</a>
    </nav>
  </header>

  <div class="main-layout">
    <div class="graph-panel">
      <canvas id="graphCanvas"></canvas>
      <div class="graph-hint">${lang === 'fr' ? 'Glisser pour d\\u00e9placer \\u2022 Molette pour zoomer' : 'Drag to move \\u2022 Scroll to zoom'}</div>
    </div>
    <aside class="sidebar">
      <div class="sidebar-search">
        <input type="text" id="searchInput" placeholder="${lang === 'fr' ? 'Rechercher...' : 'Search posts...'}" />
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

  // --- Collect all tags ---
  const allTags = [...new Set(POSTS.flatMap(p => p.tags))].sort();

  // --- Nodes ---
  const NODE_RADIUS = 4;
  const NODE_COLOR = '#a882ff';
  const NODE_COLOR_R = 168, NODE_COLOR_G = 130, NODE_COLOR_B = 255;

  const nodes = POSTS.map((p, i) => {
    const angle = (i / Math.max(POSTS.length, 1)) * Math.PI * 2;
    const spread = 100 + Math.random() * 60;
    return {
      x: Math.cos(angle) * spread + (Math.random() - 0.5) * 40,
      y: Math.sin(angle) * spread + (Math.random() - 0.5) * 40,
      vx: 0, vy: 0,
      postIndex: i,
      pinned: false,
      // Breathing phase offset per node
      breathPhase: Math.random() * Math.PI * 2,
    };
  });

  // --- Canvas setup ---
  const canvas = document.getElementById('graphCanvas');
  const ctx = canvas.getContext('2d');
  let W, H;
  let camX = 0, camY = 0, camZoom = 1;
  let hoveredNode = null, dragNode = null, dragOffset = { x: 0, y: 0 };
  let isPanning = false, panStart = { x: 0, y: 0 }, camStart = { x: 0, y: 0 };
  let sidebarHoverIndex = -1;
  let focusedIndex = -1; // from sidebar click highlight

  // Filter state
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
  const DAMPING = 0.92;
  const MIN_DIST = 30;
  const BREATHING_STRENGTH = 0.03; // tiny random drift force
  let simAlpha = 1;
  let simTime = 0;

  function simulate() {
    simTime++;

    // Keep a minimum alpha for breathing — never fully stop
    const effectiveAlpha = Math.max(simAlpha, 0.005);
    if (simAlpha > 0.001) simAlpha *= 0.995;

    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].pinned) continue;

      // Center gravity
      nodes[i].vx -= nodes[i].x * CENTER_GRAVITY * effectiveAlpha;
      nodes[i].vy -= nodes[i].y * CENTER_GRAVITY * effectiveAlpha;

      // Subtle breathing / drift force (always active)
      const bp = nodes[i].breathPhase;
      const bx = Math.sin(simTime * 0.008 + bp) * BREATHING_STRENGTH;
      const by = Math.cos(simTime * 0.006 + bp * 1.3) * BREATHING_STRENGTH;
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

    // Apply velocity with damping
    for (const n of nodes) {
      if (n.pinned) continue;
      n.vx *= DAMPING; n.vy *= DAMPING;
      n.x += n.vx; n.y += n.vy;
    }
  }

  // --- Drawing ---
  function draw() {
    ctx.clearRect(0, 0, W, H);
    // Pure black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    const isFiltered = activeTagFilters.size > 0 || searchQuery.length > 0;
    const hIdx = hoveredNode !== null ? hoveredNode.postIndex : sidebarHoverIndex;
    const connectedToHover = new Set();
    if (hIdx >= 0) {
      connectedToHover.add(hIdx);
      for (const e of edges) {
        if (e.source === hIdx) connectedToHover.add(e.target);
        if (e.target === hIdx) connectedToHover.add(e.source);
      }
    }

    // Draw edges — very thin, barely visible
    for (const e of edges) {
      const a = nodes[e.source], b = nodes[e.target];
      const sa = worldToScreen(a.x, a.y), sb = worldToScreen(b.x, b.y);

      let alpha, width;

      if (hIdx >= 0) {
        if ((e.source === hIdx || e.target === hIdx)) {
          // Edge connects to hovered node — highlight purple
          alpha = 0.6;
          width = 1;
          ctx.strokeStyle = 'rgba(' + NODE_COLOR_R + ',' + NODE_COLOR_G + ',' + NODE_COLOR_B + ',' + alpha + ')';
        } else {
          // All other edges — near invisible
          alpha = 0.02;
          width = 0.5;
          ctx.strokeStyle = 'rgba(255,255,255,' + alpha + ')';
        }
      } else if (isFiltered) {
        if (!visibleIndices.has(e.source) || !visibleIndices.has(e.target)) {
          alpha = 0.02;
        } else {
          alpha = 0.08;
        }
        width = 0.5;
        ctx.strokeStyle = 'rgba(255,255,255,' + alpha + ')';
      } else {
        // Default: barely visible gray
        alpha = 0.08;
        width = 0.5;
        ctx.strokeStyle = 'rgba(255,255,255,' + alpha + ')';
      }

      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.lineWidth = width;
      ctx.stroke();
    }

    // Draw nodes
    const showAllLabels = camZoom > 1.5;

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
        nodeAlpha = isConnected ? 1 : 0.1;
      } else if (isFiltered) {
        nodeAlpha = isVisible ? 1 : 0.1;
      }

      // Determine radius
      const r = isHovered ? 6 : NODE_RADIUS;
      const screenR = r * camZoom;

      // Glow — radial gradient halo
      const glowR = r * 3;
      const screenGlowR = glowR * camZoom;
      let glowAlpha = 0.15;
      if (isHovered) glowAlpha = 0.4;
      else if (hIdx >= 0 && !isConnected) glowAlpha = 0;
      else if (isFiltered && !isVisible) glowAlpha = 0;

      if (glowAlpha > 0) {
        const grad = ctx.createRadialGradient(s.x, s.y, screenR * 0.3, s.x, s.y, screenGlowR);
        grad.addColorStop(0, 'rgba(' + NODE_COLOR_R + ',' + NODE_COLOR_G + ',' + NODE_COLOR_B + ',' + (glowAlpha * nodeAlpha) + ')');
        grad.addColorStop(1, 'rgba(' + NODE_COLOR_R + ',' + NODE_COLOR_G + ',' + NODE_COLOR_B + ',0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, screenGlowR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(s.x, s.y, screenR, 0, Math.PI * 2);
      ctx.globalAlpha = nodeAlpha;
      if (isFocused) {
        ctx.fillStyle = '#ffffff';
      } else {
        ctx.fillStyle = NODE_COLOR;
      }
      ctx.fill();
      ctx.globalAlpha = 1;

      // Label logic:
      // Hidden by default. Show on hover for hovered node + neighbors.
      // When zoomed past 1.5x, show all at reduced opacity.
      let showLabel = false;
      let labelAlpha = 0;

      if (isHovered) {
        showLabel = true;
        labelAlpha = 1;
      } else if (hIdx >= 0 && isConnected) {
        showLabel = true;
        labelAlpha = 0.7;
      } else if (showAllLabels) {
        showLabel = true;
        labelAlpha = 0.35 * nodeAlpha;
      }

      if (showLabel) {
        const label = POSTS[i].title.length > 24 ? POSTS[i].title.slice(0, 22) + '...' : POSTS[i].title;
        ctx.globalAlpha = labelAlpha;
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px "DM Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, s.x, s.y + screenR + 12);
        ctx.globalAlpha = 1;
      }
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

  function showHoverCard(node, mx, my) {
    const p = POSTS[node.postIndex];
    if (p.coverImage) { hoverImg.src = p.coverImage; hoverImg.style.display = 'block'; }
    else { hoverImg.style.display = 'none'; }
    hoverTitle.textContent = p.title;
    const locale = LANG === 'fr' ? 'fr-FR' : 'en-US';
    hoverDate.textContent = new Date(p.date).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
    const exc = p.excerpt.length > 120 ? p.excerpt.slice(0, 117) + '...' : p.excerpt;
    hoverExcerpt.textContent = exc;
    hoverTags.innerHTML = p.tags.map(t => '<span>' + t + '</span>').join('');

    let left = mx + 16, top = my - 20;
    if (left + 310 > window.innerWidth) left = mx - 320;
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
      hoveredNode = node;
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

  // --- Sidebar: Tags ---
  const tagFilters = document.getElementById('tagFilters');
  allTags.forEach(tag => {
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
    activeTagFilters.clear();
    searchQuery = '';
    searchInput.value = '';
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
        '<div class="post-item-date">' + new Date(p.date).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' }) + '</div>' +
        '<div class="post-item-tags">' + p.tags.map(t => '<span>' + t + '</span>').join('') + '</div>';
      item.addEventListener('click', () => {
        window.location.href = PREFIX + '/blog/' + p.slug + '/';
      });
      item.addEventListener('mouseenter', () => {
        sidebarHoverIndex = i;
        focusedIndex = i;
      });
      item.addEventListener('mouseleave', () => {
        sidebarHoverIndex = -1;
        focusedIndex = -1;
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
      if (activeTagFilters.size > 0) {
        match = [...activeTagFilters].some(t => p.tags.includes(t));
      }
      if (match && searchQuery) {
        match = p.title.toLowerCase().includes(searchQuery) ||
                p.excerpt.toLowerCase().includes(searchQuery) ||
                p.tags.some(t => t.toLowerCase().includes(searchQuery));
      }
      if (match) visibleIndices.add(i);
    }

    const hasFilters = activeTagFilters.size > 0 || searchQuery.length > 0;
    activeFiltersEl.classList.toggle('visible', hasFilters);
    if (hasFilters) {
      const parts = [];
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

function blogPostHTML(data, post, lang) {
  const prefix = lang === 'fr' ? '/fr' : '';
  const seo = post.seo || {};
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${seo.title || post.title} — ${data.intro.name}</title>
  <meta name="description" content="${seo.description || post.excerpt}" />
  ${seo.ogImage ? `<meta property="og:image" content="${seo.ogImage}" />` : ''}
  <meta property="og:title" content="${seo.title || post.title}" />
  <meta property="og:description" content="${seo.description || post.excerpt}" />
  <meta property="og:type" content="article" />
  <link rel="canonical" href="https://khalildrissi.com${prefix}/blog/${post.slug}/" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #121212; --fg: #ffffff; --fg-dim: rgba(255,255,255,0.6);
      --fg-faint: rgba(255,255,255,0.22); --accent: #5e2bff;
      --mono: 'DM Mono', monospace; --serif: 'Instrument Serif', serif;
    }
    html { -webkit-font-smoothing: antialiased; }
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
    .post-hero { width: 100%; max-height: 400px; object-fit: cover; }
    .post-container { max-width: 720px; margin: 0 auto; padding: 40px 20px 80px; }
    .post-meta { display: flex; gap: 16px; align-items: center; margin-bottom: 24px; flex-wrap: wrap; }
    .post-date { font-size: 11px; color: var(--fg-dim); text-transform: uppercase; letter-spacing: 0.04em; }
    .post-tags { display: flex; gap: 6px; }
    .post-tags span {
      font-size: 10px; padding: 2px 8px; border: 1px solid var(--fg-faint); border-radius: 3px;
      color: var(--fg-dim); text-transform: uppercase; letter-spacing: 0.03em;
    }
    .post-title { font-family: var(--serif); font-size: clamp(28px, 5vw, 40px); font-weight: 400; font-style: italic; margin-bottom: 32px; line-height: 1.2; }
    .post-body h2 { font-family: var(--serif); font-size: 22px; font-weight: 400; font-style: italic; margin: 32px 0 12px; }
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
    @media (max-width: 640px) {
      .post-header { padding: 16px 20px; }
      .post-container { padding: 24px 16px 60px; }
    }
  </style>
</head>
<body>
  <header class="post-header">
    <a href="${prefix}/blog/">&larr; ${lang === 'fr' ? 'Retour au blog' : 'Back to blog'}</a>
    <a href="${prefix}/">${data.intro.name}</a>
  </header>
  ${post.coverImage ? `<img class="post-hero" src="${post.coverImage}" alt="" />` : ''}
  <article class="post-container">
    <div class="post-meta">
      <span class="post-date">${new Date(post.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
      <div class="post-tags">${post.tags.map(t => `<span>${t}</span>`).join('')}</div>
    </div>
    <h1 class="post-title">${post.title}</h1>
    <div class="post-body">${post.body}</div>
  </article>
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

    // Use WP posts if available, otherwise fall back to local JSON
    const posts = lang.wpPosts || readDir(path.join(CONTENT, 'blog', lang.code));
    const source = lang.wpPosts ? 'WordPress' : 'local JSON';

    // Portfolio page
    mkdirp(lang.outDir);
    const portfolioHTML = render(template, data, lang.code);
    fs.writeFileSync(path.join(lang.outDir, 'index.html'), portfolioHTML);
    console.log(`  ✓ ${lang.code === 'en' ? '/' : '/fr/'}index.html`);

    // Blog listing
    const blogDir = path.join(lang.outDir, 'blog');
    mkdirp(blogDir);
    fs.writeFileSync(path.join(blogDir, 'index.html'), blogListingHTML(data, posts, lang.code));
    console.log(`  ✓ ${lang.code === 'en' ? '' : '/fr'}/blog/index.html (${posts.length} posts from ${source})`);

    // Blog posts
    for (const post of posts) {
      const postDir = path.join(blogDir, post.slug);
      mkdirp(postDir);
      fs.writeFileSync(path.join(postDir, 'index.html'), blogPostHTML(data, post, lang.code));
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
  const staticFiles = ['profile.png', 'favicon.png', 'apple-touch-icon.png'];
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
