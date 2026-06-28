module.exports = [
  {
    title: 'How to deploy a static site to Cloudflare Pages',
    slug: 'deploy-static-site-cloudflare-pages',
    excerpt: 'A practical walkthrough for getting a static site live on Cloudflare Pages, from connecting your repo to wiring up a custom domain and build hooks.',
    category: 'How-To',
    tags: ['cloudflare', 'static-site', 'deployment', 'devops'],
    pexels: 'cloud server deployment',
    content: `<p>I have shipped a lot of sites onto Cloudflare Pages, including the one you are reading right now. The reason I keep coming back is boring in the best way: it is fast, the free tier is generous, and once it is set up I rarely think about it again. Here is how I do it.</p>

<h2>Connect the repository first</h2>
<p>Pages is happiest when it builds from a Git repo. Sign in to the Cloudflare dashboard, open Workers and Pages, and pick "Create application" then "Pages". Authorize GitHub or GitLab, select your repository, and you land on the build configuration screen. This is the part people get wrong, so slow down here.</p>
<p>You need three things: the framework preset (or "None" for a hand-rolled build), the build command, and the output directory. For my own generator the build command is <code>node build.js</code> and the output directory is <code>dist</code>. If you are using a known tool, the presets fill these in for you. If your "build" is just copying files, set the command to something harmless like <code>echo done</code> and point the output at your folder.</p>

<h2>Match the Node version to your local one</h2>
<p>A surprising number of failed first deploys come down to Node mismatches. Pages defaults to a recent Node, but your code might assume something else. I pin it explicitly with an environment variable so there are no surprises:</p>
<pre><code>NODE_VERSION = 20.11.0</code></pre>
<p>Add that under Settings, Environment variables, for both Production and Preview. While you are there, add any other secrets your build needs, like API tokens for pulling content. Anything sensitive belongs here, never in the repo.</p>

<h2>Trigger the first build</h2>
<p>Hit "Save and Deploy" and watch the log stream. The first build is the honest one. If a dependency is missing or your output directory is wrong, you will see it immediately. A clean build ends with Pages uploading your files to its edge network, and you get a <code>*.pages.dev</code> URL to test against. Open it, click around, and confirm assets actually load. Broken relative paths are the most common issue, usually from a site that assumed it lived at a subpath.</p>

<h2>Add your custom domain</h2>
<p>Once the preview looks right, attach a real domain. Go to the project's Custom domains tab and add your hostname. If the domain is already on Cloudflare, the DNS record is created for you in one click. If it lives elsewhere, you will get a CNAME to add at your registrar. Propagation is usually minutes, not hours. Cloudflare provisions the TLS certificate automatically, so HTTPS just works without you touching certbot.</p>

<h2>Set up redirects and headers</h2>
<p>Static sites still need rules. Pages reads two special files from your output directory. A <code>_redirects</code> file handles URL rewrites and old links, and a <code>_headers</code> file lets you set caching and security headers. Here is a small example that locks down framing and caches assets hard:</p>
<pre><code>/*
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin

/assets/*
  Cache-Control: public, max-age=31536000, immutable</code></pre>
<p>Drop those in the folder you ship, not the project root, unless your build copies them across. Aggressive caching on hashed asset filenames is one of the cheapest performance wins you will ever get.</p>

<h2>Automate redeploys</h2>
<p>Every push to your production branch triggers a fresh build, and pull requests get their own preview URLs automatically. That alone covers most workflows. But if your content lives outside the repo, in a CMS for example, you will want a build hook. Create one under Settings, Builds and deployments, and you get a URL you can POST to from anywhere to kick off a deploy. I wire mine to a webhook so editors never touch Git.</p>
<p>If you want more control over the build pipeline, you can skip the dashboard build entirely and run it yourself. I cover that approach in <a href="/blog/setup-cicd-github-actions/">setting up CI/CD with GitHub Actions</a>, which lets you deploy with the Wrangler CLI after your own test and lint steps pass.</p>

<h2>What I check before calling it done</h2>
<p>Before I trust a deploy, I run through a short list. Does the custom domain serve over HTTPS with no mixed-content warnings? Do the redirects actually fire? Are large images sensible, or am I shipping 4MB hero photos? That last one matters more than people expect, and I wrote up my whole approach in <a href="/blog/optimize-images-for-web/">optimizing images for the web</a>.</p>
<p>That is genuinely it. Cloudflare Pages rewards a simple setup, and the edge network means your visitors in Sydney get the same snappy load as the ones next door. Once the pipeline is in place, deploying becomes a non-event, which is exactly what you want.</p>`
  },
  {
    title: 'How to set up CI/CD with GitHub Actions',
    slug: 'setup-cicd-github-actions',
    excerpt: 'A no-nonsense guide to building a CI/CD pipeline with GitHub Actions that tests, builds, and deploys without becoming a maintenance burden.',
    category: 'How-To',
    tags: ['github-actions', 'cicd', 'automation', 'devops'],
    pexels: 'code laptop screen',
    content: `<p>GitHub Actions gets a bad reputation because people copy a giant YAML file from a blog post, it half works, and they never touch it again until it breaks. I want to show you the small, understandable version that I actually run on real projects.</p>

<h2>Where workflows live</h2>
<p>Every workflow is a YAML file inside <code>.github/workflows</code>. The directory name is not optional. Each file describes one or more jobs, and each job runs on a fresh virtual machine. The mental model that helped me most: a job is a clean laptop that boots, does exactly what you tell it, and then evaporates. Nothing persists between jobs unless you explicitly save it.</p>

<h2>A minimal but real pipeline</h2>
<p>Here is a workflow that runs on every push and pull request. It installs dependencies, runs the test suite, and builds the site. Note how the trigger, the runner, and the steps map to plain English:</p>
<pre><code>name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build</code></pre>
<p>Two things here earn their keep. The <code>cache: npm</code> line restores your dependency cache so installs drop from a minute to a few seconds. And <code>npm ci</code> instead of <code>npm install</code> respects your lockfile exactly, which means CI installs the same versions every time. Reproducibility is the whole point.</p>

<h2>Run jobs in parallel when you can</h2>
<p>If your lint, test, and type-check steps do not depend on each other, do not chain them. Split them into separate jobs and they run at the same time on different machines. Your feedback loop gets shorter, and the cost is the same since you pay for compute minutes either way. I only force sequence with <code>needs</code> when a later job genuinely requires an earlier one to finish, like deploy waiting on test.</p>

<h2>Adding deployment safely</h2>
<p>This is where I see the most mistakes. Deployment should only run on the main branch, never on pull requests, and it should depend on tests passing. The shape looks like this:</p>
<pre><code>  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - name: Publish
        run: npx wrangler pages deploy dist --project-name my-site</code></pre>
<p>Wrangler needs a Cloudflare API token to publish. Store it as an encrypted repository secret under Settings, Secrets and variables, and expose it to the step through the job's environment block. Never paste a token into the YAML itself, because the file is in your history forever. If you are deploying to Cloudflare specifically, the manual setup side is covered in <a href="/blog/deploy-static-site-cloudflare-pages/">deploying a static site to Cloudflare Pages</a>.</p>

<h2>Secrets, the right way</h2>
<p>Repository secrets are encrypted and only decrypted at runtime inside the job. They are masked in logs, so if a token accidentally prints, GitHub redacts it. Reference them through the secrets context in your workflow's environment mapping rather than echoing them. The golden rule: if it would let someone deploy or spend money, it is a secret, and it lives in GitHub's secret store, not your code.</p>

<h2>Caching beyond dependencies</h2>
<p>You can cache more than node_modules. Build artifacts, compiled binaries, downloaded assets, anything expensive to recreate is a candidate. The <code>actions/cache</code> step takes a key, usually a hash of a lockfile or source directory, and restores the matching cache if it exists. Get the key right and your slow steps become instant. Get it wrong and you ship stale artifacts, so always include the relevant file hash in the key.</p>

<h2>Keep it boring</h2>
<p>My strongest advice is to resist cleverness. A workflow that anyone on the team can read in thirty seconds is worth more than a brilliant one only you understand. Add steps when you have a concrete reason, delete them the moment they stop pulling their weight, and pin your action versions so a surprise update never breaks a Friday deploy. If your pipeline also publishes content that needs to be searchable, you can fold that step in too, which pairs nicely with <a href="/blog/add-search-to-static-site/">adding full-text search to a static site</a>. Done well, CI/CD fades into the background and just keeps your main branch deployable.</p>`
  },
  {
    title: 'How to add full-text search to a static site',
    slug: 'add-search-to-static-site',
    excerpt: 'Static sites have no backend, but they can still have fast, fuzzy, client-side search. Here is how I build a search index at build time and ship it to the browser.',
    category: 'How-To',
    tags: ['search', 'static-site', 'javascript', 'frontend'],
    pexels: 'magnifying glass search',
    content: `<p>The first objection I hear is that static sites cannot have search because there is no server to query. That is wrong. You can build a search index when the site is generated and ship it as a plain file, then search it entirely in the browser. For anything up to a few thousand documents, it is fast enough that users assume there is a backend.</p>

<h2>Why client-side search works</h2>
<p>The trick is moving the work to build time. While my generator is already looping over every page to render HTML, it is trivial to also collect the title, URL, and body text of each one into a list. That list becomes a JSON file. The browser downloads it once, builds an in-memory index, and every keystroke after that is instant because nothing leaves the device. No database, no API, no per-query cost.</p>

<h2>Build the index at generation time</h2>
<p>During the build, I strip HTML tags from each page and push a small record into an array. Keep the body text trimmed; you do not need every word, and a leaner index downloads faster. Here is the gist of it:</p>
<pre><code>const index = pages.map(page => ({
  title: page.title,
  url: page.url,
  excerpt: page.excerpt,
  body: page.text.slice(0, 2000)
}));

fs.writeFileSync('dist/search-index.json', JSON.stringify(index));</code></pre>
<p>Writing this file is just one more step in the same pipeline that produces your pages, so it slots naturally into a build you may already run through <a href="/blog/setup-cicd-github-actions/">CI/CD with GitHub Actions</a>. The index ships alongside your HTML to the same edge network.</p>

<h2>Pick a search library, or write the dumb version</h2>
<p>For small sites you genuinely can write your own matcher in a dozen lines. Lowercase everything, split the query into words, and score documents by how many words they contain. It works. But the moment you want typo tolerance, prefix matching, or relevance ranking, reach for a library. I like Fuse.js for fuzzy matching and MiniSearch when I want proper full-text scoring. Both are tiny and run in the browser without a build step.</p>
<p>My rule of thumb is to start with the hand-written version and only upgrade when users complain. Most of the time the simple matcher is more than enough, and you avoid shipping a dependency you do not need. When you do switch to a library, the index format stays the same, so the migration is a few lines, not a rewrite.</p>
<pre><code>import MiniSearch from 'minisearch';

const res = await fetch('/search-index.json');
const docs = await res.json();

const mini = new MiniSearch({
  fields: ['title', 'body'],
  storeFields: ['title', 'url', 'excerpt']
});
mini.addAll(docs);

const results = mini.search('cloudflare deploy', { fuzzy: 0.2 });</code></pre>

<h2>Wire it to the input</h2>
<p>Hook a listener to your search box, but do not search on every single keystroke. Debounce it by 150 milliseconds or so, otherwise a fast typist fires a dozen searches for one word. On each debounced event, run the query, take the top handful of results, and render them as a list of links. Show the title and the excerpt so people can tell which result they want before clicking.</p>
<ul>
  <li>Debounce input so you search on a pause, not on every letter.</li>
  <li>Limit to the top eight or ten results; nobody scrolls a search dropdown.</li>
  <li>Highlight the matched term in the result so the relevance is obvious.</li>
  <li>Handle the empty state and the no-results state explicitly.</li>
</ul>

<h2>Load the index lazily</h2>
<p>Do not download the search index on page load. Most visitors never search, so paying that cost upfront is wasteful. I fetch the JSON the first time someone focuses the search box, cache it in a variable, and reuse it. The first search has a tiny delay while the file arrives, every search after is instant, and people who never search never pay a byte for it. This keeps your initial load lean, which matters for the same reasons I obsess over in <a href="/blog/optimize-images-for-web/">optimizing images for the web</a>.</p>

<h2>When to stop and use a service</h2>
<p>Client-side search has a ceiling. Past roughly ten thousand documents the index gets large enough that downloading and parsing it hurts, especially on phones. At that scale I switch to a hosted search service that exposes an API. But honestly, most blogs and docs sites never come close to that limit. Build the index, ship the JSON, search in the browser, and you get a feature that feels expensive for almost no cost and zero servers to maintain.</p>`
  },
  {
    title: 'How to optimize images for the web',
    slug: 'optimize-images-for-web',
    excerpt: 'Images are usually the heaviest thing on a page. Here is the practical workflow I use to cut image weight by 70 percent without anyone noticing a quality drop.',
    category: 'How-To',
    tags: ['performance', 'images', 'frontend', 'web-vitals'],
    pexels: 'photography editing screen',
    content: `<p>If a page feels slow, images are the first thing I check, and they are almost always the culprit. Text and code are tiny. A single uncompressed hero photo can outweigh your entire JavaScript bundle. The good news is that image optimization is mostly mechanical, and you can automate the whole thing.</p>

<h2>Choose the right format</h2>
<p>Format choice is the highest-leverage decision you make. JPEG is fine for photographs but it is old and inefficient. PNG is for images that need transparency or sharp edges, like logos and screenshots, and it is terrible for photos. The modern answer for almost everything is WebP, which gives you JPEG-quality photos at a fraction of the size, and AVIF when you want to push compression even further. I serve AVIF with a WebP fallback and a JPEG fallback below that.</p>
<ul>
  <li>Photographs: AVIF or WebP, never raw JPEG if you can avoid it.</li>
  <li>Logos and icons: SVG when possible, it scales infinitely and weighs nothing.</li>
  <li>Screenshots with text: PNG or WebP lossless so the text stays crisp.</li>
</ul>

<h2>Resize before you compress</h2>
<p>This is the mistake I see constantly. People take a 4000 pixel wide camera photo, compress it, and display it in a 600 pixel column. The browser downloads all those wasted pixels and throws them away. Resize the image to the largest size it will actually be shown at first, then compress. Resizing alone often cuts file size by 80 percent before you have touched quality settings.</p>
<p>To know the right target width, look at how wide the image actually renders in your layout, then double it for high-density screens. A photo shown at 600 pixels should be exported at 1200 so it stays crisp on a retina display, and no larger. Going beyond that is pure waste, because the extra pixels never reach a single eye. I keep a small table of the render widths in my design and resize to match each one.</p>

<h2>Automate it with sharp</h2>
<p>I do not hand-edit images in an app. I run them through a script using the sharp library, which is fast and produces excellent output. A short pipeline resizes and converts everything in a folder:</p>
<pre><code>const sharp = require('sharp');

sharp('input.jpg')
  .resize({ width: 1200, withoutEnlargement: true })
  .webp({ quality: 75 })
  .toFile('output.webp')
  .then(() => console.log('done'));</code></pre>
<p>Quality 75 on WebP is my default. The difference between 75 and 90 is invisible on a screen but doubles the file size. Drop it into your build and every image gets the same treatment automatically, which fits neatly into a pipeline run through <a href="/blog/setup-cicd-github-actions/">CI/CD with GitHub Actions</a>.</p>

<h2>Serve responsive sizes</h2>
<p>A phone and a desktop should not download the same image. Generate a few widths and let the browser pick using srcset. The markup tells the browser what sizes exist and how wide the image renders, and it grabs the smallest one that still looks sharp:</p>
<pre><code>&lt;img
  src="photo-800.webp"
  srcset="photo-400.webp 400w, photo-800.webp 800w, photo-1200.webp 1200w"
  sizes="(max-width: 600px) 100vw, 600px"
  alt="A descriptive caption"
&gt;</code></pre>

<h2>Lazy load everything below the fold</h2>
<p>Add <code>loading="lazy"</code> to images that are not visible when the page first paints. The browser then defers loading them until the user scrolls near. This is a one-attribute change with a big payoff, because it stops offscreen images from competing for bandwidth with the content people actually see. Leave it off your hero image though, since you want that one to load immediately.</p>

<h2>Always set width and height</h2>
<p>Set explicit width and height attributes, or a CSS aspect ratio, on every image. Without them the browser does not know how much space to reserve, so the page jumps around as images load. That jump is layout shift, and it is one of the metrics Google grades you on. It also just feels broken to users. Reserving the space costs nothing and fixes it completely.</p>

<h2>The payoff</h2>
<p>Put these together and a typical image-heavy page goes from several megabytes to a few hundred kilobytes with no visible quality loss. That shows up directly in your load times and your Core Web Vitals. Lighter images mean a snappier site everywhere, including the moment you push it live through <a href="/blog/deploy-static-site-cloudflare-pages/">Cloudflare Pages</a> and your visitors load it from the edge. Optimize once in the build, and you never have to think about it per-image again.</p>`
  },
  {
    title: 'How to build a REST API with rate limiting',
    slug: 'build-rate-limited-rest-api',
    excerpt: 'A guide to building a REST API that defends itself with rate limiting, covering the algorithms that matter, the right HTTP responses, and where to store counters.',
    category: 'How-To',
    tags: ['api', 'rate-limiting', 'backend', 'security'],
    pexels: 'network server room',
    content: `<p>Any API exposed to the public will eventually get hammered, whether by a buggy client looping on an error, a scraper, or someone outright abusing it. Rate limiting is how you protect your service and keep it fair for everyone. I have added it to plenty of APIs, and the concepts are simpler than the jargon suggests.</p>

<h2>Pick an algorithm</h2>
<p>There are a few classic approaches and they trade off accuracy against cost. A fixed window counts requests per time bucket, say 100 per minute, and resets on the boundary. It is dead simple but allows bursts at the edges, since a client can fire 100 requests at the end of one minute and 100 at the start of the next. A sliding window smooths that out by weighting the previous window. A token bucket refills tokens at a steady rate and lets clients spend them in bursts up to a cap, which feels the most natural for real traffic.</p>
<ul>
  <li>Fixed window: easiest to build, allows edge bursts.</li>
  <li>Sliding window: more accurate, slightly more bookkeeping.</li>
  <li>Token bucket: handles bursts gracefully, my usual default.</li>
</ul>

<h2>A simple token bucket</h2>
<p>The idea is that each client has a bucket of tokens. Every request costs one token, and tokens refill over time. If the bucket is empty, the request is rejected. Here is the core logic, ignoring storage for a moment:</p>
<pre><code>function allow(bucket, now, rate, capacity) {
  const elapsed = (now - bucket.last) / 1000;
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * rate);
  bucket.last = now;
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}</code></pre>
<p>That function refills based on how much time has passed, caps the bucket so tokens do not accumulate forever, and spends one token per allowed request. It is maybe fifteen lines and it covers the vast majority of real needs.</p>

<h2>Identify the client correctly</h2>
<p>Rate limiting is only as good as your idea of who a client is. For authenticated traffic, key the limit on the API key or user ID, which is reliable. For anonymous traffic you fall back to IP address, which is imperfect because users behind the same network share an IP and proxies can spoof it. If you are behind a proxy or CDN, read the forwarded header, but only trust it when the request genuinely came through your infrastructure. Getting the key wrong means you either punish innocent users or fail to stop abusers.</p>

<h2>Respond the right way</h2>
<p>When you reject a request, do it with the correct HTTP status and helpful headers so well-behaved clients can adapt. The status is 429 Too Many Requests. Always include a Retry-After header telling the client how long to wait, and the standard rate limit headers so they can self-throttle before hitting the wall:</p>
<pre><code>HTTP/1.1 429 Too Many Requests
Retry-After: 30
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 30
Content-Type: application/json

{ "error": "rate limit exceeded, retry in 30 seconds" }</code></pre>
<p>A good client reads those headers and backs off politely. A bad one ignores them, but at least you gave it the chance, and you have a clean record of why you said no.</p>

<h2>Where to store the counters</h2>
<p>An in-memory counter works for a single server and falls apart the moment you scale to two, because each instance has its own view. For anything distributed you need shared state. Redis is the classic choice; it is fast and has atomic increment operations that make this easy. On the edge, a key-value store like Cloudflare's KV or Durable Objects does the same job close to the user. Whatever you pick, the counter update must be atomic, or two simultaneous requests can both read the same count and both get through.</p>

<h2>Layer it with other defenses</h2>
<p>Rate limiting is one layer, not the whole wall. Pair it with authentication, input validation, and sensible timeouts. Put it as early in the request lifecycle as you can, ideally before any expensive work, so a flood of blocked requests costs you almost nothing. If you are deploying this kind of service yourself, the same edge platform I describe in <a href="/blog/deploy-static-site-cloudflare-pages/">deploying to Cloudflare Pages</a> can run the API and its rate-limit store together, and you can ship it confidently through <a href="/blog/setup-cicd-github-actions/">a GitHub Actions pipeline</a>. Build the limiter once, keep it boring, and it quietly does its job under load.</p>`
  }
];
