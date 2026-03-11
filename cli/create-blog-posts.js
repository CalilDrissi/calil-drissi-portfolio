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

// Upload a featured image from Picsum (free, no API key needed)
async function uploadFeaturedImage(postTitle, index) {
  try {
    // Use a deterministic seed from post index for consistent images
    const width = 1200, height = 630;
    const imageUrl = `https://picsum.photos/seed/blog${index}/${width}/${height}`;
    const imgRes = await fetch(imageUrl, { redirect: 'follow' });
    if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const filename = `blog-cover-${index}.jpg`;

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

    // Set alt text
    await wpAPI('POST', `media/${media.id}`, { alt_text: postTitle });

    return media.id;
  } catch (e) {
    console.log(`    ⚠ Image upload failed: ${e.message.substring(0, 80)}`);
    return null;
  }
}

async function getOrCreateTerm(taxonomy, name) {
  const search = await wpAPI('GET', `${taxonomy}?search=${encodeURIComponent(name)}&per_page=5`);
  const found = search.find(t => t.name.toLowerCase() === name.toLowerCase());
  if (found) return found.id;
  try {
    const created = await wpAPI('POST', taxonomy, { name });
    return created.id;
  } catch (e) {
    // might already exist
    const retry = await wpAPI('GET', `${taxonomy}?search=${encodeURIComponent(name)}&per_page=5`);
    const f = retry.find(t => t.name.toLowerCase() === name.toLowerCase());
    return f ? f.id : null;
  }
}

