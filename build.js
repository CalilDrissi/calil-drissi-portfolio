const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'dist');
const CONTENT = path.join(__dirname, 'content');

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

// ---- Template engine (simple token replacement) ----
function render(template, data, lang) {
  let html = template;

  // Replace content blocks using marker comments
  // <!-- BEGIN:section --> ... <!-- END:section -->
  // These get replaced with generated HTML

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

  // RECOGNITION section
  html = html.replace(
    /<!-- RECOGNITION -->[\s\S]*?(?=\n\s*<!-- ARTICLES -->)/,
    `<!-- RECOGNITION -->
    <div class="col-section">
      <div class="col-header">${data.recognition.header}</div>
      <div class="recognition-tags">
        ${data.recognition.tags.map(t => `<span>${t}</span>`).join('\n        ')}
      </div>
      <div class="recognition-list">
        ${data.recognition.awards.map(a => `<span>${a}</span>`).join('\n        ')}
      </div>
      <div class="recognition-features">
        <div class="sub-label">${data.recognition.featuresLabel}</div>
        <div class="recognition-list">
          ${data.recognition.features.map(f => `<span>${f}</span>`).join('\n          ')}
        </div>
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
    /calil drissi — about/,
    data.about.titlebarText
  );
  html = html.replace(
    /<a class="win-action-btn" href="mailto:hello@calildrissi\.dev">Email ↗<\/a>/,
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
    'class="about-bio-name">Calil Drissi</div>',
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
    /<div class="msg-sender">Calil's AI Assistant<\/div>\s*Hey![\s\S]*?<div class="msg-time">/,
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

  const postCards = posts
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(p => `
      <a href="${prefix}/blog/${p.slug}/" class="blog-card">
        <img src="${p.coverImage}" alt="" loading="lazy" />
        <div class="blog-card-body">
          <div class="blog-card-date">${new Date(p.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <h2>${p.title}</h2>
          <p>${p.excerpt}</p>
          <div class="blog-card-tags">${p.tags.map(t => `<span>${t}</span>`).join('')}</div>
        </div>
      </a>
    `).join('\n');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Blog — ${data.intro.name}</title>
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
    body { background: var(--bg); color: var(--fg); font-family: var(--mono); font-size: 13px; line-height: 1.6; }
    a { color: inherit; text-decoration: none; }
    img { display: block; max-width: 100%; }
    .blog-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 20px 40px; border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .blog-header-left { display: flex; align-items: center; gap: 16px; }
    .blog-header-left a { font-size: 12px; color: var(--fg-dim); }
    .blog-header h1 { font-family: var(--serif); font-size: 24px; font-weight: 400; font-style: italic; }
    .blog-header-nav { display: flex; gap: 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
    .blog-header-nav a {
      color: var(--fg-dim); padding: 4px 10px; border: 1px solid var(--fg-faint); border-radius: 4px;
    }
    .blog-header-nav a:hover { border-color: var(--accent); color: #fff; }
    .blog-grid { max-width: 900px; margin: 60px auto; padding: 0 20px; display: flex; flex-direction: column; gap: 32px; }
    .blog-card {
      display: flex; gap: 24px; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px;
      overflow: hidden; transition: border-color 0.2s;
    }
    .blog-card:hover { border-color: var(--accent); }
    .blog-card img { width: 280px; height: 180px; object-fit: cover; flex-shrink: 0; }
    .blog-card-body { padding: 20px; display: flex; flex-direction: column; gap: 8px; }
    .blog-card-date { font-size: 11px; color: var(--fg-dim); text-transform: uppercase; letter-spacing: 0.04em; }
    .blog-card h2 { font-family: var(--serif); font-size: 20px; font-weight: 400; font-style: italic; }
    .blog-card p { color: var(--fg-dim); font-size: 12px; line-height: 1.5; }
    .blog-card-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: auto; }
    .blog-card-tags span {
      font-size: 10px; padding: 2px 8px; border: 1px solid var(--fg-faint); border-radius: 3px;
      color: var(--fg-dim); text-transform: uppercase; letter-spacing: 0.03em;
    }
    @media (max-width: 640px) {
      .blog-header { padding: 16px 20px; }
      .blog-card { flex-direction: column; }
      .blog-card img { width: 100%; height: 200px; }
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
  <div class="blog-grid">
    ${postCards}
  </div>
</body>
</html>`;
}

function blogPostHTML(data, post, lang) {
  const prefix = lang === 'fr' ? '/fr' : '';
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${post.title} — ${data.intro.name}</title>
  <meta name="description" content="${post.excerpt}" />
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
function build() {
  console.log('Building site...');

  // Clean dist
  if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
  mkdirp(DIST);

  // Read template (current index.html)
  const template = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

  // Build for each language
  const languages = [
    { code: 'en', file: 'en.json', outDir: DIST },
    { code: 'fr', file: 'fr.json', outDir: path.join(DIST, 'fr') },
  ];

  for (const lang of languages) {
    const data = readJSON(path.join(CONTENT, lang.file));
    const posts = readDir(path.join(CONTENT, 'blog', lang.code));

    // Portfolio page
    mkdirp(lang.outDir);
    const portfolioHTML = render(template, data, lang.code);
    fs.writeFileSync(path.join(lang.outDir, 'index.html'), portfolioHTML);
    console.log(`  ✓ ${lang.code === 'en' ? '/' : '/fr/'}index.html`);

    // Blog listing
    const blogDir = path.join(lang.outDir, 'blog');
    mkdirp(blogDir);
    fs.writeFileSync(path.join(blogDir, 'index.html'), blogListingHTML(data, posts, lang.code));
    console.log(`  ✓ ${lang.code === 'en' ? '' : '/fr'}/blog/index.html`);

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

  console.log('Done!');
}

build();