// 20 English posts
const enPosts = [
  {
    title: 'Understanding WebAssembly: A Practical Guide for Web Developers',
    slug: 'understanding-webassembly-practical-guide',
    date: '2025-02-10T09:00:00',
    category: 'Web Development',
    tags: ['WebAssembly', 'Rust', 'Performance'],
    content: `<h2>What is WebAssembly?</h2>
<p>WebAssembly (Wasm) is a binary instruction format that enables near-native performance in web browsers. Unlike JavaScript, which is interpreted and JIT-compiled, Wasm code is pre-compiled and runs at predictable speeds.</p>
<p>For computationally intensive tasks—image processing, physics simulations, cryptography—WebAssembly offers a 10-50x speedup over equivalent JavaScript implementations.</p>
<h2>When to Use WebAssembly</h2>
<p>Not every project needs Wasm. It shines in specific scenarios: real-time audio/video processing, 3D rendering, data compression, and algorithmic computations. If your bottleneck is DOM manipulation or network I/O, JavaScript remains the better choice.</p>
<h2>Getting Started with Rust + Wasm</h2>
<p>Rust is the most popular language for targeting WebAssembly, thanks to its zero-cost abstractions and excellent toolchain support via <code>wasm-pack</code>.</p>
<pre><code>use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn fibonacci(n: u32) -> u32 {
    match n {
        0 => 0,
        1 => 1,
        _ => fibonacci(n - 1) + fibonacci(n - 2),
    }
}</code></pre>
<h2>Integration with JavaScript</h2>
<p>The beauty of Wasm is seamless interop with JavaScript. You can call Wasm functions from JS and vice versa, making it easy to incrementally adopt in existing projects.</p>
<h2>Performance Benchmarks</h2>
<p>In our benchmarks, a Wasm-based image resizer was 23x faster than the Canvas API equivalent. For Fibonacci calculations, the speedup was 47x. These numbers make a compelling case for performance-critical paths.</p>
<h2>The Future of Wasm</h2>
<p>With WASI (WebAssembly System Interface), Wasm is expanding beyond the browser into serverless computing, IoT, and plugin systems. It's becoming a universal runtime.</p>`
  },
  {
    title: 'Building Resilient Microservices with Go',
    slug: 'building-resilient-microservices-go',
    date: '2025-03-15T10:00:00',
    category: 'Backend',
    tags: ['Go', 'Microservices', 'Architecture'],
    content: `<h2>Why Go for Microservices?</h2>
<p>Go's simplicity, fast compilation, and built-in concurrency primitives make it an ideal choice for building microservices. Unlike Java or C#, Go produces small, statically-linked binaries that start in milliseconds—perfect for containerized deployments.</p>
<h2>Circuit Breaker Pattern</h2>
<p>When a downstream service fails, you don't want cascading failures. The circuit breaker pattern monitors failure rates and temporarily stops requests to unhealthy services, giving them time to recover.</p>
<pre><code>type CircuitBreaker struct {
    failures    int
    threshold   int
    state       State
    lastFailure time.Time
}

func (cb *CircuitBreaker) Execute(fn func() error) error {
    if cb.state == Open && time.Since(cb.lastFailure) < timeout {
        return ErrCircuitOpen
    }
    err := fn()
    if err != nil {
        cb.failures++
        if cb.failures >= cb.threshold {
            cb.state = Open
            cb.lastFailure = time.Now()
        }
    } else {
        cb.failures = 0
        cb.state = Closed
    }
    return err
}</code></pre>
<h2>Retry with Exponential Backoff</h2>
<p>Transient failures are inevitable in distributed systems. Implementing retries with exponential backoff and jitter prevents thundering herd problems while ensuring eventual delivery.</p>
<h2>Health Checks and Graceful Shutdown</h2>
<p>Every microservice should expose health endpoints (<code>/healthz</code> and <code>/readyz</code>) and handle SIGTERM gracefully, draining in-flight requests before shutting down.</p>
<h2>Observability</h2>
<p>Without proper observability, debugging distributed systems is nearly impossible. We use structured logging with zerolog, distributed tracing with OpenTelemetry, and metrics with Prometheus.</p>`
  },
  {
    title: 'Advanced CSS Grid Layouts: Beyond the Basics',
    slug: 'advanced-css-grid-layouts',
    date: '2025-04-22T08:30:00',
    category: 'Frontend',
    tags: ['CSS', 'Layout', 'Design'],
    content: `<h2>Mastering Grid Template Areas</h2>
<p>CSS Grid's <code>grid-template-areas</code> property lets you design layouts visually in your stylesheet. Named areas make your code self-documenting and easier to maintain than numeric grid lines.</p>
<pre><code>.layout {
  display: grid;
  grid-template-areas:
    "header header header"
    "sidebar main aside"
    "footer footer footer";
  grid-template-columns: 200px 1fr 200px;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
}</code></pre>
<h2>Subgrid: The Missing Piece</h2>
<p>Subgrid allows child elements to participate in their parent's grid, solving the long-standing alignment problem in card layouts. No more misaligned titles and descriptions across rows.</p>
<h2>Dynamic Layouts with minmax() and auto-fill</h2>
<p>The combination of <code>auto-fill</code>, <code>minmax()</code>, and <code>repeat()</code> creates responsive layouts without media queries. Cards automatically adjust from 1 to N columns based on available space.</p>
<h2>Grid and Container Queries</h2>
<p>Container queries paired with Grid create truly component-based responsive designs. Components adapt to their container size, not the viewport—a paradigm shift in responsive design.</p>
<h2>Animation with Grid</h2>
<p>Modern browsers support animating <code>grid-template-rows</code> and <code>grid-template-columns</code>, enabling smooth expand/collapse transitions that were previously impossible without JavaScript.</p>`
  },
  {
    title: 'Securing REST APIs: A Comprehensive Checklist',
    slug: 'securing-rest-apis-checklist',
    date: '2025-05-08T11:00:00',
    category: 'Security',
    tags: ['API', 'Security', 'Authentication'],
    content: `<h2>Authentication & Authorization</h2>
<p>Use JWTs with short expiration times (15 minutes) paired with refresh tokens stored in HttpOnly cookies. Never store tokens in localStorage—it's vulnerable to XSS attacks.</p>
<h2>Rate Limiting</h2>
<p>Implement rate limiting at multiple levels: per-IP, per-user, and per-endpoint. Use sliding window algorithms for accuracy. A typical configuration: 100 requests per minute for authenticated users, 20 for anonymous.</p>
<h2>Input Validation</h2>
<p>Validate every input on the server side, regardless of client-side validation. Use schemas (Zod, Joi, or JSON Schema) to define expected shapes. Reject unknown fields to prevent mass assignment attacks.</p>
<pre><code>const createUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(100),
  role: z.enum(['user', 'admin']).default('user'),
}).strict(); // rejects unknown fields</code></pre>
<h2>CORS Configuration</h2>
<p>Never use <code>Access-Control-Allow-Origin: *</code> in production. Whitelist specific origins. Be especially careful with <code>Access-Control-Allow-Credentials: true</code>—it cannot be combined with wildcard origins.</p>
<h2>SQL Injection Prevention</h2>
<p>Always use parameterized queries or an ORM. Even with an ORM, be cautious with raw query methods. Enable query logging in development to catch potential issues early.</p>
<h2>Security Headers</h2>
<p>Set essential headers: <code>Content-Security-Policy</code>, <code>X-Content-Type-Options: nosniff</code>, <code>Strict-Transport-Security</code>, and <code>X-Frame-Options: DENY</code>. Use Helmet.js in Express for easy implementation.</p>`
  },
  {
    title: 'React Server Components: What Changes and What Doesn\'t',
    slug: 'react-server-components-what-changes',
    date: '2025-06-12T09:30:00',
    category: 'Frontend',
    tags: ['React', 'Next.js', 'Server Components'],
    content: `<h2>The Mental Model Shift</h2>
<p>React Server Components (RSC) fundamentally change how we think about React. Components now run in two environments: the server and the client. Server components fetch data and render HTML without sending JavaScript to the browser.</p>
<h2>Server vs Client Components</h2>
<p>By default, components in the App Router are server components. Add <code>'use client'</code> at the top to make them client components. The key insight: client components can render server components, but not the other way around (directly).</p>
<h2>Data Fetching Simplified</h2>
<p>With RSC, you can <code>await</code> directly in components. No more useEffect + useState dance for data fetching. This eliminates loading waterfalls and makes code more predictable.</p>
<pre><code>async function UserProfile({ id }) {
  const user = await db.users.findUnique({ where: { id } });
  const posts = await db.posts.findMany({ where: { authorId: id } });

  return (
    &lt;div&gt;
      &lt;h1&gt;{user.name}&lt;/h1&gt;
      &lt;PostList posts={posts} /&gt;
    &lt;/div&gt;
  );
}</code></pre>
<h2>When to Use Client Components</h2>
<p>Client components are still essential for interactivity: event handlers, state, effects, browser APIs. The strategy is to push client boundaries as far down the component tree as possible.</p>
<h2>Performance Implications</h2>
<p>RSC reduces the JavaScript bundle sent to the browser by up to 30-50% in data-heavy applications. Database queries and API calls happen on the server, eliminating unnecessary client-side fetching.</p>
<h2>Migration Strategy</h2>
<p>Don't rewrite everything at once. Start by converting data-fetching components to server components, keep interactive pieces as client components, and gradually refactor from the leaves up.</p>`
  },
  {
    title: 'Database Indexing Strategies for High-Traffic Applications',
    slug: 'database-indexing-strategies-high-traffic',
    date: '2025-07-20T10:00:00',
    category: 'Backend',
    tags: ['Database', 'PostgreSQL', 'Performance'],
    content: `<h2>Understanding B-Tree Indexes</h2>
<p>B-tree indexes are the default in PostgreSQL and cover most use cases. They work well for equality and range queries. But blindly adding indexes to every column is counterproductive—each index slows down writes and consumes storage.</p>
<h2>Composite Indexes: Order Matters</h2>
<p>In a composite index on (status, created_at), the index serves queries filtering on status alone, or on both columns, but NOT on created_at alone. The leftmost prefix rule determines usability.</p>
<pre><code>-- This composite index...
CREATE INDEX idx_orders_status_date ON orders (status, created_at);

-- Helps these queries:
SELECT * FROM orders WHERE status = 'pending';
SELECT * FROM orders WHERE status = 'pending' AND created_at > '2025-01-01';

-- But NOT this one:
SELECT * FROM orders WHERE created_at > '2025-01-01';</code></pre>
<h2>Partial Indexes</h2>
<p>If 90% of your queries filter on <code>WHERE active = true</code> and only 10% of rows are active, a partial index is far more efficient than a full index. Smaller index = faster lookups = less memory.</p>
<h2>GIN Indexes for JSONB</h2>
<p>PostgreSQL's GIN indexes make JSONB queries fast. Use <code>jsonb_path_ops</code> for containment queries—it's smaller and faster than the default operator class.</p>
<h2>EXPLAIN ANALYZE: Your Best Friend</h2>
<p>Always verify your indexes with <code>EXPLAIN ANALYZE</code>. Look for sequential scans on large tables, high row estimates vs. actual rows, and nested loop joins that could benefit from hash joins.</p>
<h2>Index Maintenance</h2>
<p>Indexes bloat over time. Schedule regular <code>REINDEX</code> operations or use <code>pg_repack</code> for zero-downtime rebuilds. Monitor index usage with <code>pg_stat_user_indexes</code> to drop unused ones.</p>`
  },
  {
    title: 'Practical Guide to Docker Multi-Stage Builds',
    slug: 'practical-guide-docker-multi-stage-builds',
    date: '2025-08-05T08:00:00',
    category: 'DevOps',
    tags: ['Docker', 'DevOps', 'Deployment'],
    content: `<h2>Why Multi-Stage Builds?</h2>
<p>A typical Node.js image with dev dependencies can reach 1.5GB+. Multi-stage builds let you compile in a full environment, then copy only the artifacts into a minimal runtime image. Result: 50-200MB final images.</p>
<h2>A Real-World Example</h2>
<pre><code># Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]</code></pre>
<h2>Optimizing Layer Caching</h2>
<p>Docker caches layers sequentially. Copy <code>package.json</code> and run <code>npm ci</code> before copying source code. This way, dependency installation is cached unless package.json changes—saving minutes on each build.</p>
<h2>Security Hardening</h2>
<p>Run as a non-root user, use <code>--no-cache</code> for apk/apt, remove unnecessary packages, and scan images with Trivy or Snyk. Distroless base images eliminate shells entirely.</p>
<h2>Build Arguments and Secrets</h2>
<p>Use <code>--build-arg</code> for build-time configuration and <code>--mount=type=secret</code> for sensitive data like npm tokens. Secrets are never persisted in image layers.</p>`
  },
  {
    title: 'TypeScript Generics: From Confusion to Clarity',
    slug: 'typescript-generics-confusion-to-clarity',
    date: '2025-09-18T09:00:00',
    category: 'Frontend',
    tags: ['TypeScript', 'Programming', 'Best Practices'],
    content: `<h2>Generics Are Just Parameters for Types</h2>
<p>Think of generics as function parameters, but for types. Just as a function takes a value and returns a result, a generic takes a type and returns a typed structure. The angle brackets are just syntax.</p>
<h2>Starting Simple</h2>
<pre><code>function identity&lt;T&gt;(value: T): T {
  return value;
}

// TypeScript infers T from the argument
const num = identity(42);       // T is number
const str = identity("hello");  // T is string</code></pre>
<h2>Constrained Generics</h2>
<p>Use <code>extends</code> to limit what types are accepted. This gives you autocomplete and type safety inside the function while keeping it generic.</p>
<pre><code>function getProperty&lt;T, K extends keyof T&gt;(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: "Khalil", age: 28 };
getProperty(user, "name");  // string
getProperty(user, "email"); // Error: "email" not in keyof User</code></pre>
<h2>Generic Utility Types</h2>
<p>TypeScript's built-in utility types—<code>Partial&lt;T&gt;</code>, <code>Pick&lt;T, K&gt;</code>, <code>Omit&lt;T, K&gt;</code>, <code>Record&lt;K, V&gt;</code>—are all built with generics. Understanding how they work helps you build your own.</p>
<h2>Common Patterns</h2>
<p>Generic components in React, generic API clients, and generic state management hooks are patterns you'll use daily. The key is recognizing when a piece of code works the same way regardless of the specific type.</p>
<h2>When Not to Use Generics</h2>
<p>Don't add generics preemptively. If a function only ever handles one type, keep it simple. Generics add complexity—use them when you have concrete evidence of reuse across types.</p>`
  },
  {
    title: 'Edge Computing with Cloudflare Workers: Real-World Patterns',
    slug: 'edge-computing-cloudflare-workers-patterns',
    date: '2025-10-10T10:30:00',
    category: 'Cloud',
    tags: ['Cloudflare', 'Edge Computing', 'Serverless'],
    content: `<h2>Why Edge Computing?</h2>
<p>Traditional servers are centralized. Edge computing distributes your code to 300+ data centers worldwide. Users in Tokyo hit a Tokyo server, users in Paris hit a Paris server. Latency drops from 200ms to 20ms.</p>
<h2>Cloudflare Workers Runtime</h2>
<p>Workers use V8 isolates, not containers. Cold starts are under 5ms (vs. 500ms+ for Lambda). The tradeoff: no filesystem, limited execution time (30s for free, 15min for paid), and a unique set of APIs.</p>
<h2>Pattern: API Gateway</h2>
<p>Use Workers as an API gateway: route requests, add authentication, transform responses, and cache aggressively. A single Worker replaces NGINX + auth middleware + cache layer.</p>
<h2>Pattern: A/B Testing at the Edge</h2>
<p>Assign user cohorts in a Worker and rewrite HTML before it reaches the browser. No client-side flicker, no layout shift, and cohort assignment is consistent via cookies.</p>
<h2>Durable Objects for State</h2>
<p>Durable Objects give you single-threaded, strongly consistent state at the edge. Perfect for real-time collaboration, rate limiting, and WebSocket coordination.</p>
<h2>KV vs R2 vs D1</h2>
<p>KV: eventually consistent key-value store, great for config and cached data. R2: S3-compatible object storage without egress fees. D1: SQLite at the edge for relational data. Choose based on consistency and query needs.</p>`
  },
  {
    title: 'Writing Maintainable Unit Tests That Don\'t Break',
    slug: 'writing-maintainable-unit-tests',
    date: '2025-11-25T08:00:00',
    category: 'Testing',
    tags: ['Testing', 'Best Practices', 'JavaScript'],
    content: `<h2>The Testing Pyramid Revisited</h2>
<p>The classic pyramid (many unit tests, some integration, few E2E) still holds, but the boundaries have shifted. With modern tools, integration tests are cheap enough to form a larger part of your suite.</p>
<h2>Test Behavior, Not Implementation</h2>
<p>Tests that mirror implementation details break on every refactor. Instead of testing that a function calls another function, test that given input X, the output is Y. This makes tests resilient to internal changes.</p>
<h2>The Arrange-Act-Assert Pattern</h2>
<pre><code>describe('calculateDiscount', () => {
  it('applies 10% discount for orders over $100', () => {
    // Arrange
    const order = { items: [{ price: 120, qty: 1 }] };

    // Act
    const result = calculateDiscount(order);

    // Assert
    expect(result.total).toBe(108);
    expect(result.discount).toBe(12);
  });
});</code></pre>
<h2>Avoiding Test Pollution</h2>
<p>Each test should be independent. Use <code>beforeEach</code> for setup, never share mutable state between tests, and clean up side effects. Test order should never matter.</p>
<h2>When to Mock</h2>
<p>Mock external services (APIs, databases, file system), not internal modules. Over-mocking creates tests that pass but don't verify real behavior. Use dependency injection to make mocking natural.</p>
<h2>Snapshot Testing: Use Sparingly</h2>
<p>Snapshot tests catch unintended changes but encourage mindless "update snapshot" commits. Use them for stable output (serialized data, rendered HTML templates) but not for rapidly changing components.</p>`
  },
  {
    title: 'Building a Design System from Scratch',
    slug: 'building-design-system-from-scratch',
    date: '2025-12-15T09:00:00',
    category: 'Frontend',
    tags: ['Design Systems', 'CSS', 'Components'],
    content: `<h2>Why Build Your Own?</h2>
<p>Off-the-shelf design systems (MUI, Chakra, Ant Design) are great starting points, but they come with opinionated decisions that may not match your brand. Building from scratch gives you full control over aesthetics, bundle size, and accessibility.</p>
<h2>Design Tokens First</h2>
<p>Start with design tokens: colors, spacing, typography, shadows, border radii. Define them as CSS custom properties for runtime theming, and as JS constants for computed styles.</p>
<pre><code>:root {
  --color-primary: #5e2bff;
  --color-bg: #121212;
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --font-mono: 'DM Mono', monospace;
}</code></pre>
<h2>Component API Design</h2>
<p>Design your component APIs before writing code. Keep props minimal, use composition over configuration, and follow the principle of least surprise. A Button should work like a button.</p>
<h2>Accessibility by Default</h2>
<p>Bake accessibility into every component: proper ARIA roles, keyboard navigation, focus management, color contrast. It's 10x harder to add accessibility retroactively than to build it in from the start.</p>
<h2>Documentation as Code</h2>
<p>Use Storybook or a similar tool to document components alongside their code. Interactive examples, prop tables, and usage guidelines ensure adoption across the team.</p>
<h2>Versioning and Distribution</h2>
<p>Publish your design system as an npm package with semantic versioning. Use changesets for managing releases. Breaking changes get major bumps, new components get minor bumps.</p>`
  },
  {
    title: 'Optimizing Core Web Vitals: A Developer\'s Playbook',
    slug: 'optimizing-core-web-vitals-playbook',
    date: '2026-01-08T10:00:00',
    category: 'Performance',
    tags: ['Performance', 'Web Vitals', 'SEO'],
    content: `<h2>Understanding the Metrics</h2>
<p>Core Web Vitals measure real user experience: LCP (Largest Contentful Paint) for load speed, INP (Interaction to Next Paint) for responsiveness, and CLS (Cumulative Layout Shift) for visual stability. Google uses these for ranking.</p>
<h2>LCP: Target Under 2.5 Seconds</h2>
<p>The LCP element is usually a hero image or heading. Optimize it: use <code>fetchpriority="high"</code>, preload critical images, serve WebP/AVIF formats, and eliminate render-blocking resources.</p>
<h2>INP: Target Under 200ms</h2>
<p>INP replaced FID. It measures the worst interaction latency, not just the first. Break up long tasks with <code>requestIdleCallback</code> or <code>scheduler.yield()</code>. Avoid synchronous layout thrashing.</p>
<h2>CLS: Target Under 0.1</h2>
<p>Always set explicit dimensions on images and videos. Use <code>aspect-ratio</code> CSS for responsive media. Avoid inserting content above existing content. Web fonts should use <code>font-display: swap</code> with size-adjust.</p>
<pre><code>@font-face {
  font-family: 'Custom Font';
  src: url('/fonts/custom.woff2') format('woff2');
  font-display: swap;
  size-adjust: 105%;
  ascent-override: 95%;
}</code></pre>
<h2>Measuring in the Field</h2>
<p>Lab tools (Lighthouse) give you a controlled baseline. Field data (CrUX, web-vitals library) shows real user experience. Always prioritize field data—synthetic tests don't capture device diversity.</p>
<h2>Quick Wins</h2>
<p>Enable Brotli compression, implement resource hints (preconnect, prefetch), lazy-load below-fold images, inline critical CSS, and defer non-essential JavaScript. These alone can move you from "needs improvement" to "good".</p>`
  },
  {
    title: 'Event-Driven Architecture with Message Queues',
    slug: 'event-driven-architecture-message-queues',
    date: '2024-11-20T09:00:00',
    category: 'Architecture',
    tags: ['Architecture', 'Message Queues', 'Scalability'],
    content: `<h2>Beyond Request-Response</h2>
<p>Traditional request-response architectures create tight coupling. When Service A calls Service B synchronously, A blocks until B responds. If B is slow or down, A suffers too. Event-driven architecture decouples producers from consumers.</p>
<h2>Messages vs Events</h2>
<p>A command (message) tells a service to do something: "SendEmail". An event tells the world something happened: "UserRegistered". Events enable reactive architectures where services independently decide how to respond.</p>
<h2>Choosing a Message Broker</h2>
<p>RabbitMQ for traditional message queuing with routing and acknowledgments. Kafka for high-throughput event streaming with replay capability. Redis Streams for lightweight, low-latency scenarios. SQS for serverless on AWS.</p>
<h2>Idempotency Is Non-Negotiable</h2>
<p>Messages can be delivered more than once. Every consumer must handle duplicates gracefully. Use idempotency keys or check-before-write patterns to ensure processing a message twice has the same effect as processing it once.</p>
<h2>Dead Letter Queues</h2>
<p>Messages that fail processing repeatedly shouldn't block the queue. Route them to a dead letter queue for investigation. Set up alerts when the DLQ grows—it indicates a systemic issue.</p>
<h2>Saga Pattern for Distributed Transactions</h2>
<p>Without distributed transactions, use sagas: a sequence of local transactions with compensating actions for rollback. If step 3 of 5 fails, execute compensating actions for steps 2 and 1.</p>`
  },
  {
    title: 'Mastering Git Workflows for Team Productivity',
    slug: 'mastering-git-workflows-team-productivity',
    date: '2024-10-05T08:30:00',
    category: 'DevOps',
    tags: ['Git', 'Workflow', 'Collaboration'],
    content: `<h2>Trunk-Based Development vs Git Flow</h2>
<p>Git Flow's long-lived branches create merge conflicts and integration debt. Trunk-based development (short-lived feature branches merged to main daily) keeps the codebase integrated and reduces conflict surface area.</p>
<h2>Conventional Commits</h2>
<p>Structured commit messages enable automated changelog generation, semantic versioning, and easier code review. Format: <code>type(scope): description</code>.</p>
<pre><code>feat(auth): add OAuth2 login with Google
fix(api): handle null response from payment provider
perf(db): add composite index on orders(status, date)
docs(readme): update deployment instructions</code></pre>
<h2>Rebase vs Merge</h2>
<p>Use rebase for feature branches to maintain linear history. Use merge commits for integrating to main to preserve the branch context. Never rebase shared branches.</p>
<h2>Code Review Best Practices</h2>
<p>Keep PRs small (under 400 lines). Provide context in the description. Review for correctness, security, and maintainability—not style (use formatters for that). Approve with comments for minor issues.</p>
<h2>Automating Quality Gates</h2>
<p>Run tests, linters, and type checks as CI checks on every PR. Require passing checks before merge. Use branch protection rules to enforce review requirements.</p>
<h2>Git Bisect for Bug Hunting</h2>
<p>When a bug appears and you don't know which commit introduced it, <code>git bisect</code> uses binary search across commits to find the culprit in O(log n) steps.</p>`
  },
  {
    title: 'The Art of API Design: REST, GraphQL, and tRPC Compared',
    slug: 'api-design-rest-graphql-trpc-compared',
    date: '2024-09-12T10:00:00',
    category: 'Backend',
    tags: ['API', 'GraphQL', 'REST'],
    content: `<h2>REST: The Proven Standard</h2>
<p>REST is well-understood, cacheable, and works with any HTTP client. Its weakness: over-fetching (getting more data than needed) and under-fetching (requiring multiple requests). For most CRUD applications, REST is sufficient and simple.</p>
<h2>GraphQL: Flexible Querying</h2>
<p>GraphQL solves the over/under-fetching problem with client-specified queries. Ideal for mobile apps (bandwidth-sensitive), complex relational data, and multiple frontend consumers with different data needs.</p>
<h2>tRPC: End-to-End Type Safety</h2>
<p>tRPC eliminates the API layer entirely for TypeScript monorepos. Procedures are typed functions, and the client gets full autocomplete without code generation. The tradeoff: it's TypeScript-only and tightly couples client and server.</p>
<h2>Decision Framework</h2>
<p>Use REST for public APIs, third-party integrations, and simple CRUD. Use GraphQL for complex data graphs, multiple clients, and real-time subscriptions. Use tRPC for internal TypeScript APIs in monorepos.</p>
<h2>Pagination Patterns</h2>
<p>Offset-based pagination is simple but breaks with concurrent inserts. Cursor-based pagination (using an opaque cursor, typically the last item's ID) is consistent and more performant for large datasets.</p>
<h2>Error Handling</h2>
<p>Use standard HTTP status codes for REST. In GraphQL, errors go in the <code>errors</code> array alongside partial data. For tRPC, throw typed errors that the client can catch and handle specifically.</p>`
  },
  {
    title: 'Animations That Feel Right: Physics-Based Motion in UI',
    slug: 'physics-based-motion-ui-animations',
    date: '2024-08-18T09:30:00',
    category: 'Frontend',
    tags: ['Animation', 'GSAP', 'UX'],
    content: `<h2>Why Physics-Based Motion?</h2>
<p>Linear animations feel robotic. Cubic bezier curves are better but still artificial. Physics-based animations (springs, friction, gravity) mirror real-world motion, making interfaces feel natural and responsive.</p>
<h2>Spring Dynamics</h2>
<p>A spring animation has three parameters: stiffness (how quickly it reaches the target), damping (how quickly oscillation stops), and mass (inertia). Higher stiffness = snappier, higher damping = less bounce.</p>
<h2>GSAP for Production Animations</h2>
<p>GSAP (GreenSock) is the industry standard for web animation. Its timeline system lets you orchestrate complex sequences with precise control over timing, easing, and sequencing.</p>
<pre><code>gsap.timeline()
  .from('.hero-title', { y: 60, opacity: 0, duration: 0.8 })
  .from('.hero-subtitle', { y: 40, opacity: 0, duration: 0.6 }, '-=0.4')
  .from('.hero-cta', { scale: 0.8, opacity: 0, duration: 0.5 }, '-=0.3');</code></pre>
<h2>Scroll-Driven Animations</h2>
<p>ScrollTrigger (GSAP plugin) ties animations to scroll position. Use <code>scrub</code> for scroll-linked progress, <code>pin</code> for sticky sections, and <code>batch</code> for staggering elements as they enter the viewport.</p>
<h2>Performance Considerations</h2>
<p>Animate only <code>transform</code> and <code>opacity</code>—these properties don't trigger layout or paint. Use <code>will-change</code> sparingly and only during active animations. Request animation frames, never setTimeout.</p>
<h2>Respecting User Preferences</h2>
<p>Always check <code>prefers-reduced-motion</code> and disable or simplify animations for users who request it. This is both an accessibility requirement and often a legal one.</p>`
  },
  {
    title: 'Kubernetes for Small Teams: When It Makes Sense',
    slug: 'kubernetes-small-teams-when-it-makes-sense',
    date: '2024-07-22T11:00:00',
    category: 'DevOps',
    tags: ['Kubernetes', 'DevOps', 'Infrastructure'],
    content: `<h2>The Honest Assessment</h2>
<p>Kubernetes is powerful but complex. For a small team running 2-3 services, managed platforms (Railway, Render, Fly.io) offer 90% of the benefits at 10% of the operational cost. K8s makes sense when you hit scaling limits.</p>
<h2>When Kubernetes Pays Off</h2>
<p>Multiple services with different scaling needs. Workloads that spike unpredictably. Complex networking requirements. Need for custom scheduling or resource management. If none of these apply, simpler solutions exist.</p>
<h2>Managed vs Self-Hosted</h2>
<p>Never self-host Kubernetes in production unless you have dedicated platform engineers. Use EKS, GKE, or AKS. The control plane is the hard part—let cloud providers handle it.</p>
<h2>Essential Resources</h2>
<p>You need to understand: Pods (smallest deployable unit), Deployments (declarative updates), Services (networking), Ingress (HTTP routing), ConfigMaps/Secrets (configuration), and HPA (auto-scaling).</p>
<h2>Helm Charts</h2>
<p>Helm packages Kubernetes manifests into reusable, versioned charts. Use it for deploying third-party software. For your own services, consider Kustomize for simpler overlay-based configuration.</p>
<h2>Monitoring and Debugging</h2>
<p>Install the Prometheus + Grafana stack for metrics, Loki for logs, and Jaeger for tracing. Use <code>kubectl debug</code> for ephemeral debugging containers. Set resource requests and limits to prevent noisy neighbors.</p>`
  },
  {
    title: 'Real-Time Applications with WebSockets and Server-Sent Events',
    slug: 'real-time-websockets-server-sent-events',
    date: '2024-06-14T08:00:00',
    category: 'Web Development',
    tags: ['WebSockets', 'Real-Time', 'Node.js'],
    content: `<h2>Choosing the Right Protocol</h2>
<p>WebSockets provide full-duplex communication—both client and server can send messages anytime. Server-Sent Events (SSE) are server-to-client only but simpler, auto-reconnect, and work through proxies without special configuration.</p>
<h2>When to Use WebSockets</h2>
<p>Chat applications, collaborative editing, multiplayer games, live trading—any scenario where the client sends frequent messages back to the server. WebSockets maintain a persistent TCP connection.</p>
<h2>When SSE Is Enough</h2>
<p>Live feeds, notifications, dashboard updates, progress tracking—when data flows primarily from server to client. SSE uses standard HTTP, making it simpler to deploy behind load balancers and CDNs.</p>
<h2>Scaling WebSocket Servers</h2>
<p>WebSocket connections are stateful and sticky. Scaling requires a pub/sub layer (Redis) to broadcast messages across server instances. Use sticky sessions at the load balancer level.</p>
<pre><code>// Redis pub/sub for multi-instance WebSocket
const subscriber = createClient();
const publisher = createClient();

subscriber.subscribe('chat:room:123');
subscriber.on('message', (channel, message) => {
  // Broadcast to all local WebSocket connections
  localConnections.forEach(ws => ws.send(message));
});

// When a client sends a message
publisher.publish('chat:room:123', JSON.stringify(msg));</code></pre>
<h2>Connection Management</h2>
<p>Implement heartbeat/ping-pong to detect dead connections. Handle reconnection with exponential backoff on the client. Buffer messages during disconnects and replay on reconnection.</p>
<h2>Security</h2>
<p>Authenticate WebSocket connections during the HTTP upgrade handshake, not after. Validate and sanitize all incoming messages. Rate-limit per connection to prevent abuse.</p>`
  },
  {
    title: 'Monorepo Architecture with Turborepo: Lessons Learned',
    slug: 'monorepo-architecture-turborepo-lessons',
    date: '2024-05-08T09:30:00',
    category: 'Architecture',
    tags: ['Monorepo', 'Turborepo', 'DX'],
    content: `<h2>Why Monorepo?</h2>
<p>Monorepos keep related code together: shared libraries, multiple apps, and infrastructure config in one repository. Changes that span packages are atomic—no coordinating releases across repos.</p>
<h2>Turborepo's Approach</h2>
<p>Turborepo is a build system for JavaScript/TypeScript monorepos. It caches task results (locally and remotely), understands package dependencies, and parallelizes work. A 10-minute build becomes 30 seconds with warm cache.</p>
<h2>Package Structure</h2>
<pre><code>monorepo/
├── apps/
│   ├── web/         # Next.js frontend
│   ├── api/         # Express backend
│   └── mobile/      # React Native app
├── packages/
│   ├── ui/          # Shared component library
│   ├── utils/       # Shared utilities
│   ├── config/      # ESLint, TypeScript configs
│   └── types/       # Shared type definitions
├── turbo.json
└── package.json</code></pre>
<h2>Internal Packages</h2>
<p>Use the internal package pattern: packages are consumed via TypeScript path aliases, not published to npm. This eliminates the build step for shared packages during development.</p>
<h2>CI/CD Optimization</h2>
<p>Turborepo's <code>--filter</code> flag runs tasks only for changed packages and their dependents. Combined with remote caching, CI runs only rebuild what changed. PR builds drop from 15 minutes to 2.</p>
<h2>Common Pitfalls</h2>
<p>Avoid circular dependencies between packages. Keep the dependency graph acyclic. Don't share too much—some duplication is better than tight coupling. Use <code>turbo prune</code> for deploying individual apps.</p>`
  },
  {
    title: 'Effective Error Handling in Production Applications',
    slug: 'effective-error-handling-production',
    date: '2024-04-15T10:00:00',
    category: 'Backend',
    tags: ['Error Handling', 'Monitoring', 'Best Practices'],
    content: `<h2>Errors Are Features</h2>
<p>In production, errors are inevitable. The question isn't whether they'll occur, but how gracefully your application handles them. Good error handling means users get helpful feedback and developers get actionable diagnostics.</p>
<h2>Error Classification</h2>
<p>Operational errors (network timeouts, invalid input, full disk) are expected and handleable. Programmer errors (TypeError, null reference) are bugs that need fixing. Handle the first category gracefully; for the second, crash and restart.</p>
<h2>Structured Error Responses</h2>
<pre><code>{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email address",
    "details": [
      { "field": "email", "issue": "Must be a valid email format" }
    ],
    "requestId": "req_abc123"
  }
}</code></pre>
<h2>Error Boundaries in React</h2>
<p>Error boundaries catch rendering errors and display fallback UI instead of a white screen. Place them strategically: around the entire app (catch-all), around independent features (isolated failures), and around data-dependent sections.</p>
<h2>Centralized Error Tracking</h2>
<p>Use Sentry, Bugsnag, or similar services to aggregate errors. Group by root cause, track frequency, and set up alerts for new error types. Include context: user ID, request parameters, stack trace, and git commit.</p>
<h2>Graceful Degradation</h2>
<p>When a non-critical service fails, degrade gracefully rather than failing entirely. Can't load recommendations? Show a fallback. Payment processing down? Queue the order. Always have a plan B.</p>`
  },
];

// 20 French posts (translations)
const frPosts = [
  {
    title: 'Comprendre WebAssembly : Guide Pratique pour Développeurs Web',
    slug: 'comprendre-webassembly-guide-pratique',
    date: '2025-02-10T09:00:00',
    category: 'Développement Web',
    tags: ['WebAssembly', 'Rust', 'Performance'],
    content: `<h2>Qu'est-ce que WebAssembly ?</h2>
<p>WebAssembly (Wasm) est un format d'instruction binaire qui permet des performances quasi-natives dans les navigateurs web. Contrairement à JavaScript, qui est interprété et compilé JIT, le code Wasm est pré-compilé et s'exécute à des vitesses prévisibles.</p>
<p>Pour les tâches intensives en calcul — traitement d'images, simulations physiques, cryptographie — WebAssembly offre une accélération de 10 à 50x par rapport aux implémentations JavaScript équivalentes.</p>
<h2>Quand utiliser WebAssembly</h2>
<p>Tous les projets n'ont pas besoin de Wasm. Il excelle dans des scénarios spécifiques : traitement audio/vidéo en temps réel, rendu 3D, compression de données et calculs algorithmiques.</p>
<h2>Démarrer avec Rust + Wasm</h2>
<p>Rust est le langage le plus populaire pour cibler WebAssembly, grâce à ses abstractions à coût zéro et son excellent support d'outillage via <code>wasm-pack</code>.</p>
<h2>Intégration avec JavaScript</h2>
<p>La beauté de Wasm est l'interopérabilité transparente avec JavaScript. Vous pouvez appeler des fonctions Wasm depuis JS et vice versa.</p>
<h2>L'avenir de Wasm</h2>
<p>Avec WASI, Wasm s'étend au-delà du navigateur vers le calcul serverless, l'IoT et les systèmes de plugins. Il devient un runtime universel.</p>`
  },
  {
    title: 'Construire des Microservices Résilients avec Go',
    slug: 'construire-microservices-resilients-go',
    date: '2025-03-15T10:00:00',
    category: 'Backend',
    tags: ['Go', 'Microservices', 'Architecture'],
    content: `<h2>Pourquoi Go pour les Microservices ?</h2>
<p>La simplicité de Go, sa compilation rapide et ses primitives de concurrence intégrées en font un choix idéal pour les microservices. Go produit des binaires petits et liés statiquement qui démarrent en millisecondes.</p>
<h2>Le Pattern Circuit Breaker</h2>
<p>Quand un service en aval tombe, vous ne voulez pas de défaillances en cascade. Le circuit breaker surveille les taux d'échec et arrête temporairement les requêtes vers les services défaillants.</p>
<h2>Retry avec Backoff Exponentiel</h2>
<p>Les défaillances transitoires sont inévitables dans les systèmes distribués. Implémenter des retries avec backoff exponentiel et jitter prévient les problèmes de thundering herd.</p>
<h2>Health Checks et Arrêt Gracieux</h2>
<p>Chaque microservice devrait exposer des endpoints de santé et gérer SIGTERM de manière gracieuse, drainant les requêtes en cours avant de s'arrêter.</p>
<h2>Observabilité</h2>
<p>Sans observabilité correcte, déboguer des systèmes distribués est quasi impossible. Nous utilisons zerolog, OpenTelemetry et Prometheus.</p>`
  },
  {
    title: 'Layouts CSS Grid Avancés : Au-delà des Bases',
    slug: 'layouts-css-grid-avances',
    date: '2025-04-22T08:30:00',
    category: 'Frontend',
    tags: ['CSS', 'Layout', 'Design'],
    content: `<h2>Maîtriser les Grid Template Areas</h2>
<p>La propriété <code>grid-template-areas</code> de CSS Grid vous permet de concevoir des layouts visuellement dans votre feuille de style. Les zones nommées rendent votre code auto-documenté.</p>
<h2>Subgrid : La Pièce Manquante</h2>
<p>Subgrid permet aux éléments enfants de participer à la grille de leur parent, résolvant le problème d'alignement dans les layouts de cartes.</p>
<h2>Layouts Dynamiques avec minmax() et auto-fill</h2>
<p>La combinaison de <code>auto-fill</code>, <code>minmax()</code> et <code>repeat()</code> crée des layouts responsifs sans media queries.</p>
<h2>Grid et Container Queries</h2>
<p>Les container queries combinées avec Grid créent des designs responsifs véritablement basés sur les composants.</p>
<h2>Animation avec Grid</h2>
<p>Les navigateurs modernes supportent l'animation de <code>grid-template-rows</code> et <code>grid-template-columns</code>, permettant des transitions fluides.</p>`
  },
  {
    title: 'Sécuriser les APIs REST : Checklist Complète',
    slug: 'securiser-apis-rest-checklist',
    date: '2025-05-08T11:00:00',
    category: 'Sécurité',
    tags: ['API', 'Sécurité', 'Authentification'],
    content: `<h2>Authentification et Autorisation</h2>
<p>Utilisez des JWT avec des temps d'expiration courts (15 minutes) couplés à des refresh tokens stockés dans des cookies HttpOnly. Ne stockez jamais les tokens dans localStorage.</p>
<h2>Rate Limiting</h2>
<p>Implémentez le rate limiting à plusieurs niveaux : par IP, par utilisateur et par endpoint. Utilisez des algorithmes de fenêtre glissante.</p>
<h2>Validation des Entrées</h2>
<p>Validez chaque entrée côté serveur, indépendamment de la validation côté client. Utilisez des schémas (Zod, Joi) pour définir les formes attendues.</p>
<h2>Configuration CORS</h2>
<p>N'utilisez jamais <code>Access-Control-Allow-Origin: *</code> en production. Listez les origines spécifiques autorisées.</p>
<h2>Prévention de l'Injection SQL</h2>
<p>Utilisez toujours des requêtes paramétrées ou un ORM. Même avec un ORM, soyez prudent avec les méthodes de requêtes brutes.</p>
<h2>En-têtes de Sécurité</h2>
<p>Configurez les en-têtes essentiels : Content-Security-Policy, X-Content-Type-Options, Strict-Transport-Security et X-Frame-Options.</p>`
  },
  {
    title: 'React Server Components : Ce Qui Change et Ce Qui Ne Change Pas',
    slug: 'react-server-components-ce-qui-change',
    date: '2025-06-12T09:30:00',
    category: 'Frontend',
    tags: ['React', 'Next.js', 'Server Components'],
    content: `<h2>Le Changement de Paradigme</h2>
<p>Les React Server Components (RSC) changent fondamentalement notre façon de penser React. Les composants s'exécutent maintenant dans deux environnements : le serveur et le client.</p>
<h2>Composants Serveur vs Client</h2>
<p>Par défaut, les composants dans l'App Router sont des composants serveur. Ajoutez <code>'use client'</code> en haut pour en faire des composants client.</p>
<h2>Récupération de Données Simplifiée</h2>
<p>Avec RSC, vous pouvez <code>await</code> directement dans les composants. Plus de dance useEffect + useState pour la récupération de données.</p>
<h2>Quand Utiliser les Composants Client</h2>
<p>Les composants client restent essentiels pour l'interactivité : gestionnaires d'événements, état, effets, APIs du navigateur.</p>
<h2>Implications sur les Performances</h2>
<p>RSC réduit le bundle JavaScript envoyé au navigateur de 30 à 50% dans les applications riches en données.</p>
<h2>Stratégie de Migration</h2>
<p>Ne réécrivez pas tout d'un coup. Commencez par convertir les composants de récupération de données en composants serveur.</p>`
  },
  {
    title: 'Stratégies d\'Indexation de Base de Données pour Applications à Fort Trafic',
    slug: 'strategies-indexation-base-donnees',
    date: '2025-07-20T10:00:00',
    category: 'Backend',
    tags: ['Base de données', 'PostgreSQL', 'Performance'],
    content: `<h2>Comprendre les Index B-Tree</h2>
<p>Les index B-tree sont le défaut dans PostgreSQL et couvrent la plupart des cas d'usage. Mais ajouter aveuglément des index à chaque colonne est contre-productif.</p>
<h2>Index Composites : L'Ordre Compte</h2>
<p>Dans un index composite sur (status, created_at), l'index sert les requêtes filtrant sur status seul, ou les deux colonnes, mais PAS sur created_at seul.</p>
<h2>Index Partiels</h2>
<p>Si 90% de vos requêtes filtrent sur <code>WHERE active = true</code> et seulement 10% des lignes sont actives, un index partiel est bien plus efficace.</p>
<h2>Index GIN pour JSONB</h2>
<p>Les index GIN de PostgreSQL rendent les requêtes JSONB rapides. Utilisez <code>jsonb_path_ops</code> pour les requêtes de contenance.</p>
<h2>EXPLAIN ANALYZE : Votre Meilleur Ami</h2>
<p>Vérifiez toujours vos index avec EXPLAIN ANALYZE. Cherchez les scans séquentiels sur les grandes tables.</p>
<h2>Maintenance des Index</h2>
<p>Les index se fragmentent avec le temps. Planifiez des opérations REINDEX régulières ou utilisez pg_repack.</p>`
  },
  {
    title: 'Guide Pratique des Builds Multi-Étapes Docker',
    slug: 'guide-pratique-builds-multi-etapes-docker',
    date: '2025-08-05T08:00:00',
    category: 'DevOps',
    tags: ['Docker', 'DevOps', 'Déploiement'],
    content: `<h2>Pourquoi les Builds Multi-Étapes ?</h2>
<p>Une image Node.js typique avec les dépendances de développement peut atteindre 1,5 Go+. Les builds multi-étapes vous permettent de compiler dans un environnement complet, puis de copier uniquement les artefacts dans une image minimale.</p>
<h2>Un Exemple Concret</h2>
<p>L'étape de build utilise une image complète avec toutes les dépendances. L'étape de production ne copie que les fichiers nécessaires.</p>
<h2>Optimisation du Cache de Couches</h2>
<p>Docker cache les couches séquentiellement. Copiez package.json et exécutez npm ci avant de copier le code source.</p>
<h2>Durcissement de la Sécurité</h2>
<p>Exécutez en tant qu'utilisateur non-root, utilisez --no-cache pour apk/apt, supprimez les packages inutiles et scannez les images avec Trivy.</p>
<h2>Arguments de Build et Secrets</h2>
<p>Utilisez --build-arg pour la configuration au moment du build et --mount=type=secret pour les données sensibles.</p>`
  },
  {
    title: 'Les Génériques TypeScript : De la Confusion à la Clarté',
    slug: 'generiques-typescript-confusion-clarte',
    date: '2025-09-18T09:00:00',
    category: 'Frontend',
    tags: ['TypeScript', 'Programmation', 'Bonnes Pratiques'],
    content: `<h2>Les Génériques Sont Juste des Paramètres pour les Types</h2>
<p>Pensez aux génériques comme des paramètres de fonction, mais pour les types. Les chevrons ne sont que de la syntaxe.</p>
<h2>Commencer Simple</h2>
<p>La fonction identity est l'exemple le plus simple : elle prend une valeur de type T et retourne ce même type.</p>
<h2>Génériques Contraints</h2>
<p>Utilisez <code>extends</code> pour limiter les types acceptés. Cela vous donne l'autocomplétion et la sûreté de type tout en gardant la généricité.</p>
<h2>Types Utilitaires Génériques</h2>
<p>Les types utilitaires intégrés de TypeScript — Partial, Pick, Omit, Record — sont tous construits avec des génériques.</p>
<h2>Patterns Courants</h2>
<p>Composants génériques en React, clients API génériques, hooks de gestion d'état génériques sont des patterns que vous utiliserez quotidiennement.</p>
<h2>Quand Ne Pas Utiliser les Génériques</h2>
<p>N'ajoutez pas de génériques préventivement. Si une fonction ne gère qu'un seul type, gardez la simplicité.</p>`
  },
  {
    title: 'Edge Computing avec Cloudflare Workers : Patterns Concrets',
    slug: 'edge-computing-cloudflare-workers',
    date: '2025-10-10T10:30:00',
    category: 'Cloud',
    tags: ['Cloudflare', 'Edge Computing', 'Serverless'],
    content: `<h2>Pourquoi l'Edge Computing ?</h2>
<p>Les serveurs traditionnels sont centralisés. L'edge computing distribue votre code dans 300+ centres de données mondiaux. La latence passe de 200ms à 20ms.</p>
<h2>Le Runtime Cloudflare Workers</h2>
<p>Les Workers utilisent des isolats V8, pas des conteneurs. Les cold starts sont sous 5ms. Le compromis : pas de système de fichiers et un temps d'exécution limité.</p>
<h2>Pattern : API Gateway</h2>
<p>Utilisez les Workers comme gateway API : routage des requêtes, authentification, transformation des réponses et mise en cache agressive.</p>
<h2>Pattern : Tests A/B à l'Edge</h2>
<p>Assignez les cohortes utilisateur dans un Worker et réécrivez le HTML avant qu'il n'atteigne le navigateur.</p>
<h2>Durable Objects pour l'État</h2>
<p>Les Durable Objects vous donnent un état mono-thread et fortement consistant à l'edge. Parfait pour la collaboration temps réel.</p>
<h2>KV vs R2 vs D1</h2>
<p>KV pour le stockage clé-valeur. R2 pour le stockage d'objets. D1 pour les données relationnelles SQLite à l'edge.</p>`
  },
  {
    title: 'Écrire des Tests Unitaires Maintenables Qui Ne Cassent Pas',
    slug: 'tests-unitaires-maintenables',
    date: '2025-11-25T08:00:00',
    category: 'Testing',
    tags: ['Tests', 'Bonnes Pratiques', 'JavaScript'],
    content: `<h2>La Pyramide de Tests Revisitée</h2>
<p>La pyramide classique tient toujours, mais les frontières ont bougé. Avec les outils modernes, les tests d'intégration sont assez peu coûteux pour former une part plus importante de votre suite.</p>
<h2>Tester le Comportement, Pas l'Implémentation</h2>
<p>Les tests qui reflètent les détails d'implémentation cassent à chaque refactoring. Testez plutôt que pour l'entrée X, la sortie est Y.</p>
<h2>Le Pattern Arrange-Act-Assert</h2>
<p>Organisez chaque test en trois parties claires : préparer les données, exécuter l'action, vérifier le résultat.</p>
<h2>Éviter la Pollution des Tests</h2>
<p>Chaque test doit être indépendant. Utilisez beforeEach pour la configuration, ne partagez jamais d'état mutable entre les tests.</p>
<h2>Quand Mocker</h2>
<p>Mockez les services externes, pas les modules internes. Le sur-mocking crée des tests qui passent mais ne vérifient pas le comportement réel.</p>
<h2>Tests Snapshot : Avec Parcimonie</h2>
<p>Les tests snapshot détectent les changements involontaires mais encouragent les commits « update snapshot » irréfléchis.</p>`
  },
  {
    title: 'Construire un Design System de Zéro',
    slug: 'construire-design-system-zero',
    date: '2025-12-15T09:00:00',
    category: 'Frontend',
    tags: ['Design Systems', 'CSS', 'Composants'],
    content: `<h2>Pourquoi Construire le Vôtre ?</h2>
<p>Les design systems prêts à l'emploi sont d'excellents points de départ, mais ils viennent avec des décisions orientées qui peuvent ne pas correspondre à votre marque.</p>
<h2>Les Design Tokens d'Abord</h2>
<p>Commencez par les design tokens : couleurs, espacement, typographie, ombres, rayons de bordure. Définissez-les comme propriétés CSS personnalisées.</p>
<h2>Conception de l'API des Composants</h2>
<p>Concevez vos APIs de composants avant d'écrire du code. Gardez les props minimales, utilisez la composition plutôt que la configuration.</p>
<h2>Accessibilité par Défaut</h2>
<p>Intégrez l'accessibilité dans chaque composant : rôles ARIA appropriés, navigation au clavier, gestion du focus, contraste des couleurs.</p>
<h2>Documentation comme Code</h2>
<p>Utilisez Storybook pour documenter les composants aux côtés de leur code. Exemples interactifs et guides d'utilisation assurent l'adoption.</p>
<h2>Versionnement et Distribution</h2>
<p>Publiez votre design system comme package npm avec versionnement sémantique.</p>`
  },
  {
    title: 'Optimiser les Core Web Vitals : Guide du Développeur',
    slug: 'optimiser-core-web-vitals-guide',
    date: '2026-01-08T10:00:00',
    category: 'Performance',
    tags: ['Performance', 'Web Vitals', 'SEO'],
    content: `<h2>Comprendre les Métriques</h2>
<p>Les Core Web Vitals mesurent l'expérience utilisateur réelle : LCP pour la vitesse de chargement, INP pour la réactivité, et CLS pour la stabilité visuelle. Google les utilise pour le classement.</p>
<h2>LCP : Objectif Sous 2,5 Secondes</h2>
<p>L'élément LCP est généralement une image hero ou un titre. Optimisez-le : utilisez fetchpriority="high", préchargez les images critiques, servez des formats WebP/AVIF.</p>
<h2>INP : Objectif Sous 200ms</h2>
<p>INP remplace FID. Il mesure la pire latence d'interaction. Découpez les tâches longues avec requestIdleCallback.</p>
<h2>CLS : Objectif Sous 0,1</h2>
<p>Définissez toujours des dimensions explicites sur les images et vidéos. Utilisez aspect-ratio en CSS pour les médias responsifs.</p>
<h2>Mesurer sur le Terrain</h2>
<p>Les outils de lab (Lighthouse) donnent une base contrôlée. Les données terrain (CrUX) montrent l'expérience réelle. Priorisez toujours les données terrain.</p>
<h2>Victoires Rapides</h2>
<p>Activez la compression Brotli, implémentez les resource hints, lazy-loadez les images hors écran, inlinez le CSS critique.</p>`
  },
  {
    title: 'Architecture Événementielle avec Files de Messages',
    slug: 'architecture-evenementielle-files-messages',
    date: '2024-11-20T09:00:00',
    category: 'Architecture',
    tags: ['Architecture', 'Files de messages', 'Scalabilité'],
    content: `<h2>Au-delà du Requête-Réponse</h2>
<p>Les architectures requête-réponse traditionnelles créent un couplage fort. L'architecture événementielle découple les producteurs des consommateurs.</p>
<h2>Messages vs Événements</h2>
<p>Une commande dit à un service de faire quelque chose. Un événement dit au monde que quelque chose s'est passé. Les événements permettent des architectures réactives.</p>
<h2>Choisir un Broker de Messages</h2>
<p>RabbitMQ pour le message queuing traditionnel. Kafka pour le streaming d'événements à haut débit. Redis Streams pour les scénarios légers.</p>
<h2>L'Idempotence Est Non Négociable</h2>
<p>Les messages peuvent être délivrés plus d'une fois. Chaque consommateur doit gérer les duplicats gracieusement.</p>
<h2>Dead Letter Queues</h2>
<p>Les messages qui échouent de manière répétée ne devraient pas bloquer la file. Routez-les vers une dead letter queue pour investigation.</p>
<h2>Le Pattern Saga</h2>
<p>Sans transactions distribuées, utilisez des sagas : une séquence de transactions locales avec des actions compensatoires pour le rollback.</p>`
  },
  {
    title: 'Maîtriser les Workflows Git pour la Productivité d\'Équipe',
    slug: 'maitriser-workflows-git-productivite',
    date: '2024-10-05T08:30:00',
    category: 'DevOps',
    tags: ['Git', 'Workflow', 'Collaboration'],
    content: `<h2>Trunk-Based Development vs Git Flow</h2>
<p>Les branches longue durée de Git Flow créent des conflits de merge. Le trunk-based development garde la codebase intégrée et réduit la surface de conflits.</p>
<h2>Conventional Commits</h2>
<p>Les messages de commit structurés permettent la génération automatique de changelogs et le versionnement sémantique.</p>
<h2>Rebase vs Merge</h2>
<p>Utilisez rebase pour les branches de fonctionnalités pour maintenir un historique linéaire. Utilisez les merge commits pour intégrer à main.</p>
<h2>Bonnes Pratiques de Code Review</h2>
<p>Gardez les PRs petites (moins de 400 lignes). Fournissez du contexte dans la description. Reviewez pour la correction, la sécurité et la maintenabilité.</p>
<h2>Automatiser les Portes de Qualité</h2>
<p>Exécutez tests, linters et vérifications de types comme checks CI sur chaque PR.</p>
<h2>Git Bisect pour la Chasse aux Bugs</h2>
<p>Quand un bug apparaît, git bisect utilise la recherche binaire pour trouver le commit responsable en O(log n) étapes.</p>`
  },
  {
    title: 'L\'Art du Design d\'API : REST, GraphQL et tRPC Comparés',
    slug: 'design-api-rest-graphql-trpc-compares',
    date: '2024-09-12T10:00:00',
    category: 'Backend',
    tags: ['API', 'GraphQL', 'REST'],
    content: `<h2>REST : Le Standard Éprouvé</h2>
<p>REST est bien compris, cacheable et fonctionne avec n'importe quel client HTTP. Sa faiblesse : le sur-fetching et le sous-fetching.</p>
<h2>GraphQL : Requêtes Flexibles</h2>
<p>GraphQL résout le problème du sur/sous-fetching avec des requêtes spécifiées par le client. Idéal pour les apps mobiles et les données relationnelles complexes.</p>
<h2>tRPC : Sûreté de Type de Bout en Bout</h2>
<p>tRPC élimine entièrement la couche API pour les monorepos TypeScript. Le compromis : c'est TypeScript-only.</p>
<h2>Cadre de Décision</h2>
<p>REST pour les APIs publiques. GraphQL pour les graphes de données complexes. tRPC pour les APIs TypeScript internes.</p>
<h2>Patterns de Pagination</h2>
<p>La pagination par offset est simple mais casse avec les insertions concurrentes. La pagination par curseur est consistante et plus performante.</p>
<h2>Gestion des Erreurs</h2>
<p>Utilisez les codes HTTP standard pour REST. En GraphQL, les erreurs vont dans le tableau errors. Pour tRPC, lancez des erreurs typées.</p>`
  },
  {
    title: 'Des Animations Qui Sonnent Juste : Le Motion Physique en UI',
    slug: 'animations-motion-physique-ui',
    date: '2024-08-18T09:30:00',
    category: 'Frontend',
    tags: ['Animation', 'GSAP', 'UX'],
    content: `<h2>Pourquoi le Motion Physique ?</h2>
<p>Les animations linéaires semblent robotiques. Les animations basées sur la physique (ressorts, friction, gravité) reflètent le mouvement du monde réel.</p>
<h2>Dynamique des Ressorts</h2>
<p>Une animation de ressort a trois paramètres : raideur, amortissement et masse. Plus de raideur = plus vif, plus d'amortissement = moins de rebond.</p>
<h2>GSAP pour les Animations en Production</h2>
<p>GSAP est le standard de l'industrie pour l'animation web. Son système de timeline permet d'orchestrer des séquences complexes.</p>
<h2>Animations au Scroll</h2>
<p>ScrollTrigger lie les animations à la position du scroll. Utilisez scrub pour le progrès lié au scroll, pin pour les sections sticky.</p>
<h2>Considérations de Performance</h2>
<p>N'animez que transform et opacity — ces propriétés ne déclenchent pas de layout ou de paint.</p>
<h2>Respecter les Préférences Utilisateur</h2>
<p>Vérifiez toujours prefers-reduced-motion et désactivez ou simplifiez les animations pour les utilisateurs qui le demandent.</p>`
  },
  {
    title: 'Kubernetes pour Petites Équipes : Quand Ça a du Sens',
    slug: 'kubernetes-petites-equipes',
    date: '2024-07-22T11:00:00',
    category: 'DevOps',
    tags: ['Kubernetes', 'DevOps', 'Infrastructure'],
    content: `<h2>L'Évaluation Honnête</h2>
<p>Kubernetes est puissant mais complexe. Pour une petite équipe avec 2-3 services, les plateformes managées offrent 90% des avantages à 10% du coût opérationnel.</p>
<h2>Quand Kubernetes Est Rentable</h2>
<p>Plusieurs services avec des besoins de scaling différents. Charges de travail imprévisibles. Exigences réseau complexes.</p>
<h2>Managé vs Auto-Hébergé</h2>
<p>N'auto-hébergez jamais Kubernetes en production sauf si vous avez des ingénieurs plateforme dédiés. Utilisez EKS, GKE ou AKS.</p>
<h2>Ressources Essentielles</h2>
<p>Vous devez comprendre : Pods, Deployments, Services, Ingress, ConfigMaps/Secrets et HPA.</p>
<h2>Helm Charts</h2>
<p>Helm package les manifests Kubernetes en charts réutilisables et versionnés. Pour vos propres services, considérez Kustomize.</p>
<h2>Monitoring et Débogage</h2>
<p>Installez Prometheus + Grafana pour les métriques, Loki pour les logs et Jaeger pour le tracing.</p>`
  },
  {
    title: 'Applications Temps Réel avec WebSockets et Server-Sent Events',
    slug: 'applications-temps-reel-websockets-sse',
    date: '2024-06-14T08:00:00',
    category: 'Développement Web',
    tags: ['WebSockets', 'Temps Réel', 'Node.js'],
    content: `<h2>Choisir le Bon Protocole</h2>
<p>WebSockets offrent la communication full-duplex. Server-Sent Events sont du serveur au client uniquement mais plus simples, avec auto-reconnexion.</p>
<h2>Quand Utiliser les WebSockets</h2>
<p>Applications de chat, édition collaborative, jeux multijoueurs — tout scénario où le client envoie fréquemment des messages au serveur.</p>
<h2>Quand SSE Suffit</h2>
<p>Flux en direct, notifications, mises à jour de dashboard — quand les données circulent principalement du serveur au client.</p>
<h2>Scaler les Serveurs WebSocket</h2>
<p>Les connexions WebSocket sont stateful. Le scaling nécessite une couche pub/sub (Redis) pour diffuser les messages entre instances.</p>
<h2>Gestion des Connexions</h2>
<p>Implémentez un heartbeat pour détecter les connexions mortes. Gérez la reconnexion avec backoff exponentiel côté client.</p>
<h2>Sécurité</h2>
<p>Authentifiez les connexions WebSocket pendant le handshake HTTP, pas après. Validez tous les messages entrants.</p>`
  },
  {
    title: 'Architecture Monorepo avec Turborepo : Leçons Apprises',
    slug: 'architecture-monorepo-turborepo-lecons',
    date: '2024-05-08T09:30:00',
    category: 'Architecture',
    tags: ['Monorepo', 'Turborepo', 'DX'],
    content: `<h2>Pourquoi le Monorepo ?</h2>
<p>Les monorepos gardent le code lié ensemble : bibliothèques partagées, multiples apps et config d'infrastructure dans un seul dépôt.</p>
<h2>L'Approche Turborepo</h2>
<p>Turborepo est un système de build pour les monorepos JavaScript/TypeScript. Il cache les résultats de tâches et parallélise le travail.</p>
<h2>Structure des Packages</h2>
<p>Organisez en apps/ pour les applications et packages/ pour les bibliothèques partagées, configs et types.</p>
<h2>Packages Internes</h2>
<p>Utilisez le pattern de package interne : les packages sont consommés via les alias de chemins TypeScript, pas publiés sur npm.</p>
<h2>Optimisation CI/CD</h2>
<p>Le flag --filter de Turborepo n'exécute les tâches que pour les packages modifiés. Les builds PR passent de 15 minutes à 2.</p>
<h2>Pièges Courants</h2>
<p>Évitez les dépendances circulaires entre packages. Gardez le graphe de dépendances acyclique.</p>`
  },
  {
    title: 'Gestion Efficace des Erreurs dans les Applications en Production',
    slug: 'gestion-efficace-erreurs-production',
    date: '2024-04-15T10:00:00',
    category: 'Backend',
    tags: ['Gestion d\'erreurs', 'Monitoring', 'Bonnes Pratiques'],
    content: `<h2>Les Erreurs Sont des Fonctionnalités</h2>
<p>En production, les erreurs sont inévitables. La question n'est pas si elles se produiront, mais avec quelle grâce votre application les gère.</p>
<h2>Classification des Erreurs</h2>
<p>Les erreurs opérationnelles sont attendues et gérables. Les erreurs de programmation sont des bugs qui doivent être corrigés.</p>
<h2>Réponses d'Erreur Structurées</h2>
<p>Utilisez un format cohérent avec un code d'erreur, un message humain, des détails et un identifiant de requête.</p>
<h2>Error Boundaries en React</h2>
<p>Les error boundaries attrapent les erreurs de rendu et affichent une UI de repli au lieu d'un écran blanc.</p>
<h2>Suivi Centralisé des Erreurs</h2>
<p>Utilisez Sentry ou Bugsnag pour agréger les erreurs. Groupez par cause racine, suivez la fréquence et configurez des alertes.</p>
<h2>Dégradation Gracieuse</h2>
<p>Quand un service non-critique échoue, dégradez gracieusement plutôt que d'échouer entièrement. Ayez toujours un plan B.</p>`
  },
];

(async () => {
  console.log('Setting up categories and tags...\n');

  // Collect all unique categories and tags
  const allCategories = new Set();
  const allTags = new Set();
  [...enPosts, ...frPosts].forEach(p => {
    allCategories.add(p.category);
    p.tags.forEach(t => allTags.add(t));
  });

  // Create categories
  const catIds = {};
  for (const cat of allCategories) {
    catIds[cat] = await getOrCreateTerm('categories', cat);
    console.log(`  Category "${cat}" → ID ${catIds[cat]}`);
  }

  // Create tags
  const tagIds = {};
  for (const tag of allTags) {
    tagIds[tag] = await getOrCreateTerm('tags', tag);
    console.log(`  Tag "${tag}" → ID ${tagIds[tag]}`);
  }

  // Get language term IDs for Polylang
  let enLangId = null, frLangId = null;
  try {
    const langs = await wpAPI('GET', 'categories?slug=en&per_page=5');
    // Polylang uses a different approach - try language taxonomy
  } catch (e) {}

  console.log('\n--- Creating English Posts ---\n');
  const enCreated = [];
  for (let idx = 0; idx < enPosts.length; idx++) {
    const post = enPosts[idx];
    try {
      const catId = catIds[post.category] ? [catIds[post.category]] : [];
      const tagIdList = post.tags.map(t => tagIds[t]).filter(Boolean);

      // Upload featured image
      console.log(`  📷 Uploading cover image for [EN] ${post.title}...`);
      const featuredMediaId = await uploadFeaturedImage(post.title, idx);

      const postData = {
        title: post.title,
        slug: post.slug,
        content: post.content,
        status: 'publish',
        date: post.date,
        categories: catId,
        tags: tagIdList,
        lang: 'en',
      };
      if (featuredMediaId) postData.featured_media = featuredMediaId;

      const created = await wpAPI('POST', 'posts', postData);
      enCreated.push({ id: created.id, slug: post.slug });
      console.log(`  ✓ [EN] ${post.title} (ID: ${created.id})`);
    } catch (e) {
      console.log(`  ✗ [EN] ${post.title}: ${e.message.substring(0, 100)}`);
    }
  }

  console.log('\n--- Creating French Posts ---\n');
  const frCreated = [];
  for (let idx = 0; idx < frPosts.length; idx++) {
    const post = frPosts[idx];
    try {
      const catId = catIds[post.category] ? [catIds[post.category]] : [];
      const tagIdList = post.tags.map(t => tagIds[t]).filter(Boolean);

      // Upload featured image (offset by 20 to get different images)
      console.log(`  📷 Uploading cover image for [FR] ${post.title}...`);
      const featuredMediaId = await uploadFeaturedImage(post.title, idx + 20);

      const postData = {
        title: post.title,
        slug: post.slug,
        content: post.content,
        status: 'publish',
        date: post.date,
        categories: catId,
        tags: tagIdList,
        lang: 'fr',
      };
      if (featuredMediaId) postData.featured_media = featuredMediaId;

      const created = await wpAPI('POST', 'posts', postData);
      frCreated.push({ id: created.id, slug: post.slug });
      console.log(`  ✓ [FR] ${post.title} (ID: ${created.id})`);
    } catch (e) {
      console.log(`  ✗ [FR] ${post.title}: ${e.message.substring(0, 100)}`);
    }
  }

  // Link translations via Polylang REST API
  if (enCreated.length > 0 && frCreated.length > 0) {
    console.log('\n--- Linking Translations ---\n');
    for (let i = 0; i < Math.min(enCreated.length, frCreated.length); i++) {
      try {
        // Polylang Pro REST API: set translations via post meta
        await wpAPI('POST', `posts/${enCreated[i].id}`, {
          translations: { fr: frCreated[i].id },
        });
        console.log(`  ✓ Linked EN:${enCreated[i].id} ↔ FR:${frCreated[i].id}`);
      } catch (e) {
        // Polylang may use a different API endpoint
        console.log(`  ⚠ Could not link ${enCreated[i].id} ↔ ${frCreated[i].id}: ${e.message.substring(0, 80)}`);
      }
    }
  }

  console.log(`\n✅ Done! Created ${enCreated.length} EN + ${frCreated.length} FR posts.`);
})();
