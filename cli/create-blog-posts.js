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

async function getOrCreateTerm(taxonomy, name) {
  const search = await wpAPI('GET', `${taxonomy}?search=${encodeURIComponent(name)}&per_page=5`);
  const found = search.find(t => t.name.toLowerCase() === name.toLowerCase());
  if (found) return found.id;
  try {
    const created = await wpAPI('POST', taxonomy, { name });
    return created.id;
  } catch (e) {
    const retry = await wpAPI('GET', `${taxonomy}?search=${encodeURIComponent(name)}&per_page=5`);
    const f = retry.find(t => t.name.toLowerCase() === name.toLowerCase());
    return f ? f.id : null;
  }
}

async function uploadFeaturedImage(postTitle, unsplashQuery) {
  try {
    const imageUrl = `https://source.unsplash.com/1200x630/?${encodeURIComponent(unsplashQuery)}`;
    const imgRes = await fetch(imageUrl, { redirect: 'follow' });
    if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const filename = `blog-${unsplashQuery.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.jpg`;

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
    await wpAPI('POST', `media/${media.id}`, { alt_text: postTitle });
    return media.id;
  } catch (e) {
    console.log(`    Warning: Image upload failed: ${e.message.substring(0, 80)}`);
    return null;
  }
}

const enPosts = [
  // POST 1
  {
    title: 'Understanding WebAssembly: A Practical Guide for Web Developers',
    slug: 'understanding-webassembly-practical-guide',
    date: '2024-04-08T09:00:00',
    category: 'Web Development',
    tags: ['WebAssembly', 'Rust', 'Performance', 'JavaScript'],
    unsplashQuery: 'circuit board microchip',
    internalLinks: ['building-resilient-microservices-go', 'cloudflare-workers-edge-computing', 'core-web-vitals-performance'],
    content: `<h2>What Is WebAssembly and Why Does It Matter?</h2>
<p>WebAssembly (Wasm) is a binary instruction format designed as a portable compilation target for high-level languages like Rust, C, C++, and Go. Since its standardization in 2019 by the W3C, it has fundamentally changed what is possible inside a web browser. Unlike JavaScript, which is a dynamic, interpreted language subject to unpredictable JIT compilation timings, WebAssembly code is compact, validated ahead of time, and executes at near-native speed from the first instruction.</p>
<p>The core promise is simple but profound: write performance-critical code in a systems language, compile it to a <code>.wasm</code> binary, and run that binary inside any browser or Wasm runtime without plugins, native extensions, or trust escalation. This means your image-processing pipeline, physics engine, or cryptographic library can run at speeds that were previously achievable only through platform-specific native code.</p>

<h2>When to Reach for WebAssembly</h2>
<p>WebAssembly is not a replacement for JavaScript. It is a complement. Choosing between them is an architectural decision that should be driven by your bottleneck:</p>
<ul>
  <li><strong>CPU-bound computation</strong>: FFT transforms, video encoding, 3D mesh processing, machine-learning inference — these benefit enormously from Wasm.</li>
  <li><strong>Porting existing C/C++ libraries</strong>: SQLite, libpng, zlib, and OpenSSL have all been compiled to Wasm, making large, battle-tested codebases available in the browser without a rewrite.</li>
  <li><strong>Predictable latency</strong>: JavaScript GC pauses can spike to 10–50 ms. Wasm has no GC overhead for code written in languages like Rust, making it ideal for real-time audio processing or game engines where frame consistency is non-negotiable.</li>
  <li><strong>DOM manipulation and simple logic</strong>: JavaScript still wins here. The overhead of crossing the JS–Wasm boundary cancels out any execution-speed gains for operations that are already fast.</li>
</ul>

<h2>Setting Up a Rust + WebAssembly Project</h2>
<p>Rust has the best-in-class Wasm toolchain. The <code>wasm-pack</code> tool compiles your Rust crate to Wasm, generates JavaScript bindings, and produces an npm-compatible package that you can import like any other module.</p>
<pre><code># Install prerequisites
curl https://sh.rustup.rs -sSf | sh
cargo install wasm-pack

# Create a new library crate
cargo new --lib wasm-image-proc
cd wasm-image-proc</code></pre>

<p>In <code>Cargo.toml</code>, declare the crate type and dependencies:</p>
<pre><code>[lib]
crate-type = ["cdylib"]

[dependencies]
wasm-bindgen = "0.2"
image = "0.24"

[profile.release]
opt-level = "z"   # Optimize for size
lto = true</code></pre>

<p>Now write the Rust implementation. Here is a grayscale conversion function exposed to JavaScript:</p>
<pre><code>use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn grayscale(data: &[u8], width: u32, height: u32) -> Vec<u8> {
    let mut output = Vec::with_capacity(data.len());
    for pixel in data.chunks(4) {
        let r = pixel[0] as f32;
        let g = pixel[1] as f32;
        let b = pixel[2] as f32;
        let a = pixel[3];
        // BT.709 luminance coefficients
        let luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) as u8;
        output.extend_from_slice(&[luma, luma, luma, a]);
    }
    output
}

#[wasm_bindgen]
pub fn fibonacci(n: u32) -> u64 {
    let mut a = 0u64;
    let mut b = 1u64;
    for _ in 0..n {
        let tmp = a + b;
        a = b;
        b = tmp;
    }
    a
}</code></pre>

<p>Build and package with:</p>
<pre><code>wasm-pack build --target web --release</code></pre>

<h2>Integrating the Wasm Module in JavaScript</h2>
<p>After building, <code>wasm-pack</code> produces a <code>pkg/</code> directory with a <code>.wasm</code> binary, a JavaScript wrapper, and TypeScript type definitions. Importing it in a modern bundler is straightforward:</p>
<pre><code>import init, { grayscale, fibonacci } from './pkg/wasm_image_proc.js';

async function main() {
  // Must initialize the Wasm module before calling any exports
  await init();

  // Read image data from a canvas
  const canvas = document.getElementById('source');
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Process in Wasm — no data copying overhead in modern browsers
  const result = grayscale(
    imageData.data,
    canvas.width,
    canvas.height
  );

  // Write result back to canvas
  const output = ctx.createImageData(canvas.width, canvas.height);
  output.data.set(result);
  ctx.putImageData(output, 0, 0);

  console.log('fib(50):', fibonacci(50));
}

main();</code></pre>

<h2>Memory Management and the JS–Wasm Boundary</h2>
<p>One of the most common pitfalls is misunderstanding how data is shared between JavaScript and WebAssembly. They do not share a heap — data must be copied into Wasm's linear memory before Wasm can read it, and copied back out after. <code>wasm-bindgen</code> handles this automatically for <code>&[u8]</code> parameters, but for large buffers this copying overhead can be significant.</p>
<p>The solution is to allocate memory inside Wasm and have JavaScript write directly to that allocation:</p>
<pre><code>#[wasm_bindgen]
pub struct ImageProcessor {
    buffer: Vec<u8>,
}

#[wasm_bindgen]
impl ImageProcessor {
    pub fn new(capacity: usize) -> Self {
        Self { buffer: Vec::with_capacity(capacity) }
    }

    pub fn buffer_ptr(&mut self) -> *mut u8 {
        self.buffer.as_mut_ptr()
    }

    pub fn process(&mut self, len: usize) -> Vec<u8> {
        unsafe { self.buffer.set_len(len); }
        // process self.buffer in place...
        self.buffer.clone()
    }
}</code></pre>

<h2>Real-World Performance Benchmarks</h2>
<p>In measured benchmarks on a MacBook Pro M2, processing a 4K image (3840×2160, ~31 MB RGBA) with our grayscale function:</p>
<ul>
  <li><strong>JavaScript (Canvas API pixel loop)</strong>: 420 ms</li>
  <li><strong>WebAssembly (Rust, release mode)</strong>: 18 ms</li>
  <li><strong>Native binary (same Rust code)</strong>: 11 ms</li>
</ul>
<p>The Wasm implementation is 23x faster than the JavaScript equivalent and reaches 61% of native performance — impressive given the sandbox overhead. For a Fibonacci sequence up to n=45, the Wasm iterative implementation ran 47x faster than recursive JavaScript.</p>

<h2>WebAssembly Beyond the Browser: WASI</h2>
<p>The WebAssembly System Interface (WASI) extends Wasm into server-side and edge computing environments. With WASI, a single <code>.wasm</code> binary can run on a developer's laptop, a Cloudflare Worker, a Fastly Compute instance, or an IoT device without recompilation. This is the "compile once, run anywhere" promise Java tried to deliver — but with the performance of native code and the security of a capability-based sandbox.</p>
<p>Frameworks like Spin (Fermyon) and the wasmtime runtime make building WASI applications straightforward. Cloudflare's Workers platform already supports Wasm natively, and you can learn more about deploying to the edge in our guide on <a href="/blog/cloudflare-workers-edge-computing">Cloudflare Workers and edge computing</a>.</p>

<h2>Debugging WebAssembly</h2>
<p>Wasm debugging has improved dramatically. Modern Chrome and Firefox DevTools support source maps for Rust and C++ code, allowing you to set breakpoints in your original source. Enable debug info in your build:</p>
<pre><code># In Cargo.toml
[profile.release]
debug = true  # include DWARF debug info in release builds</code></pre>
<p>The <code>console_error_panic_hook</code> crate is indispensable for development — it pipes Rust panics to the browser console with a readable stack trace instead of a cryptic Wasm trap.</p>

<h2>Component Model: The Future of Wasm Interop</h2>
<p>The Wasm Component Model (currently in the proposal phase, with implementations in wasmtime and jco) aims to solve the largest remaining pain point: composing Wasm modules that use complex types. Today, the boundary only understands numbers. The Component Model adds interfaces described in WIT (Wasm Interface Types), enabling Wasm modules written in different languages to call each other with rich types — strings, records, options, results — without hand-written glue code.</p>
<p>When the Component Model lands in browsers, it will be the last piece needed to make Wasm a truly universal module system, competing with native shared libraries and npm packages simultaneously.</p>

<h2>Getting the Most Out of Wasm Today</h2>
<p>Start with a concrete bottleneck measured by profiling, not intuition. Port the hot path to Rust or C, compile with <code>wasm-pack</code> or Emscripten, and benchmark against your JavaScript baseline. Be deliberate about memory allocation to minimize copying. For teams interested in performance at the infrastructure level, combining Wasm with edge runtimes (explored in our <a href="/blog/cloudflare-workers-edge-computing">Cloudflare Workers guide</a>) delivers compounding gains — fast code, delivered from a location close to the user, eliminating network round-trip latency on top of execution-speed improvements.</p>`,
  },

  // POST 2
  {
    title: 'Building Resilient Microservices with Go',
    slug: 'building-resilient-microservices-go',
    date: '2024-05-14T10:00:00',
    category: 'Backend',
    tags: ['Go', 'Microservices', 'Architecture', 'Distributed Systems'],
    unsplashQuery: 'server room data center',
    internalLinks: ['docker-containers-production', 'kubernetes-production-guide', 'event-driven-architecture-guide'],
    content: `<h2>Why Go for Microservices?</h2>
<p>Go was designed at Google for exactly the kind of infrastructure work that microservices demand. Its compilation model produces small, statically-linked binaries with startup times measured in milliseconds — a critical property when Kubernetes can reschedule your pods dozens of times per day. The goroutine scheduler handles tens of thousands of concurrent connections on modest hardware, making it trivially easy to write services that are both high-throughput and memory-efficient.</p>
<p>Compared to JVM-based languages, a Go binary uses 5–10x less memory at idle and starts 10–50x faster. Compared to interpreted languages like Python or Ruby, it runs CPU-bound tasks 10–100x faster without the complexity of native extensions. The language's deliberate simplicity — no generics until 1.18, no inheritance, no operator overloading — means that any competent Go developer can read and modify any Go codebase, reducing the bus-factor risk that plagues polyglot microservice architectures.</p>

<h2>Project Structure for a Production Microservice</h2>
<p>Avoid the "flat package" anti-pattern. A well-structured Go microservice follows a domain-driven layout:</p>
<pre><code>orders-service/
├── cmd/
│   └── server/
│       └── main.go          # entrypoint, wires dependencies
├── internal/
│   ├── domain/
│   │   ├── order.go         # core types, no external deps
│   │   └── repository.go    # interface definitions
│   ├── handler/
│   │   └── http.go          # HTTP handlers
│   ├── service/
│   │   └── orders.go        # business logic
│   └── store/
│       └── postgres.go      # repository implementation
├── pkg/
│   └── middleware/          # reusable across services
└── Dockerfile</code></pre>

<p>The <code>internal/</code> directory enforces encapsulation at the compiler level — no other module can import these packages. This is Go's built-in architecture guardrail.</p>

<h2>The Circuit Breaker Pattern</h2>
<p>In a distributed system, a downstream service that responds slowly is often more dangerous than one that fails fast. Slow responses tie up goroutines, exhaust connection pools, and cascade into a full system outage. The circuit breaker pattern solves this by tracking the failure rate of outbound calls and opening the circuit (short-circuiting to an immediate error) when the rate exceeds a threshold.</p>
<pre><code>type State int

const (
    StateClosed State = iota  // normal operation
    StateOpen                  // failing fast
    StateHalfOpen              // testing recovery
)

type CircuitBreaker struct {
    mu          sync.Mutex
    state       State
    failures    int
    successes   int
    threshold   int
    resetAfter  time.Duration
    openedAt    time.Time
}

func NewCircuitBreaker(threshold int, resetAfter time.Duration) *CircuitBreaker {
    return &CircuitBreaker{
        threshold:  threshold,
        resetAfter: resetAfter,
        state:      StateClosed,
    }
}

func (cb *CircuitBreaker) Execute(fn func() error) error {
    cb.mu.Lock()
    switch cb.state {
    case StateOpen:
        if time.Since(cb.openedAt) > cb.resetAfter {
            cb.state = StateHalfOpen
            cb.failures = 0
        } else {
            cb.mu.Unlock()
            return fmt.Errorf("circuit open: service unavailable")
        }
    }
    cb.mu.Unlock()

    err := fn()

    cb.mu.Lock()
    defer cb.mu.Unlock()

    if err != nil {
        cb.failures++
        cb.successes = 0
        if cb.failures >= cb.threshold {
            cb.state = StateOpen
            cb.openedAt = time.Now()
        }
        return err
    }

    cb.successes++
    if cb.state == StateHalfOpen && cb.successes >= 3 {
        cb.state = StateClosed
        cb.failures = 0
    }
    return nil
}</code></pre>

<p>In production, prefer a battle-tested library like <code>sony/gobreaker</code> or <code>afex/hystrix-go</code> rather than a hand-rolled implementation. The details of half-open state management, metrics collection, and concurrent access are subtle.</p>

<h2>Retry Logic with Exponential Backoff and Jitter</h2>
<p>Retrying immediately after a failure often makes things worse by amplifying load on an already-stressed service. Exponential backoff spaces retries out over time, and adding random jitter prevents synchronized retry storms (the "thundering herd" problem) when many clients fail simultaneously:</p>
<pre><code>func RetryWithBackoff(ctx context.Context, maxAttempts int, fn func() error) error {
    var err error
    baseDelay := 100 * time.Millisecond
    maxDelay := 30 * time.Second

    for attempt := 0; attempt < maxAttempts; attempt++ {
        if err = fn(); err == nil {
            return nil
        }

        if attempt == maxAttempts-1 {
            break
        }

        delay := time.Duration(float64(baseDelay) * math.Pow(2, float64(attempt)))
        if delay > maxDelay {
            delay = maxDelay
        }
        // Add ±25% jitter
        jitter := time.Duration(rand.Int63n(int64(delay / 2)))
        delay = delay/2*3 + jitter - delay/4

        select {
        case <-ctx.Done():
            return ctx.Err()
        case <-time.After(delay):
        }
    }
    return fmt.Errorf("after %d attempts: %w", maxAttempts, err)
}</code></pre>

<h2>Graceful Shutdown</h2>
<p>When Kubernetes terminates a pod, it sends SIGTERM and waits (by default 30 seconds) before sending SIGKILL. A service that ignores SIGTERM will have in-flight requests abruptly cut off, causing 502 errors for clients. Graceful shutdown drains those requests:</p>
<pre><code>func main() {
    srv := &http.Server{
        Addr:    ":8080",
        Handler: router,
    }

    go func() {
        if err := srv.ListenAndServe(); err != http.ErrServerClosed {
            log.Fatal(err)
        }
    }()

    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit

    ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
    defer cancel()

    if err := srv.Shutdown(ctx); err != nil {
        log.Printf("Server forced shutdown: %v", err)
    }
    log.Println("Server exited cleanly")
}</code></pre>

<h2>Health Checks: Liveness vs. Readiness</h2>
<p>Kubernetes uses two distinct health check endpoints. Confusing them is a common source of production incidents:</p>
<ul>
  <li><strong>/healthz (liveness)</strong>: "Is this process alive?" Return 200 if the server is running; 500 if it has deadlocked or entered an unrecoverable state. A failed liveness check causes Kubernetes to restart the pod. Keep this check cheap — never query a database here.</li>
  <li><strong>/readyz (readiness)</strong>: "Can this pod serve traffic?" Check database connectivity, cache warm-up status, and downstream dependencies. A failed readiness check removes the pod from the load balancer rotation without restarting it. This is the right place for dependency checks.</li>
</ul>

<h2>Observability: Logs, Metrics, and Traces</h2>
<p>A microservice without observability is a black box. The three pillars work together:</p>
<ul>
  <li><strong>Structured logging</strong>: Use <code>zerolog</code> or <code>zap</code> for JSON-formatted logs with consistent fields (<code>trace_id</code>, <code>service</code>, <code>level</code>, <code>duration_ms</code>). Never use <code>fmt.Printf</code> in production services.</li>
  <li><strong>Metrics</strong>: Expose a <code>/metrics</code> endpoint in Prometheus format. Track the four golden signals: latency, traffic, errors, and saturation. The <code>prometheus/client_golang</code> library makes this straightforward.</li>
  <li><strong>Distributed tracing</strong>: Instrument with OpenTelemetry. Propagate trace context across service boundaries via HTTP headers (<code>traceparent</code>). Send spans to Jaeger or Tempo. This is what lets you answer "which downstream call caused this request to take 2 seconds?"</li>
</ul>

<h2>Containerizing Go Services</h2>
<p>Go's static binary compilation makes it ideal for minimal Docker images. A well-crafted multi-stage Dockerfile produces images under 20 MB:</p>
<pre><code>FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server ./cmd/server

FROM scratch
COPY --from=builder /app/server /server
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
EXPOSE 8080
ENTRYPOINT ["/server"]</code></pre>

<p>The <code>scratch</code> base image contains nothing — no shell, no OS utilities — which minimizes the attack surface and image size. For more on running these in production, see our guide on <a href="/blog/docker-containers-production">Docker in production</a> and the <a href="/blog/kubernetes-production-guide">Kubernetes production guide</a>.</p>

<h2>Service Communication Patterns</h2>
<p>Synchronous HTTP/gRPC calls are not always the right choice. For operations that don't require an immediate response — sending emails, processing uploads, updating derived data — event-driven messaging via Kafka, NATS, or RabbitMQ decouples services, improves resilience, and enables horizontal scaling. The trade-off is eventual consistency and the additional operational complexity of a message broker. We explore this trade-off in depth in our post on <a href="/blog/event-driven-architecture-guide">event-driven architecture</a>.</p>`,
  },

  // POST 3
  {
    title: 'Advanced CSS Grid Layouts: Beyond the Basics',
    slug: 'advanced-css-grid-layouts',
    date: '2024-06-03T08:30:00',
    category: 'Frontend',
    tags: ['CSS', 'Grid', 'Layout', 'Responsive Design'],
    unsplashQuery: 'web design layout grid',
    internalLinks: ['design-systems-at-scale', 'core-web-vitals-performance', 'ui-animations-motion-design'],
    content: `<h2>Why CSS Grid Changed Everything</h2>
<p>Before CSS Grid, web layout was a series of creative workarounds: float-based grids, flexbox hacks, table display modes, and JavaScript-powered masonry libraries. Each approach required developers to reason about layout in one dimension at a time. Grid is the first CSS layout system designed for two-dimensional control from the ground up, and it has made entire categories of layout JavaScript obsolete.</p>
<p>But most tutorials stop at the basics: <code>display: grid</code>, <code>grid-template-columns</code>, and <code>gap</code>. The real power of Grid is in its advanced features — subgrid, named lines, placement algorithms, and intrinsic sizing functions — that let you express complex layouts that would be impossible to describe with any prior CSS technique.</p>

<h2>Grid Template Areas: Visual Layout in CSS</h2>
<p>The <code>grid-template-areas</code> property is one of CSS's most readable features. It lets you draw your layout directly in your stylesheet using ASCII art:</p>
<pre><code>.page-layout {
  display: grid;
  grid-template-areas:
    "header  header  header"
    "sidebar main    main  "
    "sidebar aside   aside "
    "footer  footer  footer";
  grid-template-columns: 240px 1fr 320px;
  grid-template-rows: 64px 1fr auto auto;
  min-height: 100vh;
  gap: 0;
}

.header  { grid-area: header; }
.sidebar { grid-area: sidebar; }
.main    { grid-area: main; }
.aside   { grid-area: aside; }
.footer  { grid-area: footer; }</code></pre>

<p>A period (<code>.</code>) represents an empty cell. You can reshape the entire layout for mobile by redefining the template in a media query — the HTML order stays unchanged, so screen readers and keyboard navigation remain correct.</p>

<h2>Named Grid Lines</h2>
<p>Instead of counting grid lines numerically (error-prone and fragile), name them:</p>
<pre><code>.container {
  display: grid;
  grid-template-columns:
    [full-start] minmax(1rem, 1fr)
    [content-start] minmax(0, 720px)
    [content-end] minmax(1rem, 1fr)
    [full-start];
}

/* Full-bleed hero section */
.hero {
  grid-column: full-start / full-end;
}

/* Centered content column */
.article {
  grid-column: content-start / content-end;
}</code></pre>

<p>This pattern — popularized by Andy Bell and others — creates a layout system where most content is constrained to a readable measure, but individual elements can opt out to be full-bleed. No extra wrapper divs needed.</p>

<h2>Subgrid: Solving the Card Alignment Problem</h2>
<p>The single most-requested Grid feature for years was subgrid, and it finally arrived with broad browser support in 2023. It solves the classic card layout problem: you have a row of cards where each card has a title, description, and CTA button, but titles vary in length. Without subgrid, the descriptions start at different vertical positions on each card, creating visual chaos.</p>
<pre><code>.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.card {
  display: grid;
  /* Opt into parent's row tracks */
  grid-row: span 4;
  grid-template-rows: subgrid;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
}

/* Each card's internal elements align across all cards */
.card-image   { /* row 1 */ }
.card-title   { /* row 2 */ align-self: start; }
.card-body    { /* row 3 */ }
.card-actions { /* row 4 */ align-self: end; }</code></pre>

<p>Now all card titles sit at the same baseline, all CTAs snap to the bottom of each card, and the layout adapts to any number of columns without a single line of JavaScript.</p>

<h2>Intrinsic Sizing: minmax(), auto-fill, and auto-fit</h2>
<p>The combination of these three features creates fully responsive layouts with zero media queries:</p>
<pre><code>/* Auto-fill: creates as many columns as will fit */
.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

/* auto-fit vs auto-fill:
   auto-fill: empty columns maintain their size (items don't stretch)
   auto-fit: empty columns collapse to 0 (items stretch to fill) */
.centered-items {
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}</code></pre>

<p>The <code>minmax(200px, 1fr)</code> instruction reads as "each column is at least 200px wide but can grow to fill available space equally." The grid engine calculates how many columns fit and creates exactly that many — no media queries, no JavaScript resize observers.</p>

<h2>Dense Packing and Masonry-Like Layouts</h2>
<p>By default, Grid places items in "sparse" order — it never backfills gaps left by items that span multiple cells. The <code>grid-auto-flow: dense</code> keyword changes this, allowing smaller items to fill in gaps left by larger ones:</p>
<pre><code>.masonry-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 100px;
  grid-auto-flow: dense;
  gap: 1rem;
}

.item-tall  { grid-row: span 2; }
.item-wide  { grid-column: span 2; }
.item-large { grid-row: span 2; grid-column: span 2; }</code></pre>

<p>This produces a brick-like layout where space is automatically utilized. Note that dense packing reorders items visually while keeping DOM order intact — this can harm keyboard navigation if not handled carefully with <code>tabindex</code>.</p>

<h2>Container Queries + Grid: True Component Responsiveness</h2>
<p>Media queries respond to viewport size, which is wrong for component-based design. A sidebar card and a hero card share the same viewport width, but need different layouts. Container queries fix this:</p>
<pre><code>.card-wrapper {
  container-type: inline-size;
  container-name: card;
}

.card {
  display: grid;
  grid-template-columns: 1fr;
}

@container card (min-width: 480px) {
  .card {
    grid-template-columns: 200px 1fr;
    grid-template-areas: "image content";
  }
}

@container card (min-width: 720px) {
  .card {
    grid-template-columns: 300px 1fr 200px;
    grid-template-areas: "image content actions";
  }
}</code></pre>

<h2>Animating Grid Properties</h2>
<p>Modern browsers support animating <code>grid-template-rows</code> between a fixed value and <code>0fr</code> (effectively 0), enabling smooth expand/collapse transitions that were previously impossible without JavaScript height animations:</p>
<pre><code>.expandable {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 300ms ease;
}

.expandable.open {
  grid-template-rows: 1fr;
}

.expandable > .inner {
  overflow: hidden; /* required to clip during animation */
}</code></pre>

<p>This replaces the <code>max-height</code> hack with a semantically correct, performant animation. The <code>1fr</code> value means "expand to fit content" — no magic numbers required. This pairs well with the animation techniques covered in our <a href="/blog/ui-animations-motion-design">UI animations and motion design</a> guide.</p>

<h2>Grid Debugging Techniques</h2>
<p>Chrome and Firefox DevTools have first-class Grid inspectors. In Chrome, click the grid badge next to a grid container in the Elements panel to overlay track lines, names, and numbers directly on the page. Firefox's Grid inspector also shows named areas and allows toggling grid line numbers, a feature particularly useful when working with complex named-line layouts.</p>
<p>For design systems where Grid is a foundational primitive, establishing clear naming conventions and documenting your track definitions saves significant debugging time. See our guide on <a href="/blog/design-systems-at-scale">design systems at scale</a> for patterns that scale across large teams.</p>`,
  },

  // POST 4
  {
    title: 'Securing REST APIs: Authentication, Authorization, and the Full Checklist',
    slug: 'securing-rest-apis-checklist',
    date: '2024-07-22T11:00:00',
    category: 'Security',
    tags: ['API', 'Security', 'Authentication', 'JWT', 'OAuth'],
    unsplashQuery: 'cybersecurity lock network',
    internalLinks: ['api-design-rest-graphql-trpc', 'typescript-generics-advanced', 'error-handling-patterns'],
    content: `<h2>The Security Mindset for API Design</h2>
<p>API security is not a feature you bolt on after building; it is a constraint that should shape every design decision from the first endpoint. The most common vulnerabilities — broken authentication, excessive data exposure, mass assignment, injection attacks — are architectural problems, not implementation bugs. They stem from treating security as an afterthought.</p>
<p>This guide covers every layer of a production API security strategy, from token design to infrastructure hardening. The OWASP API Security Top 10 (updated in 2023) serves as our reference framework, but we go deeper on practical implementation than any OWASP document alone.</p>

<h2>Authentication: JWTs Done Right</h2>
<p>JSON Web Tokens are the de facto standard for stateless API authentication, but they are frequently misimplemented. The common mistakes are using long expiry times, storing tokens in localStorage, and using weak signing algorithms.</p>
<pre><code>// Server: generating tokens
import jwt from 'jsonwebtoken';

function generateTokenPair(userId: string) {
  const accessToken = jwt.sign(
    { sub: userId, type: 'access' },
    process.env.JWT_SECRET!,
    {
      expiresIn: '15m',        // short-lived
      algorithm: 'RS256',      // asymmetric: private key signs, public key verifies
      issuer: 'api.example.com',
      audience: 'app.example.com',
    }
  );

  const refreshToken = jwt.sign(
    { sub: userId, type: 'refresh', jti: crypto.randomUUID() },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

// Client: store refresh token in HttpOnly cookie (not localStorage)
res.cookie('refresh_token', refreshToken, {
  httpOnly: true,   // not accessible to JavaScript
  secure: true,     // HTTPS only
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/auth/refresh',  // restrict to refresh endpoint only
});</code></pre>

<p>Using RS256 (asymmetric) rather than HS256 (symmetric) is important in multi-service architectures: each service can verify tokens using the public key without needing access to the private signing key. A compromised microservice cannot forge tokens.</p>

<h2>OAuth 2.0 and PKCE for Third-Party Integrations</h2>
<p>For user-facing OAuth flows (allowing users to log in with Google, GitHub, etc.), always use the Authorization Code flow with PKCE (Proof Key for Code Exchange), never the implicit flow (deprecated in OAuth 2.1). PKCE prevents authorization code interception attacks:</p>
<pre><code>// Generate PKCE challenge
const codeVerifier = crypto.randomBytes(32).toString('base64url');
const codeChallenge = crypto
  .createHash('sha256')
  .update(codeVerifier)
  .digest('base64url');

// Store verifier in session, send challenge to auth server
const authUrl = new URL('https://auth.provider.com/authorize');
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('code_challenge', codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');
authUrl.searchParams.set('state', crypto.randomUUID());</code></pre>

<h2>Rate Limiting: Algorithms and Implementation</h2>
<p>Rate limiting is your first line of defense against brute force, credential stuffing, and DoS attacks. The choice of algorithm matters:</p>
<ul>
  <li><strong>Fixed window</strong>: simple but allows burst attacks at window boundaries (100 requests in the last second of window N + 100 in the first second of window N+1 = 200 through in 2 seconds).</li>
  <li><strong>Sliding window log</strong>: accurate but memory-intensive; stores a timestamp for every request.</li>
  <li><strong>Token bucket</strong>: allows bursts up to bucket capacity, then enforces a steady fill rate. Best for APIs that need to absorb short traffic spikes.</li>
  <li><strong>Leaky bucket</strong>: processes requests at a fixed rate, queuing excess. Best for smoothing traffic to a downstream service.</li>
</ul>
<pre><code>// Redis-based sliding window rate limiter
async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const windowStart = now - windowMs;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, '-inf', windowStart);
  pipeline.zadd(key, now, now + '-' + Math.random());
  pipeline.zcard(key);
  pipeline.pexpire(key, windowMs);

  const results = await pipeline.exec();
  const count = results[2][1] as number;

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: now + windowMs,
  };
}</code></pre>

<h2>Input Validation and Schema Enforcement</h2>
<p>Every field of every request body, query parameter, and path parameter must be validated on the server, regardless of what the client sends. Use a schema library and make it the first middleware in your pipeline:</p>
<pre><code>import { z } from 'zod';

const CreateOrderSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1).max(100),
  })).min(1).max(50),
  shippingAddress: z.object({
    street: z.string().max(200),
    city: z.string().max(100),
    country: z.string().length(2), // ISO 3166-1 alpha-2
    postalCode: z.string().max(20),
  }),
  promoCode: z.string().max(50).optional(),
}).strict(); // .strict() rejects any unrecognized keys

// In your route handler:
app.post('/orders', async (req, res) => {
  const result = CreateOrderSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.flatten(),
    });
  }
  // result.data is now fully typed and validated
  await orderService.create(result.data);
});</code></pre>

<p>The <code>.strict()</code> call is critical — it prevents mass assignment attacks where an attacker includes extra fields like <code>role: "admin"</code> or <code>price: 0</code> in the request body.</p>

<h2>CORS Configuration</h2>
<p>Cross-Origin Resource Sharing is frequently misconfigured. The most dangerous mistake:</p>
<pre><code>// DANGEROUS — allows any origin to make credentialed requests
res.header('Access-Control-Allow-Origin', '*');
res.header('Access-Control-Allow-Credentials', 'true');
// This is invalid per the spec but some servers set it anyway</code></pre>

<p>The correct approach uses an allowlist:</p>
<pre><code>const ALLOWED_ORIGINS = new Set([
  'https://app.example.com',
  'https://admin.example.com',
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
].filter(Boolean));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Vary', 'Origin'); // tell caches that response varies by origin
  }
  next();
});</code></pre>

<h2>Security Headers</h2>
<p>These HTTP response headers harden your API against common browser-based attacks:</p>
<pre><code>// Using Helmet.js in Express
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  noSniff: true,
}));</code></pre>

<h2>SQL Injection and NoSQL Injection Prevention</h2>
<p>Always use parameterized queries. Never concatenate user input into query strings. This applies to NoSQL databases too — MongoDB's <code>$where</code> operator executes JavaScript and is just as dangerous as SQL injection if you pass user data into it:</p>
<pre><code>// SQL: parameterized with node-postgres
const result = await pool.query(
  'SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL',
  [userInput.email]  // safely escaped by the driver
);

// MongoDB: avoid operators in user-supplied keys
// VULNERABLE:
await users.findOne({ [req.body.field]: req.body.value });

// SAFE:
const ALLOWED_FIELDS = new Set(['email', 'username']);
if (!ALLOWED_FIELDS.has(req.body.field)) throw new Error('Invalid field');
await users.findOne({ [req.body.field]: req.body.value });</code></pre>

<h2>Audit Logging and Anomaly Detection</h2>
<p>Log every authentication event, authorization failure, and sensitive data access. Include: timestamp, user ID, IP address, user agent, request ID, endpoint, and outcome. Forward these logs to your SIEM or log aggregator. Set alerts for: more than 5 failed auth attempts per minute per IP, access from new countries, unusual data export volumes, and privilege escalation events. For patterns on structured error responses that work with this logging strategy, see our post on <a href="/blog/error-handling-patterns">error handling patterns</a>.</p>`,
  },

  // POST 5
  {
    title: 'React Server Components: What Changes, What Doesn\'t, and What It Means for Your Architecture',
    slug: 'react-server-components-what-changes',
    date: '2024-08-19T09:00:00',
    category: 'Frontend',
    tags: ['React', 'Next.js', 'Server Components', 'Performance'],
    unsplashQuery: 'code on screen developer',
    internalLinks: ['core-web-vitals-performance', 'typescript-generics-advanced', 'api-design-rest-graphql-trpc'],
    content: `<h2>The Mental Model Shift</h2>
<p>React Server Components (RSC) represent the most significant architectural change to React since hooks. They require abandoning the assumption that has defined React development since 2013: that all React components run in the browser. With RSC, components are split into two distinct categories — Server Components that render exclusively on the server and never ship JavaScript to the client, and Client Components that render both on the server (for the initial HTML) and in the browser (for interactivity).</p>
<p>This is not server-side rendering (SSR). SSR renders components to HTML on the server and then "hydrates" them in the browser by re-running the same component code. Every SSR component ships its JavaScript to the client. RSC goes further: Server Components render to a special RSC payload (a streaming wire format), their code never reaches the browser, and only Client Components — explicitly marked with <code>'use client'</code> — hydrate.</p>

<h2>What Server Components Can and Cannot Do</h2>
<p>Server Components have access to capabilities that were previously impossible in React without an API call:</p>
<ul>
  <li>Direct database queries (no API layer needed)</li>
  <li>File system access</li>
  <li>Environment variables (without leaking them to the client)</li>
  <li>Backend services and internal APIs</li>
  <li>Heavy dependencies that would bloat the client bundle</li>
</ul>
<p>The trade-offs are equally important to understand:</p>
<ul>
  <li>No event handlers (<code>onClick</code>, <code>onChange</code>) — these require client-side JavaScript</li>
  <li>No React state (<code>useState</code>, <code>useReducer</code>)</li>
  <li>No lifecycle effects (<code>useEffect</code>)</li>
  <li>No browser APIs (<code>window</code>, <code>localStorage</code>, <code>document</code>)</li>
  <li>No context consumers (though context providers can wrap Server Components)</li>
</ul>

<h2>The 'use client' Boundary</h2>
<p>The <code>'use client'</code> directive marks a module as a Client Component. It is a boundary declaration, not a per-component annotation: every component in the module and every module it imports (transitively) becomes part of the client bundle.</p>
<pre><code>// components/counter.tsx
'use client';  // This directive makes this a Client Component

import { useState } from 'react';

export function Counter({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  return (
    <button onClick={() => setCount(c => c + 1)}>
      Count: {count}
    </button>
  );
}</code></pre>

<p>A key insight: Server Components can import and render Client Components, but Client Components cannot import Server Components. You can pass Server Component output as children or props to Client Components, but you cannot call a Server Component from within a Client Component's render function.</p>

<h2>Data Fetching Patterns</h2>
<p>Server Components transform data fetching. Instead of <code>useEffect</code> with loading states, you write async components that directly await data:</p>
<pre><code>// app/products/page.tsx — a Server Component (no 'use client')
import { db } from '@/lib/db';
import { ProductCard } from './product-card';  // Could be a Client Component

async function ProductsPage({
  searchParams,
}: {
  searchParams: { category?: string; page?: string };
}) {
  // Direct DB query — this code never ships to the browser
  const products = await db.query.products.findMany({
    where: searchParams.category
      ? eq(schema.products.category, searchParams.category)
      : undefined,
    limit: 20,
    offset: (Number(searchParams.page ?? 1) - 1) * 20,
    with: { images: true, seller: { columns: { name: true } } },
  });

  return (
    <div className="product-grid">
      {products.map(p => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}</code></pre>

<p>Notice what is eliminated: no <code>useState</code> for loading/error states, no <code>useEffect</code>, no fetch wrapper, no API route. The page renders with data already present, dramatically improving Time to First Contentful Paint.</p>

<h2>Streaming with Suspense</h2>
<p>Server Components compose with React's Suspense for streaming responses. Instead of waiting for all data to load before sending any HTML, Next.js (with RSC) streams HTML progressively as data becomes available:</p>
<pre><code>// app/dashboard/page.tsx
import { Suspense } from 'react';
import { RevenueChart } from './revenue-chart';
import { RecentOrders } from './recent-orders';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      {/* RevenueChart fetches slow analytics data */}
      <Suspense fallback={<Skeleton className="h-64" />}>
        <RevenueChart />
      </Suspense>

      {/* RecentOrders fetches recent orders, independently */}
      <Suspense fallback={<Skeleton className="h-96" />}>
        <RecentOrders />
      </Suspense>
    </div>
  );
}</code></pre>

<p>The browser receives the HTML shell immediately (Time to First Byte), then the revenue chart and recent orders sections stream in as their data resolves — independently, whichever finishes first. This makes perceived performance dramatically better than a page that shows nothing until all data loads.</p>

<h2>Caching and Revalidation</h2>
<p>Next.js 14+ built a multi-layer cache on top of RSC. The four caching mechanisms you need to understand:</p>
<ul>
  <li><strong>Request memoization</strong>: identical <code>fetch()</code> calls within a single render pass are deduplicated automatically.</li>
  <li><strong>Data Cache</strong>: <code>fetch(url, { next: { revalidate: 3600 } })</code> caches the response for 1 hour, surviving across requests.</li>
  <li><strong>Full Route Cache</strong>: statically renderable routes are cached as HTML+RSC payload at build time.</li>
  <li><strong>Router Cache</strong>: client-side cache of RSC payloads for routes already visited, enabling instant back navigation.</li>
</ul>

<h2>Server Actions: Mutations Without API Routes</h2>
<p>Server Actions allow form submissions and mutations to call server-side functions directly, without creating an API endpoint:</p>
<pre><code>// app/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

export async function createProduct(formData: FormData) {
  const name = formData.get('name') as string;
  const price = Number(formData.get('price'));

  // Validation
  if (!name || price <= 0) throw new Error('Invalid product data');

  await db.insert(schema.products).values({ name, price });
  revalidatePath('/products'); // Purge the cache for this route
}

// In a Client Component:
'use client';
import { createProduct } from '../actions';

export function ProductForm() {
  return (
    <form action={createProduct}>
      <input name="name" placeholder="Product name" />
      <input name="price" type="number" />
      <button type="submit">Create</button>
    </form>
  );
}</code></pre>

<h2>When to Use Server vs. Client Components</h2>
<p>The default should be Server Components. Only reach for <code>'use client'</code> when you need interactivity. Specifically, use Client Components for: event handlers and DOM events, browser APIs, React state and lifecycle hooks, and third-party libraries that depend on the browser environment. Keep Client Components small and pushed to the leaves of your component tree — interactive islands in a sea of server-rendered content. This architecture maximizes the RSC payload compression advantage and minimizes Time to Interactive. For more on measuring these performance gains, see our guide on <a href="/blog/core-web-vitals-performance">Core Web Vitals and performance</a>.</p>`,
  },

  // POST 6
  {
    title: 'Database Indexing Strategies: From Slow Queries to Millisecond Responses',
    slug: 'database-indexing-strategies',
    date: '2024-09-10T10:00:00',
    category: 'Backend',
    tags: ['Database', 'PostgreSQL', 'Performance', 'SQL'],
    unsplashQuery: 'database server storage',
    internalLinks: ['building-resilient-microservices-go', 'error-handling-patterns', 'api-design-rest-graphql-trpc'],
    content: `<h2>Why Indexes Are the Most Impactful Database Optimization</h2>
<p>Database performance problems almost always come down to indexes — either missing ones, wrong ones, or poorly maintained ones. A query that takes 45 seconds on a table with 10 million rows can drop to 2 milliseconds with the right index. No hardware upgrade, no query caching layer, no read replica will deliver that kind of improvement. Understanding how indexes work internally is the most valuable skill a backend developer can invest in.</p>
<p>This guide uses PostgreSQL, but the principles apply to MySQL, SQLite, and most relational databases. MongoDB and other document stores use similar B-tree and hash index structures internally, and many of the same strategies apply.</p>

<h2>How B-Tree Indexes Work Internally</h2>
<p>The default PostgreSQL index type is B-tree (balanced tree). It stores index entries in sorted order, with each internal node containing pointers to child nodes and boundary key values. Leaf nodes contain the indexed values plus pointers (CTIDs in PostgreSQL) to the actual rows in the heap.</p>
<p>A B-tree lookup starts at the root, follows the appropriate child pointer based on comparison with boundary values, and descends until reaching a leaf — O(log n) operations regardless of table size. For a 10-million-row table with a B-tree index, a lookup traverses roughly 24 nodes (log₂ of 10M ≈ 23.3). Without an index, the database scans all 10 million rows.</p>
<p>The sorted nature of B-trees means they support: equality filters (<code>= value</code>), range filters (<code>BETWEEN</code>, <code>&gt;</code>, <code>&lt;</code>), prefix matching on strings (<code>LIKE 'prefix%'</code>), and <code>ORDER BY</code> without a separate sort step.</p>

<h2>Composite Indexes and Column Order</h2>
<p>A composite index on multiple columns is not simply two separate indexes. The column order fundamentally determines which queries the index can satisfy:</p>
<pre><code>-- Index on (status, created_at)
CREATE INDEX idx_orders_status_created ON orders(status, created_at);

-- This query USES the index efficiently (leading column matches)
SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at;

-- This query also uses it (both columns in prefix)
SELECT * FROM orders WHERE status = 'pending' AND created_at > NOW() - INTERVAL '7 days';

-- This query CANNOT use the index efficiently (status is not in WHERE)
SELECT * FROM orders WHERE created_at > NOW() - INTERVAL '7 days';
-- PostgreSQL might still use the index for an index scan, but less efficiently</code></pre>

<p>The rule is: equality columns first, range column last. If you filter on <code>status = 'active'</code> AND <code>created_at > X</code>, put <code>status</code> first. Columns used in equality filters narrow the B-tree traversal; the range filter on the final column is then applied along a contiguous range of the (now filtered) tree.</p>

<h2>The EXPLAIN ANALYZE Command</h2>
<p>You cannot optimize what you cannot measure. <code>EXPLAIN ANALYZE</code> executes a query and shows both the plan the planner chose and actual execution statistics:</p>
<pre><code>EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT u.email, COUNT(o.id) as order_count
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE u.country = 'US'
  AND o.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.email
ORDER BY order_count DESC
LIMIT 10;</code></pre>

<p>Key fields to examine in the output:</p>
<ul>
  <li><strong>Seq Scan</strong>: full table scan — almost always means a missing index</li>
  <li><strong>Index Scan</strong>: uses an index, but still fetches heap rows for additional columns</li>
  <li><strong>Index Only Scan</strong>: all needed columns are in the index — fastest possible</li>
  <li><strong>Rows Removed by Filter</strong>: high numbers mean the index is not selective enough</li>
  <li><strong>Buffers hit/read</strong>: cache hit ratio — "read" means disk I/O</li>
  <li><strong>actual time</strong>: real execution time vs. estimated — large discrepancies indicate stale statistics</li>
</ul>

<h2>Partial Indexes: Index Only What You Query</h2>
<p>Most production tables have a status column, and most queries filter on active or pending records — not the millions of archived, completed, or deleted ones. Partial indexes include a <code>WHERE</code> clause that limits which rows are indexed:</p>
<pre><code>-- Only index rows where status = 'pending' (perhaps 0.1% of the table)
CREATE INDEX idx_orders_pending_created
ON orders(created_at)
WHERE status = 'pending';

-- This query uses the partial index: tiny, fast
SELECT * FROM orders
WHERE status = 'pending' AND created_at < NOW() - INTERVAL '1 hour'
ORDER BY created_at;

-- Partial indexes for unique constraints on active records
CREATE UNIQUE INDEX idx_users_active_email
ON users(email)
WHERE deleted_at IS NULL;</code></pre>

<p>The unique partial index on active users allows email reuse for deleted accounts (soft deletes) while still enforcing uniqueness for active ones — a common requirement that is impossible with a standard unique index.</p>

<h2>Covering Indexes and Index-Only Scans</h2>
<p>An index-only scan occurs when every column needed to satisfy a query is present in the index — no heap fetch required. This is the fastest possible query execution. You can engineer covering indexes using <code>INCLUDE</code>:</p>
<pre><code>-- Query: get email and name for active users in a country
-- Without covering index: index scan + heap fetch for each row
CREATE INDEX idx_users_country ON users(country) WHERE active = true;

-- With covering index: index only scan, no heap access
CREATE INDEX idx_users_country_covering
ON users(country)
INCLUDE (email, name)
WHERE active = true;</code></pre>

<p><code>INCLUDE</code>d columns are stored in leaf nodes but not in internal nodes — they cannot be used for filtering or ordering, but they eliminate heap fetches for projection. Only include columns that are frequently needed alongside the filter columns.</p>

<h2>Expression Indexes</h2>
<p>If your queries filter on an expression rather than a raw column, create an index on that expression:</p>
<pre><code>-- Query that cannot use a plain email index:
SELECT * FROM users WHERE lower(email) = lower('User@Example.COM');

-- Expression index on lowercased email:
CREATE INDEX idx_users_email_lower ON users(lower(email));

-- Now this query uses the index:
SELECT * FROM users WHERE lower(email) = 'user@example.com';

-- JSON expression indexes:
CREATE INDEX idx_events_user_id ON events((payload->>'userId'));
SELECT * FROM events WHERE payload->>'userId' = '123';</code></pre>

<h2>Index Maintenance and Bloat</h2>
<p>Indexes are not free. Every INSERT, UPDATE, and DELETE must also update all relevant indexes. Tables with many indexes have slower write throughput — a table with 10 indexes might take 3x longer to INSERT into than the same table with 2 indexes. Audit your indexes regularly:</p>
<pre><code>-- Find unused indexes (pg_stat_user_indexes)
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelid NOT IN (SELECT conindid FROM pg_constraint)  -- exclude constraint indexes
ORDER BY pg_relation_size(indexrelid) DESC;</code></pre>

<p>Run <code>ANALYZE tablename</code> after large bulk imports to update the query planner's statistics. Run <code>REINDEX</code> on indexes that have accumulated significant bloat from updates. For high-write tables, use <code>REINDEX CONCURRENTLY</code> to avoid locking the table.</p>

<h2>When Indexes Hurt: Common Anti-Patterns</h2>
<p>Over-indexing is a real problem. Common anti-patterns:</p>
<ul>
  <li><strong>Indexing low-cardinality columns alone</strong>: a boolean <code>active</code> column with 90% true values — the planner will choose a seq scan anyway for queries on <code>active = true</code>.</li>
  <li><strong>Indexes on small tables</strong>: for tables under ~1000 rows, sequential scans are often faster than index scans due to overhead.</li>
  <li><strong>Redundant indexes</strong>: a composite index on <code>(a, b)</code> makes a single-column index on <code>(a)</code> redundant — the composite index satisfies all queries that the single-column index would.</li>
  <li><strong>Indexing columns that are always transformed</strong>: indexing <code>email</code> but querying <code>lower(email)</code> means the index is never used. Create the expression index instead.</li>
</ul>`,
  },

  // POST 7
  {
    title: 'Docker in Production: Images, Networking, and Orchestration Patterns',
    slug: 'docker-containers-production',
    date: '2024-10-07T09:00:00',
    category: 'DevOps',
    tags: ['Docker', 'Containers', 'DevOps', 'Production'],
    unsplashQuery: 'shipping containers logistics',
    internalLinks: ['kubernetes-production-guide', 'building-resilient-microservices-go', 'git-workflows-team'],
    content: `<h2>Docker Is Not Just for Development</h2>
<p>Many teams treat Docker as a "works on my machine" solution — a way to standardize development environments. That is valuable, but it barely scratches the surface. Docker in production is about immutable infrastructure, reproducible builds, fast deployments, and horizontal scaling. Getting it right requires understanding the internals: image layers, build caching, multi-stage builds, networking modes, security hardening, and the runtime lifecycle.</p>
<p>This guide covers production Docker patterns — the decisions that affect performance, security, and operational reliability at scale.</p>

<h2>Writing Optimal Dockerfiles</h2>
<p>The most important principles for production Dockerfiles are: minimize image size, maximize layer cache utilization, and minimize the attack surface.</p>
<pre><code># Multi-stage build for a Node.js application
# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
# Copy only package files first — changes to source don't invalidate this cache layer
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Production image
FROM node:20-alpine AS runner
WORKDIR /app

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

# Copy only what's needed
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node_modules/.bin/next", "start"]</code></pre>

<p>Key decisions in this Dockerfile:</p>
<ul>
  <li><strong>Alpine base</strong>: 5 MB vs 900 MB for the full Node.js image. Smaller images transfer faster, have fewer CVEs, and improve cold start times.</li>
  <li><strong>Dependency caching</strong>: copying <code>package.json</code> before source files means <code>npm ci</code> only reruns when dependencies change, not on every source edit.</li>
  <li><strong>Multi-stage build</strong>: dev dependencies and build tooling never enter the production image.</li>
  <li><strong>Non-root user</strong>: a compromised process running as root can escape to the host. As an unprivileged user, it cannot.</li>
</ul>

<h2>Layer Cache Strategy</h2>
<p>Docker's build cache is one of its most powerful features but is frequently underutilized. Layers are cached by content hash — if any file in the <code>COPY</code> instruction changes, that layer and all subsequent layers are invalidated.</p>
<pre><code># BAD: copies all source before installing deps
# Any source change invalidates the npm install layer
COPY . .
RUN npm ci

# GOOD: install deps first (cached until package.json changes)
COPY package.json package-lock.json ./
RUN npm ci
COPY . .  # only this and later layers invalidated on source changes</code></pre>

<p>In CI/CD pipelines, use BuildKit's registry cache to persist layers across builds on different runners:</p>
<pre><code>docker buildx build \
  --cache-from type=registry,ref=registry.example.com/myapp:cache \
  --cache-to type=registry,ref=registry.example.com/myapp:cache,mode=max \
  --tag registry.example.com/myapp:\${GIT_SHA} \
  .</code></pre>

<h2>Docker Networking in Production</h2>
<p>Docker's networking model has four main modes: bridge (default), host, overlay (Swarm/Kubernetes), and none. In production, almost all services communicate over a custom bridge network (or an overlay network in multi-host setups):</p>
<pre><code># docker-compose.yml
version: '3.9'
services:
  api:
    build: .
    networks:
      - internal
      - external
    ports:
      - "3000:3000"  # only exposed on external network

  db:
    image: postgres:16-alpine
    networks:
      - internal   # NOT on external network — only accessible to api
    volumes:
      - pg-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    networks:
      - internal
    command: redis-server --requirepass \${REDIS_PASSWORD}

networks:
  internal:
    driver: bridge
    internal: true   # no outbound internet access from this network
  external:
    driver: bridge

volumes:
  pg-data:</code></pre>

<p>Network segmentation means your database is never directly accessible from outside the Docker network, even if your host firewall is misconfigured. This is defense in depth at the container networking layer.</p>

<h2>Health Checks</h2>
<p>Docker's built-in health check runs a command inside the container and marks it healthy, unhealthy, or starting. Orchestrators like Kubernetes use this to route traffic and restart failed containers:</p>
<pre><code>HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1</code></pre>

<p>In docker-compose, you can define dependencies that wait for health:</p>
<pre><code>api:
  depends_on:
    db:
      condition: service_healthy

db:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 10s
    timeout: 5s
    retries: 5</code></pre>

<h2>Secrets Management</h2>
<p>Never bake secrets into Docker images. Even if you delete an environment variable in a later layer, it is still visible in the earlier layer's history. Use Docker secrets (in Swarm), Kubernetes secrets, or a secrets manager like HashiCorp Vault:</p>
<pre><code># Using Docker BuildKit secret mounting (never persisted in image layers)
# syntax=docker/dockerfile:1
FROM python:3.12-slim
RUN --mount=type=secret,id=pip_conf,target=/root/.pip/pip.conf \
    pip install --no-cache-dir -r requirements.txt

# Build with:
docker buildx build --secret id=pip_conf,src=./pip.conf .</code></pre>

<h2>Image Scanning and Vulnerability Management</h2>
<p>Integrate image scanning into your CI pipeline. Tools like Trivy, Snyk, or Docker Scout scan images for known CVEs in OS packages and language dependencies:</p>
<pre><code># In GitHub Actions
- name: Scan image for vulnerabilities
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'registry.example.com/myapp:\${{ github.sha }}'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'  # Fail the build on critical/high CVEs</code></pre>

<h2>Production Logging and Monitoring</h2>
<p>Configure Docker's log driver to forward to your centralized logging system. The default <code>json-file</code> driver logs to disk and is prone to filling disks on high-volume services:</p>
<pre><code># Use the fluentd driver for centralized logging
logging:
  driver: "fluentd"
  options:
    fluentd-address: "localhost:24224"
    tag: "docker.{{.Name}}"
    fluentd-async: "true"</code></pre>

<p>Alternatively, configure log rotation on the json-file driver as a minimum safety measure:</p>
<pre><code>logging:
  driver: "json-file"
  options:
    max-size: "100m"
    max-file: "5"</code></pre>

<p>Docker is the foundation for the Kubernetes workloads covered in our <a href="/blog/kubernetes-production-guide">Kubernetes production guide</a>. Understanding Docker deeply makes Kubernetes debugging and optimization much more intuitive — when a pod fails, you need to know whether the issue is in the container image, the runtime, or the orchestration layer.</p>`,
  },

  // POST 8
  {
    title: 'TypeScript Generics: From Basic Constraints to Advanced Inference Patterns',
    slug: 'typescript-generics-advanced',
    date: '2024-11-05T09:00:00',
    category: 'Frontend',
    tags: ['TypeScript', 'JavaScript', 'Type System', 'Generics'],
    unsplashQuery: 'code programming typescript',
    internalLinks: ['react-server-components-what-changes', 'api-design-rest-graphql-trpc', 'error-handling-patterns'],
    content: `<h2>Why Generics Are the Core of TypeScript Mastery</h2>
<p>TypeScript's type system is Turing-complete — any computation that can be expressed in logic can theoretically be expressed in its type system. Generics are the mechanism that makes the type system composable: they let you write code that operates on many types while preserving type safety that would otherwise require repetitive overloads or unsafe <code>any</code> casts.</p>
<p>Most TypeScript developers use generics to type collections (<code>Array&lt;T&gt;</code>, <code>Promise&lt;T&gt;</code>) and stop there. This guide goes much further: conditional types, infer, mapped types, template literal types, and the patterns that separate readable, maintainable type code from inscrutably clever type gymnastics.</p>

<h2>Generic Constraints: Requiring Specific Shapes</h2>
<p>Generic constraints narrow the set of types a type parameter can accept. The <code>extends</code> keyword specifies a minimum shape requirement:</p>
<pre><code>// Without constraint: T could be anything — no property access allowed
function getValue&lt;T&gt;(obj: T, key: string): unknown {
  return (obj as any)[key]; // forced to use any
}

// With constraint: T must have string-keyed properties
function getProperty&lt;T, K extends keyof T&gt;(obj: T, key: K): T[K] {
  return obj[key]; // fully type-safe
}

const user = { name: 'Alice', age: 30 };
const name = getProperty(user, 'name'); // type: string
const age = getProperty(user, 'age');   // type: number
// getProperty(user, 'email');          // Error: 'email' not in keyof typeof user</code></pre>

<p>The double generic <code>&lt;T, K extends keyof T&gt;</code> links the key type to the object type, making <code>T[K]</code> (indexed access type) the precise return type. This pattern is the basis for type-safe ORM query builders, event emitters, and form libraries.</p>

<h2>Conditional Types: Type-Level if/else</h2>
<p>Conditional types have the form <code>T extends U ? X : Y</code>. They evaluate at the type level, not at runtime:</p>
<pre><code>// Unwrap a Promise type
type Awaited&lt;T&gt; = T extends Promise&lt;infer U&gt; ? Awaited&lt;U&gt; : T;

type A = Awaited&lt;Promise&lt;string&gt;&gt;;        // string
type B = Awaited&lt;Promise&lt;Promise&lt;number&gt;&gt;&gt;; // number
type C = Awaited&lt;number&gt;;                  // number

// Extract only function types from a union
type FunctionTypes&lt;T&gt; = T extends (...args: any[]) => any ? T : never;

type Fns = FunctionTypes&lt;string | (() => void) | number | (() => string)&gt;;
// () => void | () => string</code></pre>

<h2>The infer Keyword: Type Extraction</h2>
<p><code>infer</code> introduces a type variable within a conditional type's extends clause, allowing you to extract parts of a type:</p>
<pre><code>// Extract the return type of a function
type ReturnType&lt;T extends (...args: any[]) => any&gt; =
  T extends (...args: any[]) => infer R ? R : never;

// Extract the first argument type
type FirstArg&lt;T extends (...args: any[]) => any&gt; =
  T extends (first: infer F, ...rest: any[]) => any ? F : never;

// Extract the element type of an array
type ElementType&lt;T&gt; = T extends (infer E)[] ? E : never;

// Extract the type of a Promise's resolved value
type UnwrapPromise&lt;T&gt; = T extends Promise&lt;infer U&gt; ? U : T;

// Practical usage: typed event handler factory
function createHandler&lt;T extends (...args: any[]) => any&gt;(
  fn: T,
  onError: (e: Error) => ReturnType&lt;T&gt;
): T {
  return ((...args: Parameters&lt;T&gt;) => {
    try { return fn(...args); }
    catch (e) { return onError(e as Error); }
  }) as T;
}</code></pre>

<h2>Mapped Types: Transforming Object Types</h2>
<p>Mapped types iterate over the keys of a type and transform each property. They are the basis for TypeScript's built-in utilities like <code>Partial</code>, <code>Required</code>, <code>Readonly</code>, and <code>Pick</code>:</p>
<pre><code>// Implement Partial from scratch
type MyPartial&lt;T&gt; = {
  [K in keyof T]?: T[K];
};

// Make nested properties optional (DeepPartial)
type DeepPartial&lt;T&gt; = {
  [K in keyof T]?: T[K] extends object ? DeepPartial&lt;T[K]&gt; : T[K];
};

// Rename all keys with a prefix
type Prefixed&lt;T, P extends string&gt; = {
  [K in keyof T as \`\${P}\${Capitalize&lt;string & K&gt;}\`]: T[K];
};

type User = { name: string; email: string; age: number };
type PrefixedUser = Prefixed&lt;User, 'user'&gt;;
// { userName: string; userEmail: string; userAge: number }

// Filter properties by type
type PickByValue&lt;T, V&gt; = {
  [K in keyof T as T[K] extends V ? K : never]: T[K];
};

type StringProps = PickByValue&lt;User, string&gt;;
// { name: string; email: string }</code></pre>

<h2>Template Literal Types</h2>
<p>Template literal types compose string literals at the type level — particularly useful for typed event systems, CSS property names, and API endpoint construction:</p>
<pre><code>type EventName = 'click' | 'focus' | 'blur';
type EventHandler = \`on\${Capitalize&lt;EventName&gt;}\`;
// 'onClick' | 'onFocus' | 'onBlur'

// Typed CSS custom properties
type CSSVar&lt;T extends string&gt; = \`--\${T}\`;
type ThemeVar = CSSVar&lt;'primary' | 'secondary' | 'background'&gt;;
// '--primary' | '--secondary' | '--background'

// Type-safe REST API paths
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
type ApiRoute = \`\${Lowercase&lt;HttpMethod&gt;} /api/\${string}\`;

// Deeply nested object path accessors
type Paths&lt;T, Prefix extends string = ''&gt; = {
  [K in keyof T & string]: T[K] extends object
    ? Paths&lt;T[K], \`\${Prefix}\${K}.\`&gt; | \`\${Prefix}\${K}\`
    : \`\${Prefix}\${K}\`;
}[keyof T & string];

type UserPaths = Paths&lt;{ user: { name: string; address: { city: string } } }&gt;;
// 'user' | 'user.name' | 'user.address' | 'user.address.city'</code></pre>

<h2>Variance and Practical Generic Patterns</h2>
<p>Understanding covariance and contravariance prevents subtle type errors in generic code:</p>
<pre><code>// Covariant: safe to read, not write (producer)
// A Container&lt;Dog&gt; IS a Container&lt;Animal&gt; if Container only reads
interface ReadOnly&lt;out T&gt; {
  readonly value: T;
}

// Contravariant: safe to write, not read (consumer)
// A Handler&lt;Animal&gt; IS a Handler&lt;Dog&gt; if Handler only writes
interface WriteOnly&lt;in T&gt; {
  write(value: T): void;
}

// Practical pattern: builder with accumulated type
class QueryBuilder&lt;TResult = never&gt; {
  private conditions: string[] = [];

  where(condition: string): QueryBuilder&lt;TResult&gt; {
    this.conditions.push(condition);
    return this;
  }

  select&lt;T&gt;(): QueryBuilder&lt;T&gt; {
    return this as any;
  }

  async execute(): Promise&lt;TResult[]&gt; {
    // ... implementation
    return [] as TResult[];
  }
}

// Usage with type accumulation:
const results = await new QueryBuilder()
  .select&lt;{ id: string; name: string }&gt;()
  .where('active = true')
  .execute();
// results: { id: string; name: string }[]</code></pre>

<h2>Real-World Generic Patterns</h2>
<p>Here are three patterns that appear repeatedly in well-typed codebases:</p>
<pre><code>// 1. Type-safe event emitter
type EventMap = { [event: string]: any[] };

class TypedEventEmitter&lt;Events extends EventMap&gt; {
  private listeners = new Map&lt;string, Function[]&gt;();

  on&lt;E extends keyof Events&gt;(
    event: E,
    listener: (...args: Events[E]) => void
  ): this {
    const list = this.listeners.get(event as string) ?? [];
    list.push(listener);
    this.listeners.set(event as string, list);
    return this;
  }

  emit&lt;E extends keyof Events&gt;(event: E, ...args: Events[E]): void {
    this.listeners.get(event as string)?.forEach(l => l(...args));
  }
}

type AppEvents = {
  userCreated: [{ id: string; email: string }];
  orderPlaced: [orderId: string, amount: number];
};

const emitter = new TypedEventEmitter&lt;AppEvents&gt;();
emitter.on('userCreated', (user) => console.log(user.email)); // typed!
emitter.emit('orderPlaced', 'ord-123', 49.99); // enforced arity!

// 2. Result type for error handling (avoids throw)
type Result&lt;T, E = Error&gt; =
  | { ok: true; value: T }
  | { ok: false; error: E };

async function fetchUser(id: string): Promise&lt;Result&lt;User&gt;&gt; {
  try {
    const user = await db.users.findById(id);
    if (!user) return { ok: false, error: new Error('Not found') };
    return { ok: true, value: user };
  } catch (e) {
    return { ok: false, error: e as Error };
  }
}</code></pre>

<p>These patterns connect naturally with the API design approaches discussed in our guide on <a href="/blog/api-design-rest-graphql-trpc">REST, GraphQL, and tRPC API design</a>, where TypeScript generics underpin end-to-end type safety in tRPC.</p>`,
  },

  // POST 9
  {
    title: 'Cloudflare Workers and Edge Computing: Building Globally Distributed Applications',
    slug: 'cloudflare-workers-edge-computing',
    date: '2024-12-03T10:00:00',
    category: 'Web Development',
    tags: ['Cloudflare', 'Edge Computing', 'Workers', 'Performance'],
    unsplashQuery: 'cloud computing network globe',
    internalLinks: ['understanding-webassembly-practical-guide', 'api-design-rest-graphql-trpc', 'core-web-vitals-performance'],
    content: `<h2>What Edge Computing Actually Means</h2>
<p>Edge computing places computation physically close to users rather than centralizing it in one or a few data centers. When a user in Tokyo requests data, traditional cloud architecture might route that request to a server in Virginia — adding 150+ ms of network latency before a single byte of application code executes. Edge computing runs your code in a Tokyo data center (or one of 300+ global locations, in Cloudflare's case), reducing that network hop to 5–10 ms.</p>
<p>Cloudflare Workers is the leading edge compute platform. Unlike serverless functions on AWS Lambda or Google Cloud Functions — which are simply single-region VMs that scale to zero — Workers run in Cloudflare's globally distributed network of 300+ points of presence, using V8 isolates instead of containers for near-instant cold starts (under 1 ms vs. 100–500 ms for Lambda).</p>

<h2>V8 Isolates vs. Containers</h2>
<p>The architectural difference between Workers and traditional serverless is fundamental. Lambda functions run in containers — isolated Linux processes with their own kernel space, filesystem, and startup overhead. Starting a container takes 100–500 ms (the dreaded "cold start").</p>
<p>Workers use V8 isolates: lightweight sandboxes within the same V8 engine process. Creating an isolate takes under 1 ms because it shares the already-running V8 engine's JIT-compiled code and memory management. This means cold starts are imperceptible to users, enabling Workers to handle the "long tail" of infrequent requests that would be expensive on container-based platforms.</p>
<p>The trade-off: Workers run in a restricted environment. No arbitrary filesystem access, no spawning processes, limited CPU time per request (50 ms CPU time on the free tier, unlimited wall clock time on paid), and no Node.js APIs — though Cloudflare has been progressively adding Node.js compatibility.</p>

<h2>Your First Worker</h2>
<pre><code>// Install Wrangler (Cloudflare's CLI)
npm install -g wrangler
wrangler login

// Create a new Worker project
wrangler init my-worker --type=javascript
cd my-worker</code></pre>

<pre><code>// src/index.ts
export interface Env {
  // Bindings defined in wrangler.toml
  MY_KV: KVNamespace;
  MY_DB: D1Database;
  API_KEY: string;  // Secret
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Route based on URL path
    if (url.pathname === '/api/users' && request.method === 'GET') {
      return handleGetUsers(env);
    }

    if (url.pathname === '/api/users' && request.method === 'POST') {
      return handleCreateUser(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler&lt;Env&gt;;

async function handleGetUsers(env: Env): Promise&lt;Response&gt; {
  // D1 is Cloudflare's SQLite at the edge
  const { results } = await env.MY_DB.prepare(
    'SELECT id, name, email FROM users ORDER BY created_at DESC LIMIT 20'
  ).all();

  return Response.json(results, {
    headers: { 'Cache-Control': 'public, max-age=60' },
  });
}</code></pre>

<h2>KV Storage: Globally Distributed Key-Value</h2>
<p>Workers KV is a globally replicated key-value store. Writes propagate to all locations within ~60 seconds, reads are served from the nearest edge node with extremely low latency. It is optimized for read-heavy workloads:</p>
<pre><code>// Writing to KV
await env.MY_KV.put('user:123', JSON.stringify(user), {
  expirationTtl: 3600,  // expire in 1 hour
  metadata: { version: 2 },
});

// Reading from KV
const value = await env.MY_KV.get('user:123', { type: 'json' });
const { value: data, metadata } = await env.MY_KV.getWithMetadata('user:123');

// Listing keys with prefix
const list = await env.MY_KV.list({ prefix: 'user:', limit: 100 });
for (const key of list.keys) {
  console.log(key.name, key.metadata);
}</code></pre>

<p>KV is eventually consistent — a write in one region takes up to 60 seconds to propagate. For user sessions, feature flags, and rate-limit counters where occasional stale reads are acceptable, this trade-off is fine. For strongly consistent data, use Durable Objects.</p>

<h2>Durable Objects: Strongly Consistent State at the Edge</h2>
<p>Durable Objects solve the consistency problem by ensuring each object runs on a single node globally. All requests for a given object ID are routed to the same instance, enabling sequential processing without distributed locks:</p>
<pre><code>// Durable Object class
export class RateLimiter implements DurableObject {
  private state: DurableObjectState;
  private requests: number = 0;
  private windowStart: number = Date.now();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    // Restore persisted state on cold start
    this.state.blockConcurrencyWhile(async () => {
      this.requests = (await this.state.storage.get('requests')) ?? 0;
      this.windowStart = (await this.state.storage.get('windowStart')) ?? Date.now();
    });
  }

  async fetch(request: Request): Promise&lt;Response&gt; {
    const now = Date.now();
    const windowMs = 60_000; // 1 minute
    const limit = 100;

    // Reset window if expired
    if (now - this.windowStart > windowMs) {
      this.requests = 0;
      this.windowStart = now;
    }

    if (this.requests >= limit) {
      return new Response('Rate limit exceeded', {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((this.windowStart + windowMs - now) / 1000)) },
      });
    }

    this.requests++;
    await this.state.storage.put('requests', this.requests);
    await this.state.storage.put('windowStart', this.windowStart);

    return new Response('OK');
  }
}

// Using the Durable Object from a Worker
const id = env.RATE_LIMITER.idFromName(clientIP);
const stub = env.RATE_LIMITER.get(id);
const response = await stub.fetch(request);</code></pre>

<h2>D1: SQLite at the Edge</h2>
<p>Cloudflare D1 is a serverless SQLite database that runs at the edge. Unlike traditional databases that run in a fixed region, D1 replicates read access to edge locations near your users:</p>
<pre><code>// Migrations with Wrangler
// wrangler d1 execute MY_DB --file=./migrations/001_init.sql

// In your Worker:
const stmt = env.MY_DB.prepare(
  'INSERT INTO posts (id, title, content, author_id) VALUES (?, ?, ?, ?)'
);

// Batch multiple operations
await env.MY_DB.batch([
  env.MY_DB.prepare('UPDATE users SET post_count = post_count + 1 WHERE id = ?').bind(authorId),
  stmt.bind(postId, title, content, authorId),
]);

// Prepared statements with .all(), .first(), .run()
const { results: posts } = await env.MY_DB
  .prepare('SELECT * FROM posts WHERE author_id = ? ORDER BY created_at DESC')
  .bind(authorId)
  .all&lt;Post&gt;();</code></pre>

<h2>Caching Strategies with the Cache API</h2>
<p>Workers can interact with Cloudflare's CDN cache directly, enabling sophisticated caching strategies that would require complex Nginx or Varnish configurations otherwise:</p>
<pre><code>export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const cache = caches.default;
    const cacheKey = new Request(request.url, request);

    // Check cache first
    let response = await cache.match(cacheKey);
    if (response) return response;

    // Fetch from origin
    response = await fetch(request);

    // Cache successful responses asynchronously (don't block the response)
    if (response.status === 200) {
      const responseToCache = new Response(response.body, response);
      responseToCache.headers.set('Cache-Control', 'public, max-age=3600');

      ctx.waitUntil(cache.put(cacheKey, responseToCache));
    }

    return response;
  },
};</code></pre>

<h2>Workers for AI Inference</h2>
<p>Cloudflare Workers AI runs inference on GPU hardware distributed across Cloudflare's network. For embedding generation, text classification, and small LLM calls, this eliminates the need to manage GPU infrastructure:</p>
<pre><code>const embedding = await env.AI.run('@cf/baai/bge-small-en-v1.5', {
  text: ['What is edge computing?', 'How do Cloudflare Workers work?'],
});

const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
  messages: [{ role: 'user', content: 'Summarize this article: ' + articleText }],
  max_tokens: 200,
});</code></pre>

<p>Workers pairs naturally with WebAssembly (covered in our <a href="/blog/understanding-webassembly-practical-guide">WebAssembly guide</a>) — you can run compiled Wasm modules in Workers for computationally intensive edge processing that exceeds what pure JavaScript can do within the CPU time limits. The combination of edge distribution and Core Web Vitals improvements is explored in our <a href="/blog/core-web-vitals-performance">Core Web Vitals guide</a>.</p>`,
  },

  // POST 10
  {
    title: 'Testing Strategies for Modern Web Applications: Unit, Integration, and E2E',
    slug: 'testing-strategies-web-applications',
    date: '2025-01-14T09:00:00',
    category: 'Web Development',
    tags: ['Testing', 'Vitest', 'Playwright', 'TDD', 'Quality'],
    unsplashQuery: 'quality assurance checklist',
    internalLinks: ['typescript-generics-advanced', 'react-server-components-what-changes', 'error-handling-patterns'],
    content: `<h2>The Testing Trophy, Not the Testing Pyramid</h2>
<p>The traditional testing pyramid — many unit tests, some integration tests, few E2E tests — was designed for an era of thick desktop applications with complex business logic that lived in pure functions. Modern web applications are largely about connecting things: databases, APIs, UIs, third-party services. For these, integration tests provide far more confidence per dollar spent than unit tests of individual functions in isolation.</p>
<p>Kent C. Dodds' "Testing Trophy" reframes the hierarchy: a small base of static type checking and linting, a modest set of unit tests for complex logic, a large middle of integration tests, and a targeted set of E2E tests for critical user journeys. This guide implements this philosophy with the modern tooling that makes each layer fast and maintainable.</p>

<h2>Unit Testing with Vitest</h2>
<p>Vitest is Jest-compatible but runs in Vite's native ESM environment, making it dramatically faster for modern TypeScript codebases. Configuration is often zero:</p>
<pre><code>// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: { statements: 80, branches: 75, functions: 80, lines: 80 },
    },
    globals: true,
  },
});</code></pre>

<p>Write unit tests for pure business logic: transformations, validations, calculations. Avoid testing framework boilerplate:</p>
<pre><code>// utils/pricing.test.ts
import { describe, it, expect } from 'vitest';
import { calculateDiscount, applyTax } from './pricing';

describe('calculateDiscount', () => {
  it('applies percentage discount correctly', () => {
    expect(calculateDiscount(100, { type: 'percentage', value: 20 })).toBe(80);
  });

  it('applies fixed discount correctly', () => {
    expect(calculateDiscount(100, { type: 'fixed', value: 15 })).toBe(85);
  });

  it('does not apply discount below minimum order value', () => {
    expect(calculateDiscount(10, { type: 'percentage', value: 20, minOrder: 50 })).toBe(10);
  });

  it('throws for negative prices', () => {
    expect(() => calculateDiscount(-1, { type: 'fixed', value: 5 })).toThrow('Price must be positive');
  });
});

describe('applyTax', () => {
  it.each([
    ['US', 100, 108],
    ['EU', 100, 120],
    ['CA', 100, 115],
  ])('applies correct tax rate for %s', (country, price, expected) => {
    expect(applyTax(price, country)).toBe(expected);
  });
});</code></pre>

<h2>Mocking and Spying</h2>
<p>Vitest's mocking API is identical to Jest's, with some improvements for ESM modules:</p>
<pre><code>import { vi, describe, it, expect, beforeEach } from 'vitest';
import { sendWelcomeEmail } from './email';
import { createUser } from './user-service';

// Auto-mock an entire module
vi.mock('./email', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue({ messageId: 'mock-id' }),
}));

describe('createUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends welcome email after creating user', async () => {
    await createUser({ email: 'alice@example.com', name: 'Alice' });

    expect(sendWelcomeEmail).toHaveBeenCalledOnce();
    expect(sendWelcomeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@example.com' })
    );
  });
});</code></pre>

<h2>Integration Tests with a Real Database</h2>
<p>The most valuable tests for backend services test the full stack: HTTP request → handler → service → database → response. Use a real test database (not mocks) with transactions rolled back after each test:</p>
<pre><code>// tests/integration/orders.test.ts
import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import { createApp } from '../../src/app';
import { db } from '../../src/db';
import supertest from 'supertest';

let app: ReturnType&lt;typeof createApp&gt;;
let agent: ReturnType&lt;typeof supertest&gt;;

beforeAll(async () => {
  app = createApp();
  agent = supertest(app);
  await db.migrate.latest();
});

afterAll(async () => {
  await db.destroy();
});

beforeEach(async () => {
  // Roll back any changes from the previous test
  await db.raw('BEGIN');
});

afterEach(async () => {
  await db.raw('ROLLBACK');
});

describe('POST /api/orders', () => {
  it('creates an order and returns 201', async () => {
    // Seed necessary data within the transaction
    const user = await db('users').insert({ email: 'test@example.com' }).returning('*').first();

    const response = await agent
      .post('/api/orders')
      .set('Authorization', \`Bearer \${generateTestToken(user.id)}\`)
      .send({
        items: [{ productId: 'prod-1', quantity: 2 }],
        shippingAddress: { street: '123 Main St', city: 'Portland', country: 'US', postalCode: '97201' },
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(String),
      status: 'pending',
      total: expect.any(Number),
    });

    // Verify database state
    const order = await db('orders').where({ id: response.body.id }).first();
    expect(order).toBeDefined();
    expect(order.user_id).toBe(user.id);
  });
});</code></pre>

<h2>Testing React Components with Testing Library</h2>
<p>React Testing Library encourages testing from the user's perspective — what the user sees and does, not implementation details:</p>
<pre><code>// components/LoginForm.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('submits credentials and calls onSuccess', async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();

    render(&lt;LoginForm onSuccess={onSuccess} /&gt;);

    // Interact as a user would
    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'alice@example.com' })
      );
    });
  });

  it('shows validation error for invalid email', async () => {
    const user = userEvent.setup();
    render(&lt;LoginForm onSuccess={vi.fn()} /&gt;);

    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i);
  });
});</code></pre>

<h2>End-to-End Testing with Playwright</h2>
<p>Playwright is the gold standard for E2E testing: it supports Chromium, Firefox, and WebKit; has auto-waiting built in; and generates video recordings and traces for failed tests:</p>
<pre><code>// e2e/checkout.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Checkout flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login via API (faster than UI login for test setup)
    const response = await page.request.post('/api/auth/login', {
      data: { email: 'test@example.com', password: 'testpassword' },
    });
    const { token } = await response.json();
    await page.context().addCookies([{
      name: 'auth-token', value: token, domain: 'localhost', path: '/',
    }]);
  });

  test('completes purchase with valid card', async ({ page }) => {
    await page.goto('/products/widget-pro');
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await page.getByRole('link', { name: 'Checkout' }).click();

    // Fill shipping
    await page.getByLabel('Street address').fill('123 Main St');
    await page.getByLabel('City').fill('Portland');
    await page.getByLabel('ZIP code').fill('97201');

    // Fill payment (Stripe test card)
    const stripeFrame = page.frameLocator('iframe[name*="stripe"]');
    await stripeFrame.getByLabel('Card number').fill('4242 4242 4242 4242');
    await stripeFrame.getByLabel('Expiry').fill('12/28');
    await stripeFrame.getByLabel('CVC').fill('123');

    await page.getByRole('button', { name: 'Place Order' }).click();

    await expect(page.getByRole('heading', { name: /order confirmed/i })).toBeVisible();
    await expect(page.getByText(/confirmation email/i)).toBeVisible();
  });
});</code></pre>

<h2>Visual Regression Testing</h2>
<p>Playwright supports screenshot comparison to catch unintended visual changes:</p>
<pre><code>test('design system components match snapshots', async ({ page }) => {
  await page.goto('/storybook/components/button');
  await expect(page).toHaveScreenshot('button-variants.png', {
    threshold: 0.01,  // allow 1% pixel difference (anti-aliasing)
    animations: 'disabled',
  });
});</code></pre>

<h2>CI/CD Integration</h2>
<p>Run tests in parallel across multiple workers in GitHub Actions:</p>
<pre><code># .github/workflows/test.yml
- name: Run tests
  run: |
    npm run test:unit -- --reporter=junit --outputFile=junit-unit.xml
    npm run test:integration
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

- name: Run Playwright E2E (sharded)
  run: npx playwright test --shard=\${{ matrix.shard }}/\${{ strategy.job-total }}
  strategy:
    matrix:
      shard: [1, 2, 3, 4]</code></pre>

<p>Test coverage and error handling are deeply intertwined — uncaught errors that aren't tested lead to silent production failures. See our post on <a href="/blog/error-handling-patterns">error handling patterns</a> for the complementary approach to making your application resilient.</p>`,
  },

  // POST 11
  {
    title: 'Design Systems at Scale: Building a Component Library That Lasts',
    slug: 'design-systems-at-scale',
    date: '2025-02-04T09:00:00',
    category: 'Frontend',
    tags: ['Design Systems', 'CSS', 'Component Library', 'Storybook'],
    unsplashQuery: 'design system ui components',
    internalLinks: ['advanced-css-grid-layouts', 'ui-animations-motion-design', 'monorepo-turborepo-guide'],
    content: `<h2>What Makes a Design System Different from a Component Library</h2>
<p>A component library is a collection of reusable UI code. A design system is a shared language — tokens, principles, patterns, and components — that enables a product team to build consistently at speed. The distinction matters: you can have a component library without a design system (misaligned visual language, inconsistent UX patterns), but not a design system without a component library.</p>
<p>Successful design systems like Material Design (Google), Polaris (Shopify), and Carbon (IBM) share three properties: they encode design decisions as data (tokens, not hardcoded values), they are version-controlled and distributed like software, and they are owned by a dedicated team with a clear governance model. This guide covers the technical implementation of a design system that exhibits all three properties.</p>

<h2>Design Tokens: The Foundation</h2>
<p>Design tokens are named values that represent design decisions: colors, spacing, typography, border radii, shadows, and animation durations. By centralizing these values and distributing them as data (rather than code), you can update the visual language of your entire product by changing a single source of truth:</p>
<pre><code>// tokens/tokens.json (W3C Design Token Format)
{
  "color": {
    "brand": {
      "primary": { "$value": "#6366f1", "$type": "color" },
      "primary-hover": { "$value": "#4f46e5", "$type": "color" },
      "secondary": { "$value": "#8b5cf6", "$type": "color" }
    },
    "neutral": {
      "0": { "$value": "#ffffff", "$type": "color" },
      "100": { "$value": "#f4f4f5", "$type": "color" },
      "200": { "$value": "#e4e4e7", "$type": "color" },
      "900": { "$value": "#09090b", "$type": "color" }
    },
    "semantic": {
      "surface": { "$value": "{color.neutral.0}", "$type": "color" },
      "text-primary": { "$value": "{color.neutral.900}", "$type": "color" },
      "border": { "$value": "{color.neutral.200}", "$type": "color" }
    }
  },
  "spacing": {
    "1": { "$value": "4px", "$type": "dimension" },
    "2": { "$value": "8px", "$type": "dimension" },
    "4": { "$value": "16px", "$type": "dimension" },
    "6": { "$value": "24px", "$type": "dimension" },
    "8": { "$value": "32px", "$type": "dimension" }
  },
  "typography": {
    "font-family-base": { "$value": "'Inter', -apple-system, sans-serif", "$type": "fontFamily" },
    "font-size-sm": { "$value": "14px", "$type": "dimension" },
    "font-size-base": { "$value": "16px", "$type": "dimension" },
    "font-size-lg": { "$value": "18px", "$type": "dimension" },
    "line-height-base": { "$value": "1.5", "$type": "number" }
  }
}</code></pre>

<p>Use Style Dictionary or Token Transformer to compile these tokens into platform-specific outputs: CSS custom properties, Sass variables, iOS Swift constants, Android resources, and Figma variables:</p>
<pre><code>// style-dictionary.config.js
module.exports = {
  source: ['tokens/**/*.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      prefix: 'ds',
      buildPath: 'dist/tokens/',
      files: [{ destination: 'tokens.css', format: 'css/variables' }],
    },
    js: {
      transformGroup: 'js',
      buildPath: 'dist/tokens/',
      files: [{ destination: 'tokens.js', format: 'javascript/es6' }],
    },
  },
};</code></pre>

<h2>Component Architecture</h2>
<p>Design system components must solve for three competing concerns: flexibility (components must work across many contexts), consistency (components enforce the design language), and composability (components work together without surprises). The compound component pattern balances all three:</p>
<pre><code>// components/Card/Card.tsx
import { createContext, useContext, HTMLAttributes } from 'react';

interface CardContextValue {
  variant: 'elevated' | 'outlined' | 'filled';
}

const CardContext = createContext&lt;CardContextValue&gt;({ variant: 'elevated' });

interface CardProps extends HTMLAttributes&lt;HTMLDivElement&gt; {
  variant?: 'elevated' | 'outlined' | 'filled';
}

export function Card({ variant = 'elevated', children, className, ...props }: CardProps) {
  return (
    &lt;CardContext.Provider value={{ variant }}&gt;
      &lt;div
        className={cn(
          'ds-card',
          \`ds-card--\${variant}\`,
          className
        )}
        {...props}
      &gt;
        {children}
      &lt;/div&gt;
    &lt;/CardContext.Provider&gt;
  );
}

Card.Header = function CardHeader({ children, className, ...props }: HTMLAttributes&lt;HTMLDivElement&gt;) {
  const { variant } = useContext(CardContext);
  return &lt;div className={cn('ds-card__header', className)} {...props}&gt;{children}&lt;/div&gt;;
};

Card.Body = function CardBody({ children, className, ...props }: HTMLAttributes&lt;HTMLDivElement&gt;) {
  return &lt;div className={cn('ds-card__body', className)} {...props}&gt;{children}&lt;/div&gt;;
};

Card.Footer = function CardFooter({ children, className, ...props }: HTMLAttributes&lt;HTMLDivElement&gt;) {
  return &lt;div className={cn('ds-card__footer', className)} {...props}&gt;{children}&lt;/div&gt;;
};

// Usage:
// &lt;Card variant="outlined"&gt;
//   &lt;Card.Header&gt;Title&lt;/Card.Header&gt;
//   &lt;Card.Body&gt;Content&lt;/Card.Body&gt;
//   &lt;Card.Footer&gt;Actions&lt;/Card.Footer&gt;
// &lt;/Card&gt;</code></pre>

<h2>Polymorphic Components with 'as' Prop</h2>
<p>Many design system components need to render as different HTML elements or other React components while preserving their styling. The polymorphic pattern handles this with full TypeScript safety:</p>
<pre><code>type PolymorphicProps&lt;C extends React.ElementType, Props = {}&gt; = Props &
  Omit&lt;React.ComponentPropsWithoutRef&lt;C&gt;, keyof Props&gt; & {
    as?: C;
  };

type ButtonProps&lt;C extends React.ElementType = 'button'&gt; = PolymorphicProps&lt;C, {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}&gt;;

export function Button&lt;C extends React.ElementType = 'button'&gt;({
  as,
  variant = 'primary',
  size = 'md',
  children,
  ...props
}: ButtonProps&lt;C&gt;) {
  const Component = as ?? 'button';
  return (
    &lt;Component
      className={cn('ds-button', \`ds-button--\${variant}\`, \`ds-button--\${size}\`)}
      {...props}
    &gt;
      {children}
    &lt;/Component&gt;
  );
}

// Renders as a link with full anchor typechecking:
// &lt;Button as="a" href="/about"&gt;About&lt;/Button&gt;
// Renders as a Next.js Link:
// &lt;Button as={Link} href="/about"&gt;About&lt;/Button&gt;</code></pre>

<h2>Storybook: The Design System Workbench</h2>
<p>Storybook is the industry standard for developing and documenting design system components in isolation. Every component in your library should have stories that document its variants, states, and edge cases:</p>
<pre><code>// components/Button/Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta&lt;typeof Button&gt; = {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    variant: { control: 'radio', options: ['primary', 'secondary', 'ghost'] },
    size: { control: 'radio', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
  },
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/...',  // Figma integration
    },
  },
};

export default meta;
type Story = StoryObj&lt;typeof Button&gt;;

export const Primary: Story = {
  args: { variant: 'primary', children: 'Click me' },
};

export const AllVariants: Story = {
  render: () => (
    &lt;div style={{ display: 'flex', gap: '8px' }}&gt;
      &lt;Button variant="primary"&gt;Primary&lt;/Button&gt;
      &lt;Button variant="secondary"&gt;Secondary&lt;/Button&gt;
      &lt;Button variant="ghost"&gt;Ghost&lt;/Button&gt;
    &lt;/div&gt;
  ),
};</code></pre>

<h2>Versioning and Distribution</h2>
<p>A design system is software. It needs semantic versioning, a changelog, and a disciplined release process. Use Changesets for version management in a monorepo:</p>
<pre><code># Add a changeset for a breaking change
npx changeset add
# Select: major
# Description: Button component now requires explicit variant prop

# Version all changed packages
npx changeset version

# Publish to npm
npx changeset publish</code></pre>

<p>Consumers pin to a specific major version and upgrade deliberately. This means your design system can evolve without breaking every application that depends on it. For managing a design system in a monorepo alongside its consumers, see our guide on <a href="/blog/monorepo-turborepo-guide">monorepos with Turborepo</a>. For animating design system components consistently, see the <a href="/blog/ui-animations-motion-design">UI animations guide</a>.</p>`,
  },

  // POST 12
  {
    title: 'Core Web Vitals and Performance: From Scores to Real-World Impact',
    slug: 'core-web-vitals-performance',
    date: '2025-03-11T09:00:00',
    category: 'Performance',
    tags: ['Core Web Vitals', 'Performance', 'SEO', 'LCP', 'CLS', 'INP'],
    unsplashQuery: 'speedometer performance speed',
    internalLinks: ['react-server-components-what-changes', 'cloudflare-workers-edge-computing', 'advanced-css-grid-layouts'],
    content: `<h2>Why Core Web Vitals Are Not Just an SEO Checkbox</h2>
<p>Google made Core Web Vitals a ranking factor in 2021, which prompted every web development team to care about them — at least superficially. But the real reason to care is simpler: slow, janky, layout-shifting pages drive users away. Vodafone found a 31% improvement in sales after improving LCP by 8%. Netzwelt saw a 18% reduction in bounce rate after improving their Web Vitals scores. These are not SEO games; they are business outcomes.</p>
<p>Core Web Vitals currently comprises three metrics: Largest Contentful Paint (LCP), Cumulative Layout Shift (CLS), and Interaction to Next Paint (INP). Each measures a distinct aspect of user experience. Improving them requires understanding what they measure, why they degrade, and which specific technical interventions address each one.</p>

<h2>Largest Contentful Paint (LCP): Perceived Load Speed</h2>
<p>LCP measures the time from navigation start to when the largest content element (typically a hero image or H1 heading) becomes visible in the viewport. Good LCP is under 2.5 seconds; poor is over 4 seconds.</p>
<p>The four causes of poor LCP, in order of frequency:</p>
<ul>
  <li><strong>Slow server response (TTFB)</strong>: if your server takes 2 seconds to respond, LCP cannot be under 2.5 seconds regardless of optimization. Use edge caching, server-side rendering with streaming, and CDN distribution.</li>
  <li><strong>Render-blocking resources</strong>: synchronous CSS and JavaScript in <code>&lt;head&gt;</code> block rendering until they download and execute. Defer non-critical JavaScript; inline critical CSS.</li>
  <li><strong>Resource load times</strong>: the LCP image itself taking too long to download. Use modern formats (WebP, AVIF), correct dimensions (avoid downloading a 4K image for a 400px container), and <code>fetchpriority="high"</code> on the LCP image.</li>
  <li><strong>Client-side rendering</strong>: if your LCP element is rendered by JavaScript, the browser must download, parse, and execute that JavaScript first. Switch to server-side rendering for content-critical pages.</li>
</ul>

<pre><code>&lt;!-- Critical: tell the browser to preload the LCP image --&gt;
&lt;link
  rel="preload"
  as="image"
  href="/hero-image.avif"
  fetchpriority="high"
  imagesrcset="/hero-800.avif 800w, /hero-1600.avif 1600w"
  imagesizes="(max-width: 768px) 100vw, 50vw"
/&gt;

&lt;!-- The LCP image itself --&gt;
&lt;img
  src="/hero-image.avif"
  alt="Hero"
  fetchpriority="high"  &lt;!-- high priority fetch --&gt;
  loading="eager"       &lt;!-- never lazy-load the LCP image --&gt;
  width="1600"
  height="900"          &lt;!-- prevents layout shift --&gt;
/&gt;</code></pre>

<h2>Cumulative Layout Shift (CLS): Visual Stability</h2>
<p>CLS measures unexpected layout shifts — content jumping around as the page loads. A score of 0 is perfect; under 0.1 is good; over 0.25 is poor. It is calculated as a product of impact fraction (how much of the viewport shifted) and distance fraction (how far elements moved).</p>
<p>Common CLS causes and fixes:</p>
<pre><code>&lt;!-- WRONG: Image without dimensions causes layout shift --&gt;
&lt;img src="/product.jpg" alt="Product" /&gt;

&lt;!-- CORRECT: Explicit dimensions reserve space --&gt;
&lt;img src="/product.jpg" alt="Product" width="400" height="300" /&gt;

&lt;!-- CSS approach with aspect ratio --&gt;
&lt;style&gt;
.image-container {
  aspect-ratio: 16 / 9;  /* reserves space before image loads */
  width: 100%;
  overflow: hidden;
}
.image-container img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
&lt;/style&gt;</code></pre>

<p>Font-induced layout shift (FOUT — Flash of Unstyled Text) is another common source. The <code>font-display: optional</code> strategy eliminates FOUT entirely by only using the custom font if it loads within a very short window (otherwise uses the fallback permanently for that page view). For pages where brand typography is essential, use <code>font-display: swap</code> and minimize the visual difference between fallback and custom font using the Font Style Matcher tool to set matching metrics:</p>
<pre><code>@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter.woff2') format('woff2');
  font-display: swap;
  /* Adjust fallback font metrics to minimize layout shift */
  size-adjust: 107%;
  ascent-override: 90%;
  descent-override: 22%;
}</code></pre>

<h2>Interaction to Next Paint (INP): Responsiveness</h2>
<p>INP replaced First Input Delay (FID) as a Core Web Vital in March 2024. It measures the time from any user interaction (click, tap, keyboard input) to the next paint. Good INP is under 200 ms; poor is over 500 ms.</p>
<p>INP problems are almost always caused by long tasks on the main thread. The main thread handles JavaScript execution, layout, painting, and compositing — if your JavaScript runs a 1-second function in response to a click, the browser cannot paint the updated UI for that entire second.</p>
<pre><code>// WRONG: Long synchronous work blocks the main thread
button.addEventListener('click', () => {
  const results = processLargeDataset(hugeArray); // 800ms
  updateUI(results);
});

// BETTER: Break work into chunks with scheduler.yield()
button.addEventListener('click', async () => {
  const chunks = splitIntoChunks(hugeArray, 1000);
  const results = [];

  for (const chunk of chunks) {
    results.push(...processChunk(chunk));
    // Yield to the browser between chunks
    await scheduler.yield(); // or: await new Promise(r => setTimeout(r, 0));
  }

  updateUI(results);
});

// BEST for heavy computation: Web Workers
const worker = new Worker('./process-worker.js');
button.addEventListener('click', () => {
  worker.postMessage({ data: hugeArray });
});
worker.onmessage = ({ data: results }) => updateUI(results);</code></pre>

<h2>Diagnosing with Real User Monitoring (RUM)</h2>
<p>Lab tools (Lighthouse, WebPageTest) measure your site in controlled conditions. Real User Monitoring (RUM) captures actual user experiences across all device types, network conditions, and geographic locations — the data that actually correlates with your business metrics:</p>
<pre><code>// Capture Core Web Vitals with the web-vitals library
import { onLCP, onINP, onCLS, onTTFB, onFCP } from 'web-vitals';

function sendToAnalytics({ name, value, rating, id, navigationType }) {
  fetch('/analytics/vitals', {
    method: 'POST',
    body: JSON.stringify({
      metric: name,
      value: Math.round(name === 'CLS' ? value * 1000 : value),
      rating,          // 'good' | 'needs-improvement' | 'poor'
      id,
      url: location.href,
      navigationType, // 'navigate' | 'reload' | 'back-forward'
      connection: navigator.connection?.effectiveType,
    }),
    keepalive: true,  // ensures the request completes even if page unloads
  });
}

onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);
onTTFB(sendToAnalytics);
onFCP(sendToAnalytics);</code></pre>

<h2>Next.js Performance Optimizations</h2>
<p>Next.js 14+ includes several built-in optimizations that directly address Core Web Vitals:</p>
<ul>
  <li><strong>next/image</strong>: automatic WebP/AVIF conversion, lazy loading, explicit dimensions required (prevents CLS), responsive srcset generation, and priority prop for the LCP image.</li>
  <li><strong>next/font</strong>: downloads fonts at build time, self-hosts them, eliminates third-party font network requests, and automatically sets <code>size-adjust</code> for zero CLS.</li>
  <li><strong>Partial Prerendering (PPR)</strong>: streams a static shell immediately (great TTFB and LCP) while dynamic content streams in behind Suspense boundaries.</li>
  <li><strong>React Server Components</strong>: eliminates JavaScript for server-rendered content, reducing main thread work and improving INP.</li>
</ul>
<p>Edge distribution (covered in our <a href="/blog/cloudflare-workers-edge-computing">Cloudflare Workers guide</a>) dramatically improves TTFB, which is the upstream dependency of LCP. No amount of client-side optimization compensates for a 3-second server response time.</p>`,
  },

  // POST 13
  {
    title: 'Event-Driven Architecture: Patterns, Trade-offs, and Implementation',
    slug: 'event-driven-architecture-guide',
    date: '2025-04-08T10:00:00',
    category: 'Backend',
    tags: ['Architecture', 'Kafka', 'Event-Driven', 'Microservices'],
    unsplashQuery: 'network cables fiber optic',
    internalLinks: ['building-resilient-microservices-go', 'kubernetes-production-guide', 'error-handling-patterns'],
    content: `<h2>Why Events? The Core Trade-off</h2>
<p>In a synchronous, request/response architecture, Service A calls Service B directly and waits for the answer. This is simple, consistent, and easy to reason about — but it creates tight coupling. If Service B is slow, Service A slows down. If Service B is unavailable, Service A fails. Scaling requires scaling both services together. Any change to B's interface requires coordinated changes to A.</p>
<p>Event-driven architecture inverts this dependency: Service A publishes an event ("OrderPlaced") to a broker, and Service B (along with Services C, D, and E) consumes that event independently and asynchronously. Services are decoupled in time and space — B can be down for an hour and still process every event when it comes back. New consumers can be added without changing A. Services scale independently based on their own throughput requirements.</p>
<p>The trade-off is complexity: distributed messaging systems introduce eventual consistency, message ordering challenges, idempotency requirements, and operational overhead that synchronous systems do not have. Event-driven architecture is not inherently better — it is better for specific problems.</p>

<h2>Events, Commands, and Queries</h2>
<p>Not all messages are the same. The distinction shapes how you design your message schemas and who is allowed to produce and consume them:</p>
<ul>
  <li><strong>Events</strong>: facts about something that happened. Past tense, immutable, broadcast to any interested consumer. "OrderPlaced", "UserEmailVerified", "PaymentFailed". The publisher has no knowledge of or dependency on consumers.</li>
  <li><strong>Commands</strong>: requests to perform an action. Imperative, directed at a specific service. "SendWelcomeEmail", "ChargePaymentMethod". One publisher, one consumer.</li>
  <li><strong>Queries</strong>: requests for data. Typically synchronous (REST/gRPC) or via query-specific messaging patterns like request/reply.</li>
</ul>
<p>The most common mistake in event-driven systems is treating events as commands: "UserCreated" event with a field "sendWelcomeEmail: true". This re-couples the publisher to a specific consumer's behavior. Events should describe what happened; consumers decide what to do about it.</p>

<h2>Apache Kafka Architecture</h2>
<p>Kafka is the dominant event streaming platform for high-throughput, durable, replayable event streams. Understanding its architecture is prerequisite to using it well:</p>
<ul>
  <li><strong>Topics</strong>: named, ordered, immutable logs of messages. Unlike a queue, messages are not deleted after consumption — they are retained for a configurable period (default 7 days, often extended to weeks or months).</li>
  <li><strong>Partitions</strong>: topics are split into partitions for parallelism. Messages within a partition are strictly ordered; ordering across partitions is not guaranteed. The partition key determines which partition a message goes to — identical keys always go to the same partition.</li>
  <li><strong>Consumer groups</strong>: each consumer in a group reads from a different subset of partitions. This enables parallel consumption while ensuring each message is processed by exactly one consumer in the group. Multiple groups can consume the same topic independently (pub/sub semantics).</li>
  <li><strong>Offsets</strong>: Kafka tracks consumption position as an offset (integer). Consumers commit offsets to mark messages as processed. This enables replay: set the offset back to reprocess historical events.</li>
</ul>

<h2>Producing Events with Node.js</h2>
<pre><code>import { Kafka, CompressionTypes, logLevel } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'orders-service',
  brokers: ['kafka-1:9092', 'kafka-2:9092', 'kafka-3:9092'],
  ssl: true,
  sasl: { mechanism: 'scram-sha-512', username: process.env.KAFKA_USER!, password: process.env.KAFKA_PASS! },
  logLevel: logLevel.WARN,
});

const producer = kafka.producer({
  idempotent: true,         // exactly-once delivery
  transactionalId: 'orders-producer',  // enables transactions
});

interface OrderPlacedEvent {
  eventId: string;
  eventType: 'OrderPlaced';
  aggregateId: string;  // orderId
  occurredAt: string;
  payload: {
    orderId: string;
    userId: string;
    items: Array<{ productId: string; quantity: number; price: number }>;
    total: number;
  };
}

async function publishOrderPlaced(order: Order): Promise<void> {
  const event: OrderPlacedEvent = {
    eventId: crypto.randomUUID(),
    eventType: 'OrderPlaced',
    aggregateId: order.id,
    occurredAt: new Date().toISOString(),
    payload: { orderId: order.id, userId: order.userId, items: order.items, total: order.total },
  };

  await producer.send({
    topic: 'order-events',
    messages: [{
      key: order.id,      // partition by orderId — all order events are ordered
      value: JSON.stringify(event),
      headers: {
        'event-type': event.eventType,
        'event-version': '1',
        'correlation-id': getCorrelationId(),
      },
    }],
    compression: CompressionTypes.GZIP,
  });
}</code></pre>

<h2>Consuming Events with Idempotency</h2>
<p>In at-least-once delivery systems (the Kafka default), consumers may receive the same message more than once — during rebalances, restarts, or network issues. Handlers must be idempotent: processing the same event twice must produce the same result as processing it once:</p>
<pre><code>const consumer = kafka.consumer({ groupId: 'notifications-service' });

await consumer.subscribe({ topics: ['order-events'], fromBeginning: false });

await consumer.run({
  autoCommit: false,  // manual offset commit after successful processing
  eachMessage: async ({ topic, partition, message, heartbeat }) => {
    const event = JSON.parse(message.value!.toString());
    const eventId = message.headers?.['event-id']?.toString() ?? event.eventId;

    // Idempotency check: have we already processed this event?
    const processed = await redis.get(\`processed:\${eventId}\`);
    if (processed) {
      await consumer.commitOffsets([{ topic, partition, offset: String(Number(message.offset) + 1) }]);
      return;
    }

    try {
      await handleEvent(event);

      // Mark as processed (with TTL matching your retention window)
      await redis.setex(\`processed:\${eventId}\`, 7 * 24 * 3600, '1');

      await consumer.commitOffsets([
        { topic, partition, offset: String(Number(message.offset) + 1) },
      ]);
    } catch (e) {
      // Don't commit — message will be redelivered
      console.error('Failed to process event:', eventId, e);
      // Optional: send to dead letter queue after N failures
    }

    await heartbeat();  // prevent consumer group rebalance during long processing
  },
});</code></pre>

<h2>Outbox Pattern: Atomic Event Publishing</h2>
<p>The most dangerous bug in event-driven systems: writing to the database succeeds, but publishing the event fails. Now your data says the order was placed but no downstream service knows about it. The Outbox pattern solves this by writing events to the same database transaction as the business data:</p>
<pre><code>-- In the same transaction as INSERT INTO orders:
BEGIN;
  INSERT INTO orders (id, user_id, total, status)
  VALUES ($1, $2, $3, 'pending');

  INSERT INTO outbox_events (id, topic, aggregate_id, event_type, payload, created_at)
  VALUES (
    gen_random_uuid(),
    'order-events',
    $1,  -- orderId
    'OrderPlaced',
    $4::jsonb,
    NOW()
  );
COMMIT;</code></pre>

<p>A separate Outbox Processor reads unpublished events from the outbox table and publishes them to Kafka, then marks them as published. This guarantees that every database write is eventually published as an event, even if the application crashes between the two operations.</p>

<h2>Event Sourcing vs. Event-Driven Architecture</h2>
<p>These terms are often confused. Event-driven architecture uses events for communication between services. Event sourcing stores the full history of state changes as the source of truth for a single aggregate, deriving current state by replaying events. They are independent patterns that can be used together or separately.</p>
<p>Event sourcing adds significant complexity — CQRS, projection maintenance, schema evolution across event versions — that is only justified for domains with complex audit requirements, temporal queries ("what was the state of this order at 3pm yesterday?"), or frequent state modeling changes. Most microservices should use event-driven architecture without event sourcing. For the infrastructure to run this reliably, see our <a href="/blog/kubernetes-production-guide">Kubernetes production guide</a>.</p>`,
  },

  // POST 14
  {
    title: 'Git Workflows for Teams: Branching Strategies, Code Review, and Release Management',
    slug: 'git-workflows-team',
    date: '2025-05-06T09:00:00',
    category: 'DevOps',
    tags: ['Git', 'GitHub', 'Workflow', 'CI/CD', 'Code Review'],
    unsplashQuery: 'team collaboration workflow',
    internalLinks: ['docker-containers-production', 'monorepo-turborepo-guide', 'testing-strategies-web-applications'],
    content: `<h2>Why Git Workflow Matters More Than You Think</h2>
<p>Your Git branching strategy is not just a version control decision — it is a deployment architecture decision. The branches you create determine when code ships to production, how conflicts are resolved, what your CI/CD pipeline triggers, and how quickly teams can respond to production incidents. A team of 3 can get away with chaos; a team of 30 shipping multiple features in parallel cannot.</p>
<p>This guide covers three proven workflows — GitHub Flow, Git Flow, and Trunk-Based Development — with guidance on choosing between them, plus the tooling and review practices that make any workflow effective.</p>

<h2>GitHub Flow: Simple and Continuous</h2>
<p>GitHub Flow is intentionally minimal: one production-stable branch (<code>main</code>), short-lived feature branches off main, pull requests for review, and direct merges to main that trigger deployment. It works well for teams that deploy continuously and have strong automated testing:</p>
<pre><code># Start a feature
git checkout -b feature/user-notifications main

# Work in small commits
git commit -m "feat: add notification service interface"
git commit -m "feat: implement email notification handler"
git commit -m "test: add notification service tests"

# Keep up to date with main
git fetch origin
git rebase origin/main

# Push and open PR
git push -u origin feature/user-notifications
gh pr create --title "Add user notification system" --body "..."

# After review and approval — squash merge to keep main history clean
gh pr merge --squash</code></pre>

<p>GitHub Flow's simplicity is its strength and its weakness. It works well when: you deploy immediately after merging, your test suite is fast and reliable, and features are small enough to complete in a day or two. It struggles when: you need to maintain multiple deployed versions simultaneously, features take weeks, or deployments require scheduled windows.</p>

<h2>Git Flow: Structured Releases</h2>
<p>Git Flow maintains two permanent branches (<code>main</code> and <code>develop</code>) and introduces release, hotfix, and feature branch types. It is appropriate for products with versioned releases (mobile apps, libraries, enterprise software):</p>
<pre><code># Feature development
git checkout -b feature/payment-gateway develop
# ... work ...
git checkout develop
git merge --no-ff feature/payment-gateway  # --no-ff preserves branch history

# Release preparation
git checkout -b release/1.4.0 develop
# Fix release-critical bugs only on this branch
git commit -m "fix: payment gateway timeout on slow connections"
git checkout main && git merge --no-ff release/1.4.0
git tag -a v1.4.0 -m "Release 1.4.0"
git checkout develop && git merge --no-ff release/1.4.0

# Emergency hotfix
git checkout -b hotfix/1.4.1 main
git commit -m "fix: critical XSS vulnerability in search"
git checkout main && git merge --no-ff hotfix/1.4.1
git tag -a v1.4.1
git checkout develop && git merge --no-ff hotfix/1.4.1</code></pre>

<p>The downside of Git Flow is its ceremony. It works well for quarterly releases; it creates friction for weekly or daily deployments. Most SaaS teams have moved away from Git Flow for this reason.</p>

<h2>Trunk-Based Development: Scale Without Branches</h2>
<p>Trunk-Based Development (TBD) is the practice used at Google, Facebook, and most high-velocity engineering organizations. The principle: everyone commits to <code>main</code> (the "trunk") at least once per day. Feature flags control which features are visible to users — code is deployed before it is "launched."</p>
<pre><code>// Feature flag check in application code
import { getFlags } from '@company/flags';

export async function SearchBar({ userId }: { userId: string }) {
  const flags = await getFlags(userId);

  return flags.newSearchUI
    ? &lt;NewSearchBarV2 /&gt;
    : &lt;SearchBarV1 /&gt;;
}

// Flag definition (in LaunchDarkly, Unleash, or similar)
// {
//   key: 'newSearchUI',
//   rollout: { percentage: 25, seed: 'newSearchUI' },  // 25% of users
//   targeting: [{ attribute: 'betaUser', match: true, serve: true }]
// }</code></pre>

<p>TBD requires discipline: commits to trunk must not break the build, feature code behind inactive flags must not degrade performance, and flags must be cleaned up after full rollout (flag debt is real). The benefits are significant: no merge conflicts from long-lived branches, instant visibility of everyone's work, and the ability to ship and roll back individual features independently of other work.</p>

<h2>Writing Effective Commit Messages</h2>
<p>Commit messages are the primary documentation of <em>why</em> a change was made. The Conventional Commits specification provides a machine-readable format that enables automated changelogs and semantic versioning:</p>
<pre><code># Format: &lt;type&gt;[optional scope]: &lt;description&gt;
#         [optional body]
#         [optional footer]

# Types: feat, fix, docs, style, refactor, perf, test, chore, ci
# Breaking changes use BREAKING CHANGE footer or ! after type

feat(payments): add PayPal checkout integration

Implement PayPal Smart Buttons as an additional checkout option
alongside existing Stripe integration. The payment method selection
is persisted to the user's profile.

Closes #234
BREAKING CHANGE: PaymentMethod enum adds 'paypal' value; consumers
must handle the new variant</code></pre>

<p>Tools like Commitizen enforce the format interactively, and commitlint validates it in CI.</p>

<h2>Pull Request Best Practices</h2>
<p>The pull request review is one of the highest-leverage activities in software development — it catches bugs, spreads knowledge, and enforces architectural standards. Make it effective:</p>
<ul>
  <li><strong>Keep PRs small</strong>: under 400 lines of changed code. Large PRs receive superficial reviews. If a feature is large, split it into a series of PRs that each work and pass CI.</li>
  <li><strong>Write a meaningful description</strong>: what problem does this solve? What did you try that didn't work? What should reviewers focus on? Include screenshots for UI changes.</li>
  <li><strong>Link to the issue or spec</strong>: reviewers should be able to understand the "why" without asking you.</li>
  <li><strong>Request specific reviewers</strong>: don't rely on round-robin assignment. The person who designed the system being modified is the right reviewer.</li>
  <li><strong>Use draft PRs for early feedback</strong>: open a PR as draft when you want architectural feedback before the implementation is complete.</li>
</ul>

<h2>Branch Protection Rules</h2>
<p>Protect your main branch from accidental direct pushes, broken builds, and insufficient review:</p>
<pre><code># GitHub CLI: set branch protection
gh api repos/{owner}/{repo}/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["ci/tests","ci/lint","ci/security"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null</code></pre>

<h2>Automated Release Management</h2>
<p>Semantic Release automates version bumping, changelog generation, and publishing based on Conventional Commits:</p>
<pre><code>// .releaserc.json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    ["@semantic-release/npm", { "npmPublish": false }],
    ["@semantic-release/github", {
      "assets": [{ "path": "dist/*.tar.gz", "label": "Build artifacts" }]
    }],
    ["@semantic-release/git", {
      "assets": ["CHANGELOG.md", "package.json"],
      "message": "chore(release): \${nextRelease.version} [skip ci]"
    }]
  ]
}</code></pre>

<p>On every merge to main, Semantic Release analyzes commits since the last release, determines the appropriate version bump (patch for fixes, minor for features, major for breaking changes), generates a changelog, creates a GitHub release, and publishes. Zero human decision-making about version numbers. For managing these workflows across multiple packages, see our guide on <a href="/blog/monorepo-turborepo-guide">monorepos with Turborepo</a>.</p>`,
  },

  // POST 15
  {
    title: 'API Design Principles: REST, GraphQL, and tRPC Compared',
    slug: 'api-design-rest-graphql-trpc',
    date: '2025-06-10T10:00:00',
    category: 'Backend',
    tags: ['API', 'REST', 'GraphQL', 'tRPC', 'TypeScript'],
    unsplashQuery: 'api connection network interface',
    internalLinks: ['securing-rest-apis-checklist', 'typescript-generics-advanced', 'error-handling-patterns'],
    content: `<h2>The Right Tool for the Right API</h2>
<p>API design is one of the most consequential technical decisions in a software project. A poorly designed API is forever — it accumulates consumers, becomes impossible to change without breaking things, and shapes every client implementation built on top of it. The choice between REST, GraphQL, and tRPC is not a matter of fashion; it is a decision that should be driven by your team's structure, your consumers' needs, and your performance requirements.</p>
<p>This guide provides an honest comparison of all three approaches, with real code examples that show not just how to use each but where each starts to strain under real-world requirements.</p>

<h2>REST: The Established Standard</h2>
<p>REST (Representational State Transfer) is the dominant API paradigm because it aligns with how HTTP was designed: resources identified by URLs, operations expressed through HTTP methods, state transferred in representations (typically JSON). Its ubiquity means every language, framework, and tool has mature REST support.</p>
<pre><code># REST resource design for a blog API
GET    /api/posts              # List posts
POST   /api/posts              # Create a post
GET    /api/posts/:id          # Get a post
PUT    /api/posts/:id          # Replace a post
PATCH  /api/posts/:id          # Update fields of a post
DELETE /api/posts/:id          # Delete a post

GET    /api/posts/:id/comments # List comments for a post
POST   /api/posts/:id/comments # Add a comment</code></pre>

<p>REST's weaknesses at scale:</p>
<ul>
  <li><strong>Over-fetching</strong>: <code>GET /api/users/:id</code> returns the full user object even when the client only needs the display name. Solutions: sparse fieldsets (<code>?fields=name,avatar</code>), response shaping — both add complexity.</li>
  <li><strong>Under-fetching</strong>: getting a post with its author and comment count requires 3 API calls unless you build custom endpoints. Solutions: compound documents (JSON:API), custom endpoints — both add surface area.</li>
  <li><strong>Versioning</strong>: v1/v2/v3 URL schemes fragment your API surface. Header versioning is cleaner but harder to discover. Additive changes require careful discipline to avoid breaking clients.</li>
</ul>

<h2>Designing a REST API That Doesn't Age Poorly</h2>
<p>REST done well avoids most of its common pitfalls:</p>
<pre><code>// Express + Zod + TypeScript REST implementation
import express from 'express';
import { z } from 'zod';

const router = express.Router();

// Consistent error format
interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

// Consistent pagination
interface PaginatedResponse&lt;T&gt; {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  _links: {
    self: string;
    next?: string;
    prev?: string;
  };
}

// List with filtering, sorting, and pagination
router.get('/posts', async (req, res) => {
  const query = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['draft', 'published', 'archived']).optional(),
    sort: z.enum(['createdAt', 'updatedAt', 'title']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
    search: z.string().max(200).optional(),
  }).parse(req.query);

  const [posts, total] = await Promise.all([
    postService.findMany(query),
    postService.count(query),
  ]);

  return res.json({
    data: posts,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems: total,
      totalPages: Math.ceil(total / query.pageSize),
      hasNext: query.page * query.pageSize < total,
      hasPrev: query.page > 1,
    },
    _links: {
      self: \`/api/posts?page=\${query.page}&pageSize=\${query.pageSize}\`,
      ...(query.page * query.pageSize < total && {
        next: \`/api/posts?page=\${query.page + 1}&pageSize=\${query.pageSize}\`,
      }),
    },
  } satisfies PaginatedResponse&lt;Post&gt;);
});</code></pre>

<h2>GraphQL: Flexible Queries for Complex Data</h2>
<p>GraphQL solves REST's over/under-fetching problems by letting clients specify exactly what data they need in a single request. It is the right choice when: you have a complex, interconnected data graph; your consumers are diverse (web, mobile, third parties); and data requirements evolve rapidly.</p>
<pre><code># GraphQL schema definition
type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  comments(first: Int = 10, after: String): CommentConnection!
  tags: [Tag!]!
  publishedAt: DateTime
  status: PostStatus!
}

type Query {
  post(id: ID!): Post
  posts(
    first: Int = 20
    after: String
    status: PostStatus
    authorId: ID
  ): PostConnection!
}

type Mutation {
  createPost(input: CreatePostInput!): CreatePostPayload!
  publishPost(id: ID!): PublishPostPayload!
}</code></pre>

<pre><code>// Resolver implementation with DataLoader (critical for N+1 prevention)
import DataLoader from 'dataloader';

const userLoader = new DataLoader&lt;string, User&gt;(async (ids) => {
  const users = await db.users.findMany({ where: { id: { in: ids as string[] } } });
  return ids.map(id => users.find(u => u.id === id) ?? new Error(\`User \${id} not found\`));
});

const resolvers = {
  Post: {
    // Without DataLoader: N separate DB queries for N posts
    // With DataLoader: 1 batched query regardless of N
    author: (post: Post) => userLoader.load(post.authorId),
  },
};</code></pre>

<p>GraphQL's weaknesses: the N+1 query problem requires DataLoader (additional complexity), subscriptions are complex to implement and scale, query complexity attacks (deeply nested queries) require depth limiting and cost analysis, and caching is harder than REST (responses are not URL-addressable).</p>

<h2>tRPC: End-to-End Type Safety Without a Schema</h2>
<p>tRPC takes a different approach: instead of defining a schema and generating types (like GraphQL), it uses TypeScript's type inference to automatically share types between server and client. There is no schema language, no code generation, and no type drift between API definition and implementation:</p>
<pre><code>// server/routers/posts.ts
import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';

export const postsRouter = router({
  list: publicProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      status: z.enum(['draft', 'published']).optional(),
    }))
    .query(async ({ input, ctx }) => {
      return postService.findMany(input);
      // Return type is automatically inferred — no need to declare it
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      content: z.string().min(100),
      tags: z.array(z.string().uuid()).max(5),
    }))
    .mutation(async ({ input, ctx }) => {
      return postService.create({ ...input, authorId: ctx.user.id });
    }),

  publish: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const post = await postService.findById(input.id);
      if (post.authorId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
      return postService.publish(input.id);
    }),
});

// client/pages/blog.tsx — fully typed, no code generation
import { trpc } from '../utils/trpc';

function BlogPage() {
  const { data, isLoading } = trpc.posts.list.useQuery({
    page: 1, status: 'published'
  });
  // data is fully typed as { posts: Post[]; pagination: Pagination }

  const createPost = trpc.posts.create.useMutation({
    onSuccess: () => utils.posts.list.invalidate(),
  });
}</code></pre>

<h2>Choosing Between the Three</h2>
<ul>
  <li><strong>Choose REST</strong> when: your API will be consumed by third parties, you need HTTP caching, or your team is more comfortable with it. REST's universality and tooling maturity remain significant advantages.</li>
  <li><strong>Choose GraphQL</strong> when: you have a complex data graph with many relationships, diverse clients with different data needs, and a team willing to manage the DataLoader, schema design, and deprecation complexity.</li>
  <li><strong>Choose tRPC</strong> when: your frontend and backend are both TypeScript, you control both ends of the API (internal API), and you want to eliminate the entire API contract layer. tRPC is transformative for full-stack TypeScript teams.</li>
</ul>
<p>The security considerations for all three approaches are covered in depth in our guide on <a href="/blog/securing-rest-apis-checklist">securing REST APIs</a>, and TypeScript generics that power tRPC's type inference are explained in our <a href="/blog/typescript-generics-advanced">TypeScript generics guide</a>.</p>`,
  },

  // POST 16
  {
    title: 'UI Animations and Motion Design: Performance, Accessibility, and Craft',
    slug: 'ui-animations-motion-design',
    date: '2025-07-15T09:00:00',
    category: 'Frontend',
    tags: ['Animation', 'CSS', 'Motion', 'Accessibility', 'Framer Motion'],
    unsplashQuery: 'motion blur light trails',
    internalLinks: ['advanced-css-grid-layouts', 'design-systems-at-scale', 'core-web-vitals-performance'],
    content: `<h2>Motion as a Design Material</h2>
<p>Animation in user interfaces is often treated as a cosmetic layer applied at the end of a project — sprinkles on a finished product. This framing leads to gratuitous animations that slow down interactions and distract from content. The better framing: motion is a design material as fundamental as color, typography, and space. Used well, it communicates state changes, establishes spatial relationships, guides attention, and reinforces the mental model of how an interface works.</p>
<p>The discipline of motion design is about restraint and purpose: each animation should communicate something that could not be communicated as clearly without it. If you cannot articulate what an animation communicates, it should not exist.</p>

<h2>The Physics of Natural Motion</h2>
<p>Human visual perception has been shaped by physical objects that have inertia: they accelerate from rest, decelerate before stopping, and overshoot when suddenly stopped. CSS transitions with <code>linear</code> or <code>ease</code> timing functions feel mechanical because they do not model inertia.</p>
<p>Spring-based animations model physical inertia and feel natural because they mimic how objects actually move. Instead of specifying a duration, you specify the physical properties of the spring:</p>
<pre><code>// CSS: cubic-bezier approximation of spring motion
.card {
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  /* The values above 1 in the y-axis create overshoot — the "spring" effect */
}

.card:hover {
  transform: scale(1.05) translateY(-4px);
}</code></pre>

<pre><code>// Framer Motion: true spring physics
import { motion } from 'framer-motion';

const springConfig = {
  type: 'spring',
  stiffness: 400,   // how strong the spring pulls back
  damping: 25,      // how much it resists oscillation (lower = more bounce)
  mass: 1,          // the "weight" of the element
};

function AnimatedCard({ children }: { children: React.ReactNode }) {
  return (
    &lt;motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={springConfig}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
    &gt;
      {children}
    &lt;/motion.div&gt;
  );
}</code></pre>

<h2>Layout Animations: The Hard Problem</h2>
<p>Animating layout changes — items reordering, a list gaining a new item, a panel expanding — is the hardest category of UI animation. The browser's layout engine recalculates positions instantaneously; bridging the gap between "where the element was" and "where the element now is" requires JavaScript.</p>
<p>Framer Motion's <code>layout</code> prop handles this automatically using the FLIP (First, Last, Invert, Play) technique:</p>
<pre><code>// Animated list with reordering
import { motion, AnimatePresence } from 'framer-motion';

function SortableList({ items }: { items: Item[] }) {
  return (
    &lt;ul&gt;
      &lt;AnimatePresence mode="popLayout"&gt;
        {items.map(item => (
          &lt;motion.li
            key={item.id}
            layout                    // animate layout changes
            layoutId={item.id}        // for shared layout transitions
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          &gt;
            {item.name}
          &lt;/motion.li&gt;
        ))}
      &lt;/AnimatePresence&gt;
    &lt;/ul&gt;
  );
}</code></pre>

<h2>Shared Layout Transitions</h2>
<p>Shared layout transitions — an element morphing from one position/size to another as the user navigates — are among the most compelling interactions in modern apps. The "hero" image expanding from a thumbnail to fill the screen is the canonical example:</p>
<pre><code>// Gallery → Detail shared layout transition
// Gallery item
&lt;motion.img
  layoutId={\`image-\${photo.id}\`}
  src={photo.thumbnail}
  onClick={() => setSelected(photo.id)}
  style={{ borderRadius: 8 }}
/&gt;

// Detail view (rendered in a portal/modal)
{selected && (
  &lt;motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="overlay"
    onClick={() => setSelected(null)}
  &gt;
    &lt;motion.img
      layoutId={\`image-\${selected}\`}  // same layoutId = shared transition
      src={photos.find(p =&gt; p.id === selected)?.full}
      style={{ borderRadius: 0 }}     // borderRadius animates too!
    /&gt;
  &lt;/motion.div&gt;
)}</code></pre>

<h2>CSS View Transitions API</h2>
<p>The View Transitions API, now in all modern browsers, enables shared element transitions with nothing but CSS — no JavaScript animation libraries required. It is particularly powerful for Multi-Page Application (MPA) navigation:</p>
<pre><code>/* app.css */
/* Opt the entire page into view transitions */
@view-transition {
  navigation: auto;
}

/* Name specific elements for shared transitions */
.card-image {
  view-transition-name: var(--image-id);  /* unique per card */
  contain: layout;
}

/* Customize the transition animation */
::view-transition-old(card-image) {
  animation: 300ms ease-out fade-and-scale-out;
}

::view-transition-new(card-image) {
  animation: 300ms ease-in fade-and-scale-in;
}</code></pre>

<h2>Performance: Animating the Right Properties</h2>
<p>The most important performance rule in CSS animation: only animate properties that trigger compositing, not layout or paint. The browser's rendering pipeline has three stages — layout (calculate positions and sizes), paint (draw pixels), and composite (layer the painted results on the GPU). Layout and paint are expensive; compositing is nearly free because it happens on the GPU.</p>
<ul>
  <li><strong>Cheap (compositor-only)</strong>: <code>transform</code> (translate, scale, rotate, skew), <code>opacity</code>. Always use these.</li>
  <li><strong>Expensive (triggers paint)</strong>: <code>background-color</code>, <code>border-color</code>, <code>box-shadow</code>, <code>color</code>. Avoid animating these in tight loops.</li>
  <li><strong>Very expensive (triggers layout)</strong>: <code>width</code>, <code>height</code>, <code>top</code>, <code>left</code>, <code>margin</code>, <code>padding</code>. Never animate these directly; use <code>transform: translate()</code> instead.</li>
</ul>
<pre><code>/* WRONG: animates width — triggers layout reflow on every frame */
.drawer { transition: width 0.3s; }
.drawer.open { width: 320px; }

/* RIGHT: animates transform — compositor only, GPU-accelerated */
.drawer { transform: translateX(-320px); transition: transform 0.3s; }
.drawer.open { transform: translateX(0); }</code></pre>

<h2>Accessibility: Respecting prefers-reduced-motion</h2>
<p>Vestibular disorders affect ~35% of adults. For users with these conditions, screen motion — especially parallax effects, spinning animations, and zoom transitions — can trigger nausea, dizziness, and migraines. The <code>prefers-reduced-motion</code> media query lets users declare their preference, and you must respect it:</p>
<pre><code>/* In CSS: disable animations for users who prefer reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* In JavaScript/Framer Motion: */
import { useReducedMotion } from 'framer-motion';

function AnimatedComponent() {
  const prefersReducedMotion = useReducedMotion();

  return (
    &lt;motion.div
      animate={{ opacity: 1, y: prefersReducedMotion ? 0 : -20 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
    &gt;
      ...
    &lt;/motion.div&gt;
  );
}</code></pre>

<p>A reduced-motion experience should not be a degraded experience — it should be a different experience that achieves the same communication goals without vestibular-disrupting movement. Fade transitions (opacity changes) are generally acceptable; spatial movement (translate, zoom, rotate) should be replaced or removed. These accessibility considerations and the broader performance impact of animations are also covered in our <a href="/blog/core-web-vitals-performance">Core Web Vitals guide</a>.</p>`,
  },

  // POST 17
  {
    title: 'Kubernetes in Production: Deployments, Autoscaling, and Reliability',
    slug: 'kubernetes-production-guide',
    date: '2025-08-12T10:00:00',
    category: 'DevOps',
    tags: ['Kubernetes', 'K8s', 'DevOps', 'Containers', 'Production'],
    unsplashQuery: 'server infrastructure operations',
    internalLinks: ['docker-containers-production', 'building-resilient-microservices-go', 'event-driven-architecture-guide'],
    content: `<h2>Kubernetes Is Infrastructure Abstraction, Not Magic</h2>
<p>Kubernetes (K8s) is the platform that has won the container orchestration wars. It runs at Google, Netflix, Airbnb, and tens of thousands of other organizations. It is also one of the most operationally complex pieces of infrastructure in modern software engineering — with a steep learning curve that has driven many teams back to simpler alternatives like Fly.io, Render, or Railway.</p>
<p>This guide is not a "Kubernetes basics" introduction. It is a production-focused guide for teams that have decided K8s is the right choice and need to run it reliably. We cover the deployment patterns, autoscaling configurations, resource management, and observability practices that separate a stable production cluster from one that pages you at 3 AM.</p>

<h2>Pod Design: The Fundamental Unit</h2>
<p>A Pod is the smallest deployable unit in Kubernetes — one or more containers that share a network namespace and storage volumes. In practice, most Pods contain a single application container, with possible sidecar containers for logging agents, service mesh proxies (Envoy/Istio), or secrets injection (Vault Agent).</p>
<p>Every production Pod must have resource requests and limits defined. Without them, the Kubernetes scheduler cannot make informed placement decisions, and a single runaway container can starve other Pods on the same node:</p>
<pre><code>apiVersion: apps/v1
kind: Deployment
metadata:
  name: orders-service
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: orders-service
  template:
    metadata:
      labels:
        app: orders-service
        version: "1.4.2"
    spec:
      containers:
      - name: orders-service
        image: registry.example.com/orders-service:1.4.2
        ports:
        - containerPort: 8080
        resources:
          requests:
            cpu: "250m"       # 0.25 CPU cores — used for scheduling
            memory: "256Mi"
          limits:
            cpu: "1000m"      # 1 CPU core — hard cap
            memory: "512Mi"   # OOMKilled if exceeded
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /readyz
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
          successThreshold: 1
          failureThreshold: 2
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: orders-secrets
              key: database-url
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values: [orders-service]
              topologyKey: kubernetes.io/hostname</code></pre>

<p>The <code>podAntiAffinity</code> rule is critical: it tells the scheduler to prefer placing replicas on different nodes. Without it, all three replicas might land on the same node, and a single node failure takes down your service entirely.</p>

<h2>Horizontal Pod Autoscaling</h2>
<p>HPA automatically adjusts replica count based on metrics. The basic CPU-based HPA is useful but insufficient — CPU utilization is a lagging indicator of load. Custom metrics (requests per second, queue depth, memory-based) provide more responsive scaling:</p>
<pre><code>apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: orders-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: orders-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70   # scale up when average CPU > 70%
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "100"      # scale up when RPS > 100 per pod
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60    # avoid rapid scale-up oscillation
      policies:
      - type: Percent
        value: 50                        # add max 50% replicas at a time
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300   # wait 5 minutes before scaling down
      policies:
      - type: Percent
        value: 25
        periodSeconds: 60</code></pre>

<h2>Rolling Updates and Rollback Strategies</h2>
<p>Kubernetes deployments use a rolling update strategy by default — gradually replacing old Pods with new ones. Configure it to minimize risk:</p>
<pre><code>spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0    # never take pods offline (requires extra capacity)
      maxSurge: 1          # bring up 1 extra pod at a time
  # For zero-downtime: maxUnavailable: 0 + PodDisruptionBudget</code></pre>

<pre><code># Check rollout status
kubectl rollout status deployment/orders-service

# View rollout history
kubectl rollout history deployment/orders-service

# Instant rollback to previous version
kubectl rollout undo deployment/orders-service

# Rollback to a specific revision
kubectl rollout undo deployment/orders-service --to-revision=3</code></pre>

<h2>PodDisruptionBudgets: Voluntary Disruption Control</h2>
<p>When a node is drained (for maintenance or scaling down), Kubernetes evicts its Pods. Without a PodDisruptionBudget (PDB), Kubernetes might evict all replicas of a service simultaneously:</p>
<pre><code>apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: orders-service-pdb
spec:
  minAvailable: 2          # always keep at least 2 pods running
  # Or: maxUnavailable: 1  # allow at most 1 pod to be disrupted at a time
  selector:
    matchLabels:
      app: orders-service</code></pre>

<h2>Resource Quotas and LimitRanges</h2>
<p>In multi-team clusters, resource quotas prevent one team from consuming all cluster capacity:</p>
<pre><code>apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-a-quota
  namespace: team-a
spec:
  hard:
    requests.cpu: "10"
    requests.memory: "20Gi"
    limits.cpu: "20"
    limits.memory: "40Gi"
    pods: "50"
    services: "10"
    persistentvolumeclaims: "20"

---
apiVersion: v1
kind: LimitRange
metadata:
  name: team-a-limits
  namespace: team-a
spec:
  limits:
  - default:          # default limit if container doesn't specify
      cpu: "500m"
      memory: "256Mi"
    defaultRequest:   # default request if container doesn't specify
      cpu: "100m"
      memory: "128Mi"
    type: Container</code></pre>

<h2>GitOps with ArgoCD</h2>
<p>GitOps treats your Git repository as the single source of truth for cluster state. ArgoCD continuously reconciles the cluster state with the desired state in Git — any drift is automatically corrected:</p>
<pre><code>apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: orders-service
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/example/k8s-manifests.git
    targetRevision: HEAD
    path: apps/orders-service/production
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true      # delete resources removed from Git
      selfHeal: true   # revert manual kubectl changes
    syncOptions:
    - CreateNamespace=true</code></pre>

<p>The operational complexity of Kubernetes is justified when you need: sophisticated traffic management (canary deployments, A/B testing), autoscaling at the cluster level (Cluster Autoscaler or Karpenter), multi-region failover, or running many services from multiple teams on shared infrastructure. For single-service applications or small teams, the simpler alternatives are often the right choice. The underlying container images run in K8s are built using the patterns from our <a href="/blog/docker-containers-production">Docker in production guide</a>.</p>`,
  },

  // POST 18
  {
    title: 'WebSockets in Production: Real-Time Architecture That Actually Scales',
    slug: 'websockets-production-realtime',
    date: '2025-09-09T10:00:00',
    category: 'Backend',
    tags: ['WebSockets', 'Real-Time', 'Node.js', 'Scalability'],
    unsplashQuery: 'network data stream communication',
    internalLinks: ['building-resilient-microservices-go', 'event-driven-architecture-guide', 'cloudflare-workers-edge-computing'],
    content: `<h2>When WebSockets Are the Right Tool</h2>
<p>WebSockets enable bidirectional, persistent connections between client and server — the browser can receive messages from the server at any time without polling. They are the right choice for: live collaborative editing, multiplayer games, real-time dashboards, chat applications, and any scenario where server-pushed updates need to arrive within milliseconds.</p>
<p>However, WebSockets are frequently over-applied. If your "real-time" feature actually just needs updates every 10 seconds, polling with <code>setInterval</code> or Server-Sent Events (SSE) is simpler, more cache-friendly, and works better behind HTTP/2 proxies. Reserve WebSockets for genuinely bidirectional, latency-sensitive communication.</p>

<h2>The WebSocket Lifecycle</h2>
<p>A WebSocket connection starts as an HTTP request and upgrades via the <code>Upgrade: websocket</code> handshake. After the upgrade, it is a TCP connection — no HTTP overhead, full-duplex, with a lightweight framing protocol for messages:</p>
<pre><code>// Client
const ws = new WebSocket('wss://api.example.com/ws');

ws.addEventListener('open', () => {
  console.log('Connected');
  ws.send(JSON.stringify({ type: 'subscribe', channel: 'orders:user-123' }));
});

ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  handleMessage(message);
});

ws.addEventListener('close', (event) => {
  console.log('Disconnected:', event.code, event.reason);
  // Reconnect with exponential backoff
  scheduleReconnect();
});

ws.addEventListener('error', (error) => {
  console.error('WebSocket error:', error);
});

// Reconnection with exponential backoff
let reconnectDelay = 1000;
function scheduleReconnect() {
  setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    connect();
  }, reconnectDelay + Math.random() * 1000); // add jitter
}</code></pre>

<h2>Server Implementation with Node.js and ws</h2>
<pre><code>import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { parse } from 'url';

const server = createServer();
const wss = new WebSocketServer({ server, path: '/ws' });

// Track clients by their subscription channels
const channels = new Map&lt;string, Set&lt;WebSocket&gt;&gt;();

interface AuthenticatedWebSocket extends WebSocket {
  userId: string;
  isAlive: boolean;
  subscriptions: Set&lt;string&gt;;
}

wss.on('connection', async (ws: AuthenticatedWebSocket, req) => {
  // Authenticate via JWT in query param or cookie
  const url = parse(req.url!, true);
  const token = url.query.token as string;

  try {
    const payload = verifyToken(token);
    ws.userId = payload.sub;
    ws.isAlive = true;
    ws.subscriptions = new Set();
  } catch {
    ws.close(4001, 'Unauthorized');
    return;
  }

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleClientMessage(ws, msg);
    } catch {
      ws.send(JSON.stringify({ type: 'error', code: 'INVALID_JSON' }));
    }
  });

  ws.on('close', () => {
    // Unsubscribe from all channels
    for (const channel of ws.subscriptions) {
      channels.get(channel)?.delete(ws);
    }
  });
});

function handleClientMessage(ws: AuthenticatedWebSocket, msg: any) {
  switch (msg.type) {
    case 'subscribe':
      subscribeToChannel(ws, msg.channel);
      break;
    case 'unsubscribe':
      unsubscribeFromChannel(ws, msg.channel);
      break;
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
  }
}

function subscribeToChannel(ws: AuthenticatedWebSocket, channel: string) {
  // Authorization check
  if (!canAccessChannel(ws.userId, channel)) {
    ws.send(JSON.stringify({ type: 'error', code: 'FORBIDDEN', channel }));
    return;
  }

  if (!channels.has(channel)) channels.set(channel, new Set());
  channels.get(channel)!.add(ws);
  ws.subscriptions.add(channel);

  ws.send(JSON.stringify({ type: 'subscribed', channel }));
}

// Broadcast to a channel
export function broadcast(channel: string, message: object) {
  const subscribers = channels.get(channel);
  if (!subscribers) return;

  const data = JSON.stringify(message);
  for (const client of subscribers) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// Heartbeat: detect dead connections
const heartbeatInterval = setInterval(() => {
  for (const ws of wss.clients as Set&lt;AuthenticatedWebSocket&gt;) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);</code></pre>

<h2>Scaling WebSockets Horizontally</h2>
<p>The fundamental scaling problem: WebSocket connections are stateful and pinned to a specific server instance. When you run 5 server instances behind a load balancer, a broadcast to a channel must reach clients connected to all 5 instances. Two approaches:</p>
<p><strong>Redis Pub/Sub</strong> is the standard solution for Node.js clusters:</p>
<pre><code>import { createClient } from 'redis';

const publisher = createClient({ url: process.env.REDIS_URL });
const subscriber = createClient({ url: process.env.REDIS_URL });

await publisher.connect();
await subscriber.connect();

// Subscribe to the Redis channel on startup
await subscriber.subscribe('ws-broadcast', (message) => {
  const { channel, data } = JSON.parse(message);
  // Deliver to local WebSocket clients subscribed to this channel
  broadcastLocal(channel, data);
});

// Publish a message — reaches all server instances
export async function broadcast(channel: string, message: object) {
  await publisher.publish('ws-broadcast', JSON.stringify({ channel, data: message }));
}</code></pre>

<p><strong>Sticky sessions</strong> are an alternative: the load balancer routes a client to the same server instance on every connection (based on client IP or a cookie). Simpler, but uneven load distribution and a single instance going down disconnects all its clients.</p>

<h2>Message Protocol Design</h2>
<p>Design your WebSocket message protocol with versioning and a clear envelope:</p>
<pre><code>interface WsMessage {
  id: string;       // client-generated, for request/response correlation
  type: string;     // 'subscribe' | 'event' | 'error' | 'pong' etc.
  v: number;        // protocol version
  payload: unknown;
  ts: number;       // server timestamp (Unix ms)
}

// Server-to-client event
const orderUpdated: WsMessage = {
  id: crypto.randomUUID(),
  type: 'order:updated',
  v: 1,
  payload: {
    orderId: 'ord-123',
    status: 'shipped',
    trackingNumber: '1Z999AA1',
  },
  ts: Date.now(),
};</code></pre>

<h2>Alternatives: Server-Sent Events</h2>
<p>For purely server-to-client streams (dashboards, notifications, live feeds), Server-Sent Events (SSE) is simpler than WebSockets and works over HTTP/2 multiplexing:</p>
<pre><code>// Express SSE endpoint
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',  // disable Nginx buffering
  });

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\\n\\n');  // comment line keeps connection alive
  }, 15000);

  const cleanup = subscribeToUserEvents(req.user.id, (event) => {
    res.write(\`id: \${event.id}\\n\`);
    res.write(\`event: \${event.type}\\n\`);
    res.write(\`data: \${JSON.stringify(event.payload)}\\n\\n\`);
  });

  req.on('close', () => {
    clearInterval(heartbeat);
    cleanup();
  });
});</code></pre>

<p>SSE has built-in reconnection and Last-Event-ID header support for resuming missed events — features you have to implement manually with WebSockets. For a real-time architecture that spans multiple regions, combining WebSockets with the edge computing approach from our <a href="/blog/cloudflare-workers-edge-computing">Cloudflare Workers guide</a> reduces connection latency significantly — Cloudflare's Durable Objects are particularly well-suited for WebSocket state management at the edge.</p>`,
  },

  // POST 19
  {
    title: 'Monorepos with Turborepo: Structure, Caching, and CI Optimization',
    slug: 'monorepo-turborepo-guide',
    date: '2025-10-14T09:00:00',
    category: 'DevOps',
    tags: ['Monorepo', 'Turborepo', 'npm workspaces', 'CI/CD', 'Build'],
    unsplashQuery: 'organized files folders structure',
    internalLinks: ['design-systems-at-scale', 'git-workflows-team', 'testing-strategies-web-applications'],
    content: `<h2>The Case For and Against Monorepos</h2>
<p>A monorepo houses multiple packages or projects in a single version-controlled repository. This is the approach used by Google (all code in one repo), Meta, Microsoft (TypeScript, VS Code), and Vercel (Next.js ecosystem). The alternative — one repository per package — is called a polyrepo or multi-repo approach.</p>
<p>Monorepos excel at: sharing code between packages without publishing to npm, atomic commits that span multiple packages, unified tooling and CI/CD configuration, and making cross-package refactoring tractable. They struggle with: long clone/checkout times for large codebases, CI pipelines that naively run everything on every commit, and the tooling complexity required to make builds fast.</p>
<p>Turborepo solves the CI performance problem with intelligent task orchestration and remote caching. This guide covers setting up a production-quality monorepo with Turborepo, npm workspaces, and the CI configuration that keeps builds fast as the repo grows.</p>

<h2>Repository Structure</h2>
<p>A well-organized monorepo distinguishes between applications (deployed things) and packages (shared libraries):</p>
<pre><code>my-monorepo/
├── apps/
│   ├── web/              # Next.js web application
│   ├── mobile/           # React Native application
│   ├── admin/            # Admin dashboard
│   └── api/              # Express/Fastify API server
├── packages/
│   ├── ui/               # Shared component library
│   ├── design-tokens/    # Design tokens
│   ├── utils/            # Shared utility functions
│   ├── config/
│   │   ├── eslint/       # Shared ESLint config
│   │   ├── tsconfig/     # Shared TypeScript configs
│   │   └── prettier/     # Shared Prettier config
│   └── database/         # Prisma schema + client
├── package.json          # Root workspace config
├── turbo.json            # Turborepo pipeline
└── pnpm-workspace.yaml   # pnpm workspace definition</code></pre>

<h2>Workspace Configuration</h2>
<pre><code>// package.json (root)
{
  "name": "my-monorepo",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0"
  },
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "test": "turbo test",
    "lint": "turbo lint",
    "type-check": "turbo type-check"
  },
  "packageManager": "pnpm@9.0.0"
}</code></pre>

<pre><code>// packages/ui/package.json
{
  "name": "@company/ui",
  "version": "1.0.0",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts",
    "dev": "tsup src/index.ts --format esm,cjs --dts --watch",
    "test": "vitest run",
    "lint": "eslint src"
  },
  "peerDependencies": {
    "react": ">=18"
  },
  "devDependencies": {
    "@company/tsconfig": "workspace:*",
    "tsup": "^8.0.0"
  }
}</code></pre>

<h2>Turborepo Pipeline Configuration</h2>
<p>The <code>turbo.json</code> pipeline defines task dependencies and caching behavior. Turborepo uses this to determine execution order and whether cached results can be used:</p>
<pre><code>{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],  // build deps first (topological order)
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"],
      "cache": true
    },
    "test": {
      "dependsOn": ["^build"],  // tests need packages to be built
      "outputs": ["coverage/**"],
      "cache": true,
      "env": ["NODE_ENV", "DATABASE_URL"]  // cache key includes these env vars
    },
    "lint": {
      "outputs": [],
      "cache": true
    },
    "type-check": {
      "dependsOn": ["^build"],
      "outputs": [],
      "cache": true
    },
    "dev": {
      "dependsOn": ["^build"],
      "cache": false,    // never cache dev servers
      "persistent": true // long-running process
    }
  }
}</code></pre>

<p>The <code>^build</code> syntax means "the build task of all dependencies." If <code>apps/web</code> depends on <code>packages/ui</code>, Turborepo ensures <code>packages/ui</code> builds before <code>apps/web</code>. If neither has changed since the last run, both are restored from cache instantly.</p>

<h2>Remote Caching: The Game-Changer for CI</h2>
<p>Local caching speeds up individual developer builds. Remote caching extends this to your entire team and CI pipeline — one developer's build cache is available to all other developers and CI runners:</p>
<pre><code># Link your repo to Vercel Remote Cache (free for open source, paid for teams)
npx turbo login
npx turbo link

# Or use self-hosted remote cache with Turborepo API (open source)
# turbo.json
{
  "remoteCache": {
    "enabled": true,
    "apiUrl": "https://your-cache-server.example.com",
    "teamId": "your-team"
  }
}</code></pre>

<p>In practice, remote caching reduces CI build times from 10–15 minutes to 30–60 seconds for typical pull requests that change only a subset of packages — because only the changed packages and their dependents need to be rebuilt.</p>

<h2>Filtering: Run Tasks for Specific Packages</h2>
<pre><code># Run only for the web app and its deps
npx turbo build --filter=@company/web

# Run for packages that have changed since main
npx turbo test --filter=[main]

# Run for a specific package and everything that depends on it
npx turbo test --filter=...@company/ui

# Run for packages affected by specific files
npx turbo test --filter=[HEAD^1]</code></pre>

<h2>Optimized CI/CD Pipeline</h2>
<pre><code># .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0  # needed for --filter=[main] comparisons

    - uses: pnpm/action-setup@v3
      with:
        version: 9

    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'pnpm'

    - run: pnpm install --frozen-lockfile

    - name: Build, test, lint (with remote cache)
      run: npx turbo build test lint type-check --filter=[main]
      env:
        TURBO_TOKEN: \${{ secrets.TURBO_TOKEN }}
        TURBO_TEAM: \${{ vars.TURBO_TEAM }}

    - name: Upload coverage
      uses: codecov/codecov-action@v4
      with:
        directory: '**/coverage'</code></pre>

<h2>Package Boundaries and Dependency Rules</h2>
<p>Monorepos require discipline about which packages can import which. Without rules, you end up with circular dependencies and a big ball of mud. Use ESLint's <code>import/no-restricted-imports</code> or a custom rule to enforce the dependency graph:</p>
<pre><code>// apps/web cannot import from apps/api (cross-app imports are forbidden)
// packages/* can only import from other packages/* (not apps/*)
// All packages can use @company/utils and @company/config/*

// .eslintrc.js (root)
module.exports = {
  rules: {
    'import/no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['*/apps/*'],
          message: 'Apps cannot import from other apps. Extract to a package.',
        },
      ],
    }],
  },
};</code></pre>

<p>Managing a design system in a monorepo — where the design system package lives in <code>packages/ui</code> and multiple apps consume it — is covered in our <a href="/blog/design-systems-at-scale">design systems guide</a>. The Git workflow considerations for monorepos, including branch protection on large repos, are covered in our <a href="/blog/git-workflows-team">Git workflows guide</a>.</p>`,
  },

  // POST 20
  {
    title: 'Error Handling Patterns in TypeScript: From Exceptions to Typed Results',
    slug: 'error-handling-patterns',
    date: '2025-11-11T09:00:00',
    category: 'Backend',
    tags: ['TypeScript', 'Error Handling', 'Patterns', 'Architecture'],
    unsplashQuery: 'warning error system alert',
    internalLinks: ['typescript-generics-advanced', 'api-design-rest-graphql-trpc', 'testing-strategies-web-applications'],
    content: `<h2>Why try/catch Fails at Scale</h2>
<p>JavaScript's <code>try/catch</code> is a runtime mechanism with no type-level representation. A function that throws can be called by a developer who does not know it throws, and the TypeScript compiler will not warn them. The error propagates up the call stack invisibly until it either crashes the application or is caught by a top-level handler that has lost all context about what went wrong.</p>
<p>This is not a TypeScript limitation — TypeScript intentionally does not type thrown exceptions because JavaScript exceptions are dynamic. Any throw site can throw anything, and annotating them would create a false sense of safety. The real solution is to make errors part of the function's return type, not a side-channel.</p>

<h2>The Result Type Pattern</h2>
<p>Borrowed from Rust (<code>Result&lt;T, E&gt;</code>) and Haskell (<code>Either</code>), the Result type makes error handling explicit in the type system:</p>
<pre><code>// Base Result type
type Result&lt;T, E = Error&gt; =
  | { ok: true; value: T }
  | { ok: false; error: E };

// Constructor helpers
const Ok = &lt;T&gt;(value: T): Result&lt;T, never&gt; => ({ ok: true, value });
const Err = &lt;E&gt;(error: E): Result&lt;never, E&gt; => ({ ok: false, error });

// Usage: now the caller MUST handle the error case
async function getUserById(id: string): Promise&lt;Result&lt;User, 'NOT_FOUND' | 'DB_ERROR'&gt;&gt; {
  try {
    const user = await db.users.findById(id);
    if (!user) return Err('NOT_FOUND');
    return Ok(user);
  } catch (e) {
    console.error('Database error:', e);
    return Err('DB_ERROR');
  }
}

// At the call site — TypeScript enforces the check
const result = await getUserById('user-123');

if (!result.ok) {
  switch (result.error) {
    case 'NOT_FOUND': return res.status(404).json({ error: 'User not found' });
    case 'DB_ERROR': return res.status(503).json({ error: 'Service unavailable' });
    // TypeScript errors if you forget a case (exhaustiveness checking)
  }
}

// result.value is User here — TypeScript knows
const user = result.value;</code></pre>

<h2>Typed Error Hierarchies</h2>
<p>When you do use exceptions (appropriate for truly unexpected errors — bugs, programming mistakes), create a typed hierarchy that carries structured information:</p>
<pre><code>// Base application error
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly context?: Record&lt;string, unknown&gt;,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
    // Capture stack trace for V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        context: this.context,
      },
    };
  }
}

// Domain-specific errors
class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly fields: Record&lt;string, string[]&gt;,
  ) {
    super(message, 'VALIDATION_ERROR', 400, { fields });
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 'FORBIDDEN', 403);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(\`\${resource} not found: \${id}\`, 'NOT_FOUND', 404, { resource, id });
  }
}

class ConflictError extends AppError {
  constructor(message: string, context?: Record&lt;string, unknown&gt;) {
    super(message, 'CONFLICT', 409, context);
  }
}

// Type guard for AppError
function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}</code></pre>

<h2>Global Error Handler in Express</h2>
<p>A centralized error handler converts errors to consistent HTTP responses and logs them appropriately:</p>
<pre><code>import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Log all errors with context
  const requestContext = {
    method: req.method,
    path: req.path,
    requestId: req.headers['x-request-id'],
    userId: req.user?.id,
  };

  if (isAppError(err)) {
    // Expected application errors — log at warn or info level
    if (err.statusCode >= 500) {
      logger.error({ err, ...requestContext }, 'Application error');
    } else {
      logger.warn({ err, ...requestContext }, 'Client error');
    }
    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  // Unexpected errors — log at error level with full stack
  logger.error({ err, ...requestContext }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : (err as Error).message,
    },
  });
}</code></pre>

<h2>Error Boundaries in React</h2>
<p>React Error Boundaries catch rendering errors in the component tree and display a fallback UI instead of crashing the entire application:</p>
<pre><code>'use client';

import { Component, ReactNode } from 'react';

interface Props {
  fallback: (error: Error, reset: () => void) => ReactNode;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component&lt;Props, State&gt; {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Send to error tracking service
    captureError(error, { extra: { componentStack: info.componentStack } });
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback(this.state.error, this.reset);
    }
    return this.props.children;
  }
}

// Next.js 13+ app router also supports error.tsx:
// app/products/error.tsx
'use client';
export default function ProductsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    &lt;div role="alert"&gt;
      &lt;h2&gt;Something went wrong loading products&lt;/h2&gt;
      &lt;button onClick={reset}&gt;Try again&lt;/button&gt;
    &lt;/div&gt;
  );
}</code></pre>

<h2>Async Error Handling Patterns</h2>
<pre><code>// Utility: wrap async route handlers to eliminate try/catch boilerplate
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise&lt;void&gt;
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);  // passes error to Express error handler
  };
}

// Clean route handler with no try/catch
router.post('/users', asyncHandler(async (req, res) => {
  const result = CreateUserSchema.safeParse(req.body);
  if (!result.success) throw new ValidationError('Invalid input', result.error.flatten().fieldErrors);

  const existing = await userService.findByEmail(result.data.email);
  if (existing) throw new ConflictError('Email already in use', { email: result.data.email });

  const user = await userService.create(result.data);
  res.status(201).json({ data: user });
}));

// Never swallow errors silently
// WRONG:
async function doSomething() {
  try {
    await riskyOperation();
  } catch {} // This is a bug: the error is invisible

// RIGHT:
async function doSomething() {
  try {
    await riskyOperation();
  } catch (e) {
    // Either handle it, rethrow it, or log it
    logger.error({ err: e }, 'riskyOperation failed');
    throw e;  // rethrow so the caller knows
  }
}</code></pre>

<h2>Error Observability: Sentry Integration</h2>
<pre><code>import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,  // 10% of transactions
  beforeSend(event, hint) {
    const error = hint.originalException;
    // Don't send expected client errors to Sentry (too noisy)
    if (isAppError(error) && error.statusCode < 500) return null;
    return event;
  },
});</code></pre>

<p>Testing error handling is as important as testing the happy path. Every error case in your application should have a corresponding test that verifies the correct error code, status code, and (where applicable) the error context. Our guide on <a href="/blog/testing-strategies-web-applications">testing strategies</a> covers how to test error boundaries and API error responses effectively.</p>`,
  },

  // POST 21
  {
    title: 'Working with Claude Code: Multi-Agent Workflows, Code Review, and Best Practices',
    slug: 'claude-code-multi-agent-workflows',
    date: '2026-03-10T10:00:00',
    category: 'AI Tools',
    tags: ['Claude Code', 'AI', 'Developer Tools', 'Multi-Agent', 'Productivity'],
    unsplashQuery: 'artificial intelligence technology abstract',
    internalLinks: ['git-workflows-team', 'testing-strategies-web-applications', 'monorepo-turborepo-guide'],
    content: `<h2>Claude Code in 2025: Beyond the Autocomplete Paradigm</h2>
<p>Claude Code, Anthropic's official CLI for Claude, has evolved far beyond tab-completion or single-file generation. As of 2025, it is a full-featured agentic development environment that can autonomously plan and execute multi-step engineering tasks, orchestrate networks of parallel sub-agents, run hooks that integrate with your CI/CD pipeline, and serve as the reasoning layer connecting specialized tools through the Model Context Protocol (MCP). This guide covers the complete feature set as it stands in 2025 and provides practical patterns for integrating Claude Code into a professional software engineering workflow.</p>

<h2>The CLAUDE.md File: Your Project's AI Constitution</h2>
<p>Every serious Claude Code project starts with a <code>CLAUDE.md</code> file in the repository root. This Markdown file is automatically loaded by Claude Code at the start of every session — it is the mechanism for encoding project-specific knowledge that Claude would otherwise have to rediscover through exploration on every session:</p>
<pre><code># CLAUDE.md

## Project Overview
This is a Next.js 14 application with a Prisma/PostgreSQL backend.
TypeScript strict mode is enabled. We use pnpm workspaces.

## Key Commands
- \`pnpm dev\` — start development server
- \`pnpm test\` — run Vitest tests (not Jest)
- \`pnpm build\` — production build (must pass before any PR)
- \`pnpm db:migrate\` — run pending database migrations
- \`pnpm db:studio\` — open Prisma Studio

## Architecture Decisions
- All database access goes through \`src/lib/db/\` — never import Prisma client directly in components
- Server Components are default; add 'use client' only when necessary
- Error handling uses the Result type pattern (see \`src/lib/result.ts\`)
- All API routes use Zod for input validation

## Code Conventions
- Prefer named exports over default exports
- Tests live next to their source files (\`foo.ts\` + \`foo.test.ts\`)
- Commit messages follow Conventional Commits

## What NOT to Do
- Do not run \`npm install\` — we use pnpm
- Do not modify \`prisma/schema.prisma\` without running a migration
- Do not add dependencies without checking bundle size impact</code></pre>

<p>CLAUDE.md files support subdirectory scoping: a <code>packages/ui/CLAUDE.md</code> is loaded automatically when Claude Code is working in that directory, providing context specific to that package. In large monorepos, this lets each team maintain their own AI conventions without polluting the root file.</p>

<h2>Plan Mode: Think Before Acting</h2>
<p>Plan mode (activated with the <code>--plan</code> flag or the <code>/plan</code> command) instructs Claude Code to reason through a task and present a structured execution plan before making any file changes. This is the right default for complex or risky tasks:</p>
<pre><code># Activate plan mode
claude --plan "Refactor the authentication system to use Lucia Auth instead of next-auth"

# Interactive plan mode in a session
/plan Migrate the users table to add soft deletes and update all queries accordingly</code></pre>

<p>In plan mode, Claude Code presents numbered steps, identifies files that will be modified, flags potential risks, and asks for confirmation before proceeding. For architectural changes that touch many files, plan mode is invaluable — it surfaces assumptions and potential conflicts before any destructive changes are made.</p>

<h2>Multi-Agent Orchestration</h2>
<p>Claude Code's most powerful 2025 feature is its multi-agent system. The orchestrator model (your primary Claude Code session) can spawn sub-agents that execute tasks in parallel, dramatically reducing wall-clock time for complex operations. Sub-agents run in isolated contexts and return structured results to the orchestrator.</p>
<p>The canonical use case: you are building a new feature that requires changes across the frontend, backend API, database schema, and documentation. Instead of doing these sequentially, the orchestrator decomposes the task and parallelizes it:</p>
<pre><code># From within Claude Code, orchestrate parallel sub-agents
# Claude Code will automatically use sub-agents when the task scope warrants it

"Add a notifications feature including:
1. A notifications table in the database with migration
2. A REST API endpoint at GET /api/notifications and POST /api/notifications/:id/read
3. A NotificationBell component in the navbar that polls the API
4. Unit tests for the API handler
5. Update the API documentation in docs/api.md"</code></pre>

<p>Claude Code's orchestrator analyzes this task, identifies that steps 1–2 can be done in parallel with step 5 (docs don't depend on implementation), and that step 3 depends on step 2 (component needs the API to exist). It then assigns work to sub-agents accordingly, maintaining a dependency graph that ensures correctness.</p>
<p>Sub-agents inherit the CLAUDE.md context and have access to the same tools (Bash, file editing, search) as the orchestrator. They can themselves spawn further sub-agents, enabling arbitrarily deep task decomposition — though in practice, 2–3 levels of nesting is sufficient for most engineering tasks.</p>

<h2>Hooks: Integrating with Your Development Pipeline</h2>
<p>Claude Code hooks are scripts that execute at defined points in Claude Code's lifecycle. They are defined in <code>.claude/hooks.json</code> and enable deep integration with your project's tooling:</p>
<pre><code>// .claude/hooks.json
{
  "hooks": {
    "post-edit": [
      {
        "name": "lint-changed-files",
        "command": "pnpm eslint --fix {changed_files}",
        "when": "always"
      },
      {
        "name": "format",
        "command": "pnpm prettier --write {changed_files}",
        "when": "always"
      }
    ],
    "post-task": [
      {
        "name": "run-tests",
        "command": "pnpm test --run --reporter=verbose",
        "when": "tests_exist"
      },
      {
        "name": "type-check",
        "command": "pnpm tsc --noEmit",
        "when": "always"
      }
    ],
    "pre-commit": [
      {
        "name": "full-build",
        "command": "pnpm build",
        "when": "on_commit_request"
      }
    ]
  }
}</code></pre>

<p>Hooks make Claude Code self-correcting: if a post-edit lint hook returns errors, Claude Code reads those errors and automatically fixes them before moving on. This dramatically reduces the "fix one thing, break another" cycle that plagues large automated refactors.</p>

<h2>The /review Command: AI-Powered Code Review</h2>
<p>The <code>/review</code> command runs a structured code review against your staged changes or a specified diff. Unlike asking Claude Code to "look at this code," <code>/review</code> has a defined rubric: correctness, security, performance, test coverage, and consistency with the codebase's existing patterns:</p>
<pre><code># Review staged changes
/review

# Review a specific file
/review src/api/auth.ts

# Review a GitHub PR
/review https://github.com/owner/repo/pull/456

# Review with a specific focus
/review --focus security src/api/
/review --focus performance src/lib/db/</code></pre>

<p>The output is structured Markdown with severity levels (Critical, High, Medium, Low, Info) and specific line references. Critical and High items must be addressed before the review is considered passed. The <code>/review</code> command respects your CLAUDE.md conventions — it will flag code that violates patterns documented there as Medium-severity findings.</p>

<h2>MCP Servers: Connecting Claude Code to Your Tooling</h2>
<p>The Model Context Protocol (MCP) is Anthropic's open protocol for connecting AI models to external tools and data sources. Claude Code ships with support for MCP servers out of the box, and a growing ecosystem of servers is available for common developer tools:</p>
<pre><code># .claude/mcp.json — configure MCP servers for this project
{
  "servers": {
    "github": {
      "command": "mcp-server-github",
      "args": [],
      "env": {
        "GITHUB_TOKEN": "\${GITHUB_TOKEN}"
      }
    },
    "postgres": {
      "command": "mcp-server-postgres",
      "args": ["postgresql://localhost:5432/mydb"]
    },
    "filesystem": {
      "command": "mcp-server-filesystem",
      "args": ["/Users/developer/projects/myapp/docs"]
    },
    "slack": {
      "command": "mcp-server-slack",
      "env": { "SLACK_BOT_TOKEN": "\${SLACK_BOT_TOKEN}" }
    }
  }
}</code></pre>

<p>With the GitHub MCP server configured, Claude Code can: read issue details, create PRs, fetch PR review comments, and query workflow run results — all without leaving the terminal. With the Postgres server, it can query your development database to understand the actual data shape when writing or debugging queries.</p>
<p>You can write custom MCP servers for your internal tools. Any capability expressible as a function with typed inputs and outputs can be exposed as an MCP tool. Internal deployment pipelines, feature flag systems, incident management platforms, and proprietary data sources have all been integrated via custom MCP servers.</p>

<h2>Git Worktrees: Parallel Work Without Context Switching</h2>
<p>Claude Code's worktree integration allows you to work on multiple branches simultaneously without stashing or committing half-finished work. Worktrees create separate working directories linked to the same repository:</p>
<pre><code># Create a worktree for a new feature
claude worktree create feature/payment-redesign

# Claude Code opens a new session in the worktree
# You can have multiple terminal tabs with different worktrees

# List active worktrees
claude worktree list

# This is equivalent to:
git worktree add ../myapp-payment-redesign feature/payment-redesign</code></pre>

<p>In a multi-agent workflow, the orchestrator can assign sub-agents to different worktrees, enabling true parallel development on independent features without the overhead of separate repository clones. The sub-agent working on the API endpoint and the sub-agent working on the frontend component each have their own working tree, so they never conflict on file edits.</p>

<h2>Background Tasks and the Task Queue</h2>
<p>Long-running tasks — large refactors, comprehensive test generation, documentation updates — can be dispatched as background tasks that run without blocking your current session:</p>
<pre><code># Dispatch a background task
claude task create "Generate comprehensive JSDoc documentation for all public functions in src/lib/"

# Check task status
claude task list
claude task get &lt;task-id&gt;

# View task output
claude task logs &lt;task-id&gt;</code></pre>

<p>Background tasks run in a separate process, allowing you to continue working while Claude Code handles the tedious parts. When a task completes (or fails), you receive a notification. The task queue persists across terminal sessions — you can start a documentation task, close your laptop, and check the results the next day.</p>

<h2>Practical Workflows for Professional Development</h2>

<h3>The Feature Development Workflow</h3>
<p>A productive Claude Code workflow for a new feature:</p>
<ol>
  <li>Open a GitHub issue or write a brief spec — Claude Code can read both.</li>
  <li>Run <code>/plan</code> with the feature description. Review and approve the plan.</li>
  <li>Let Claude Code execute, with hooks automatically running lint, format, and tests after each edit.</li>
  <li>Run <code>/review</code> on the completed changes. Address any Critical/High findings.</li>
  <li>Ask Claude Code to write or improve the commit message in Conventional Commits format.</li>
</ol>

<h3>The Legacy Code Refactoring Workflow</h3>
<p>Refactoring legacy code with Claude Code:</p>
<pre><code># First, have Claude Code characterize the code
"Read src/legacy/payment-processor.js and describe what it does,
what its dependencies are, and what test coverage it currently has"

# Then plan the refactor
/plan Refactor payment-processor.js to TypeScript with proper error handling

# Use the sub-agent system for large refactors
"Refactor all JavaScript files in src/legacy/ to TypeScript.
For each file: preserve exact behavior, add proper types, add unit tests.
Do these in parallel where possible."</code></pre>

<h3>The Code Review Workflow</h3>
<p>Integrate Claude Code into your team's PR review process:</p>
<pre><code># Review a PR before adding your own comments
/review https://github.com/org/repo/pull/789

# Ask specific questions about a PR
"What are the performance implications of the changes in this PR?
Are there any race conditions in the async code?"

# Have Claude Code draft review comments
"Draft GitHub review comments for the security issues you found.
Format them as actionable suggestions with code examples."</code></pre>

<h2>Context Management: Working Within the Token Window</h2>
<p>Claude Code's context window is large but finite. For large codebases, managing what information is in context is important for both quality and cost:</p>
<ul>
  <li><strong>Use specific file references</strong>: "Read <code>src/api/orders.ts</code>" is better than "look at the orders code" — Claude Code loads only what you specify.</li>
  <li><strong>Leverage CLAUDE.md</strong>: document architecture decisions in CLAUDE.md so Claude Code doesn't need to re-discover them from code every session.</li>
  <li><strong>Use sub-agents for isolated tasks</strong>: sub-agents start with fresh contexts, preventing context pollution between unrelated tasks.</li>
  <li><strong>Compact long conversations</strong>: the <code>/compact</code> command summarizes the current conversation and discards intermediate messages, preserving the important conclusions while freeing context space.</li>
</ul>

<h2>Security Considerations</h2>
<p>Claude Code executes Bash commands, reads files, and makes network requests — it has significant access to your development environment. Treat it with appropriate security awareness:</p>
<ul>
  <li>Review any <code>curl</code>, <code>wget</code>, or other network-fetching commands before approving them.</li>
  <li>Use the <code>--allowlist</code> flag to restrict which commands Claude Code can run in sensitive environments.</li>
  <li>Never include production credentials in CLAUDE.md or the project directory — use environment variables and <code>.gitignore</code>.</li>
  <li>MCP server tokens should be in environment variables, never hardcoded in <code>.claude/mcp.json</code>.</li>
  <li>In multi-agent workflows, sub-agents inherit the orchestrator's permissions — be thoughtful about what you grant.</li>
</ul>

<h2>Measuring Productivity Impact</h2>
<p>Teams using Claude Code effectively report 2–4x speedup on routine tasks (writing tests, documentation, boilerplate), 30–50% reduction in the "discovery" phase of unfamiliar codebases, and significantly fewer "works on my machine" issues because the hooks enforce consistency. The highest-leverage uses are: comprehensive test generation for untested code, large-scale automated refactoring (TypeScript migrations, API version upgrades), and cross-referencing multiple documentation sources to answer architectural questions.</p>
<p>The lowest-leverage use is trying to have Claude Code write complex, novel business logic from scratch. It excels as a force-multiplier for skilled engineers, not as a replacement for domain expertise. Use it to eliminate mechanical work so you can focus on the decisions that actually require human judgment. The Git workflow integration discussed in our <a href="/blog/git-workflows-team">Git workflows guide</a> pairs naturally with Claude Code's commit and PR creation features.</p>`,
  },
];


const frPosts = [
  // POST FR-1
  {
    title: 'Comprendre WebAssembly : Guide Pratique pour les Développeurs Web',
    slug: 'comprendre-webassembly-guide-pratique',
    date: '2024-04-08T09:00:00',
    category: 'Développement Web',
    tags: ['WebAssembly', 'Rust', 'Performance', 'JavaScript'],
    unsplashQuery: 'circuit board microchip',
    internalLinks: ['construire-microservices-resilients-go', 'cloudflare-workers-edge-computing-fr', 'core-web-vitals-performance-fr'],
    content: `<h2>Qu'est-ce que WebAssembly et pourquoi est-ce important ?</h2>
<p>WebAssembly (Wasm) est un format d'instruction binaire conçu comme cible de compilation portable pour des langages de haut niveau tels que Rust, C, C++ et Go. Depuis sa standardisation en 2019 par le W3C, il a fondamentalement transformé ce qui est possible à l'intérieur d'un navigateur web. Contrairement à JavaScript, langage dynamique et interprété soumis à des variations imprévisibles de compilation JIT, le code WebAssembly est compact, validé en amont et s'exécute à une vitesse quasi-native dès la première instruction.</p>
<p>La promesse fondamentale est simple mais profonde : écrire du code critique en performances dans un langage système, le compiler en un binaire <code>.wasm</code> binaire, et exécuter ce binaire dans n'importe quel navigateur ou runtime Wasm sans plugins, sans extensions natives ni élévation de privilèges. Cela signifie que votre pipeline de traitement d'images, votre moteur physique ou votre bibliothèque cryptographique peuvent tourner à des vitesses auparavant réservées au code natif spécifique à une plateforme.</p>
<h2>Quand se tourner vers WebAssembly ?</h2>
<p>WebAssembly ne remplace pas JavaScript. Il le complète. Le choix entre les deux est une décision architecturale guidée par votre goulot d'étranglement :</p>
<ul>
  <li><strong>Calculs intensifs en CPU</strong> : transformées FFT, encodage vidéo, traitement de maillages 3D, inférence de modèles — ces cas bénéficient énormément de Wasm.</li>
  <li><strong>Portage de bibliothèques C/C++ existantes</strong> : SQLite, libpng, zlib et OpenSSL ont tous été compilés en Wasm, rendant disponibles dans le navigateur de grandes bases de code éprouvées sans réécriture.</li>
  <li><strong>Latence prévisible</strong> : les pauses GC de JavaScript peuvent atteindre 10–50 ms. Wasm n'a pas de surcharge GC pour le code écrit en Rust, ce qui le rend idéal pour le traitement audio en temps réel ou les moteurs de jeu.</li>
  <li><strong>Manipulation du DOM et logique simple</strong> : JavaScript gagne encore ici. Le coût de franchissement de la frontière JS–Wasm annule tout gain pour des opérations déjà rapides.</li>
</ul>
<h2>Mettre en place un projet Rust + WebAssembly</h2>
<p>Rust dispose de la meilleure chaîne d'outils Wasm disponible. L'outil <code>wasm-pack</code> compile votre crate Rust en Wasm, génère des liaisons JavaScript et produit un package compatible npm que vous pouvez importer comme n'importe quel autre module.</p>
<pre><code># Installer les prérequis
curl https://sh.rustup.rs -sSf | sh
cargo install wasm-pack

# Créer une nouvelle crate de bibliothèque
cargo new --lib wasm-traitement-image
cd wasm-traitement-image</code></pre>
<p>Dans <code>Cargo.toml</code>, déclarez le type de crate et les dépendances :</p>
<pre><code>[lib]
crate-type = ["cdylib"]

[dependencies]
wasm-bindgen = "0.2"
image = "0.24"

[profile.release]
opt-level = "z"
lto = true</code></pre>
<p>Voici l'implémentation Rust avec une fonction de conversion en niveaux de gris :</p>
<pre><code>use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn niveau_de_gris(data: &amp;[u8], largeur: u32, hauteur: u32) -&gt; Vec&lt;u8&gt; {
    let mut sortie = Vec::with_capacity(data.len());
    for pixel in data.chunks(4) {
        let r = pixel[0] as f32;
        let g = pixel[1] as f32;
        let b = pixel[2] as f32;
        let a = pixel[3];
        // Coefficients de luminance BT.709
        let luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) as u8;
        sortie.extend_from_slice(&amp;[luma, luma, luma, a]);
    }
    sortie
}

#[wasm_bindgen]
pub fn fibonacci(n: u32) -&gt; u64 {
    let mut a = 0u64;
    let mut b = 1u64;
    for _ in 0..n {
        let tmp = a + b;
        a = b;
        b = tmp;
    }
    a
}</code></pre>
<p>Compilez et empaquetez avec : <code>wasm-pack build --target web --release</code></p>
<h2>Intégrer le module Wasm dans JavaScript</h2>
<p>Après la compilation, <code>wasm-pack</code> produit un répertoire <code>pkg/</code> contenant un binaire <code>.wasm</code>, un wrapper JavaScript et des définitions TypeScript :</p>
<pre><code>import init, { niveau_de_gris, fibonacci } from './pkg/wasm_traitement_image.js';

async function main() {
  await init();

  const canvas = document.getElementById('source');
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const resultat = niveau_de_gris(imageData.data, canvas.width, canvas.height);

  const sortie = ctx.createImageData(canvas.width, canvas.height);
  sortie.data.set(resultat);
  ctx.putImageData(sortie, 0, 0);

  console.log('fib(50):', fibonacci(50));
}
main();</code></pre>
<h2>Gestion de la mémoire et la frontière JS–Wasm</h2>
<p>L'un des pièges les plus courants est de mal comprendre comment les données sont partagées entre JavaScript et WebAssembly. Ils ne partagent pas de tas — les données doivent être copiées dans la mémoire linéaire de Wasm. Pour les grands tampons, ce coût peut être significatif. La solution consiste à allouer de la mémoire dans Wasm et laisser JavaScript écrire directement :</p>
<pre><code>#[wasm_bindgen]
pub struct ProcesseurImage {
    tampon: Vec&lt;u8&gt;,
}

#[wasm_bindgen]
impl ProcesseurImage {
    pub fn new(capacite: usize) -&gt; Self {
        Self { tampon: Vec::with_capacity(capacite) }
    }
    pub fn ptr_tampon(&amp;mut self) -&gt; *mut u8 {
        self.tampon.as_mut_ptr()
    }
    pub fn traiter(&amp;mut self, longueur: usize) -&gt; Vec&lt;u8&gt; {
        unsafe { self.tampon.set_len(longueur); }
        self.tampon.clone()
    }
}</code></pre>
<h2>Benchmarks de performance réels</h2>
<p>Sur un MacBook Pro M2, traitement d'une image 4K (3840×2160, ~31 Mo RGBA) :</p>
<ul>
  <li><strong>JavaScript (boucle pixel Canvas API)</strong> : 420 ms</li>
  <li><strong>WebAssembly (Rust, mode release)</strong> : 18 ms</li>
  <li><strong>Binaire natif (même code Rust)</strong> : 11 ms</li>
</ul>
<p>L'implémentation Wasm est 23 fois plus rapide que l'équivalent JavaScript et atteint 61 % des performances natives. Pour Fibonacci jusqu'à n=45, l'itératif Wasm est 47 fois plus rapide que le récursif JavaScript.</p>
<h2>WebAssembly au-delà du navigateur : WASI</h2>
<p>L'interface système WebAssembly (WASI) étend Wasm aux environnements serveur et edge. Avec WASI, un seul binaire <code>.wasm</code> peut tourner sur le laptop d'un développeur, un Cloudflare Worker, ou un appareil IoT sans recompilation. Des frameworks comme Spin (Fermyon) et le runtime wasmtime facilitent la création d'applications WASI. En savoir plus dans notre guide sur <a href="/fr/blog/cloudflare-workers-edge-computing-fr">Cloudflare Workers et le calcul edge</a>.</p>
<h2>Déboguer WebAssembly</h2>
<p>Les DevTools modernes de Chrome et Firefox supportent les source maps pour Rust et C++, permettant de placer des points d'arrêt dans votre code source original. La crate <code>console_error_panic_hook</code> est indispensable en développement — elle redirige les panics Rust vers la console du navigateur avec une trace de pile lisible.</p>
<pre><code># Dans Cargo.toml
[profile.release]
debug = true  # inclure les infos DWARF dans les builds release</code></pre>
<h2>Le modèle de composants Wasm</h2>
<p>Le modèle de composants Wasm (implémentations dans wasmtime et jco) vise à résoudre la composition de modules Wasm avec des types complexes. Aujourd'hui, la frontière ne comprend que des nombres. Le modèle de composants ajoute des interfaces WIT (Wasm Interface Types) permettant aux modules écrits dans différents langages de s'appeler mutuellement avec des types riches — chaînes, enregistrements, options — sans code de liaison manuel.</p>
<h2>Tirer le meilleur parti de Wasm aujourd'hui</h2>
<p>Commencez par un goulot d'étranglement concret mesuré par profiling. Portez la partie chaude vers Rust, compilez avec <code>wasm-pack</code>, et comparez avec votre référence JavaScript. Combinez Wasm avec des runtimes edge pour des gains cumulatifs. Consultez notre guide sur les <a href="/fr/blog/construire-microservices-resilients-go">microservices résilients avec Go</a> pour des stratégies d'architecture complémentaires, et les <a href="/fr/blog/core-web-vitals-performance-fr">Core Web Vitals</a> pour mesurer l'impact sur les métriques utilisateur réelles.</p>`,
  },
  // POST FR-2
  {
    title: 'Construire des Microservices Résilients avec Go',
    slug: 'construire-microservices-resilients-go',
    date: '2024-05-14T10:00:00',
    category: 'Backend',
    tags: ['Go', 'Microservices', 'Architecture', 'Systèmes Distribués'],
    unsplashQuery: 'server room data center',
    internalLinks: ['docker-conteneurs-production', 'kubernetes-guide-production', 'architecture-event-driven-guide'],
    content: `<h2>Pourquoi Go pour les microservices ?</h2>
<p>Go a été conçu chez Google précisément pour le type de travail d'infrastructure que les microservices exigent. Son modèle de compilation produit de petits binaires à liaison statique avec des temps de démarrage mesurés en millisecondes — propriété critique quand Kubernetes peut reprogrammer vos pods des dizaines de fois par jour. Le scheduler de goroutines gère des dizaines de milliers de connexions concurrentes sur du matériel modeste, rendant triviale l'écriture de services à fort débit et efficaces en mémoire.</p>
<p>Par rapport aux langages JVM, un binaire Go utilise 5–10 fois moins de mémoire au repos et démarre 10–50 fois plus vite. Par rapport aux langages interprétés comme Python ou Ruby, il exécute les tâches intensives en CPU 10–100 fois plus vite sans la complexité des extensions natives. La simplicité délibérée du langage — pas d'héritage, pas de surcharge d'opérateurs — signifie que tout développeur Go compétent peut lire et modifier n'importe quelle base de code Go.</p>
<h2>Structure de projet pour un microservice en production</h2>
<p>Évitez l'anti-pattern du "paquet plat". Un microservice Go bien structuré suit une organisation pilotée par le domaine :</p>
<pre><code>orders-service/
├── cmd/
│   └── server/
│       └── main.go          # point d'entrée, câblage des dépendances
├── internal/
│   ├── domain/
│   │   ├── order.go         # types centraux, aucune dépendance externe
│   │   └── repository.go    # définitions d'interfaces
│   ├── handler/
│   │   └── http.go          # gestionnaires HTTP
│   ├── service/
│   │   └── orders.go        # logique métier
│   └── store/
│       └── postgres.go      # implémentation du repository
├── pkg/
│   └── middleware/
└── Dockerfile</code></pre>
<p>Le répertoire <code>internal/</code> impose l'encapsulation au niveau du compilateur — aucun autre module ne peut importer ces packages. C'est le garde-fou architectural intégré de Go.</p>
<h2>Le pattern Disjoncteur (Circuit Breaker)</h2>
<p>Dans un système distribué, un service en aval qui répond lentement est souvent plus dangereux que celui qui échoue rapidement. Les réponses lentes mobilisent des goroutines, épuisent les pools de connexions et déclenchent une panne en cascade. Le pattern disjoncteur résout ce problème en suivant le taux d'échec et en ouvrant le circuit quand le seuil est dépassé :</p>
<pre><code>type Etat int

const (
    EtatFerme   Etat = iota
    EtatOuvert
    EtatMiOuvert
)

type Disjoncteur struct {
    mu          sync.Mutex
    etat        Etat
    echecs      int
    seuil       int
    reinitApres time.Duration
    ouvertA     time.Time
}

func (d *Disjoncteur) Executer(fn func() error) error {
    d.mu.Lock()
    if d.etat == EtatOuvert {
        if time.Since(d.ouvertA) &gt; d.reinitApres {
            d.etat = EtatMiOuvert
            d.echecs = 0
        } else {
            d.mu.Unlock()
            return fmt.Errorf("disjoncteur ouvert")
        }
    }
    d.mu.Unlock()

    err := fn()

    d.mu.Lock()
    defer d.mu.Unlock()
    if err != nil {
        d.echecs++
        if d.echecs &gt;= d.seuil {
            d.etat = EtatOuvert
            d.ouvertA = time.Now()
        }
        return err
    }
    d.echecs = 0
    d.etat = EtatFerme
    return nil
}</code></pre>
<h2>Observabilité avec OpenTelemetry</h2>
<p>Un microservice sans observabilité est une boîte noire. OpenTelemetry (OTel) est le standard de l'industrie pour les traces, métriques et logs. Son SDK Go s'intègre proprement avec le modèle de contexte du langage :</p>
<pre><code>import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/trace"
)

var traceur = otel.Tracer("orders-service")

func (s *ServiceCommandes) ObtenirCommande(ctx context.Context, id string) (*domain.Commande, error) {
    ctx, span := traceur.Start(ctx, "ObtenirCommande",
        trace.WithAttributes(attribute.String("commande.id", id)),
    )
    defer span.End()

    commande, err := s.repo.Trouver(ctx, id)
    if err != nil {
        span.RecordError(err)
        span.SetStatus(codes.Error, err.Error())
        return nil, fmt.Errorf("récupération commande %s : %w", id, err)
    }
    return commande, nil
}</code></pre>
<h2>Health checks et readiness probes</h2>
<p>Kubernetes utilise les health checks pour décider quand rediriger du trafic vers votre pod. Implémentez des endpoints <code>/healthz</code> (liveness) et <code>/readyz</code> (readiness) distincts :</p>
<pre><code>func (s *Serveur) HandleReadyz(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
    defer cancel()

    if err := s.db.PingContext(ctx); err != nil {
        http.Error(w, "base de données non disponible", http.StatusServiceUnavailable)
        return
    }
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"status": "prêt"})
}</code></pre>
<h2>Graceful shutdown</h2>
<p>Un microservice doit se terminer proprement sur SIGTERM : finir les requêtes en cours, fermer les connexions, vider les buffers de métriques :</p>
<pre><code>func main() {
    srv := &amp;http.Server{Addr: ":8080", Handler: router}

    arret := make(chan os.Signal, 1)
    signal.Notify(arret, syscall.SIGTERM, syscall.SIGINT)

    go func() {
        if err := srv.ListenAndServe(); err != http.ErrServerClosed {
            log.Fatalf("serveur HTTP : %v", err)
        }
    }()

    &lt;-arret
    log.Println("arrêt en cours...")

    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    if err := srv.Shutdown(ctx); err != nil {
        log.Fatalf("arrêt forcé : %v", err)
    }
    log.Println("serveur arrêté proprement")
}</code></pre>
<h2>Tests d'intégration avec testcontainers-go</h2>
<p>Les tests unitaires avec des mocks sont utiles, mais les tests d'intégration contre une vraie base de données PostgreSQL détectent une tout autre classe de bugs. <code>testcontainers-go</code> démarre des conteneurs Docker directement dans vos tests :</p>
<pre><code>func TestRepositoryCommandes(t *testing.T) {
    ctx := context.Background()

    conteneurPg, err := postgres.RunContainer(ctx,
        testcontainers.WithImage("postgres:16-alpine"),
        postgres.WithDatabase("testdb"),
        postgres.WithUsername("test"),
        postgres.WithPassword("test"),
        testcontainers.WithWaitStrategy(
            wait.ForLog("database system is ready to accept connections"),
        ),
    )
    require.NoError(t, err)
    defer conteneurPg.Terminate(ctx)

    dsn, _ := conteneurPg.ConnectionString(ctx, "sslmode=disable")
    repo := store.NewRepositoryPostgres(dsn)

    commande := &amp;domain.Commande{ID: "cmd-001", Montant: 9999}
    err = repo.Sauvegarder(ctx, commande)
    require.NoError(t, err)

    trouvee, err := repo.Trouver(ctx, "cmd-001")
    require.NoError(t, err)
    assert.Equal(t, commande.Montant, trouvee.Montant)
}</code></pre>
<h2>Dockerfile multi-étapes optimisé</h2>
<p>Un Dockerfile optimisé pour Go utilise la construction multi-étapes pour produire un binaire minimal :</p>
<pre><code>FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server ./cmd/server

FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/server /server
EXPOSE 8080
ENTRYPOINT ["/server"]</code></pre>
<p>L'image finale basée sur <code>scratch</code> fait moins de 20 Mo, contient uniquement le binaire et les certificats TLS, sans surface d'attaque shell. Consultez notre guide sur <a href="/fr/blog/docker-conteneurs-production">Docker en production</a> pour les stratégies de réseau et d'orchestration, et notre article sur l'<a href="/fr/blog/architecture-event-driven-guide">architecture event-driven</a> pour connecter vos microservices de manière asynchrone.</p>`,
  },
  // POST FR-3
  {
    title: 'CSS Grid Avancé : Au-delà des Bases',
    slug: 'css-grid-avance-mise-en-page',
    date: '2024-06-03T08:30:00',
    category: 'Frontend',
    tags: ['CSS', 'Grid', 'Mise en page', 'Responsive Design'],
    unsplashQuery: 'web design layout grid',
    internalLinks: ['systemes-design-a-echelle', 'core-web-vitals-performance-fr', 'animations-ui-motion-design'],
    content: `<h2>Repenser la mise en page avec CSS Grid</h2>
<p>CSS Grid a transformé la façon dont les développeurs front-end construisent des interfaces. Ce n'est plus une question de hacks avec des floats ou de contournements Flexbox — Grid est un système de mise en page bidimensionnel natif, conçu précisément pour la complexité des interfaces modernes. Mais la majorité des développeurs s'arrête aux patterns les plus simples : <code>grid-template-columns: repeat(3, 1fr)</code>. Ce guide explore les capacités avancées qui permettent de construire des mises en page impossibles avec tout autre outil CSS.</p>
<h2>Placement explicite vs placement automatique</h2>
<p>Le placement automatique de Grid est pratique, mais le placement explicite est là où réside la puissance. Comprendre la différence est la première étape vers des mises en page sophistiquées :</p>
<pre><code>.grille-magazine {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-template-rows: auto;
  gap: 1.5rem;
}

/* Article principal : 8 colonnes, 2 rangées */
.article-vedette {
  grid-column: 1 / 9;
  grid-row: 1 / 3;
}

/* Barre latérale : colonnes 9 à 12 */
.barre-laterale {
  grid-column: 9 / -1;
  grid-row: 1 / 4;
}

/* Articles secondaires */
.article-secondaire {
  grid-column: span 4;
}</code></pre>
<h2>Zones nommées : la mise en page déclarative</h2>
<p>La propriété <code>grid-template-areas</code> vous permet de "dessiner" votre mise en page en ASCII art directement dans vos styles :</p>
<pre><code>.mise-en-page-app {
  display: grid;
  grid-template-columns: 240px 1fr 320px;
  grid-template-rows: 64px 1fr 48px;
  grid-template-areas:
    "entete  entete  entete"
    "nav     contenu panneau"
    "pied    pied    pied";
  min-height: 100vh;
}

.entete  { grid-area: entete; }
.nav     { grid-area: nav; }
.contenu { grid-area: contenu; }
.panneau { grid-area: panneau; }
.pied    { grid-area: pied; }

@media (max-width: 768px) {
  .mise-en-page-app {
    grid-template-columns: 1fr;
    grid-template-rows: 64px auto 1fr 48px;
    grid-template-areas:
      "entete"
      "nav"
      "contenu"
      "pied";
  }
  .panneau { display: none; }
}</code></pre>
<h2>subgrid : alignement dans les grilles imbriquées</h2>
<p><code>subgrid</code> est disponible dans tous les navigateurs majeurs. Il permet aux enfants d'un élément de grille de s'aligner sur les pistes de la grille parente — résolvant le cauchemar de l'alignement de cartes imbriquées :</p>
<pre><code>.grille-cartes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.carte {
  display: grid;
  grid-row: span 4;
  grid-template-rows: subgrid;
  border: 1px solid var(--couleur-bordure);
  border-radius: 0.5rem;
  overflow: hidden;
}

/* Résultat : tous les titres s'alignent horizontalement
   peu importe la longueur du texte des rangées précédentes */</code></pre>
<h2>Fonctions de sizing avancées</h2>
<p>Les fonctions <code>min()</code>, <code>max()</code> et <code>clamp()</code> transforment la définition des tailles de colonnes, rendant votre grille intrinsèquement responsive sans media queries :</p>
<pre><code>/* Colonnes jamais &lt; 200px ni &gt; 400px */
.grille-fluide {
  grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
}

/* Grille avec contenu principal proportionnel */
.grille-contenu {
  grid-template-columns:
    minmax(1rem, 1fr)
    minmax(0, clamp(320px, 65ch, 800px))
    minmax(0, 240px)
    minmax(1rem, 1fr);
}</code></pre>
<h2>Animations de mise en page avec Grid</h2>
<p>Chrome, Firefox et Safari supportent désormais les transitions sur <code>grid-template-columns</code> et <code>grid-template-rows</code>, ouvrant des possibilités créatives inédites :</p>
<pre><code>.panneau-extensible {
  display: grid;
  grid-template-columns: 200px 1fr;
  transition: grid-template-columns 300ms ease;
}

.panneau-extensible.reduit {
  grid-template-columns: 48px 1fr;
}

/* Accordéon animé sans JavaScript */
.accordeon {
  display: grid;
  grid-template-rows: auto 0fr;
  transition: grid-template-rows 250ms ease;
}

.accordeon.ouvert {
  grid-template-rows: auto 1fr;
}

.accordeon__contenu {
  overflow: hidden; /* requis pour l'animation 0fr vers 1fr */
}</code></pre>
<h2>Patterns utilitaires réutilisables</h2>
<p>Quelques utilitaires Grid qui résolvent des problèmes courants de manière élégante :</p>
<pre><code>/* Centrage parfait, toujours */
.centrage-absolu {
  display: grid;
  place-items: center;
}

/* Empilement d'éléments au même endroit */
.pile {
  display: grid;
}
.pile &gt; * {
  grid-area: 1 / 1;
}

/* Holy grail layout en 3 lignes */
.holy-grail {
  display: grid;
  grid-template: auto 1fr auto / auto 1fr auto;
  min-height: 100vh;
}</code></pre>
<h2>Débogage avec les DevTools navigateur</h2>
<p>Les DevTools de Chrome, Firefox et Edge intègrent des inspecteurs Grid visuels. Cliquez sur l'icône "grid" dans le panneau Éléments pour superposer les numéros de lignes, les noms de zones et les espaces de gouttière directement sur la page. Firefox propose l'inspecteur le plus avancé, incluant la visualisation des grilles imbriquées et des subgrids.</p>
<h2>Grilles masonry avec CSS Grid Level 3</h2>
<p>La spec CSS Grid Level 3 introduit <code>grid-template-rows: masonry</code> pour un véritable layout en cascade sans JavaScript. Firefox supporte cette fonctionnalité derrière un flag, les autres navigateurs devraient suivre prochainement. En attendant, la solution avec <code>columns</code> CSS reste viable pour des layouts simples.</p>
<p>La maîtrise de CSS Grid transforme votre capacité à traduire des designs en code. Combinez ces techniques avec notre <a href="/fr/blog/systemes-design-a-echelle">guide sur les systèmes de design</a> pour construire des bibliothèques de composants cohérentes. Pour l'impact sur les performances, consultez notre article sur les <a href="/fr/blog/core-web-vitals-performance-fr">Core Web Vitals</a>, et notre guide sur les <a href="/fr/blog/animations-ui-motion-design">animations UI</a> pour animer vos transitions de mise en page avec finesse.</p>`,
  },
  // POST FR-4
  {
    title: 'Sécuriser les API REST : Authentification, Autorisation et Checklist Complète',
    slug: 'securiser-api-rest-checklist',
    date: '2024-07-22T11:00:00',
    category: 'Sécurité',
    tags: ['API', 'Sécurité', 'Authentification', 'JWT', 'OAuth'],
    unsplashQuery: 'cybersecurity lock network',
    internalLinks: ['conception-api-rest-graphql-trpc', 'typescript-generiques-avances', 'patterns-gestion-erreurs'],
    content: `<h2>Pourquoi la sécurité des API est plus complexe qu'il n'y paraît</h2>
<p>Les API REST exposées sur Internet sont la cible de la grande majorité des attaques applicatives modernes. Contrairement aux applications web traditionnelles où le navigateur impose certaines protections, les API sont consultées par des clients variés — applications mobiles, services tiers, scripts automatisés — ce qui élargit considérablement la surface d'attaque. Une seule vulnérabilité peut exposer des données sensibles de millions d'utilisateurs ou permettre à un attaquant de prendre le contrôle de votre infrastructure.</p>
<p>Ce guide couvre les vecteurs d'attaque les plus courants, les patterns de défense éprouvés, et se termine par une checklist opérationnelle que vous pouvez appliquer immédiatement à vos APIs existantes.</p>
<h2>Authentification : au-delà des mots de passe</h2>
<p>L'authentification répond à la question "qui êtes-vous ?". Pour les APIs, les tokens sont préférables aux sessions car ils sont stateless et s'intègrent naturellement dans des architectures microservices.</p>
<h3>JWT : avantages, pièges et meilleures pratiques</h3>
<p>Les JSON Web Tokens sont omniprésents mais souvent mal implémentés. Les erreurs fatales les plus courantes :</p>
<pre><code>// DANGEREUX : accepter l'algorithme "none"
// Un attaquant peut envoyer un JWT avec alg: "none" et aucune signature

// CORRECT : spécifier explicitement les algorithmes acceptés
const payload = jwt.verify(token, secret, {
  algorithms: ['HS256'],  // ou ['RS256'] pour asymétrique
  issuer: 'https://auth.votreapp.com',
  audience: 'api.votreapp.com',
});

// Vérifier l'expiration (exp) et l'émission (iat)
if (payload.iat &lt; Date.now() / 1000 - 3600) {
  throw new Error('Token trop ancien, re-authentification requise');
}</code></pre>
<p>Durées de vie recommandées : access token 15 minutes, refresh token 7 jours (avec rotation). Stockez les refresh tokens en base de données pour permettre la révocation.</p>
<h3>OAuth 2.0 et PKCE pour les applications publiques</h3>
<p>Pour les applications mobiles et SPA où le secret client ne peut pas être protégé, utilisez le flux Authorization Code avec PKCE :</p>
<pre><code>// Côté client : générer le code_verifier et code_challenge
const codeVerifier = crypto.randomBytes(32).toString('base64url');
const codeChallenge = crypto
  .createHash('sha256')
  .update(codeVerifier)
  .digest('base64url');

// Rediriger vers l'authorization endpoint
const params = new URLSearchParams({
  response_type: 'code',
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  code_challenge: codeChallenge,
  code_challenge_method: 'S256',
  state: crypto.randomBytes(16).toString('hex'), // protection CSRF
});
window.location.href = \`\${AUTH_URL}/authorize?\${params}\`;</code></pre>
<h2>Autorisation : contrôle d'accès basé sur les rôles et attributs</h2>
<p>L'autorisation répond à "qu'avez-vous le droit de faire ?". Implémentez toujours l'autorisation au niveau de la couche service, jamais uniquement au niveau de la route :</p>
<pre><code>// Middleware d'autorisation basé sur les rôles
function exigerRole(...roles) {
  return (req, res, next) => {
    const rolesUtilisateur = req.user.roles || [];
    const aAcces = roles.some(r => rolesUtilisateur.includes(r));
    if (!aAcces) {
      return res.status(403).json({
        error: 'Accès refusé',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }
    next();
  };
}

// Autorisation au niveau ressource (ownership check)
async function verifierPropriete(req, res, next) {
  const ressource = await db.trouver(req.params.id);
  if (!ressource) return res.status(404).json({ error: 'Introuvable' });
  if (ressource.proprietaireId !== req.user.id) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  req.ressource = ressource;
  next();
}</code></pre>
<h2>Protection contre les injections</h2>
<p>Les injections SQL restent dans le top 3 des vulnérabilités OWASP. La défense est simple : ne jamais construire des requêtes par concaténation de chaînes :</p>
<pre><code>// DANGEREUX
const requete = \`SELECT * FROM users WHERE email = '\${email}'\`;

// CORRECT : requêtes paramétrées
const utilisateur = await db.query(
  'SELECT * FROM users WHERE email = $1 AND actif = $2',
  [email, true]
);

// Avec un ORM (Prisma)
const utilisateur = await prisma.user.findUnique({
  where: { email, actif: true },
});
</code></pre>
<p>Pour les injections NoSQL (MongoDB), validez et castez vos entrées avant de les passer au driver :</p>
<pre><code>// Valider avec zod avant toute requête
const SchemaRecherche = z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(150).optional(),
});
const params = SchemaRecherche.parse(req.body);
const result = await collection.findOne(params); // types garantis</code></pre>
<h2>Rate limiting et protection contre les abus</h2>
<p>Sans rate limiting, votre API est vulnérable au brute-force, au credential stuffing et aux attaques DoS applicatives. Implémentez plusieurs niveaux de limitation :</p>
<pre><code>import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 req/min
});

// Différents seuils selon le type d'endpoint
const limiteConnexion = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(5, '15 m'), // 5 tentatives / 15 min
});

export async function middleware(req) {
  const identifiant = req.ip ?? 'anonymous';
  const { success, reset } = await ratelimit.limit(identifiant);

  if (!success) {
    return new Response('Trop de requêtes', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)) },
    });
  }
}</code></pre>
<h2>En-têtes de sécurité HTTP</h2>
<p>Configurez ces en-têtes sur toutes vos réponses API :</p>
<pre><code>// Configuration Express / Next.js
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0'); // désactiver : le CSP est supérieur
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Cache-Control', 'no-store'); // pour les endpoints authentifiés
  res.removeHeader('X-Powered-By');
  next();
});</code></pre>
<h2>Checklist de sécurité API</h2>
<p>Avant tout déploiement en production, vérifiez ces points :</p>
<ul>
  <li>Authentification : tous les endpoints non-publics exigent un token valide</li>
  <li>Autorisation : vérification d'ownership sur chaque ressource</li>
  <li>Validation des entrées : schémas stricts (zod, Joi) sur toutes les routes</li>
  <li>Rate limiting : implémenté côté serveur (pas uniquement côté client)</li>
  <li>HTTPS uniquement : redirection 301 depuis HTTP, HSTS activé</li>
  <li>Secrets : dans les variables d'environnement, jamais dans le code</li>
  <li>Logging sécurisé : aucune donnée sensible (mots de passe, tokens) dans les logs</li>
  <li>Dépendances : audit npm/cargo/pip régulier, Dependabot activé</li>
  <li>Erreurs génériques : messages d'erreur identiques pour "utilisateur inconnu" et "mauvais mot de passe"</li>
</ul>
<p>Pour aller plus loin sur la conception d'APIs robustes, lisez notre comparatif <a href="/fr/blog/conception-api-rest-graphql-trpc">REST, GraphQL et tRPC</a>. La gestion des erreurs de sécurité est couverte en détail dans notre guide sur les <a href="/fr/blog/patterns-gestion-erreurs">patterns de gestion d'erreurs en TypeScript</a>.</p>`,
  },
  // POST FR-5
  {
    title: 'React Server Components : Ce qui Change, Ce qui Reste, et les Implications pour Votre Architecture',
    slug: 'react-server-components-implications-architecture',
    date: '2024-08-19T09:00:00',
    category: 'Frontend',
    tags: ['React', 'Next.js', 'Server Components', 'Performance'],
    unsplashQuery: 'code on screen developer',
    internalLinks: ['core-web-vitals-performance-fr', 'typescript-generiques-avances', 'conception-api-rest-graphql-trpc'],
    content: `<h2>La rupture paradigmatique des React Server Components</h2>
<p>Les React Server Components (RSC) représentent le changement architectural le plus important dans l'écosystème React depuis l'introduction des Hooks en 2018. Mais contrairement aux Hooks, qui ont simplifié la gestion de l'état local, les RSC remettent en question un postulat fondamental : que tout composant React doit être capable de s'exécuter dans le navigateur. Cette hypothèse sous-tendait chaque décision de performance des six dernières années — code splitting, lazy loading, hydratation partielle. Les RSC la rendent obsolète pour une large portion des composants d'interface.</p>
<p>Ce guide explique précisément ce qui change, ce qui ne change pas, et comment adapter une architecture Next.js existante pour en tirer le meilleur parti.</p>
<h2>Qu'est-ce qu'un Server Component ?</h2>
<p>Un Server Component est un composant React qui s'exécute exclusivement sur le serveur. Il n'est jamais envoyé au navigateur sous forme de JavaScript — seul son output HTML est transmis. Conséquences directes :</p>
<ul>
  <li>Accès direct aux bases de données, fichiers, APIs internes sans passer par une route API</li>
  <li>Zéro JavaScript ajouté au bundle client pour ce composant</li>
  <li>Aucun état local, aucun effet de bord (<code>useState</code>, <code>useEffect</code> interdits)</li>
  <li>Possibilité d'utiliser des secrets (clés API) directement dans le composant</li>
</ul>
<pre><code>// app/produits/page.tsx — Server Component par défaut dans Next.js App Router
import { db } from '@/lib/db';

export default async function PageProduits() {
  // Accès direct à la base de données — aucune API route nécessaire
  const produits = await db.produit.findMany({
    where: { publie: true },
    include: { categorie: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    &lt;ul&gt;
      {produits.map(p =&gt; (
        &lt;li key={p.id}&gt;
          &lt;h2&gt;{p.nom}&lt;/h2&gt;
          &lt;p&gt;{p.categorie.nom}&lt;/p&gt;
        &lt;/li&gt;
      ))}
    &lt;/ul&gt;
  );
}
</code></pre>
<h2>Règles de composition Server/Client</h2>
<p>La règle la plus importante et la plus souvent mal comprise : <strong>un Server Component peut importer un Client Component, mais un Client Component ne peut pas importer un Server Component</strong>. En revanche, un Client Component peut recevoir un Server Component comme enfant via <code>children</code> :</p>
<pre><code>// Correct : passer un Server Component en tant qu'enfant
// app/layout.tsx
import PanneauInteractif from './PanneauInteractif'; // Client Component
import ListeStatique from './ListeStatique';         // Server Component

export default function Layout() {
  return (
    &lt;PanneauInteractif&gt;
      &lt;ListeStatique /&gt; {/* Server Component passé comme enfant — OK */}
    &lt;/PanneauInteractif&gt;
  );
}

// PanneauInteractif.tsx
'use client';

export default function PanneauInteractif({ children }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    &lt;div&gt;
      &lt;button onClick={() =&gt; setOuvert(!ouvert)}&gt;Basculer&lt;/button&gt;
      {ouvert &amp;&amp; children}
    &lt;/div&gt;
  );
}</code></pre>
<h2>Stratégies de data fetching avec l'App Router</h2>
<p>Next.js 14+ offre plusieurs niveaux de cache pour les données fetchées dans les Server Components :</p>
<pre><code>// Cache permanent (rendu statique)
const data = await fetch('https://api.exemple.com/config', {
  cache: 'force-cache',
});

// Revalidation toutes les heures (ISR)
const articles = await fetch('https://api.exemple.com/articles', {
  next: { revalidate: 3600 },
});

// Données fraîches à chaque requête
const panier = await fetch('https://api.exemple.com/panier', {
  cache: 'no-store',
  headers: { Authorization: \`Bearer \${session.token}\` },
});

// Plusieurs fetches en parallèle
const [utilisateur, commandes] = await Promise.all([
  fetchUtilisateur(session.userId),
  fetchCommandes(session.userId),
]);</code></pre>
<h2>Streaming et Suspense</h2>
<p>Les Server Components s'intègrent nativement avec React Suspense pour le streaming progressif. Le contenu lent n'est plus un bloquant — il arrive quand il est prêt :</p>
<pre><code>// app/tableau-de-bord/page.tsx
import { Suspense } from 'react';
import StatistiquesRapides from './StatistiquesRapides';
import GraphiqueDetaille from './GraphiqueDetaille';
import SqueletteGraphique from './SqueletteGraphique';

export default function TableauDeBord() {
  return (
    &lt;div&gt;
      {/* Chargé immédiatement */}
      &lt;Suspense fallback={&lt;p&gt;Chargement...&lt;/p&gt;}&gt;
        &lt;StatistiquesRapides /&gt;
      &lt;/Suspense&gt;

      {/* Streamé quand disponible, squelette affiché entre-temps */}
      &lt;Suspense fallback={&lt;SqueletteGraphique /&gt;}&gt;
        &lt;GraphiqueDetaille /&gt;
      &lt;/Suspense&gt;
    &lt;/div&gt;
  );
}</code></pre>
<h2>Ce qui ne change pas</h2>
<p>Plusieurs concepts restent inchangés et c'est important à comprendre pour ne pas sur-complexifier votre migration :</p>
<ul>
  <li><strong>Client Components</strong> : tout ce qui utilise <code>useState</code>, <code>useEffect</code>, event handlers, APIs navigateur reste un Client Component avec <code>'use client'</code></li>
  <li><strong>CSS et styles</strong> : CSS Modules, Tailwind, styled-components fonctionnent identiquement</li>
  <li><strong>Bibliothèques tierces</strong> : la plupart des bibliothèques de composants (shadcn/ui, Radix) sont des Client Components, ce qui est parfaitement normal</li>
  <li><strong>Testing</strong> : les Server Components async se testent avec <code>await renderToString()</code>, les Client Components avec React Testing Library comme avant</li>
</ul>
<h2>Migration progressive depuis le Pages Router</h2>
<p>Next.js supporte la coexistence du Pages Router et de l'App Router dans le même projet. Migrez page par page, en commençant par les pages sans état client :</p>
<pre><code># Structure de migration progressive
app/
  layout.tsx          # nouveau layout global
  (marketing)/        # groupe de routes — pages statiques
    page.tsx
    about/page.tsx
  dashboard/          # pages avec auth — migrer en dernier
    page.tsx

pages/                # pages existantes non encore migrées
  old-feature.tsx</code></pre>
<h2>Patterns d'erreurs courants à éviter</h2>
<p>Les erreurs les plus fréquentes lors de l'adoption des RSC :</p>
<ul>
  <li>Marquer trop de composants avec <code>'use client'</code> par précaution — chaque Client Component boundary coupe l'arbre serveur</li>
  <li>Fetch en cascade (waterfall) dans des composants imbriqués — utilisez <code>Promise.all</code> ou remontez les fetches</li>
  <li>Passer des fonctions non-sérialisables (callbacks) comme props d'un Server à un Client Component</li>
  <li>Oublier que <code>cookies()</code> et <code>headers()</code> de Next.js sont des fonctions dynamiques qui désactivent le cache statique</li>
</ul>
<p>Les Server Components changent fondamentalement la façon de penser les performances React. Pour mesurer l'impact concret sur vos métriques, consultez notre guide sur les <a href="/fr/blog/core-web-vitals-performance-fr">Core Web Vitals</a>. Pour les patterns TypeScript dans les Server Components, notre article sur les <a href="/fr/blog/typescript-generiques-avances">génériques TypeScript avancés</a> couvre les cas d'usage les plus complexes.</p>`,
  },
  // POST FR-6
  {
    title: 'Stratégies d\'Indexation en Base de Données : Des Requêtes Lentes aux Réponses en Millisecondes',
    slug: 'strategies-indexation-base-de-donnees',
    date: '2024-09-10T10:00:00',
    category: 'Backend',
    tags: ['Base de données', 'PostgreSQL', 'Performance', 'SQL'],
    unsplashQuery: 'database server storage',
    internalLinks: ['construire-microservices-resilients-go', 'patterns-gestion-erreurs', 'conception-api-rest-graphql-trpc'],
    content: `<h2>Pourquoi les requêtes lentes tuent les applications en production</h2>
<p>Une requête qui prend 2 secondes sur une table de 1 000 lignes peut prendre 45 secondes sur la même table avec 10 millions de lignes si elle n'est pas correctement indexée. Cette dégradation non-linéaire surprend systématiquement les équipes qui testent uniquement sur des jeux de données réduits. Comprendre les index — quand les créer, quel type choisir, et comment éviter qu'ils deviennent un problème eux-mêmes — est la compétence de performance base de données la plus rentable qu'un développeur puisse acquérir.</p>
<p>Ce guide se concentre sur PostgreSQL, mais les principes s'appliquent à MySQL/MariaDB et à la plupart des bases relationnelles.</p>
<h2>Comprendre EXPLAIN ANALYZE</h2>
<p>Avant de créer le moindre index, exécutez <code>EXPLAIN ANALYZE</code> sur vos requêtes lentes. C'est la seule source de vérité :</p>
<pre><code>EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT u.email, COUNT(o.id) as nb_commandes
FROM utilisateurs u
LEFT JOIN commandes o ON o.utilisateur_id = u.id
WHERE u.cree_le &gt; NOW() - INTERVAL '30 jours'
  AND u.pays = 'FR'
GROUP BY u.id
ORDER BY nb_commandes DESC
LIMIT 20;</code></pre>
<p>Les métriques clés à surveiller dans le plan d'exécution :</p>
<ul>
  <li><strong>Seq Scan</strong> : lecture séquentielle complète — mauvais sur les grandes tables</li>
  <li><strong>Index Scan</strong> : utilise un index B-tree, généralement bon</li>
  <li><strong>Bitmap Heap Scan</strong> : utile pour les requêtes ramenant beaucoup de lignes</li>
  <li><strong>Hash Join vs Nested Loop</strong> : Hash Join est préféré pour les grandes jointures</li>
  <li><strong>actual rows vs estimated rows</strong> : un grand écart indique des statistiques obsolètes (<code>ANALYZE</code> nécessaire)</li>
</ul>
<h2>Index B-tree : le cheval de bataille</h2>
<p>Les index B-tree (type par défaut) accélèrent les égalités, les comparaisons de plage et les tris :</p>
<pre><code>-- Index simple sur une colonne de filtrage fréquente
CREATE INDEX CONCURRENTLY idx_commandes_utilisateur
  ON commandes(utilisateur_id);

-- Index composite : l'ordre des colonnes est critique
-- Bon pour: WHERE pays = 'FR' AND actif = true
-- Bon pour: WHERE pays = 'FR' (colonne de tête seule)
-- Inutile pour: WHERE actif = true (sans la colonne de tête)
CREATE INDEX CONCURRENTLY idx_utilisateurs_pays_actif
  ON utilisateurs(pays, actif);

-- Index avec condition (index partiel) : plus petit, plus rapide
CREATE INDEX CONCURRENTLY idx_commandes_en_attente
  ON commandes(cree_le)
  WHERE statut = 'EN_ATTENTE';
</code></pre>
<h2>Index GIN pour la recherche full-text et JSONB</h2>
<p>Pour la recherche plein texte et les colonnes JSONB, les index GIN (Generalized Inverted Index) sont incontournables :</p>
<pre><code>-- Recherche plein texte en français
ALTER TABLE articles ADD COLUMN recherche tsvector
  GENERATED ALWAYS AS (
    to_tsvector('french', coalesce(titre, '') || ' ' || coalesce(contenu, ''))
  ) STORED;

CREATE INDEX idx_articles_recherche ON articles USING GIN(recherche);

-- Recherche
SELECT titre FROM articles
WHERE recherche @@ plainto_tsquery('french', 'microservices performance');

-- Index GIN sur JSONB pour les métadonnées flexibles
CREATE INDEX idx_produits_metadata ON produits USING GIN(metadata);

-- Requête rapide sur JSONB
SELECT * FROM produits
WHERE metadata @&gt; '{"couleur": "rouge", "taille": "L"}'::jsonb;</code></pre>
<h2>Index GiST pour les données géospatiales et d'intervalle</h2>
<p>PostgreSQL avec l'extension PostGIS utilise les index GiST pour les requêtes géospatiales :</p>
<pre><code>-- Activer PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Index spatial
CREATE INDEX idx_commerces_localisation
  ON commerces USING GIST(localisation);

-- Trouver les commerces dans un rayon de 5 km
SELECT nom, ST_Distance(localisation, point_reference) as distance
FROM commerces
WHERE ST_DWithin(
  localisation,
  ST_MakePoint(2.3522, 48.8566)::geography, -- Paris
  5000 -- mètres
)
ORDER BY distance;</code></pre>
<h2>Éviter les pièges courants</h2>
<p>Les index mal conçus peuvent nuire aux performances d'écriture et consommer de l'espace inutilement :</p>
<pre><code>-- PROBLÈME : fonction sur la colonne indexée rend l'index inutilisable
-- Ne peut pas utiliser l'index sur email
SELECT * FROM utilisateurs WHERE LOWER(email) = 'alice@exemple.com';

-- SOLUTION 1 : index fonctionnel
CREATE INDEX idx_utilisateurs_email_lower ON utilisateurs(LOWER(email));

-- SOLUTION 2 : stocker les données en minuscules dès l'insertion (préférable)
ALTER TABLE utilisateurs
  ADD CONSTRAINT chk_email_lowercase CHECK (email = LOWER(email));

-- PROBLÈME : colonnes à très faible cardinalité
-- Un index sur une colonne booléenne avec 50% de true est souvent inutile
-- PostgreSQL préférera un Seq Scan (moins coûteux que l'index pour &gt;15% des lignes)

-- SOLUTION : index partiel si une valeur domine
CREATE INDEX idx_commandes_non_traitees
  ON commandes(cree_le)
  WHERE traitee = false; -- seulement les lignes minoritaires</code></pre>
<h2>Maintenance des index</h2>
<p>Les index se fragmentent avec le temps et doivent être entretenus. PostgreSQL fournit les outils nécessaires :</p>
<pre><code>-- Identifier les index inutilisés (potentiels à supprimer)
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE 'pg_toast%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Identifier les index dupliqués
SELECT indrelid::regclass, array_agg(indexrelid::regclass) as indexes
FROM pg_index
GROUP BY indrelid, indkey
HAVING COUNT(*) &gt; 1;

-- Reconstruire un index fragmenté sans bloquer les lectures
REINDEX INDEX CONCURRENTLY idx_commandes_utilisateur;

-- Analyser les statistiques pour que le planner fasse de bons choix
ANALYZE utilisateurs;
ANALYZE commandes;</code></pre>
<h2>Optimisation des requêtes au-delà des index</h2>
<p>Parfois l'index n'est pas la solution — la requête elle-même doit être repensée :</p>
<pre><code>-- Anti-pattern : COUNT(*) sur une grande table pour paginer
SELECT COUNT(*) FROM commandes WHERE utilisateur_id = $1; -- lent

-- Alternative : pagination par curseur (keyset pagination)
SELECT * FROM commandes
WHERE utilisateur_id = $1
  AND id &lt; $dernierIdVu    -- curseur opaque
ORDER BY id DESC
LIMIT 20;

-- Anti-pattern : N+1 queries
-- Pour chaque utilisateur, une requête pour ses commandes
users.forEach(async u =&gt; {
  u.commandes = await db.query('SELECT * FROM commandes WHERE utilisateur_id = $1', [u.id]);
});

-- Solution : une seule requête avec JOIN ou subquery
SELECT u.*, json_agg(o.*) as commandes
FROM utilisateurs u
LEFT JOIN commandes o ON o.utilisateur_id = u.id
WHERE u.id = ANY($1::int[])
GROUP BY u.id;</code></pre>
<p>La performance base de données est indissociable de l'architecture de vos services. Notre guide sur les <a href="/fr/blog/construire-microservices-resilients-go">microservices résilients avec Go</a> couvre le pool de connexions et les patterns de retry. Pour la gestion des erreurs SQL dans le code applicatif, consultez notre article sur les <a href="/fr/blog/patterns-gestion-erreurs">patterns de gestion d'erreurs en TypeScript</a>.</p>`,
  },
  // POST FR-7
  {
    title: 'Docker en Production : Images, Réseau et Patterns d\'Orchestration',
    slug: 'docker-conteneurs-production',
    date: '2024-10-07T09:00:00',
    category: 'DevOps',
    tags: ['Docker', 'Conteneurs', 'DevOps', 'Production'],
    unsplashQuery: 'shipping containers logistics',
    internalLinks: ['kubernetes-guide-production', 'construire-microservices-resilients-go', 'workflows-git-equipe'],
    content: `<h2>Docker en production : ce que les tutoriels ne vous disent pas</h2>
<p>La majorité des tutoriels Docker vous montrent comment faire tourner un conteneur en local. La production, c'est une autre histoire : images sécurisées et minimales, gestion des secrets, réseau inter-conteneurs fiable, logging centralisé, et redémarrages gracieux. Ce guide couvre les pratiques que les équipes professionnelles appliquent pour faire tourner Docker en conditions réelles.</p>
<h2>Construire des images sécurisées et minimales</h2>
<p>La surface d'attaque d'un conteneur est directement proportionnelle à son contenu. Chaque outil, bibliothèque et couche supplémentaire est un vecteur potentiel. La build multi-étapes est la technique fondamentale pour minimiser l'image finale :</p>
<pre><code># Étape 1 : builder — contient tous les outils de build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --frozen-lockfile
COPY . .
RUN npm run build

# Étape 2 : runner — seulement ce qui est nécessaire à l'exécution
FROM node:20-alpine AS runner
WORKDIR /app

# Créer un utilisateur non-root
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Copier uniquement les artefacts de build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Changer de propriétaire et d'utilisateur
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/server.js"]</code></pre>
<h2>Gestion des secrets : ne jamais mettre de secrets dans l'image</h2>
<p>Les secrets dans les images Docker sont une fuite de sécurité catastrophique — toute personne ayant accès au registre peut extraire l'image et lire les secrets. Utilisez des variables d'environnement injectées au runtime :</p>
<pre><code># docker-compose.yml en production
services:
  api:
    image: monregistre/api:\${TAG}
    environment:
      - DATABASE_URL=\${DATABASE_URL}
      - JWT_SECRET=\${JWT_SECRET}
    secrets:
      - db_password
    networks:
      - interne

secrets:
  db_password:
    external: true  # géré par Docker Secrets ou Vault

# .env (jamais commité dans git)
DATABASE_URL=postgres://user:password@db:5432/prod
JWT_SECRET=un-secret-fort-generere-aleatoirement</code></pre>
<p>Pour Kubernetes, utilisez des <code>Secret</code> objects montés en tant que volumes ou variables d'environnement, jamais hardcodés dans les manifestes.</p>
<h2>Réseau Docker : modes et isolation</h2>
<p>Docker propose plusieurs modes réseau avec des compromis différents :</p>
<pre><code># Réseau bridge personnalisé (recommandé en production avec Docker Compose)
# Les conteneurs se trouvent par nom — résolution DNS automatique
services:
  api:
    networks:
      - backend
      - frontend

  db:
    networks:
      - backend  # db n'est pas accessible depuis le réseau frontend

  nginx:
    networks:
      - frontend
    ports:
      - "443:443"  # seul nginx est exposé à l'extérieur

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # pas d'accès internet depuis ce réseau</code></pre>
<h2>Health checks et politiques de redémarrage</h2>
<p>Les health checks permettent à Docker (et Kubernetes) de savoir si un conteneur est réellement fonctionnel, pas seulement démarré :</p>
<pre><code># Dans le Dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/healthz || exit 1

# Dans docker-compose.yml
services:
  api:
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/healthz"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
    restart: unless-stopped  # redémarrage automatique sauf arrêt manuel

  db:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  api-dependant:
    depends_on:
      db:
        condition: service_healthy  # attend que db soit healthy</code></pre>
<h2>Logging centralisé</h2>
<p>Les conteneurs Docker écrivent sur stdout/stderr par convention. Centralisez ces logs avec un driver approprié :</p>
<pre><code># docker-compose.yml avec logging vers Loki (stack Grafana)
services:
  api:
    logging:
      driver: loki
      options:
        loki-url: "http://loki:3100/loki/api/v1/push"
        loki-batch-size: "400"
        labels: "service,env"
        env: "NODE_ENV"

# Ou vers un fichier avec rotation (solution simple)
  api:
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "5"
        labels: "service"</code></pre>
<h2>Optimisation des couches pour le cache de build</h2>
<p>L'ordre des instructions dans un Dockerfile détermine l'efficacité du cache. Mettez les couches qui changent rarement en premier :</p>
<pre><code># MAUVAIS : COPY . . en premier invalide le cache à chaque changement de code
FROM node:20-alpine
COPY . .
RUN npm ci  # re-exécuté à chaque changement de fichier source

# BON : dépendances d'abord, code ensuite
FROM node:20-alpine
COPY package*.json ./
RUN npm ci  # utilise le cache si package.json n'a pas changé
COPY . .
RUN npm run build</code></pre>
<h2>Limites de ressources</h2>
<p>En production, limitez toujours la mémoire et le CPU pour éviter qu'un conteneur défaillant n'affecte les autres :</p>
<pre><code>services:
  api:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 128M
    # Pour docker run (sans Compose)
    # docker run --memory="512m" --cpus="1.0" monimage</code></pre>
<h2>Registry privé et scan de vulnérabilités</h2>
<p>Utilisez un registre privé (GitHub Container Registry, AWS ECR, Harbor) et intégrez un scanner de vulnérabilités dans votre CI :</p>
<pre><code># GitHub Actions : build, scan, push
- name: Scanner l'image avec Trivy
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'monregistre/api:\${{ github.sha }}'
    format: 'sarif'
    exit-code: '1'          # échouer si vulnérabilités critiques
    severity: 'CRITICAL,HIGH'
    output: 'trivy-results.sarif'</code></pre>
<p>Pour passer à l'orchestration à grande échelle, consultez notre guide complet sur <a href="/fr/blog/kubernetes-guide-production">Kubernetes en production</a>. Docker Compose reste pertinent pour les environnements de développement et les déploiements simples — Kubernetes prend le relais quand vous avez besoin d'autoscaling, de rolling updates et de self-healing. Pour organiser vos microservices conteneurisés, notre guide sur les <a href="/fr/blog/construire-microservices-resilients-go">microservices résilients avec Go</a> couvre les patterns d'organisation du code et de communication inter-services.</p>`,
  },
  // POST FR-8
  {
    title: 'TypeScript : Génériques Avancés et Patterns d\'Inférence',
    slug: 'typescript-generiques-avances',
    date: '2024-11-05T09:00:00',
    category: 'Frontend',
    tags: ['TypeScript', 'JavaScript', 'Système de types', 'Génériques'],
    unsplashQuery: 'code programming typescript',
    internalLinks: ['react-server-components-implications-architecture', 'conception-api-rest-graphql-trpc', 'patterns-gestion-erreurs'],
    content: `<h2>Génériques TypeScript : de la syntaxe à la puissance réelle</h2>
<p>La plupart des développeurs TypeScript utilisent les génériques uniquement pour les collections : <code>Array&lt;T&gt;</code>, <code>Promise&lt;T&gt;</code>, <code>Map&lt;K, V&gt;</code>. C'est utile, mais c'est à peine effleurer la surface. Les génériques avancés — types conditionnels, types mappés, inférence avec <code>infer</code>, contraintes distributives — permettent de construire des systèmes de types qui éliminent des classes entières d'erreurs runtime sans ajouter une seule ligne de code de validation. Ce guide vous emmène de la syntaxe basique aux patterns utilisés dans des bibliothèques comme Zod, Prisma et tRPC.</p>
<h2>Contraintes et valeurs par défaut</h2>
<pre><code>// Contrainte basique
function premierElement&lt;T extends unknown[]&gt;(tableau: T): T[0] | undefined {
  return tableau[0];
}

// Contrainte avec interface
interface AIdentifiant { id: string | number; }

function trouverParId&lt;T extends AIdentifiant&gt;(items: T[], id: T['id']): T | undefined {
  return items.find(item => item.id === id);
}

// Valeur par défaut de type générique
interface PaginationReponse&lt;T = unknown&gt; {
  data: T[];
  total: number;
  page: number;
  parPage: number;
}

type ReponseUtilisateurs = PaginationReponse&lt;Utilisateur&gt;;
type ReponseBrute = PaginationReponse; // T = unknown</code></pre>
<h2>Types conditionnels</h2>
<p>Les types conditionnels permettent une logique de type qui dépend d'autres types :</p>
<pre><code>// Syntaxe : T extends U ? X : Y
type EstTableau&lt;T&gt; = T extends unknown[] ? true : false;
type A = EstTableau&lt;string[]&gt;;  // true
type B = EstTableau&lt;string&gt;;    // false

// Dépliage d'un type Promise imbriqué
type DeballerPromesse&lt;T&gt; = T extends Promise&lt;infer R&gt;
  ? DeballerPromesse&lt;R&gt;
  : T;

type C = DeballerPromesse&lt;Promise&lt;Promise&lt;string&gt;&gt;&gt;; // string

// Type utilitaire conditionnel : rendre certaines propriétés optionnelles
type RendreOptionnelle&lt;T, K extends keyof T&gt; = Omit&lt;T, K&gt; &amp; Partial&lt;Pick&lt;T, K&gt;&gt;;

interface Commande {
  id: string;
  produitId: string;
  quantite: number;
  adresseLivraison: string;
}

// Pour la création : id est optionnel (généré par la DB)
type CreerCommande = RendreOptionnelle&lt;Commande, 'id'&gt;;</code></pre>
<h2>Le mot-clé infer</h2>
<p><code>infer</code> permet d'extraire des types depuis d'autres types dans une position de type conditionnel :</p>
<pre><code>// Extraire le type de retour d'une fonction
type TypeRetour&lt;T&gt; = T extends (...args: any[]) => infer R ? R : never;

async function obtenirUtilisateur(id: string): Promise&lt;Utilisateur&gt; { /* ... */ }
type UtilisateurRetourne = TypeRetour&lt;typeof obtenirUtilisateur&gt;; // Promise&lt;Utilisateur&gt;
type UtilisateurDeballee = Awaited&lt;TypeRetour&lt;typeof obtenirUtilisateur&gt;&gt;; // Utilisateur

// Extraire les types des paramètres
type Parametres&lt;T&gt; = T extends (...args: infer P) => any ? P : never;
type ParamsObtenirUtilisateur = Parametres&lt;typeof obtenirUtilisateur&gt;; // [string]

// Pattern avancé : inferrer depuis un tuple
type PremierParam&lt;T extends (...args: any[]) => any&gt; =
  T extends (premier: infer P, ...reste: any[]) => any ? P : never;</code></pre>
<h2>Types mappés</h2>
<p>Les types mappés transforment tous les membres d'un type existant :</p>
<pre><code>// Réimplémentation de Readonly
type MonReadonly&lt;T&gt; = {
  readonly [K in keyof T]: T[K];
};

// Transformer les valeurs : tous les champs deviennent des promesses
type Promisifie&lt;T&gt; = {
  [K in keyof T]: Promise&lt;T[K]&gt;;
};

// Avec filtrage : ne garder que les méthodes
type SeulementMéthodes&lt;T&gt; = {
  [K in keyof T as T[K] extends Function ? K : never]: T[K];
};

// Template literal types dans les clés mappées
type Getters&lt;T&gt; = {
  [K in keyof T as \`get\${Capitalize&lt;string &amp; K&gt;}\`]: () => T[K];
};

interface Utilisateur { nom: string; age: number; }
type GettersUtilisateur = Getters&lt;Utilisateur&gt;;
// { getNom: () => string; getAge: () => number; }</code></pre>
<h2>Construire un validateur de schéma type-safe</h2>
<p>Un exemple concret qui combine tout ce qu'on a vu — un mini-Zod maison :</p>
<pre><code>type Infer&lt;T extends Validateur&lt;any&gt;&gt; = T extends Validateur&lt;infer R&gt; ? R : never;

class Validateur&lt;T&gt; {
  constructor(private fn: (val: unknown) => T) {}

  parser(val: unknown): T {
    return this.fn(val);
  }

  optional(): Validateur&lt;T | undefined&gt; {
    return new Validateur(val => val === undefined ? undefined : this.fn(val));
  }
}

const chaine = new Validateur&lt;string&gt;(val => {
  if (typeof val !== 'string') throw new Error('Chaîne attendue');
  return val;
});

const nombre = new Validateur&lt;number&gt;(val => {
  if (typeof val !== 'number') throw new Error('Nombre attendu');
  return val;
});

function objet&lt;T extends Record&lt;string, Validateur&lt;any&gt;&gt;&gt;(schema: T) {
  type Forme = { [K in keyof T]: Infer&lt;T[K]&gt; };
  return new Validateur&lt;Forme&gt;(val => {
    if (typeof val !== 'object' || val === null) throw new Error('Objet attendu');
    const result = {} as Forme;
    for (const key in schema) {
      result[key] = schema[key].parser((val as any)[key]);
    }
    return result;
  });
}

const SchemaCommande = objet({
  id: chaine,
  quantite: nombre,
  note: chaine.optional(),
});

type TypeCommande = Infer&lt;typeof SchemaCommande&gt;;
// { id: string; quantite: number; note: string | undefined }</code></pre>
<h2>Distributivité et types union</h2>
<p>Un comportement subtil mais important : les types conditionnels sont distributifs sur les types union :</p>
<pre><code>type SupprimerNull&lt;T&gt; = T extends null | undefined ? never : T;

type A = SupprimerNull&lt;string | null | number | undefined&gt;;
// Distribue sur chaque membre : string | number
// Équivalent à : SupprimerNull&lt;string&gt; | SupprimerNull&lt;null&gt; | ...
//              : string | never | number | never
//              : string | number

// Pour désactiver la distributivité : envelopper dans un tuple
type NonDistributif&lt;T&gt; = [T] extends [null | undefined] ? never : T;
type B = NonDistributif&lt;string | null&gt;; // string | null (non distribué)</code></pre>
<p>Ces patterns forment la base des bibliothèques TypeScript modernes. Pour leur application dans des APIs type-safe, consultez notre guide sur <a href="/fr/blog/conception-api-rest-graphql-trpc">REST, GraphQL et tRPC</a>. La gestion des erreurs avec les types <code>Result</code> et discriminated unions est détaillée dans notre article sur les <a href="/fr/blog/patterns-gestion-erreurs">patterns de gestion d'erreurs TypeScript</a>.</p>`,
  },
  // POST FR-9
  {
    title: 'Cloudflare Workers et le Calcul Edge : Construire des Applications Distribuées Mondialement',
    slug: 'cloudflare-workers-edge-computing-fr',
    date: '2024-12-03T10:00:00',
    category: 'Développement Web',
    tags: ['Cloudflare', 'Edge Computing', 'Workers', 'Performance'],
    unsplashQuery: 'cloud computing network globe',
    internalLinks: ['comprendre-webassembly-guide-pratique', 'conception-api-rest-graphql-trpc', 'core-web-vitals-performance-fr'],
    content: `<h2>Le calcul edge : exécuter du code là où se trouvent vos utilisateurs</h2>
<p>Le calcul edge représente un changement fondamental dans la topologie du déploiement web. Plutôt que d'exécuter votre code applicatif dans une ou deux régions et de servir les utilisateurs du monde entier depuis ces points centraux, le calcul edge distribue l'exécution dans des centaines de points de présence (PoP) à travers le globe. Pour un utilisateur à Tokyo, votre code s'exécute à Tokyo. Pour un utilisateur à São Paulo, il s'exécute à São Paulo.</p>
<p>Cloudflare Workers est la plateforme edge la plus mature du marché, avec plus de 300 PoP, une latence de démarrage de zéro millisecondes (pas de cold start), et un modèle de tarification basé sur les requêtes plutôt que sur le temps d'exécution alloué. Ce guide vous montre comment construire des applications sérieuses au-dessus de cette infrastructure.</p>
<h2>Architecture d'un Cloudflare Worker</h2>
<p>Un Worker est une fonction JavaScript/TypeScript qui reçoit des objets <code>Request</code> standard et renvoie des objets <code>Response</code>. L'API suit les standards Web — <code>fetch</code>, <code>crypto</code>, <code>URL</code>, <code>TextEncoder</code> — ce qui rend le code portable :</p>
<pre><code>// worker.ts
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise&lt;Response&gt; {
    const url = new URL(request.url);

    // Routage simple
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env, ctx);
    }

    if (url.pathname.startsWith('/static/')) {
      return env.ASSETS.fetch(request); // servir depuis R2 ou Pages Assets
    }

    return new Response('Non trouvé', { status: 404 });
  },

  // Tâches planifiées (équivalent cron)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise&lt;void&gt; {
    ctx.waitUntil(nettoyerCacheExpire(env));
  },
};

interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  FICHIERS: R2Bucket;
  API_SECRET: string;
}</code></pre>
<h2>KV : le stockage clé-valeur distribué</h2>
<p>Cloudflare KV est un stockage clé-valeur avec cohérence éventuelle — parfait pour les données lues fréquemment et rarement modifiées :</p>
<pre><code>async function obtenirConfig(env: Env): Promise&lt;Config&gt; {
  const cached = await env.CACHE.get('config', { type: 'json' });
  if (cached) return cached as Config;

  // Calculer la config depuis D1 si absente du cache
  const config = await calculerConfig(env.DB);

  // Stocker pendant 1 heure avec expiration automatique
  await env.CACHE.put('config', JSON.stringify(config), {
    expirationTtl: 3600,
  });

  return config;
}

// Lecture avec metadata
const { value, metadata } = await env.CACHE.getWithMetadata&lt;Config, { version: number }&gt;('config', 'json');
if (metadata?.version !== CURRENT_VERSION) {
  await env.CACHE.delete('config');
}</code></pre>
<h2>D1 : SQLite en edge</h2>
<p>Cloudflare D1 est une base de données SQLite qui s'exécute à l'edge. Ses lectures sont ultra-rapides (SQLite est embarqué dans le Worker), ses écritures sont répliquées globalement :</p>
<pre><code>export async function obtenirArticle(env: Env, slug: string): Promise&lt;Article | null&gt; {
  const stmt = env.DB.prepare(
    'SELECT * FROM articles WHERE slug = ? AND publie = 1'
  );
  const result = await stmt.bind(slug).first&lt;Article&gt;();
  return result;
}

// Batch queries pour éviter les waterfalls
export async function obtenirArticleAvecAuteur(env: Env, slug: string) {
  const [article, [auteurResult]] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM articles WHERE slug = ?').bind(slug),
    env.DB.prepare('SELECT * FROM auteurs WHERE id = ?').bind(articleId),
  ]);

  return {
    article: article.results[0],
    auteur: auteurResult.results[0],
  };
}

// Transactions
async function creerCommandeAvecStock(env: Env, commande: NouvelleCommande) {
  const statements = [
    env.DB.prepare('INSERT INTO commandes (id, produit_id, quantite) VALUES (?, ?, ?)')
      .bind(commande.id, commande.produitId, commande.quantite),
    env.DB.prepare('UPDATE stock SET quantite = quantite - ? WHERE produit_id = ?')
      .bind(commande.quantite, commande.produitId),
  ];
  await env.DB.batch(statements);
}</code></pre>
<h2>R2 : stockage d'objets compatible S3</h2>
<p>Cloudflare R2 offre le stockage d'objets compatible S3 sans frais de sortie de données — une différence économique majeure par rapport à AWS S3 :</p>
<pre><code>// Upload d'un fichier vers R2
async function uploadFichier(env: Env, request: Request): Promise&lt;Response&gt; {
  const formData = await request.formData();
  const fichier = formData.get('fichier') as File;

  const cle = \`uploads/\${Date.now()}-\${fichier.name}\`;
  await env.FICHIERS.put(cle, fichier.stream(), {
    httpMetadata: { contentType: fichier.type },
    customMetadata: { utilisateur: 'user-123', taille: String(fichier.size) },
  });

  return Response.json({ cle, url: \`https://cdn.exemple.com/\${cle}\` });
}

// Servir avec transformations
async function servirImage(env: Env, cle: string, largeur?: number): Promise&lt;Response&gt; {
  const objet = await env.FICHIERS.get(cle);
  if (!objet) return new Response('Introuvable', { status: 404 });

  // Cloudflare Image Resizing (disponible sur les plans payants)
  if (largeur) {
    const url = \`https://votre-zone.com/cdn-cgi/image/width=\${largeur}/\${cle}\`;
    return fetch(url);
  }

  return new Response(objet.body, {
    headers: { 'Content-Type': objet.httpMetadata?.contentType ?? 'application/octet-stream' },
  });
}</code></pre>
<h2>Durables Objects : état avec coordination</h2>
<p>Les Durable Objects résolvent le problème le plus difficile du calcul edge : l'état partagé et coordonné. Chaque Durable Object est une instance JavaScript unique dans le monde entier, avec sa propre mémoire et stockage :</p>
<pre><code>// Compteur distribué avec Durable Object
export class Compteur implements DurableObject {
  private valeur = 0;

  constructor(private state: DurableObjectState) {
    this.state.blockConcurrencyWhile(async () => {
      this.valeur = (await this.state.storage.get&lt;number&gt;('valeur')) ?? 0;
    });
  }

  async fetch(request: Request): Promise&lt;Response&gt; {
    const url = new URL(request.url);

    if (url.pathname === '/increment') {
      this.valeur++;
      await this.state.storage.put('valeur', this.valeur);
      return Response.json({ valeur: this.valeur });
    }

    if (url.pathname === '/valeur') {
      return Response.json({ valeur: this.valeur });
    }

    return new Response('Non trouvé', { status: 404 });
  }
}

// Utilisation depuis un Worker
async function incrementerCompteur(env: Env, nomCompteur: string): Promise&lt;number&gt; {
  const id = env.COMPTEUR.idFromName(nomCompteur);
  const compteur = env.COMPTEUR.get(id);
  const response = await compteur.fetch('https://interne/increment');
  const { valeur } = await response.json();
  return valeur;
}</code></pre>
<h2>Optimisation des performances edge</h2>
<p>Pour tirer le maximum des Workers, quelques patterns clés :</p>
<pre><code>// Cache API : mettre en cache des réponses au niveau CDN
async function avecCache(request: Request, handler: () => Promise&lt;Response&gt;): Promise&lt;Response&gt; {
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await handler();
  if (response.ok) {
    // Cloner car Response n'est utilisable qu'une fois
    const reponseAMettrEnCache = response.clone();
    const headers = new Headers(reponseAMettrEnCache.headers);
    headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');

    const ctx = ...; // passer ExecutionContext
    ctx.waitUntil(cache.put(request, new Response(reponseAMettrEnCache.body, { headers })));
  }

  return response;
}</code></pre>
<p>Cloudflare Workers s'intègre naturellement avec WebAssembly pour les tâches intensives en calcul — explorez les possibilités dans notre guide sur <a href="/fr/blog/comprendre-webassembly-guide-pratique">WebAssembly</a>. Pour concevoir les APIs que vos Workers exposent, consultez notre comparatif <a href="/fr/blog/conception-api-rest-graphql-trpc">REST, GraphQL et tRPC</a>. L'impact sur les métriques de performance utilisateur est mesuré dans notre article sur les <a href="/fr/blog/core-web-vitals-performance-fr">Core Web Vitals</a>.</p>`,
  },
  // POST FR-10
  {
    title: 'Stratégies de Tests pour les Applications Web Modernes : Unitaires, Intégration et E2E',
    slug: 'strategies-tests-applications-web',
    date: '2025-01-14T09:00:00',
    category: 'Développement Web',
    tags: ['Tests', 'Vitest', 'Playwright', 'TDD', 'Qualité'],
    unsplashQuery: 'quality assurance checklist',
    internalLinks: ['typescript-generiques-avances', 'react-server-components-implications-architecture', 'patterns-gestion-erreurs'],
    content: `<h2>Repenser la stratégie de tests</h2>
<p>La pyramide de tests traditionnelle — beaucoup d'unitaires, quelques intégrations, peu d'E2E — est remise en question par les applications web modernes. Avec React Server Components, des ORMs type-safe, et des APIs qui ne sont plus que du JSON sur HTTP, les tests unitaires isolés avec des mocks omniprésents créent une fausse confiance : les tests passent mais l'application échoue en production sur les interactions entre les couches. Ce guide propose une stratégie basée sur la valeur plutôt que sur les chiffres, en utilisant Vitest pour les tests rapides et Playwright pour les tests E2E.</p>
<h2>Configuration de Vitest</h2>
<p>Vitest est le successeur moderne de Jest — compatible avec l'écosystème Vite, support TypeScript natif, et 2–5x plus rapide :</p>
<pre><code>// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

// src/test/setup.ts
import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});</code></pre>
<h2>Tests unitaires : tester les comportements, pas les implémentations</h2>
<p>Un test unitaire bien écrit documente le comportement attendu et résiste aux refactorisations internes :</p>
<pre><code>// src/lib/calcul-remise.test.ts
import { describe, it, expect } from 'vitest';
import { calculerRemise } from './calcul-remise';

describe('calculerRemise', () => {
  it('applique la remise client fidèle sur les commandes éligibles', () => {
    const commande = { montant: 200, produits: ['EBOOK_123'], type: 'NUMERIQUE' as const };
    const client = { anciennete: 365, abonnementPremium: true };
    expect(calculerRemise(commande, client)).toEqual({
      remisePourcentage: 20,
      montantRemise: 40,
      montantFinal: 160,
      raison: 'CLIENT_FIDELE_PREMIUM',
    });
  });

  it('ne s\'applique pas sous le seuil minimum de commande', () => {
    const commande = { montant: 50, produits: ['EBOOK_123'], type: 'NUMERIQUE' as const };
    const client = { anciennete: 365, abonnementPremium: true };
    expect(calculerRemise(commande, client)).toEqual({
      remisePourcentage: 0,
      montantRemise: 0,
      montantFinal: 50,
      raison: 'MONTANT_INSUFFISANT',
    });
  });

  it.each([
    [100, 'PHYSIQUE', 10],
    [200, 'NUMERIQUE', 20],
    [500, 'SERVICE', 25],
  ])('commande %s€ type %s donne %s%% de remise', (montant, type, remisePourcentage) => {
    const commande = { montant, produits: [], type: type as any };
    const client = { anciennete: 400, abonnementPremium: true };
    expect(calculerRemise(commande, client).remisePourcentage).toBe(remisePourcentage);
  });
});</code></pre>
<h2>Tests de composants React avec Testing Library</h2>
<p>Testez les composants depuis la perspective de l'utilisateur, pas depuis l'implémentation :</p>
<pre><code>// src/components/FormulairePanier.test.tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import FormulairePanier from './FormulairePanier';

describe('FormulairePanier', () => {
  const produitsInitiaux = [
    { id: '1', nom: 'Widget Pro', prix: 49.99, quantite: 1 },
    { id: '2', nom: 'Gadget Plus', prix: 99.99, quantite: 2 },
  ];

  it('affiche le total correct', () => {
    render(&lt;FormulairePanier produits={produitsInitiaux} onValider={vi.fn()} /&gt;);
    // 49.99 × 1 + 99.99 × 2 = 249.97
    expect(screen.getByText('Total : 249,97 €')).toBeInTheDocument();
  });

  it('met à jour le total quand la quantité change', async () => {
    const user = userEvent.setup();
    render(&lt;FormulairePanier produits={produitsInitiaux} onValider={vi.fn()} /&gt;);

    const ligneWidget = screen.getByRole('row', { name: /Widget Pro/ });
    const inputQuantite = within(ligneWidget).getByRole('spinbutton');

    await user.clear(inputQuantite);
    await user.type(inputQuantite, '3');

    // 49.99 × 3 + 99.99 × 2 = 349.95
    expect(screen.getByText('Total : 349,95 €')).toBeInTheDocument();
  });

  it('appelle onValider avec les bonnes données à la soumission', async () => {
    const user = userEvent.setup();
    const onValider = vi.fn();
    render(&lt;FormulairePanier produits={produitsInitiaux} onValider={onValider} /&gt;);

    await user.click(screen.getByRole('button', { name: 'Valider la commande' }));

    expect(onValider).toHaveBeenCalledWith({
      produits: produitsInitiaux,
      total: 249.97,
    });
  });
});</code></pre>
<h2>Tests d'intégration avec de vraies dépendances</h2>
<p>Testez les routes API avec des bases de données réelles via testcontainers :</p>
<pre><code>// src/api/commandes.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { creerApp } from '../app';
import { migrer } from '../db/migrations';

describe('API Commandes (intégration)', () => {
  let conteneur: any;
  let app: any;

  beforeAll(async () => {
    conteneur = await new PostgreSqlContainer('postgres:16-alpine').start();
    await migrer(conteneur.getConnectionUri());
    app = creerApp(conteneur.getConnectionUri());
  }, 60_000);

  afterAll(async () => {
    await conteneur.stop();
  });

  it('crée une commande et la retrouve par ID', async () => {
    const creerRes = await app.request('/api/commandes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produitId: 'prod-001', quantite: 2 }),
    });
    expect(creerRes.status).toBe(201);
    const { id } = await creerRes.json();

    const obtenirRes = await app.request(\`/api/commandes/\${id}\`);
    expect(obtenirRes.status).toBe(200);
    const commande = await obtenirRes.json();
    expect(commande.quantite).toBe(2);
    expect(commande.statut).toBe('EN_ATTENTE');
  });
});</code></pre>
<h2>Tests E2E avec Playwright</h2>
<p>Playwright est le standard pour les tests E2E modernes — API unifiée pour Chrome, Firefox et Safari, gestion automatique des assertions asynchrones :</p>
<pre><code>// e2e/panier.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Flux d\'achat complet', () => {
  test.beforeEach(async ({ page }) => {
    // Connexion via l'API de test (plus rapide que l'UI)
    await page.request.post('/api/test/reset-db');
    await page.goto('/connexion');
    await page.fill('[name="email"]', 'test@exemple.com');
    await page.fill('[name="motdepasse"]', 'MotDePasse123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/tableau-de-bord');
  });

  test('ajouter au panier et commander', async ({ page }) => {
    await page.goto('/produits/widget-pro');
    await page.click('[data-testid="ajouter-au-panier"]');

    // Vérifier le badge du panier
    await expect(page.locator('[data-testid="badge-panier"]')).toHaveText('1');

    await page.goto('/panier');
    await expect(page.getByRole('heading', { name: 'Votre panier' })).toBeVisible();
    await expect(page.getByText('Widget Pro')).toBeVisible();

    await page.click('[data-testid="passer-commande"]');
    await page.fill('[name="numeroCarte"]', '4242 4242 4242 4242');
    await page.fill('[name="expiration"]', '12/26');
    await page.fill('[name="cvv"]', '123');
    await page.click('[data-testid="confirmer-paiement"]');

    await expect(page.getByRole('heading', { name: 'Commande confirmée !' })).toBeVisible();
    await expect(page.getByText(/numéro de commande/i)).toBeVisible();
  });
});</code></pre>
<h2>Stratégie de couverture pragmatique</h2>
<p>Visez la couverture des chemins critiques, pas des chiffres arbitraires :</p>
<ul>
  <li><strong>Logique métier pure</strong> (calculs, transformations) : 95%+ de couverture unitaire</li>
  <li><strong>Routes API</strong> : tests d'intégration pour chaque code de réponse possible</li>
  <li><strong>Flux utilisateur critiques</strong> (inscription, achat, paiement) : tests E2E obligatoires</li>
  <li><strong>Composants UI purement visuels</strong> : tests de régression visuelle avec Playwright screenshots</li>
</ul>
<p>Intégrez ces tests dans votre CI pour une détection précoce des régressions. Notre guide sur les <a href="/fr/blog/patterns-gestion-erreurs">patterns de gestion d'erreurs TypeScript</a> montre comment rendre votre code plus facile à tester via les types <code>Result</code>. Pour la stratégie de test des Server Components React, consultez notre guide sur les <a href="/fr/blog/react-server-components-implications-architecture">React Server Components</a>.</p>`,
  },
  // POST FR-11
  {
    title: 'Systèmes de Design à Grande Échelle : Construire une Bibliothèque de Composants Durable',
    slug: 'systemes-design-a-echelle',
    date: '2025-02-04T09:00:00',
    category: 'Frontend',
    tags: ['Systèmes de Design', 'CSS', 'Bibliothèque de composants', 'Storybook'],
    unsplashQuery: 'design system ui components',
    internalLinks: ['css-grid-avance-mise-en-page', 'animations-ui-motion-design', 'monorepo-turborepo-guide'],
    content: `<h2>Pourquoi les bibliothèques de composants échouent-elles ?</h2>
<p>Presque toutes les équipes de taille moyenne ont tenté de créer une bibliothèque de composants. La plupart abandonnent après six mois ou finissent avec un graveyard de composants que personne n'utilise. Les raisons d'échec sont prévisibles : manque d'implication des designers, composants trop rigides pour les cas d'usage réels, documentation inexistante, et versionning chaotique qui provoque des conflits entre équipes produit. Ce guide couvre les décisions architecturales qui différencient une bibliothèque viable d'un projet abandonné.</p>
<h2>Architecture des tokens de design</h2>
<p>Un système de design sain commence par les tokens — des variables nommées qui représentent les décisions de design :</p>
<pre><code>/* tokens/couleurs.css */
:root {
  /* Palette brute — jamais utilisée directement dans les composants */
  --bleu-50: #eff6ff;
  --bleu-500: #3b82f6;
  --bleu-900: #1e3a8a;

  /* Tokens sémantiques — ce qu'on utilise dans les composants */
  --couleur-primaire: var(--bleu-500);
  --couleur-primaire-survol: var(--bleu-600);
  --couleur-fond: #ffffff;
  --couleur-texte: #111827;
  --couleur-texte-secondaire: #6b7280;
  --couleur-bordure: #e5e7eb;
  --couleur-erreur: #ef4444;
  --couleur-succes: #22c55e;
}

[data-theme="sombre"] {
  --couleur-fond: #111827;
  --couleur-texte: #f9fafb;
  --couleur-texte-secondaire: #9ca3af;
  --couleur-bordure: #374151;
}</code></pre>
<p>Exporter les tokens vers plusieurs formats avec Style Dictionary permet une source unique pour CSS, JavaScript et les outils de design :</p>
<pre><code>// style-dictionary.config.js
module.exports = {
  source: ['tokens/**/*.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      prefix: 'ds',
      files: [{ destination: 'dist/tokens.css', format: 'css/variables' }],
    },
    js: {
      transformGroup: 'js',
      files: [{ destination: 'dist/tokens.js', format: 'javascript/es6' }],
    },
    ios: {
      transformGroup: 'ios-swift',
      files: [{ destination: 'dist/StyleDictionary.swift', format: 'ios-swift/class.swift' }],
    },
  },
};</code></pre>
<h2>Composants accessibles avec Radix UI primitives</h2>
<p>Construire l'accessibilité (ARIA, navigation clavier, gestion du focus) depuis zéro est extrêmement complexe. Radix UI fournit des primitives headless — comportement et accessibilité sans style :</p>
<pre><code>// components/ui/Select.tsx
import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectProps {
  placeholder?: string;
  options: { valeur: string; libelle: string; desactive?: boolean }[];
  valeur?: string;
  onChange?: (valeur: string) => void;
}

export function Select({ placeholder, options, valeur, onChange }: SelectProps) {
  return (
    &lt;SelectPrimitive.Root value={valeur} onValueChange={onChange}&gt;
      &lt;SelectPrimitive.Trigger
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border',
          'border-[var(--couleur-bordure)] bg-transparent px-3 py-2 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-[var(--couleur-primaire)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      &gt;
        &lt;SelectPrimitive.Value placeholder={placeholder} /&gt;
        &lt;SelectPrimitive.Icon asChild&gt;
          &lt;ChevronDown className="h-4 w-4 opacity-50" /&gt;
        &lt;/SelectPrimitive.Icon&gt;
      &lt;/SelectPrimitive.Trigger&gt;

      &lt;SelectPrimitive.Portal&gt;
        &lt;SelectPrimitive.Content className="z-50 min-w-[8rem] overflow-hidden rounded-md border shadow-md"&gt;
          &lt;SelectPrimitive.Viewport className="p-1"&gt;
            {options.map(opt =&gt; (
              &lt;SelectPrimitive.Item
                key={opt.valeur}
                value={opt.valeur}
                disabled={opt.desactive}
                className="relative flex cursor-pointer select-none items-center rounded-sm px-8 py-1.5 text-sm outline-none"
              &gt;
                &lt;SelectPrimitive.ItemText&gt;{opt.libelle}&lt;/SelectPrimitive.ItemText&gt;
                &lt;SelectPrimitive.ItemIndicator className="absolute left-2"&gt;
                  &lt;Check className="h-4 w-4" /&gt;
                &lt;/SelectPrimitive.ItemIndicator&gt;
              &lt;/SelectPrimitive.Item&gt;
            ))}
          &lt;/SelectPrimitive.Viewport&gt;
        &lt;/SelectPrimitive.Content&gt;
      &lt;/SelectPrimitive.Portal&gt;
    &lt;/SelectPrimitive.Root&gt;
  );
}</code></pre>
<h2>Versionning sémantique et gestion des breaking changes</h2>
<p>Le versionning d'une bibliothèque de composants est plus délicat que pour une bibliothèque utilitaire car les "breaking changes" incluent les changements visuels, pas seulement les changements d'API :</p>
<pre><code># Politique de versionning pour les design systems
# MAJOR (1.0.0 → 2.0.0) :
#   - Suppression d'un composant
#   - Changement de props incompatible (renommer, changer le type)
#   - Changement visuel radical qui casse les tests de régression

# MINOR (1.0.0 → 1.1.0) :
#   - Nouveau composant
#   - Nouvelle prop optionnelle
#   - Amélioration visuelle non-breaking

# PATCH (1.0.0 → 1.0.1) :
#   - Correction de bug d'accessibilité
#   - Fix de style mineur
#   - Correction de typos dans la documentation

# .changeset/bouton-variante.md (avec Changesets)
---
"@monorg/ui": minor
---
Ajouter la variante "outline" au composant Button</code></pre>
<h2>Documentation avec Storybook 8</h2>
<p>Storybook est le standard pour documenter les bibliothèques de composants. Avec les Component Story Format 3 :</p>
<pre><code>// stories/Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../components/Button';

const meta: Meta&lt;typeof Button&gt; = {
  title: 'Composants/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    a11y: { config: { rules: [{ id: 'color-contrast', enabled: true }] } },
  },
  argTypes: {
    variante: {
      control: { type: 'select' },
      options: ['primaire', 'secondaire', 'destructif', 'fantome'],
    },
    taille: {
      control: { type: 'radio' },
      options: ['sm', 'md', 'lg'],
    },
  },
};
export default meta;
type Story = StoryObj&lt;typeof Button&gt;;

export const Primaire: Story = {
  args: { variante: 'primaire', enfants: 'Cliquez ici', taille: 'md' },
};

export const Desactive: Story = {
  args: { variante: 'primaire', enfants: 'Désactivé', desactive: true },
};

// Test de régression visuelle automatique
export const TousLesVariantes: Story = {
  render: () =&gt; (
    &lt;div className="flex gap-4"&gt;
      {(['primaire', 'secondaire', 'destructif'] as const).map(v =&gt; (
        &lt;Button key={v} variante={v}&gt;{v}&lt;/Button&gt;
      ))}
    &lt;/div&gt;
  ),
};</code></pre>
<h2>Tests de régression visuelle avec Chromatic</h2>
<p>Chromatic (le service cloud de Storybook) capture des screenshots de toutes vos stories à chaque commit et signale les différences visuelles pour approbation humaine. Intégration GitHub Actions :</p>
<pre><code># .github/workflows/chromatic.yml
- name: Publier sur Chromatic
  uses: chromaui/action@latest
  with:
    projectToken: \${{ secrets.CHROMATIC_PROJECT_TOKEN }}
    exitZeroOnChanges: true  # ne pas faire échouer le CI pour les changements acceptables</code></pre>
<p>Pour organiser votre design system dans un monorepo, consultez notre guide sur <a href="/fr/blog/monorepo-turborepo-guide">les monorepos avec Turborepo</a>. Les techniques CSS avancées pour vos composants sont dans notre article sur <a href="/fr/blog/css-grid-avance-mise-en-page">CSS Grid avancé</a>. Pour les animations de vos composants, notre guide sur les <a href="/fr/blog/animations-ui-motion-design">animations UI</a> couvre les transitions accessibles et performantes.</p>`,
  },
  // POST FR-12
  {
    title: 'Core Web Vitals et Performance : Des Scores aux Impacts Réels',
    slug: 'core-web-vitals-performance-fr',
    date: '2025-03-11T09:00:00',
    category: 'Performance',
    tags: ['Core Web Vitals', 'Performance', 'SEO', 'LCP', 'CLS', 'INP'],
    unsplashQuery: 'speedometer performance speed',
    internalLinks: ['react-server-components-implications-architecture', 'cloudflare-workers-edge-computing-fr', 'css-grid-avance-mise-en-page'],
    content: `<h2>Pourquoi les Core Web Vitals ont changé la façon d'optimiser le web</h2>
<p>Depuis l'intégration des Core Web Vitals dans l'algorithme de classement de Google en 2021, la performance web est passée d'une bonne pratique à un impératif commercial. Mais au-delà du SEO, les métriques CWV mesurent des aspects de l'expérience utilisateur qui ont un impact direct sur les conversions : une amélioration de 100 ms du LCP peut augmenter les conversions de 2 à 8% selon les études sectorielles. Ce guide couvre les trois métriques actuelles — LCP, CLS, et INP — avec des stratégies d'optimisation concrètes et mesurables.</p>
<h2>LCP : Largest Contentful Paint</h2>
<p>Le LCP mesure le temps d'affichage du plus grand élément de contenu visible dans le viewport initial. Pour la majorité des pages, c'est soit une image hero, soit un bloc de texte. Cible : &lt; 2,5 secondes.</p>
<h3>Diagnostiquer le LCP</h3>
<pre><code>// Mesurer le LCP en JavaScript (pour le monitoring RUM)
new PerformanceObserver((entryList) => {
  const entries = entryList.getEntries();
  const derniereLCP = entries[entries.length - 1];

  console.log('LCP :', derniereLCP.startTime.toFixed(0), 'ms');
  console.log('Élément :', derniereLCP.element?.tagName, derniereLCP.element?.id);

  // Envoyer à votre service d'analytics
  envoyerMetrique('LCP', {
    valeur: Math.round(derniereLCP.startTime),
    url: window.location.pathname,
    element: derniereLCP.element?.tagName,
  });
}).observe({ type: 'largest-contentful-paint', buffered: true });</code></pre>
<h3>Optimiser l'image LCP</h3>
<pre><code>&lt;!-- Préciser la taille, désactiver le lazy loading, précharger --&gt;
&lt;link rel="preload" as="image" href="/hero.webp" /&gt;

&lt;img
  src="/hero.webp"
  alt="Description précise pour l'accessibilité"
  width="1200"
  height="630"
  fetchpriority="high"
  decoding="async"
  sizes="(max-width: 768px) 100vw, 1200px"
  srcset="/hero-480.webp 480w, /hero-768.webp 768w, /hero.webp 1200w"
/&gt;

&lt;!-- En Next.js --&gt;
&lt;Image
  src="/hero.webp"
  alt="..."
  width={1200}
  height={630}
  priority  // équivalent à fetchpriority="high" + preload
  quality={85}
/&gt;</code></pre>
<h3>Réduire le TTFB (Time to First Byte)</h3>
<p>Le LCP est directement limité par le TTFB. Chaque milliseconde de TTFB retarde le LCP d'au moins autant. Strategies :</p>
<pre><code>// Next.js : générer statiquement les pages à fort trafic
export async function generateStaticParams() {
  const articles = await obtenirArticlesPublies();
  return articles.map(a => ({ slug: a.slug }));
}

// Stale-While-Revalidate : servir depuis le cache, régénérer en arrière-plan
export const revalidate = 60; // regénérer si la page a plus de 60 secondes</code></pre>
<h2>CLS : Cumulative Layout Shift</h2>
<p>Le CLS mesure la stabilité visuelle — les décalages inattendus de contenu pendant le chargement. Cible : &lt; 0,1.</p>
<h3>Causes fréquentes et solutions</h3>
<pre><code>/* 1. Images sans dimensions déclarées */
/* MAUVAIS */
img { max-width: 100%; }

/* BON : réserver l'espace avec le ratio */
.conteneur-image {
  aspect-ratio: 16 / 9;
  overflow: hidden;
}
.conteneur-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 2. Polices web qui décalent le texte au chargement */
/* Dans votre CSS */
@font-face {
  font-family: 'MaPolice';
  src: url('/fonts/mapolice.woff2') format('woff2');
  font-display: optional; /* ne charge pas si lent — pas de CLS */
  /* ou: font-display: swap + size-adjust pour minimiser le décalage */
  size-adjust: 105%;
  ascent-override: 90%;
}

/* 3. Contenu injecté dynamiquement (publicités, embeds) */
/* Toujours réserver l'espace en avance */
.emplacement-pub {
  min-height: 250px; /* hauteur connue de l'annonce */
  container-type: inline-size;
}</code></pre>
<h2>INP : Interaction to Next Paint</h2>
<p>L'INP (qui a remplacé FID en mars 2024) mesure la réactivité globale de la page aux interactions utilisateur. C'est la métrique la plus difficile à améliorer car elle concerne le main thread JavaScript. Cible : &lt; 200 ms.</p>
<h3>Diagnostiquer les interactions lentes</h3>
<pre><code>// Identifier les interactions qui dégradent l'INP
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.interactionId &amp;&amp; entry.duration &gt; 200) {
      console.warn('Interaction lente détectée :', {
        type: entry.name,
        duree: entry.duration.toFixed(0) + 'ms',
        element: entry.target?.tagName,
        // Décomposer en phases
        delaiEntree: entry.processingStart - entry.startTime,
        tempsTreatement: entry.processingEnd - entry.processingStart,
        delaiPresentation: entry.duration - (entry.processingEnd - entry.startTime),
      });
    }
  }
}).observe({ type: 'event', buffered: true, durationThreshold: 100 });</code></pre>
<h3>Optimiser les gestionnaires d'événements lents</h3>
<pre><code>// Anti-pattern : travail lourd sur le main thread dans un handler
bouton.addEventListener('click', () => {
  const resultat = calculLong(données); // bloque le rendu
  afficherResultat(resultat);
});

// Solution 1 : déplacer vers un Web Worker
const worker = new Worker('/workers/calcul.js');
bouton.addEventListener('click', () => {
  worker.postMessage({ données });
});
worker.onmessage = (e) => afficherResultat(e.data);

// Solution 2 : découper avec scheduler.yield()
bouton.addEventListener('click', async () => {
  const lot1 = données.slice(0, 1000);
  traiter(lot1);

  await scheduler.yield(); // permettre au navigateur de peindre

  const lot2 = données.slice(1000);
  traiter(lot2);
});

// Solution 3 : debounce pour les événements fréquents
import { useDebouncedCallback } from 'use-debounce';

const handleRecherche = useDebouncedCallback((terme) => {
  fetchResultats(terme);
}, 300);</code></pre>
<h2>Surveiller en production : Real User Monitoring</h2>
<p>Les métriques synthétiques (Lighthouse) ne suffisent pas — les conditions réelles des utilisateurs varient énormément. Implémentez le RUM :</p>
<pre><code>// Avec la bibliothèque web-vitals
import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals';

function envoyerVerAnalytics(metrique) {
  const body = JSON.stringify({
    nom: metrique.name,
    valeur: metrique.value,
    note: metrique.rating, // 'good' | 'needs-improvement' | 'poor'
    id: metrique.id,
    page: window.location.pathname,
    connexion: navigator.connection?.effectiveType,
    appareil: /Mobile/.test(navigator.userAgent) ? 'mobile' : 'desktop',
  });

  // Utiliser sendBeacon pour ne pas bloquer la navigation
  navigator.sendBeacon('/api/analytics/vitals', body);
}

onCLS(envoyerVerAnalytics);
onINP(envoyerVerAnalytics);
onLCP(envoyerVerAnalytics);
onFCP(envoyerVerAnalytics);
onTTFB(envoyerVerAnalytics);</code></pre>
<p>L'amélioration des Core Web Vitals est souvent liée à l'architecture : les React Server Components réduisent le JavaScript côté client (voir notre <a href="/fr/blog/react-server-components-implications-architecture">guide RSC</a>), et le calcul edge réduit le TTFB (voir notre <a href="/fr/blog/cloudflare-workers-edge-computing-fr">guide Cloudflare Workers</a>). Les techniques CSS Grid avancées évitent les CLS liés aux changements de mise en page — consultez notre <a href="/fr/blog/css-grid-avance-mise-en-page">guide CSS Grid</a>.</p>`,
  },
  // POST FR-13
  {
    title: 'Architecture Event-Driven : Patterns, Compromis et Implémentation',
    slug: 'architecture-event-driven-guide',
    date: '2025-04-08T10:00:00',
    category: 'Backend',
    tags: ['Architecture', 'Kafka', 'Event-Driven', 'Microservices'],
    unsplashQuery: 'network cables fiber optic',
    internalLinks: ['construire-microservices-resilients-go', 'kubernetes-guide-production', 'patterns-gestion-erreurs'],
    content: `<h2>Quand et pourquoi adopter l'architecture event-driven</h2>
<p>L'architecture event-driven (EDA) est l'un des paradigmes architecturaux les plus puissants — et les plus mal compris — du développement backend moderne. Elle découple les producteurs d'événements des consommateurs, permet de composer des workflows complexes sans couplage direct, et offre une résilience naturelle aux pannes partielles. Mais elle introduit aussi une complexité opérationnelle significative : débogage distribué difficile, cohérence éventuelle à gérer explicitement, et risque de désordre chronologique des événements.</p>
<p>Ce guide couvre les patterns fondamentaux, les compromis honnêtes, et une implémentation concrète avec Apache Kafka.</p>
<h2>Les patterns fondamentaux de l'EDA</h2>
<h3>Event Notification</h3>
<p>Le pattern le plus simple : un service notifie les autres qu'un événement s'est produit, sans partager les données complètes. Les consommateurs rappellent pour obtenir les détails.</p>
<pre><code>// Producteur — service Commandes
interface EvenementCommandeCreee {
  type: 'COMMANDE_CREEE';
  commandeId: string;
  timestamp: string;
  // Pas de données complètes — juste un signal
}

await kafka.producer.send({
  topic: 'commandes',
  messages: [{
    key: commande.id,
    value: JSON.stringify({
      type: 'COMMANDE_CREEE',
      commandeId: commande.id,
      timestamp: new Date().toISOString(),
    } satisfies EvenementCommandeCreee),
  }],
});</code></pre>
<h3>Event-Carried State Transfer</h3>
<p>Le pattern plus courant en pratique : l'événement contient toutes les données nécessaires, évitant aux consommateurs de rappeler.</p>
<pre><code>interface EvenementCommandeCreeeAvecEtat {
  type: 'COMMANDE_CREEE';
  commandeId: string;
  timestamp: string;
  // Données complètes embarquées
  utilisateurId: string;
  produits: { produitId: string; quantite: number; prixUnitaire: number }[];
  total: number;
  adresseLivraison: { rue: string; ville: string; codePostal: string };
}</code></pre>
<h3>Event Sourcing</h3>
<p>Le pattern le plus avancé : l'état courant est calculé en rejouant l'historique des événements. Très puissant pour l'audit et le debugging, mais complexe à implémenter correctement.</p>
<pre><code>// L'état d'une commande est la projection de ses événements
type EvenementCommande =
  | { type: 'CommandeCreee'; commandeId: string; produits: Produit[] }
  | { type: 'ArticleAjoute'; commandeId: string; produit: Produit }
  | { type: 'CommandeAnnulee'; commandeId: string; raison: string }
  | { type: 'PaiementRecu'; commandeId: string; montant: number };

function projeterCommande(evenements: EvenementCommande[]): EtatCommande {
  return evenements.reduce((etat, evenement) => {
    switch (evenement.type) {
      case 'CommandeCreee':
        return { ...etat, statut: 'CREEE', produits: evenement.produits };
      case 'ArticleAjoute':
        return { ...etat, produits: [...etat.produits, evenement.produit] };
      case 'CommandeAnnulee':
        return { ...etat, statut: 'ANNULEE', raisonAnnulation: evenement.raison };
      case 'PaiementRecu':
        return { ...etat, statut: 'PAYEE', montantPaye: evenement.montant };
      default:
        return etat;
    }
  }, { statut: 'INEXISTANTE', produits: [] } as EtatCommande);
}</code></pre>
<h2>Kafka : architecture et configuration</h2>
<p>Apache Kafka est le broker de messages de référence pour les architectures event-driven à grande échelle. Ses concepts clés :</p>
<pre><code>// Configuration du producteur Kafka (Node.js avec kafkajs)
import { Kafka, CompressionTypes, logLevel } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'service-commandes',
  brokers: ['kafka-1:9092', 'kafka-2:9092', 'kafka-3:9092'],
  retry: {
    initialRetryTime: 300,
    retries: 10,
    multiplier: 2,
    maxRetryTime: 30000,
  },
});

const producteur = kafka.producer({
  idempotent: true,            // garantie exactly-once
  transactionalId: 'commandes-prod', // pour les transactions
  maxInFlightRequests: 1,      // requis avec idempotent: true
});

await producteur.connect();

// Envoi transactionnel : soit tout passe, soit rien
await producteur.transaction(async (tx) => {
  await tx.send({
    topic: 'commandes',
    compression: CompressionTypes.GZIP,
    messages: [{
      key: commande.id,
      value: JSON.stringify(evenement),
      headers: {
        'correlation-id': correlationId,
        'source-service': 'commandes',
        'schema-version': '2',
      },
    }],
  });

  // Sauvegarder en DB dans la même transaction
  await sauvegarderDansDB(commande, tx);
});</code></pre>
<h2>Consommateurs et gestion des erreurs</h2>
<pre><code>const consommateur = kafka.consumer({
  groupId: 'service-livraison',
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
});

await consommateur.connect();
await consommateur.subscribe({ topics: ['commandes'], fromBeginning: false });

await consommateur.run({
  partitionsConsumedConcurrently: 3,
  eachMessage: async ({ topic, partition, message, heartbeat }) => {
    const evenement = JSON.parse(message.value.toString());

    try {
      await traiterEvenement(evenement);
    } catch (erreur) {
      if (estErreurTransitoire(erreur)) {
        // Re-throw : Kafka va réessayer depuis le dernier offset committé
        throw erreur;
      }
      // Erreur permanente : envoyer vers la Dead Letter Queue
      await envoyerVersDLQ(topic, message, erreur);
      // Ne pas throw : committer l'offset pour continuer
    }

    // Committer manuellement pour un contrôle précis
    await consommateur.commitOffsets([{
      topic,
      partition,
      offset: (BigInt(message.offset) + 1n).toString(),
    }]);
  },
});</code></pre>
<h2>Schéma Registry et compatibilité</h2>
<p>Dans une architecture event-driven mature, les schémas d'événements doivent être versionnés et compatibles. Confluent Schema Registry avec Avro ou Protobuf garantit la compatibilité évolutive :</p>
<pre><code>// Schéma Avro pour EvenementCommandeCreee
const schema = {
  type: 'record',
  name: 'EvenementCommandeCreee',
  namespace: 'com.monapp.commandes',
  fields: [
    { name: 'commandeId', type: 'string' },
    { name: 'utilisateurId', type: 'string' },
    { name: 'total', type: 'double' },
    { name: 'timestamp', type: 'long', logicalType: 'timestamp-millis' },
    // Champ optionnel ajouté en v2 — compatible backwards
    { name: 'canalAcquisition', type: ['null', 'string'], default: null },
  ],
};</code></pre>
<h2>Saga pattern pour les transactions distribuées</h2>
<p>Lorsqu'une opération métier implique plusieurs services, le pattern Saga coordonne les rollbacks en cas d'échec partiel :</p>
<pre><code>// Saga choreography pour la création de commande
// 1. CommandeService publie 'COMMANDE_CREEE'
// 2. StockService consomme, réserve le stock, publie 'STOCK_RESERVE' ou 'STOCK_INSUFFISANT'
// 3. PaiementService consomme 'STOCK_RESERVE', débite, publie 'PAIEMENT_EFFECTUE' ou 'PAIEMENT_ECHOUE'
// 4. LivraisonService consomme 'PAIEMENT_EFFECTUE', crée la livraison
// Compensation: si PAIEMENT_ECHOUE, StockService libère le stock sur cet événement

class SagaCreationCommande {
  async compenserStockReserve(commandeId: string): Promise&lt;void&gt; {
    await this.stockService.libererReservation(commandeId);
    await this.publier({
      type: 'RESERVATION_ANNULEE',
      commandeId,
      timestamp: new Date().toISOString(),
    });
  }
}</code></pre>
<p>L'architecture event-driven s'articule étroitement avec les microservices — notre guide sur les <a href="/fr/blog/construire-microservices-resilients-go">microservices résilients avec Go</a> couvre les patterns de communication. Pour le déploiement de Kafka en production, consultez notre <a href="/fr/blog/kubernetes-guide-production">guide Kubernetes</a>. La gestion des erreurs dans les consommateurs est detaillée dans notre article sur les <a href="/fr/blog/patterns-gestion-erreurs">patterns d'erreurs TypeScript</a>.</p>`,
  },
  // POST FR-14
  {
    title: 'Workflows Git pour les Équipes : Stratégies de Branches, Revue de Code et Gestion des Releases',
    slug: 'workflows-git-equipe',
    date: '2025-05-06T09:00:00',
    category: 'DevOps',
    tags: ['Git', 'GitHub', 'Workflow', 'CI/CD', 'Revue de code'],
    unsplashQuery: 'team collaboration workflow',
    internalLinks: ['docker-conteneurs-production', 'monorepo-turborepo-guide', 'strategies-tests-applications-web'],
    content: `<h2>Git en équipe : les fondamentaux avant les outils</h2>
<p>La plupart des équipes qui ont des problèmes avec Git n'ont pas un problème d'outils — elles ont un problème de conventions non partagées. Quand nommer une branche <code>fix/bug</code> vs <code>bugfix/description</code>, quand squasher les commits, comment gérer un hotfix en parallèle d'une release planifiée — ces décisions non documentées créent des frictions quotidiennes. Ce guide propose un système complet et cohérent que vous pouvez adopter tel quel ou adapter à votre contexte.</p>
<h2>Stratégies de branches : GitFlow vs Trunk-Based Development</h2>
<p>Deux philosophies dominantes s'affrontent :</p>
<p><strong>GitFlow</strong> convient aux équipes avec des cycles de release longs et plusieurs versions en production simultanément (logiciels on-premise, applications mobiles). Il utilise des branches <code>develop</code>, <code>release/*</code>, <code>hotfix/*</code> et <code>feature/*</code>.</p>
<p><strong>Trunk-Based Development (TBD)</strong> convient aux équipes pratiquant le déploiement continu — tout le monde intègre sur <code>main</code> au moins une fois par jour, les feature flags masquent les fonctionnalités incomplètes.</p>
<pre><code># Trunk-Based Development avec feature flags
# Branche courte durée de vie (&lt; 2 jours)
git checkout -b feat/nouveau-dashboard

# Commits atomiques avec Conventional Commits
git commit -m "feat(dashboard): ajouter widget métriques temps réel

Ajoute un graphique en temps réel des métriques API.
Le rendu est conditionnel au feature flag DASHBOARD_V2.

Refs #1234"

# Intégrer rapidement dans main
git fetch origin
git rebase origin/main
git push origin feat/nouveau-dashboard
# Ouvrir une PR → review → merge dans les 24-48h</code></pre>
<h2>Convention de nommage des branches</h2>
<pre><code># Structure : type/numero-ticket-description-courte

feat/1234-authentification-sso
fix/1235-correction-calcul-tva
refactor/1236-migration-typescript
docs/1237-api-reference-update
chore/1238-upgrade-dependances-q2

# Hooks Git pour imposer la convention
# .git/hooks/commit-msg
#!/bin/sh
COMMIT_MSG_FILE=$1
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

PATTERN="^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?: .{1,72}"

if ! echo "$COMMIT_MSG" | grep -qE "$PATTERN"; then
  echo "Format de commit invalide. Utilisez: type(scope): description"
  echo "Types valides: feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert"
  exit 1
fi</code></pre>
<h2>Configuration de la protection des branches</h2>
<pre><code># .github/branch-protection.yml (via GitHub CLI)
gh api repos/ORG/REPO/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["lint","test","build"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true,"require_code_owner_reviews":true}' \
  --field restrictions=null</code></pre>
<h2>Revue de code efficace avec GitHub CLI</h2>
<pre><code># Lister les PRs en attente de ma review
gh pr list --search "review-requested:@me" --json number,title,author,createdAt

# Checker out une PR rapidement
gh pr checkout 1234

# Commenter avec des suggestions de code
gh pr review 1234 \
  --comment \
  --body "Quelques suggestions après relecture..."

# Approuver et merger (squash pour garder l'historique propre)
gh pr review 1234 --approve
gh pr merge 1234 --squash --delete-branch</code></pre>
<h2>Semantic Release : versionning automatique</h2>
<p>Semantic Release analyse vos commits Conventional Commits et détermine automatiquement le prochain numéro de version :</p>
<pre><code>// release.config.js
module.exports = {
  branches: [
    'main',
    { name: 'beta', prerelease: true },
    { name: 'alpha', prerelease: true },
  ],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/changelog',
    ['@semantic-release/npm', { npmPublish: false }],
    ['@semantic-release/github', {
      assets: [
        { path: 'dist/*.js', label: 'Distribution' },
      ],
    }],
    ['@semantic-release/git', {
      assets: ['CHANGELOG.md', 'package.json'],
      message: 'chore(release): \${nextRelease.version} [skip ci]\\n\\n\${nextRelease.notes}',
    }],
  ],
};</code></pre>
<h2>Gestion des hotfixes en production</h2>
<pre><code># Scénario : bug critique en production sur v2.3.1
# main est déjà sur v2.4.0-beta

# 1. Créer une branche hotfix depuis le tag de production
git checkout -b hotfix/2.3.2-critique-paiement v2.3.1

# 2. Corriger le bug
git commit -m "fix(paiement): correction dépassement entier sur montants > 2^31"

# 3. Tag et merge
git tag v2.3.2
git checkout main
git merge hotfix/2.3.2-critique-paiement --no-ff
git push origin main --tags

# 4. Cherry-pick sur la branche beta si nécessaire
git checkout beta
git cherry-pick hotfix/2.3.2-critique-paiement</code></pre>
<h2>Hooks de pre-commit avec Husky et lint-staged</h2>
<pre><code>// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{css,scss}": ["stylelint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}

// .husky/pre-commit
#!/bin/sh
npx lint-staged

// .husky/pre-push
#!/bin/sh
npm run test:unit -- --run  # tests rapides uniquement avant push</code></pre>
<h2>Rebase interactif pour nettoyer l'historique</h2>
<pre><code># Nettoyer les 5 derniers commits avant de pousser
git rebase -i HEAD~5

# Dans l'éditeur interactif :
# pick abc1234 feat: ajouter authentification
# squash def5678 wip: corrections typos
# squash ghi9012 fix: corriger bug introduction
# reword jkl3456 feat: page profil utilisateur
# pick mno7890 test: ajouter tests authentification

# Résultat : historique propre avec des commits atomiques et significatifs</code></pre>
<p>Un bon workflow Git s'intègre avec votre pipeline CI/CD — notre guide sur <a href="/fr/blog/docker-conteneurs-production">Docker en production</a> couvre les stratégies de déploiement basées sur les tags Git. Pour les monorepos, la stratégie de branches se complexifie : consultez notre <a href="/fr/blog/monorepo-turborepo-guide">guide Turborepo</a>. Les tests automatiques en CI qui valident vos PR sont détaillés dans notre article sur les <a href="/fr/blog/strategies-tests-applications-web">stratégies de tests</a>.</p>`,
  },
  // POST FR-15
  {
    title: 'Conception d\'API : REST, GraphQL et tRPC Comparés',
    slug: 'conception-api-rest-graphql-trpc',
    date: '2025-06-10T10:00:00',
    category: 'Backend',
    tags: ['API', 'REST', 'GraphQL', 'tRPC', 'TypeScript'],
    unsplashQuery: 'api connection network interface',
    internalLinks: ['securiser-api-rest-checklist', 'typescript-generiques-avances', 'patterns-gestion-erreurs'],
    content: `<h2>Choisir entre REST, GraphQL et tRPC : au-delà du dogme</h2>
<p>Le débat REST vs GraphQL est l'une des discussions les plus clivantes du développement web — et l'une des moins productives, car les trois approches sont des outils adaptés à des contextes différents. REST est simple, universel et bien compris. GraphQL donne au client le contrôle sur la forme des données et excelle pour les APIs publiques consommées par des clients variés. tRPC est la solution la plus productive quand le serveur et le client sont écrits en TypeScript dans le même monorepo. Ce guide vous aidera à choisir en connaissance de cause et vous montrera comment implémenter chacun correctement.</p>
<h2>REST : principes et bonnes pratiques</h2>
<p>REST bien implémenté est élégant, prédictible et facile à documenter. Les erreurs courantes à éviter :</p>
<pre><code>// Mauvaise conception REST
POST /api/getUtilisateur     // verbe dans l'URL
POST /api/creerOuMettreAJour // ambiguïté

// Bonne conception REST
GET    /api/utilisateurs          // liste
POST   /api/utilisateurs          // créer
GET    /api/utilisateurs/:id      // détail
PUT    /api/utilisateurs/:id      // remplacement complet
PATCH  /api/utilisateurs/:id      // modification partielle
DELETE /api/utilisateurs/:id      // supprimer

// Relations imbriquées
GET /api/utilisateurs/:id/commandes       // commandes d'un utilisateur
POST /api/utilisateurs/:id/commandes      // créer une commande pour cet utilisateur

// Actions non-CRUD (verbes d'action)
POST /api/commandes/:id/annuler           // action métier
POST /api/utilisateurs/:id/reinitialiser-mot-de-passe</code></pre>
<h3>Codes de statut HTTP corrects</h3>
<pre><code>// 200 OK — succès général
// 201 Created — ressource créée (avec Location header)
// 204 No Content — succès sans corps de réponse (DELETE)
// 400 Bad Request — données invalides côté client
// 401 Unauthorized — non authentifié
// 403 Forbidden — authentifié mais pas autorisé
// 404 Not Found — ressource inexistante
// 409 Conflict — conflit (email déjà utilisé)
// 422 Unprocessable Entity — validation métier échouée
// 429 Too Many Requests — rate limit dépassé
// 500 Internal Server Error — erreur serveur

// Réponse d'erreur standardisée (RFC 7807 Problem Details)
{
  "type": "https://api.exemple.com/erreurs/validation",
  "title": "Données invalides",
  "status": 422,
  "detail": "L'adresse email est déjà associée à un compte",
  "instance": "/api/utilisateurs",
  "champs": {
    "email": "Cette adresse est déjà utilisée"
  }
}</code></pre>
<h2>GraphQL : quand le client dicte la forme des données</h2>
<p>GraphQL brille pour les APIs publiques et les frontends qui ont des besoins très différents (dashboard admin vs application mobile) :</p>
<pre><code># Schéma GraphQL
type Utilisateur {
  id: ID!
  nom: String!
  email: String!
  commandes(limite: Int, statut: StatutCommande): [Commande!]!
  abonnement: Abonnement
}

type Commande {
  id: ID!
  statut: StatutCommande!
  total: Float!
  articles: [ArticleCommande!]!
  livraison: Livraison
}

type Query {
  utilisateur(id: ID!): Utilisateur
  utilisateurs(filtre: FiltreUtilisateur, pagination: Pagination): PageUtilisateurs!
}

type Mutation {
  creerCommande(input: InputCommande!): ResultatCommande!
  annulerCommande(id: ID!, raison: String): Commande!
}

type Subscription {
  statutCommandeMisAJour(commandeId: ID!): Commande!
}</code></pre>
<pre><code>// Implémentation avec Apollo Server 4
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';

const server = new ApolloServer({
  typeDefs,
  resolvers: {
    Query: {
      utilisateur: async (_, { id }, { dataSources }) => {
        return dataSources.utilisateurAPI.obtenirParId(id);
      },
    },
    Utilisateur: {
      // Resolver de champ — évite le N+1 avec DataLoader
      commandes: async (parent, { limite, statut }, { dataSources }) => {
        return dataSources.commandeAPI.parUtilisateur(parent.id, { limite, statut });
      },
    },
  },
  plugins: [ApolloServerPluginInlineTrace()],
});

// DataLoader pour grouper les requêtes (résout N+1)
const commandeLoader = new DataLoader(async (utilisateurIds: readonly string[]) => {
  const commandes = await db.commande.findMany({
    where: { utilisateurId: { in: [...utilisateurIds] } },
  });
  return utilisateurIds.map(id => commandes.filter(c => c.utilisateurId === id));
});</code></pre>
<h2>tRPC : type-safety de bout en bout sans compromis</h2>
<p>tRPC est la solution la plus radicale et la plus productive pour les applications full-stack TypeScript. Zéro schéma GraphQL à écrire, zéro sérialisation manuelle :</p>
<pre><code>// server/api/router/commandes.ts
import { z } from 'zod';
import { router, publiceProcedure, procedurePrivee } from '../trpc';
import { TRPCError } from '@trpc/server';

export const routeurCommandes = router({
  liste: procedurePrivee
    .input(z.object({
      statut: z.enum(['EN_ATTENTE', 'CONFIRMEE', 'LIVREE', 'ANNULEE']).optional(),
      page: z.number().int().min(1).default(1),
      parPage: z.number().int().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const commandes = await ctx.db.commande.findMany({
        where: {
          utilisateurId: ctx.session.utilisateurId,
          ...(input.statut && { statut: input.statut }),
        },
        skip: (input.page - 1) * input.parPage,
        take: input.parPage,
        orderBy: { createdAt: 'desc' },
      });
      return commandes;
    }),

  creer: procedurePrivee
    .input(z.object({
      produits: z.array(z.object({
        produitId: z.string().cuid(),
        quantite: z.number().int().min(1).max(99),
      })).min(1),
      adresseLivraisonId: z.string().cuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Types inférés automatiquement depuis l'input Zod
      const commande = await ctx.db.commande.create({
        data: {
          utilisateurId: ctx.session.utilisateurId,
          statut: 'EN_ATTENTE',
          articles: {
            create: input.produits.map(p => ({
              produitId: p.produitId,
              quantite: p.quantite,
            })),
          },
          adresseLivraisonId: input.adresseLivraisonId,
        },
      });
      return commande;
    }),
});</code></pre>
<pre><code>// Côté client — types inférés automatiquement, zéro configuration
import { trpc } from '@/lib/trpc';

function MesCommandes() {
  const { data, isLoading } = trpc.commandes.liste.useQuery({
    statut: 'EN_ATTENTE',
    page: 1,
  });

  const creer = trpc.commandes.creer.useMutation({
    onSuccess: () => utils.commandes.liste.invalidate(),
  });

  // data est typé comme Commande[] — pas de \`as\`, pas d'any
  return (
    &lt;ul&gt;
      {data?.map(commande =&gt; (
        &lt;li key={commande.id}&gt;{commande.statut}&lt;/li&gt;
      ))}
    &lt;/ul&gt;
  );
}</code></pre>
<h2>Tableau de comparaison</h2>
<table>
  <tr><th>Critère</th><th>REST</th><th>GraphQL</th><th>tRPC</th></tr>
  <tr><td>API publique/tiers</td><td>Excellent</td><td>Excellent</td><td>Non adapté</td></tr>
  <tr><td>Flexibilité requêtes</td><td>Faible</td><td>Excellente</td><td>Bonne</td></tr>
  <tr><td>Type safety</td><td>Manuel</td><td>Codegen</td><td>Automatique</td></tr>
  <tr><td>Learning curve</td><td>Faible</td><td>Moyenne</td><td>Faible (si TypeScript)</td></tr>
  <tr><td>Performance</td><td>Bonne</td><td>Variable (N+1)</td><td>Bonne</td></tr>
  <tr><td>Outillage</td><td>Mature</td><td>Mature</td><td>En croissance</td></tr>
</table>
<p>La sécurité de vos APIs quelle que soit la technologie choisie est couverte dans notre <a href="/fr/blog/securiser-api-rest-checklist">checklist de sécurité API REST</a>. Pour tirer le maximum de tRPC, les génériques TypeScript avancés sont essentiels — consultez notre <a href="/fr/blog/typescript-generiques-avances">guide sur les génériques TypeScript</a>. La gestion des erreurs de type dans les trois approches est détaillée dans les <a href="/fr/blog/patterns-gestion-erreurs">patterns de gestion d'erreurs TypeScript</a>.</p>`,
  },
  // POST FR-16
  {
    title: 'Animations UI et Motion Design : Performance, Accessibilité et Maîtrise',
    slug: 'animations-ui-motion-design',
    date: '2025-07-15T09:00:00',
    category: 'Frontend',
    tags: ['Animation', 'CSS', 'Motion', 'Accessibilité', 'Framer Motion'],
    unsplashQuery: 'motion blur light trails',
    internalLinks: ['css-grid-avance-mise-en-page', 'systemes-design-a-echelle', 'core-web-vitals-performance-fr'],
    content: `<h2>Les animations qui améliorent vs celles qui agacent</h2>
<p>Une animation bien conçue réduit la charge cognitive en guidant l'attention, confirme les actions utilisateur, et rend une interface plus "physique" et intuitive. Une animation mal conçue distrait, ralentit, et peut provoquer des malaises physiques chez les utilisateurs sensibles aux mouvements. La différence entre les deux tient rarement à la complexité technique — elle tient à comprendre la physique du mouvement, les principes de l'accessibilité, et les contraintes de performance du navigateur.</p>
<h2>Les fondamentaux physiques des animations crédibles</h2>
<p>Les animations qui "sonnent juste" obéissent à des principes physiques réels. Le premier principe est que rien dans la nature ne commence ni ne s'arrête instantanément :</p>
<pre><code>/* Mauvais : linéaire, robotique */
.element {
  transition: transform 300ms linear;
}

/* Bon : ease-out — démarre vite, ralentit à la fin (objet qui s'arrête) */
.element {
  transition: transform 300ms cubic-bezier(0.0, 0.0, 0.2, 1);
}

/* Excellent : spring — rebond naturel */
.element {
  /* Avec CSS @keyframes pour simuler un spring */
  animation: spring-in 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Courbes de référence */
:root {
  --ease-entree:   cubic-bezier(0.0, 0.0, 0.2, 1);
  --ease-sortie:   cubic-bezier(0.4, 0.0, 1, 1);
  --ease-standard: cubic-bezier(0.4, 0.0, 0.2, 1);
  --ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1);
}</code></pre>
<h2>Ce que le navigateur peut animer gratuitement</h2>
<p>Le moteur de rendu du navigateur opère sur deux threads : le main thread (JavaScript, style, layout) et le compositor thread (painting, compositing). Les animations qui restent sur le compositor thread ne provoquent jamais de jank, même si le main thread est occupé :</p>
<pre><code>/* Ces propriétés sont animées sur le compositor — toujours 60fps+ */
.gpu-accelere {
  transform: translateX(0);   /* translate, scale, rotate, skew */
  opacity: 1;
  filter: blur(0px);          /* Attention : coûteux en mémoire GPU */
}

/* Ces propriétés forcent un layout recalcul — éviter en animation */
/* width, height, top, left, margin, padding, font-size */

/* Pattern correct : utiliser transform au lieu de left/top */
.mouvant-mauvais {
  position: absolute;
  left: 0;
  transition: left 300ms ease; /* Déclenche layout à chaque frame */
}

.mouvant-bon {
  position: absolute;
  transform: translateX(0);
  transition: transform 300ms var(--ease-standard); /* Compositor seulement */
}

/* Forcer la promotion sur le GPU pour les éléments animés fréquemment */
.toujours-anime {
  will-change: transform; /* Utiliser avec parcimonie — consomme de la VRAM */
}</code></pre>
<h2>Framer Motion : animations déclaratives en React</h2>
<p>Framer Motion est la bibliothèque d'animation React la plus complète. Son API déclarative masque la complexité des Web Animations API et des calculs d'interpolation :</p>
<pre><code>import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

// Variantes pour des animations coordonnées
const variantesConteneur = {
  cache: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,  // décalage entre enfants
      delayChildren: 0.2,
    },
  },
};

const variantesElement = {
  cache: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
};

function ListeAnimee({ items }: { items: string[] }) {
  const prefereReductionMouvement = useReducedMotion();

  return (
    &lt;motion.ul
      variants={variantesConteneur}
      initial="cache"
      animate="visible"
    &gt;
      {items.map((item) =&gt; (
        &lt;motion.li
          key={item}
          variants={prefereReductionMouvement ? undefined : variantesElement}
          layout // anime automatiquement les changements de position
        &gt;
          {item}
        &lt;/motion.li&gt;
      ))}
    &lt;/motion.ul&gt;
  );
}

// AnimatePresence pour les animations d'entrée/sortie du DOM
function FenetreModale({ ouverte, onFermer, children }) {
  return (
    &lt;AnimatePresence&gt;
      {ouverte &amp;&amp; (
        &lt;motion.div
          key="modal"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', duration: 0.3 }}
          className="modal"
        &gt;
          {children}
        &lt;/motion.div&gt;
      )}
    &lt;/AnimatePresence&gt;
  );
}</code></pre>
<h2>Accessibilité et prefers-reduced-motion</h2>
<p>Environ 35% des adultes souffrent de vertiges ou malaises liés aux mouvements à l'écran. La media query <code>prefers-reduced-motion</code> est obligatoire, pas optionnelle :</p>
<pre><code>/* CSS : désactiver les animations quand l'utilisateur le demande */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* Alternative plus nuancée : remplacer par des transitions subtiles */
@media (prefers-reduced-motion: reduce) {
  .carte-interactive {
    transition: opacity 150ms ease; /* opacité ok, pas de transform */
  }
  .carousel {
    scroll-behavior: auto;
    /* Désactiver l'autoplay */
  }
}</code></pre>
<h2>Animations de page avec View Transitions API</h2>
<p>La View Transitions API (disponible dans Chrome 111+, Firefox 130+) permet des transitions de page fluides sans bibliothèque :</p>
<pre><code>// Navigation avec transition de vue
async function naviguerVers(url: string) {
  if (!document.startViewTransition) {
    window.location.href = url;
    return;
  }

  document.startViewTransition(async () => {
    await fetch(url).then(r =&gt; r.text()).then(html =&gt; {
      document.querySelector('main')!.innerHTML =
        new DOMParser().parseFromString(html, 'text/html')
          .querySelector('main')!.innerHTML;
    });
  });
}

/* CSS pour personnaliser la transition */
::view-transition-old(root) {
  animation: 250ms ease-out both fondu-sortie;
}

::view-transition-new(root) {
  animation: 250ms ease-in both fondu-entree;
}

@keyframes fondu-sortie {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(-30px); }
}

@keyframes fondu-entree {
  from { opacity: 0; transform: translateX(30px); }
  to   { opacity: 1; transform: translateX(0); }
}</code></pre>
<h2>Audit de performance des animations</h2>
<p>Pour mesurer l'impact de vos animations sur les Core Web Vitals :</p>
<pre><code>// Détecter les animations qui causent des jank
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration &gt; 50) {
      console.warn('Long Task détecté pendant animation:', {
        duree: entry.duration.toFixed(0) + 'ms',
        debut: entry.startTime.toFixed(0),
      });
    }
  }
});
observer.observe({ type: 'longtask', buffered: true });

// Dans les DevTools Chrome : activer "Show paint flashing"
// Les zones vertes clignotantes = repaint inutile = animation non-composited</code></pre>
<p>Les animations s'intègrent naturellement dans un système de design — consultez notre <a href="/fr/blog/systemes-design-a-echelle">guide sur les systèmes de design</a> pour tokéniser vos durées et courbes d'animation. Les implications des animations sur les Core Web Vitals, notamment l'INP et le CLS, sont détaillées dans notre article sur les <a href="/fr/blog/core-web-vitals-performance-fr">Core Web Vitals</a>. Pour les mises en page animées avec CSS Grid, notre guide <a href="/fr/blog/css-grid-avance-mise-en-page">CSS Grid avancé</a> couvre les transitions de grille.</p>`,
  },
  // POST FR-17
  {
    title: 'Kubernetes en Production : Déploiements, Autoscaling et Fiabilité',
    slug: 'kubernetes-guide-production',
    date: '2025-08-12T10:00:00',
    category: 'DevOps',
    tags: ['Kubernetes', 'K8s', 'DevOps', 'Conteneurs', 'Production'],
    unsplashQuery: 'server infrastructure operations',
    internalLinks: ['docker-conteneurs-production', 'construire-microservices-resilients-go', 'architecture-event-driven-guide'],
    content: `<h2>Kubernetes : la complexité justifiée</h2>
<p>Kubernetes est notoirement complexe à appréhender. Sa courbe d'apprentissage est raide, sa surface API est vaste, et ses messages d'erreur sont parfois énigmatiques. Pourtant, des milliers d'entreprises font le choix délibéré de l'adopter parce qu'aucune autre plateforme ne combine aussi naturellement l'autoscaling, l'autorédémarrage, les rolling updates sans downtime, et la gestion des secrets à grande échelle. Ce guide se concentre sur les configurations de production qui font réellement la différence entre un cluster stable et un cluster qui réveille son équipe à 3h du matin.</p>
<h2>Anatomy d'un Deployment de production</h2>
<pre><code>apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-service
  namespace: production
  labels:
    app: api-service
    version: "2.4.1"
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-service
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0    # zéro downtime
      maxSurge: 1          # un pod supplémentaire pendant le déploiement
  template:
    metadata:
      labels:
        app: api-service
        version: "2.4.1"
    spec:
      # Empêcher plusieurs pods sur le même noeud
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values: [api-service]
              topologyKey: kubernetes.io/hostname

      containers:
      - name: api
        image: registre.exemple.com/api-service:2.4.1
        ports:
        - containerPort: 8080

        # Limites de ressources — TOUJOURS définir en production
        resources:
          requests:
            cpu: "250m"
            memory: "256Mi"
          limits:
            cpu: "1000m"
            memory: "512Mi"

        # Probes
        readinessProbe:
          httpGet:
            path: /readyz
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
          failureThreshold: 3

        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 15
          failureThreshold: 3

        # Variables d'environnement depuis Secrets
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: database-url
        - name: NODE_ENV
          value: "production"

        # Sécurité du conteneur
        securityContext:
          runAsNonRoot: true
          runAsUser: 1001
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop: ["ALL"]

      # Délai de grâce pour le graceful shutdown
      terminationGracePeriodSeconds: 60</code></pre>
<h2>Horizontal Pod Autoscaler (HPA)</h2>
<p>L'autoscaling basé sur le CPU est le plus simple à configurer. L'autoscaling basé sur des métriques custom (requêtes en file, profondeur de queue Kafka) est plus précis pour les workloads event-driven :</p>
<pre><code>apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-service-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-service
  minReplicas: 2
  maxReplicas: 20
  metrics:
  # Autoscaling CPU
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70

  # Autoscaling mémoire
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80

  # Métrique custom : requêtes par seconde (via Prometheus Adapter)
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "100"

  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300  # attendre 5 min avant de réduire
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60  # max -50% par minute
    scaleUp:
      stabilizationWindowSeconds: 0  # scale up immédiatement
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15</code></pre>
<h2>Network Policies : isolation réseau</h2>
<pre><code># Par défaut, K8s est permissif — tout pod peut parler à tout pod
# Définir des Network Policies pour l'isolation

apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-service-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api-service
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: nginx-ingress  # seulement depuis l'ingress
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres        # base de données
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - namespaceSelector:
        matchLabels:
          name: monitoring     # métriques Prometheus
    ports:
    - protocol: TCP
      port: 9090</code></pre>
<h2>PodDisruptionBudget : disponibilité pendant les maintenances</h2>
<pre><code>apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-service-pdb
  namespace: production
spec:
  minAvailable: 2  # au moins 2 pods disponibles en permanence
  selector:
    matchLabels:
      app: api-service</code></pre>
<h2>Monitoring avec kube-prometheus-stack</h2>
<pre><code># Installer la stack complète (Prometheus + Grafana + AlertManager)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  --set prometheus.prometheusSpec.retention=30d \
  --set grafana.adminPassword=$GRAFANA_PASSWORD \
  --set alertmanager.config.global.slack_api_url=$SLACK_WEBHOOK</code></pre>
<h2>GitOps avec ArgoCD</h2>
<p>Le GitOps synchronise automatiquement l'état du cluster avec les manifestes dans Git — chaque déploiement est un commit, chaque rollback est un revert :</p>
<pre><code># Application ArgoCD
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: api-service
  namespace: argocd
spec:
  project: production
  source:
    repoURL: https://github.com/monorg/infra
    targetRevision: HEAD
    path: kubernetes/production/api-service
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true      # supprimer les ressources supprimées du Git
      selfHeal: true   # corriger les dérives manuelles
    syncOptions:
    - CreateNamespace=true</code></pre>
<p>Kubernetes orchestre les conteneurs que vous construisez avec les patterns de notre <a href="/fr/blog/docker-conteneurs-production">guide Docker en production</a>. Les microservices Go y tournent naturellement — consultez notre guide sur les <a href="/fr/blog/construire-microservices-resilients-go">microservices résilients</a> pour les patterns de health check et graceful shutdown requis par K8s. Pour les architectures event-driven sur Kubernetes avec Kafka, notre <a href="/fr/blog/architecture-event-driven-guide">guide EDA</a> couvre le déploiement de brokers.</p>`,
  },
  // POST FR-18
  {
    title: 'WebSockets en Production : Architecture Temps Réel qui Passe à l\'Échelle',
    slug: 'websockets-production-temps-reel',
    date: '2025-09-09T10:00:00',
    category: 'Backend',
    tags: ['WebSockets', 'Temps réel', 'Node.js', 'Scalabilité'],
    unsplashQuery: 'network data stream communication',
    internalLinks: ['construire-microservices-resilients-go', 'architecture-event-driven-guide', 'cloudflare-workers-edge-computing-fr'],
    content: `<h2>Le vrai défi des WebSockets en production</h2>
<p>Faire fonctionner des WebSockets en développement local est trivial. Faire fonctionner des WebSockets fiablement en production avec 100 000 connexions simultanées sur plusieurs serveurs, derrière un load balancer, avec une reconnexion transparente côté client, des heartbeats, et une distribution des messages inter-serveurs — c'est là que la plupart des équipes rencontrent des obstacles imprévus. Ce guide traite des problèmes de production réels, pas des exemples de chat tutoriel.</p>
<h2>Architecture de base avec Socket.IO</h2>
<p>Socket.IO ajoute une couche d'abstraction au-dessus des WebSockets natifs : reconnexion automatique, fallback HTTP long-polling, rooms et namespaces, et acquittements :</p>
<pre><code>// server.ts
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
  pingTimeout: 20000,      // déclarer le client mort après 20s sans pong
  pingInterval: 25000,     // envoyer un ping toutes les 25s
  maxHttpBufferSize: 1e6,  // 1 MB max par message
  transports: ['websocket', 'polling'], // WebSocket d'abord, fallback polling
});

// Adapter Redis pour la distribution inter-serveurs
const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));</code></pre>
<h2>Authentification et autorisation des connexions WebSocket</h2>
<pre><code>// Middleware Socket.IO pour l'authentification
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token ||
                socket.handshake.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return next(new Error('Token d\'authentification manquant'));
  }

  try {
    const payload = await verifierJWT(token);
    socket.data.utilisateur = payload;
    socket.data.utilisateurId = payload.sub;
    next();
  } catch (err) {
    next(new Error('Token invalide ou expiré'));
  }
});

// Rejoindre des rooms basées sur les droits utilisateur
io.on('connection', async (socket) => {
  const { utilisateurId, roles } = socket.data.utilisateur;

  // Room personnelle — notifications ciblées
  socket.join(\`utilisateur:\${utilisateurId}\`);

  // Rooms d'abonnement
  const abonnements = await obtenirAbonnements(utilisateurId);
  for (const abo of abonnements) {
    socket.join(\`projet:\${abo.projetId}\`);
  }

  console.log(\`Connexion: \${utilisateurId} (total: \${io.engine.clientsCount})\`);

  socket.on('disconnect', (raison) => {
    console.log(\`Déconnexion: \${utilisateurId}, raison: \${raison}\`);
  });
});</code></pre>
<h2>Scalabilité horizontale avec Redis Pub/Sub</h2>
<p>Avec plusieurs instances de serveur WebSocket, chaque instance ne connaît que ses propres connexions. L'adapter Redis propage les événements à tous les serveurs :</p>
<pre><code>// Émettre vers un utilisateur spécifique depuis n'importe quel service
// (même si la connexion est sur un autre serveur)
async function notifierUtilisateur(utilisateurId: string, evenement: string, data: unknown) {
  // L'adapter Redis s'occupe de propager vers le bon serveur
  io.to(\`utilisateur:\${utilisateurId}\`).emit(evenement, data);
}

// Depuis un autre service (ex: service Commandes) via Redis directement
const publisher = createClient({ url: process.env.REDIS_URL });
await publisher.connect();

async function notifierDepuisService(utilisateurId: string, data: object) {
  await publisher.publish(
    'socket:notification',
    JSON.stringify({ utilisateurId, ...data })
  );
}

// Côté serveur WebSocket : écouter le channel Redis
const subscriber = createClient({ url: process.env.REDIS_URL });
await subscriber.connect();
await subscriber.subscribe('socket:notification', (message) => {
  const { utilisateurId, ...data } = JSON.parse(message);
  io.to(\`utilisateur:\${utilisateurId}\`).emit('notification', data);
});</code></pre>
<h2>Reconnexion côté client et état offline</h2>
<pre><code>// client.ts
import { io, Socket } from 'socket.io-client';

class GestionnaireSocket {
  private socket: Socket;
  private fileAttente: { evenement: string; data: unknown }[] = [];

  constructor(private url: string, private getToken: () => Promise&lt;string&gt;) {
    this.socket = io(url, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    this.configurerGestionnaires();
  }

  private async configurerGestionnaires() {
    this.socket.on('connect', () => {
      console.log('WebSocket connecté');
      // Vider la file d'attente des messages offline
      this.fileAttente.forEach(({ evenement, data }) => {
        this.socket.emit(evenement, data);
      });
      this.fileAttente = [];
    });

    this.socket.on('connect_error', async (err) => {
      if (err.message === 'Token invalide ou expiré') {
        // Rafraîchir le token et reconnecter
        const token = await this.getToken();
        this.socket.auth = { token };
        this.socket.connect();
      }
    });

    this.socket.on('disconnect', (raison) => {
      if (raison === 'io server disconnect') {
        // Déconnexion volontaire du serveur — ne pas reconnecter automatiquement
        console.log('Déconnecté par le serveur');
      }
    });
  }

  async connecter() {
    const token = await this.getToken();
    this.socket.auth = { token };
    this.socket.connect();
  }

  emettre(evenement: string, data: unknown) {
    if (this.socket.connected) {
      this.socket.emit(evenement, data);
    } else {
      // Mettre en file d'attente pour émission à la reconnexion
      this.fileAttente.push({ evenement, data });
    }
  }
}</code></pre>
<h2>Gestion de la charge et backpressure</h2>
<pre><code>// Rate limiting des événements WebSocket
const limites = new Map&lt;string, { count: number; resetAt: number }&gt;();

io.on('connection', (socket) => {
  socket.use(([evenement, ...args], next) => {
    const cle = \`\${socket.data.utilisateurId}:\${evenement}\`;
    const maintenant = Date.now();
    const limite = limites.get(cle);

    if (limite && maintenant &lt; limite.resetAt) {
      if (limite.count &gt;= 10) { // 10 messages/seconde max
        return next(new Error('Trop de messages'));
      }
      limite.count++;
    } else {
      limites.set(cle, { count: 1, resetAt: maintenant + 1000 });
    }

    next();
  });
});</code></pre>
<h2>Monitoring des connexions WebSocket</h2>
<pre><code>// Métriques Prometheus pour Socket.IO
import { Gauge, Counter } from 'prom-client';

const connectionsActives = new Gauge({
  name: 'websocket_connections_active',
  help: 'Nombre de connexions WebSocket actives',
});

const messagesEmis = new Counter({
  name: 'websocket_messages_total',
  help: 'Nombre total de messages émis',
  labelNames: ['evenement'],
});

io.on('connection', (socket) => {
  connectionsActives.inc();
  socket.on('disconnect', () => connectionsActives.dec());

  const origEmet = socket.emit.bind(socket);
  socket.emit = (evenement, ...args) => {
    messagesEmis.inc({ evenement });
    return origEmet(evenement, ...args);
  };
});</code></pre>
<p>Les WebSockets fonctionnent naturellement avec une architecture event-driven — consultez notre <a href="/fr/blog/architecture-event-driven-guide">guide EDA</a> pour connecter vos sockets à un bus d'événements Kafka. Pour les cas d'usage edge (chat global, notifications en temps réel distribuées), Cloudflare Workers avec Durable Objects offre une alternative intéressante — voir notre <a href="/fr/blog/cloudflare-workers-edge-computing-fr">guide Cloudflare Workers</a>. La résilience des connexions s'appuie sur les patterns des <a href="/fr/blog/construire-microservices-resilients-go">microservices Go</a>.</p>`,
  },
  // POST FR-19
  {
    title: 'Monorepos avec Turborepo : Structure, Cache et Optimisation CI',
    slug: 'monorepo-turborepo-guide',
    date: '2025-10-14T09:00:00',
    category: 'DevOps',
    tags: ['Monorepo', 'Turborepo', 'npm workspaces', 'CI/CD', 'Build'],
    unsplashQuery: 'organized files folders structure',
    internalLinks: ['systemes-design-a-echelle', 'workflows-git-equipe', 'strategies-tests-applications-web'],
    content: `<h2>Monorepo : un choix architectural, pas une mode</h2>
<p>Un monorepo — un seul dépôt Git pour plusieurs packages ou applications — résout des problèmes réels que les multi-repos ignorent : partage de code sans versioning inter-dépendances, refactorisations atomiques qui traversent plusieurs packages, et cohérence des outils de build et de test. Des entreprises comme Google, Meta, et Vercel l'ont adopté à grande échelle. Mais un monorepo mal organisé transforme ces avantages en cauchemars de build lents et de dépendances circulaires. Turborepo résout le problème de performance : il mémorise intelligemment les résultats de build et parallélise les tâches en fonction du graphe de dépendances.</p>
<h2>Structure d'un monorepo Turborepo</h2>
<pre><code>mon-monorepo/
├── apps/
│   ├── web/              # Application Next.js principale
│   ├── admin/            # Dashboard d'administration
│   ├── api/              # API Node.js/Hono
│   └── mobile/           # Expo React Native
├── packages/
│   ├── ui/               # Bibliothèque de composants partagée
│   ├── config/           # Configurations partagées (ESLint, TS, Tailwind)
│   ├── db/               # Prisma schema + client typé
│   └── utils/            # Fonctions utilitaires
├── turbo.json
├── package.json          # workspaces définis ici
└── pnpm-workspace.yaml   # ou package.json "workspaces" pour npm/yarn</code></pre>
<pre><code>// package.json racine
{
  "name": "mon-monorepo",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "test": "turbo test",
    "type-check": "turbo type-check"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  }
}</code></pre>
<h2>Configuration Turborepo</h2>
<pre><code>// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],    // construire les dépendances d'abord
      "inputs": ["$TURBO_DEFAULT$", ".env.local"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,              // jamais cacher le dev server
      "persistent": true           // process long-running
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$"],
      "outputs": ["coverage/**"],
      "env": ["NODE_ENV", "CI"]
    },
    "lint": {
      "inputs": ["$TURBO_DEFAULT$", ".eslintrc.*"]
    },
    "type-check": {
      "dependsOn": ["^build"],
      "inputs": ["**/*.{ts,tsx}", "tsconfig*.json"]
    }
  }
}</code></pre>
<h2>Package partagé : la bibliothèque UI</h2>
<pre><code>// packages/ui/package.json
{
  "name": "@repo/ui",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./styles.css": "./dist/styles.css"
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts",
    "dev": "tsup src/index.ts --format esm,cjs --dts --watch"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "@types/react": "^18.0.0"
  }
}

// packages/ui/src/index.ts
export { Button } from './components/Button';
export { Input } from './components/Input';
export { Modal } from './components/Modal';
export type { ButtonProps } from './components/Button';</code></pre>
<h2>Configuration TypeScript partagée</h2>
<pre><code>// packages/config/tsconfig/base.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "Base",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}

// apps/web/tsconfig.json
{
  "extends": "@repo/config/tsconfig/nextjs.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "next.config.ts"],
  "exclude": ["node_modules"]
}</code></pre>
<h2>Remote caching avec Vercel Remote Cache</h2>
<p>Le cache distant partage les résultats de build entre développeurs et CI, éliminant les rebuilds inutiles :</p>
<pre><code># Lier le monorepo à Vercel Remote Cache
npx turbo login
npx turbo link

# En CI (GitHub Actions)
# Les variables TURBO_TOKEN et TURBO_TEAM sont automatiquement
# disponibles sur Vercel, ou à définir comme secrets GitHub

# turbo.json : activer le remote cache
{
  "remoteCache": {
    "enabled": true,
    "signature": true  // vérifier l'intégrité du cache
  }
}</code></pre>
<h2>Pipeline CI optimisé</h2>
<pre><code># .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 2  # pour la détection des changements Turbo

    - uses: pnpm/action-setup@v4
      with:
        version: 9

    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'pnpm'

    - run: pnpm install --frozen-lockfile

    # Turbo détecte automatiquement les packages affectés par le PR
    - run: pnpm turbo build test lint type-check
      env:
        TURBO_TOKEN: \${{ secrets.TURBO_TOKEN }}
        TURBO_TEAM: \${{ secrets.TURBO_TEAM }}

    # Déployer uniquement les apps modifiées
    - name: Déployer web si modifié
      if: \${{ contains(steps.turbo.outputs.affected, 'web') }}
      run: pnpm --filter web deploy:production</code></pre>
<h2>Gestion des dépendances inter-packages</h2>
<pre><code># Ajouter une dépendance d'un package interne
pnpm --filter @repo/web add @repo/ui @repo/db

# Mettre à jour toutes les dépendances d'un workspace
pnpm --filter @repo/api update

# Exécuter une commande dans un package spécifique
pnpm --filter @repo/ui build

# Exécuter dans tous les packages sauf la racine
pnpm -r build

# Filtre par tag (défini dans package.json "keywords")
pnpm --filter ...affected build  # Turbo: seulement les packages affectés</code></pre>
<p>Un monorepo bien structuré est le fondement d'un système de design durable — notre guide sur les <a href="/fr/blog/systemes-design-a-echelle">systèmes de design à grande échelle</a> détaille l'organisation des packages de composants. Les workflows Git dans un monorepo ont des spécificités importantes — consultez notre <a href="/fr/blog/workflows-git-equipe">guide sur les workflows Git pour les équipes</a>. Pour les stratégies de tests qui s'exécutent efficacement dans un contexte Turborepo, notre article sur les <a href="/fr/blog/strategies-tests-applications-web">stratégies de tests</a> couvre l'intégration CI.</p>`,
  },
  // POST FR-20
  {
    title: 'Patterns de Gestion d\'Erreurs en TypeScript : Des Exceptions aux Résultats Typés',
    slug: 'patterns-gestion-erreurs',
    date: '2025-11-11T09:00:00',
    category: 'Backend',
    tags: ['TypeScript', 'Gestion d\'erreurs', 'Patterns', 'Architecture'],
    unsplashQuery: 'warning error system alert',
    internalLinks: ['typescript-generiques-avances', 'conception-api-rest-graphql-trpc', 'strategies-tests-applications-web'],
    content: `<h2>Le problème avec les exceptions en TypeScript</h2>
<p>TypeScript a un angle mort critique dans son système de types : les exceptions. Quand une fonction peut lancer une erreur, le système de types n'en sait rien. Il n'y a pas d'équivalent TypeScript du <code>throws</code> de Java ou du type <code>Result&lt;T, E&gt;</code> de Rust — par défaut, toute fonction peut lancer n'importe quelle erreur, et les appelants n'ont aucun moyen de le savoir à la compilation. Ce guide explore les patterns qui comblent ce manque : les types Result, les discriminated unions, et une approche systématique pour rendre les erreurs explicites dans vos APIs TypeScript.</p>
<h2>Le type Result : rendre les erreurs explicites</h2>
<pre><code>// Définition du type Result
type Result&lt;T, E = Error&gt; =
  | { success: true; data: T }
  | { success: false; error: E };

// Fonctions utilitaires
function ok&lt;T&gt;(data: T): Result&lt;T, never&gt; {
  return { success: true, data };
}

function err&lt;E&gt;(error: E): Result&lt;never, E&gt; {
  return { success: false, error };
}

// Utilisation
async function obtenirUtilisateur(id: string): Promise&lt;Result&lt;Utilisateur, ErreurUtilisateur&gt;&gt; {
  try {
    const utilisateur = await db.utilisateur.findUnique({ where: { id } });
    if (!utilisateur) {
      return err({ type: 'NON_TROUVE' as const, message: \`Utilisateur \${id} introuvable\` });
    }
    return ok(utilisateur);
  } catch (e) {
    return err({ type: 'ERREUR_DB' as const, message: 'Erreur base de données', cause: e });
  }
}

// L'appelant est FORCÉ de gérer les deux cas
const resultat = await obtenirUtilisateur('user-123');
if (!resultat.success) {
  switch (resultat.error.type) {
    case 'NON_TROUVE':
      return res.status(404).json({ message: resultat.error.message });
    case 'ERREUR_DB':
      return res.status(500).json({ message: 'Erreur interne' });
  }
}
const utilisateur = resultat.data; // TypeScript sait que c'est Utilisateur ici</code></pre>
<h2>Erreurs typées avec discriminated unions</h2>
<pre><code>// Définir toutes les erreurs possibles d'un domaine
type ErreurCommande =
  | { type: 'COMMANDE_INTROUVABLE'; commandeId: string }
  | { type: 'STOCK_INSUFFISANT'; produitId: string; disponible: number; demande: number }
  | { type: 'PAIEMENT_REFUSE'; code: string; message: string }
  | { type: 'UTILISATEUR_NON_AUTORISE'; utilisateurId: string; commandeId: string }
  | { type: 'ERREUR_INTERNE'; cause: unknown };

// TypeScript vous force à gérer tous les cas avec les discriminated unions
function afficherErreurCommande(erreur: ErreurCommande): string {
  switch (erreur.type) {
    case 'COMMANDE_INTROUVABLE':
      return \`Commande \${erreur.commandeId} introuvable\`;
    case 'STOCK_INSUFFISANT':
      return \`Stock insuffisant pour \${erreur.produitId}: \${erreur.disponible} disponibles, \${erreur.demande} demandés\`;
    case 'PAIEMENT_REFUSE':
      return \`Paiement refusé (\${erreur.code}): \${erreur.message}\`;
    case 'UTILISATEUR_NON_AUTORISE':
      return 'Accès refusé à cette commande';
    case 'ERREUR_INTERNE':
      return 'Une erreur interne est survenue';
    // TypeScript signale si un cas est oublié (exhaustive check)
  }
}</code></pre>
<h2>Classe d'erreur domaine avec contexte riche</h2>
<pre><code>// Alternative orientée objet : erreurs personnalisées avec contexte
abstract class ErreurDomaine extends Error {
  abstract readonly type: string;
  abstract readonly statusHTTP: number;

  constructor(
    message: string,
    public readonly contexte?: Record&lt;string, unknown&gt;
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  toJSON() {
    return {
      type: this.type,
      message: this.message,
      contexte: this.contexte,
    };
  }
}

class ErreurNonTrouve extends ErreurDomaine {
  readonly type = 'NON_TROUVE' as const;
  readonly statusHTTP = 404;

  constructor(ressource: string, id: string) {
    super(\`\${ressource} avec l'identifiant \${id} introuvable\`, { ressource, id });
  }
}

class ErreurValidation extends ErreurDomaine {
  readonly type = 'VALIDATION' as const;
  readonly statusHTTP = 422;

  constructor(
    public readonly champs: Record&lt;string, string[]&gt;
  ) {
    super('Les données saisies sont invalides', { champs });
  }
}

class ErreurAutorisationRefusee extends ErreurDomaine {
  readonly type = 'AUTORISATION_REFUSEE' as const;
  readonly statusHTTP = 403;
}

// Middleware Express qui transforme les erreurs domaine en réponses HTTP
function gestionnaireErreurs(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ErreurDomaine) {
    return res.status(err.statusHTTP).json(err.toJSON());
  }

  if (err instanceof ZodError) {
    return res.status(422).json({
      type: 'VALIDATION',
      message: 'Données invalides',
      champs: err.flatten().fieldErrors,
    });
  }

  // Erreur inattendue — ne pas exposer les détails internes
  console.error('Erreur non gérée:', err);
  res.status(500).json({ type: 'ERREUR_INTERNE', message: 'Une erreur est survenue' });
}</code></pre>
<h2>Chaînage de Results avec flatMap</h2>
<pre><code>// Composition fonctionnelle de résultats
type AsyncResult&lt;T, E&gt; = Promise&lt;Result&lt;T, E&gt;&gt;;

async function flatMap&lt;T, U, E&gt;(
  result: AsyncResult&lt;T, E&gt;,
  fn: (data: T) =&gt; AsyncResult&lt;U, E&gt;
): AsyncResult&lt;U, E&gt; {
  const r = await result;
  if (!r.success) return r;
  return fn(r.data);
}

// Exemple : pipeline de traitement d'une commande
const resultat = await flatMap(
  validerCommande(input),
  async (commandeValidee) =&gt; flatMap(
    verifierStock(commandeValidee),
    async (stock) =&gt; traiterPaiement(commandeValidee, stock)
  )
);

if (!resultat.success) {
  // Une seule gestion d'erreur pour tout le pipeline
  return repondreAvecErreur(res, resultat.error);
}</code></pre>
<h2>Logging structuré des erreurs</h2>
<pre><code>import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level: (label) =&gt; ({ level: label }),
  },
  redact: ['body.motDePasse', 'body.numeroCarte', 'headers.authorization'],
});

function loggerErreur(erreur: unknown, contexte?: Record&lt;string, unknown&gt;) {
  if (erreur instanceof ErreurDomaine) {
    // Erreurs métier attendues — niveau warn
    logger.warn({
      type: erreur.type,
      message: erreur.message,
      contexte: { ...erreur.contexte, ...contexte },
    });
    return;
  }

  // Erreurs inattendues — niveau error avec stack trace
  logger.error({
    err: erreur,
    message: erreur instanceof Error ? erreur.message : 'Erreur inconnue',
    stack: erreur instanceof Error ? erreur.stack : undefined,
    contexte,
  });
}</code></pre>
<p>Ces patterns d'erreurs sont particulièrement utiles avec les génériques TypeScript avancés — notre <a href="/fr/blog/typescript-generiques-avances">guide sur les génériques</a> montre comment construire des types Result génériques robustes. Pour les APIs tRPC qui utilisent ces patterns, consultez notre comparatif <a href="/fr/blog/conception-api-rest-graphql-trpc">REST, GraphQL et tRPC</a>. Les tests des différents chemins d'erreur sont couverts dans notre article sur les <a href="/fr/blog/strategies-tests-applications-web">stratégies de tests</a>.</p>`,
  },
  // POST FR-21
  {
    title: 'Travailler avec Claude Code : Workflows Multi-Agents, Revue de Code et Bonnes Pratiques',
    slug: 'claude-code-workflows-multi-agents',
    date: '2026-03-10T10:00:00',
    category: 'Outils IA',
    tags: ['Claude Code', 'IA', 'Outils développeur', 'Multi-Agent', 'Productivité'],
    unsplashQuery: 'artificial intelligence technology abstract',
    internalLinks: ['workflows-git-equipe', 'strategies-tests-applications-web', 'monorepo-turborepo-guide'],
    content: `<h2>Claude Code en 2025 : au-delà de l'autocomplétion</h2>
<p>Claude Code, le CLI officiel d'Anthropic pour Claude, a largement dépassé le paradigme de la simple complétion de code ou de la génération de fichiers uniques. En 2025, c'est un environnement de développement agentique complet : il peut planifier et exécuter des tâches d'ingénierie multi-étapes de manière autonome, orchestrer des réseaux de sous-agents parallèles, exécuter des hooks qui s'intègrent dans votre pipeline CI/CD, et servir de couche de raisonnement connectant des outils spécialisés via le Model Context Protocol (MCP). Ce guide couvre l'ensemble du système tel qu'il existe en 2025 et propose des patterns pratiques pour intégrer Claude Code dans un workflow d'ingénierie logicielle professionnel.</p>
<h2>Installation et configuration initiale</h2>
<pre><code># Installation
npm install -g @anthropic-ai/claude-code

# Vérification
claude --version

# Initialisation dans un projet
cd mon-projet
claude init</code></pre>
<p>La commande <code>claude init</code> crée un fichier <code>CLAUDE.md</code> à la racine du projet — le document de contexte persistant que Claude Code lit au début de chaque session. C'est ici que vous documentez les conventions du projet, l'architecture, les commandes importantes et les décisions de design que vous ne voulez pas expliquer à chaque fois.</p>
<pre><code># CLAUDE.md — exemple
## Stack technique
- Frontend: Next.js 15, TypeScript strict, Tailwind CSS
- Backend: API Routes Next.js + tRPC, PostgreSQL via Prisma
- Tests: Vitest (unit), Playwright (E2E)
- CI: GitHub Actions, déploiement sur Vercel

## Conventions
- Commits en Conventional Commits format
- Toujours ajouter des tests pour les nouvelles fonctionnalités
- Utiliser le type Result pour la gestion d'erreurs (voir packages/utils/result.ts)
- Les migrations Prisma doivent être réversibles

## Commandes importantes
- \`npm run dev\` : démarrer le serveur de développement
- \`npm run test\` : tests unitaires avec watch mode
- \`npm run test:e2e\` : tests Playwright
- \`npm run db:migrate\` : appliquer les migrations Prisma

## Architecture
- Les composants serveur accèdent directement à la DB via Prisma
- Les composants client utilisent tRPC via les hooks dans src/trpc/
- L'authentification est gérée par NextAuth.js</code></pre>
<h2>Workflows multi-agents : parallélisation des tâches</h2>
<p>Claude Code peut créer des sous-agents pour exécuter des tâches en parallèle — un multiplicateur de force pour les opérations à grande échelle :</p>
<pre><code># Demande qui déclenche une orchestration multi-agents
"Migre tous les fichiers JavaScript dans src/ vers TypeScript.
Pour chaque fichier :
1. Ajouter les types appropriés en inférant depuis l'utilisation
2. Corriger les erreurs TypeScript strict
3. Ajouter des tests unitaires pour les fonctions non couvertes
4. Mettre à jour les imports dans les fichiers dépendants

Traite les fichiers en parallèle par dossier. 
Commence par un fichier pour valider l'approche avant de continuer."</code></pre>
<p>L'orchestrateur decompose automatiquement cette tâche en sous-agents par répertoire, les exécute en parallèle, et agrège les résultats. Le pattern "commence par un fichier pour valider" est important : il évite de propager une mauvaise approche sur des centaines de fichiers avant correction.</p>
<h2>Mode plan : réviser avant d'exécuter</h2>
<p>Pour les tâches conséquentes, le mode plan affiche le plan d'action complet avant toute modification :</p>
<pre><code>/plan Ajouter un système de notifications temps réel à l'application

# Claude Code répond avec quelque chose comme :
# Plan de mise en œuvre :
# 1. Installer socket.io et @socket.io/redis-adapter
# 2. Créer server/socket.ts avec la configuration du serveur WebSocket
# 3. Ajouter l'authentification des connexions WebSocket
# 4. Créer le hook React useNotifications dans src/hooks/
# 5. Ajouter le contexte NotificationProvider dans app/layout.tsx
# 6. Créer les API endpoints pour marquer les notifications comme lues
# 7. Ajouter les tests unitaires pour le hook
# 8. Mettre à jour CLAUDE.md pour documenter l'architecture WebSocket
#
# Fichiers qui seront créés : [liste]
# Fichiers qui seront modifiés : [liste]
# Packages qui seront installés : [liste]
#
# Approuver ? (o/n)</code></pre>
<h2>Revue de code avec /review</h2>
<p>La commande <code>/review</code> génère une analyse de code structurée avec des priorités :</p>
<pre><code>/review src/api/paiements.ts

# Exemple de sortie structurée :
## Revue de code : src/api/paiements.ts
#
### 🔴 Critique
# - Ligne 47 : La clé API Stripe est lue directement depuis req.body — 
#   devrait venir uniquement de process.env.STRIPE_SECRET_KEY
# - Ligne 89 : Pas de vérification de la signature webhook Stripe — 
#   vulnérabilité permettant de forger des événements de paiement
#
### 🟡 Majeur
# - Ligne 23 : Pas de timeout sur l'appel Stripe — peut bloquer indéfiniment
# - Ligne 67 : Le montant n'est pas validé côté serveur avant l'appel Stripe
#
### 🟢 Mineur
# - Ligne 12 : Nommage inconsistant (montant vs amount dans la même fonction)
# - Les erreurs Stripe ne sont pas typées — utiliser Stripe.errors.StripeError
#
### 💡 Suggestions
# - Extraire la logique Stripe dans un service dédié pour faciliter le testing</code></pre>
<h2>Hooks : intégration avec votre pipeline CI/CD</h2>
<p>Les hooks Claude Code exécutent des commandes automatiquement après certaines actions — formatage, lint, tests :</p>
<pre><code>// .claude/hooks.json
{
  "postEdit": [
    {
      "command": "npx prettier --write \"\${file}\"",
      "condition": "file_matches",
      "pattern": "\\.(ts|tsx|js|jsx|json|css)$"
    },
    {
      "command": "npx eslint --fix \"\${file}\"",
      "condition": "file_matches",
      "pattern": "\\.(ts|tsx|js|jsx)$"
    }
  ],
  "postCreate": [
    {
      "command": "npx prettier --write \"\${file}\""
    }
  ],
  "onComplete": [
    {
      "command": "npm run type-check",
      "failOnError": true
    },
    {
      "command": "npm run test -- --changed",
      "failOnError": false
    }
  ]
}</code></pre>
<h2>Model Context Protocol (MCP) : connecter des outils spécialisés</h2>
<p>MCP permet à Claude Code d'accéder à des sources de données et outils externes avec des permissions granulaires :</p>
<pre><code>// .claude/mcp.json
{
  "servers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "\${GITHUB_TOKEN}"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "\${DATABASE_URL}"]
    },
    "figma": {
      "command": "npx",
      "args": ["-y", "figma-mcp"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "\${FIGMA_TOKEN}"
      }
    }
  }
}</code></pre>
<p>Avec l'accès à GitHub via MCP, Claude Code peut lire les issues, créer des PRs et consulter l'historique des commits directement dans une conversation. Avec PostgreSQL, il peut inspecter le schéma en temps réel et écrire des requêtes précises.</p>
<h2>Tâches en arrière-plan</h2>
<p>Les tâches longues — refactorisations importantes, génération de tests, mise à jour de documentation — peuvent être déléguées en arrière-plan sans bloquer votre session courante :</p>
<pre><code># Déléguer une tâche en arrière-plan
claude task create "Génère la documentation JSDoc complète pour toutes les fonctions publiques dans src/lib/"

# Vérifier le statut
claude task list
claude task get &lt;task-id&gt;

# Consulter les logs
claude task logs &lt;task-id&gt;</code></pre>
<h2>Workflows pratiques pour le développement professionnel</h2>
<h3>Workflow de développement de fonctionnalité</h3>
<ol>
  <li>Ouvrir une issue GitHub ou rédiger un brief court — Claude Code peut lire les deux.</li>
  <li>Exécuter <code>/plan</code> avec la description de la fonctionnalité. Réviser et approuver le plan.</li>
  <li>Laisser Claude Code exécuter, avec les hooks qui lancent automatiquement lint, format et tests après chaque édition.</li>
  <li>Exécuter <code>/review</code> sur les changements terminés. Traiter les problèmes Critiques/Majeurs.</li>
  <li>Demander à Claude Code de rédiger ou améliorer le message de commit en format Conventional Commits.</li>
</ol>
<h3>Workflow de refactorisation de code legacy</h3>
<pre><code># D'abord, demander à Claude Code de caractériser le code
"Lis src/legacy/processeur-paiement.js et décris ce qu'il fait,
ses dépendances, et la couverture de tests actuelle"

# Puis planifier le refactor
/plan Refactoriser processeur-paiement.js vers TypeScript avec gestion d'erreurs propre

# Utiliser le système de sous-agents pour les refactorisations larges
"Refactorise tous les fichiers JavaScript dans src/legacy/ vers TypeScript.
Pour chaque fichier : préserver le comportement exact, ajouter les types appropriés,
ajouter des tests unitaires. Parallélise où possible."</code></pre>
<h2>Gestion du contexte</h2>
<p>La fenêtre de contexte de Claude Code est large mais finie. Pour les grandes bases de code, quelques pratiques importantes :</p>
<ul>
  <li><strong>Référencer des fichiers spécifiques</strong> : "Lis <code>src/api/commandes.ts</code>" est bien plus précis que "regarde le code des commandes"</li>
  <li><strong>Utiliser CLAUDE.md</strong> : documenter les décisions architecturales pour éviter de les re-découvrir à chaque session</li>
  <li><strong>Utiliser des sous-agents pour les tâches isolées</strong> : les sous-agents démarrent avec un contexte frais, évitant la pollution entre tâches non liées</li>
  <li><strong>La commande /compact</strong> : résume la conversation courante et libère de l'espace de contexte</li>
</ul>
<h2>Sécurité et permissions</h2>
<p>Claude Code exécute des commandes Bash, lit des fichiers, et effectue des requêtes réseau. Traitez-le avec une vigilance de sécurité appropriée :</p>
<ul>
  <li>Vérifiez toute commande <code>curl</code>, <code>wget</code> ou autre fetch réseau avant de l'approuver</li>
  <li>Utilisez l'option <code>--allowlist</code> pour restreindre les commandes disponibles dans des environnements sensibles</li>
  <li>N'incluez jamais de credentials de production dans CLAUDE.md — utilisez les variables d'environnement</li>
  <li>Les tokens des serveurs MCP doivent être dans des variables d'environnement, jamais en dur dans <code>.claude/mcp.json</code></li>
</ul>
<h2>Mesurer l'impact sur la productivité</h2>
<p>Les équipes utilisant Claude Code efficacement rapportent une accélération de 2 à 4 fois sur les tâches routinières (écriture de tests, documentation, boilerplate), une réduction de 30 à 50% de la phase de "découverte" dans les bases de code inconnues, et significativement moins de problèmes "ça marche sur ma machine" grâce à l'uniformisation imposée par les hooks. Les usages les plus rentables : génération complète de tests pour du code non couvert, refactorisations automatisées à grande échelle (migrations TypeScript, mises à jour de versions d'API), et croisement de plusieurs sources de documentation pour répondre à des questions architecturales complexes.</p>
<p>L'usage le moins rentable est de tenter de faire écrire de la logique métier complexe et inédite depuis zéro. Claude Code excelle comme multiplicateur de force pour les ingénieurs compétents, pas comme substitut à l'expertise du domaine. Utilisez-le pour éliminer le travail mécanique et concentrez-vous sur les décisions qui nécessitent réellement un jugement humain. L'intégration avec les workflows Git décrits dans notre <a href="/fr/blog/workflows-git-equipe">guide Git pour les équipes</a> est naturelle pour les fonctionnalités de création de commits et de PRs. Pour les tests générés automatiquement, notre article sur les <a href="/fr/blog/strategies-tests-applications-web">stratégies de tests</a> fournit le cadre pour valider leur qualité. Dans un <a href="/fr/blog/monorepo-turborepo-guide">monorepo Turborepo</a>, Claude Code peut opérer à travers plusieurs packages simultanément — une combinaison particulièrement puissante.</p>`,
  },
];

// ─── Polylang translation linking helper ─────────────────────────────────────
async function linkTranslations(enPostId, frPostId) {
  try {
    // Polylang REST API: set language for each post and link them
    await wpAPI('POST', `posts/${enPostId}`, { lang: 'en' });
    await wpAPI('POST', `posts/${frPostId}`, { lang: 'fr' });

    // Link translations via Polylang endpoint (if available)
    const linkUrl = `${WP_URL}/wp-json/pll/v1/post/${enPostId}`;
    const linkRes = await fetch(linkUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${AUTH}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ translations: { en: enPostId, fr: frPostId } }),
    });
    if (!linkRes.ok) {
      console.log(`    Note: Translation link via Polylang REST may not be available; posts created with correct lang codes.`);
    }
  } catch (e) {
    console.log(`    Note: Could not link translations via Polylang: ${e.message.substring(0, 80)}`);
  }
}

// ─── Main execution ───────────────────────────────────────────────────────────
(async () => {
  console.log('=== Blog Post Creator: EN + FR with Polylang ===\n');

  // Step 1: collect all unique categories and tags from both arrays
  const allCategories = [...new Set([
    ...enPosts.map(p => p.category),
    ...frPosts.map(p => p.category),
  ])];
  const allTags = [...new Set([
    ...enPosts.flatMap(p => p.tags),
    ...frPosts.flatMap(p => p.tags),
  ])];

  console.log(`Creating ${allCategories.length} categories and ${allTags.length} tags...`);

  const categoryMap = {};
  for (const cat of allCategories) {
    try {
      categoryMap[cat] = await getOrCreateTerm('categories', cat);
      process.stdout.write('.');
    } catch (e) {
      console.error(`\n  Error creating category "${cat}": ${e.message}`);
    }
  }

  const tagMap = {};
  for (const tag of allTags) {
    try {
      tagMap[tag] = await getOrCreateTerm('tags', tag);
      process.stdout.write('.');
    } catch (e) {
      console.error(`\n  Error creating tag "${tag}": ${e.message}`);
    }
  }
  console.log('\nCategories and tags ready.\n');

  // Step 2: Create EN posts
  const enPostIds = [];
  console.log('=== Creating EN posts ===');
  for (let i = 0; i < enPosts.length; i++) {
    const post = enPosts[i];
    console.log(`[EN ${i + 1}/${enPosts.length}] ${post.title}`);
    try {
      const catId = categoryMap[post.category];
      const tagIds = post.tags.map(t => tagMap[t]).filter(Boolean);

      console.log(`  Uploading featured image...`);
      const featuredMediaId = await uploadFeaturedImage(post.title, post.unsplashQuery);

      const postData = {
        title: post.title,
        slug: post.slug,
        content: post.content,
        status: 'publish',
        date: post.date,
        categories: catId ? [catId] : [],
        tags: tagIds,
        ...(featuredMediaId && { featured_media: featuredMediaId }),
      };

      const created = await wpAPI('POST', 'posts', postData);
      enPostIds.push(created.id);
      console.log(`  ✓ Created EN post ID ${created.id}: ${post.slug}`);
    } catch (e) {
      console.error(`  ✗ Failed to create EN post "${post.title}": ${e.message}`);
      enPostIds.push(null);
    }
  }

  // Step 3: Create FR posts
  const frPostIds = [];
  console.log('\n=== Creating FR posts ===');
  for (let i = 0; i < frPosts.length; i++) {
    const post = frPosts[i];
    console.log(`[FR ${i + 1}/${frPosts.length}] ${post.title}`);
    try {
      const catId = categoryMap[post.category];
      const tagIds = post.tags.map(t => tagMap[t]).filter(Boolean);

      console.log(`  Uploading featured image...`);
      const featuredMediaId = await uploadFeaturedImage(post.title, post.unsplashQuery);

      const postData = {
        title: post.title,
        slug: post.slug,
        content: post.content,
        status: 'publish',
        date: post.date,
        categories: catId ? [catId] : [],
        tags: tagIds,
        ...(featuredMediaId && { featured_media: featuredMediaId }),
        // Set Polylang language meta if the REST field is supported
        lang: 'fr',
      };

      const created = await wpAPI('POST', 'posts', postData);
      frPostIds.push(created.id);
      console.log(`  ✓ Created FR post ID ${created.id}: ${post.slug}`);
    } catch (e) {
      console.error(`  ✗ Failed to create FR post "${post.title}": ${e.message}`);
      frPostIds.push(null);
    }
  }

  // Step 4: Link EN ↔ FR translations via Polylang
  console.log('\n=== Linking EN ↔ FR translations via Polylang ===');
  for (let i = 0; i < enPostIds.length; i++) {
    const enId = enPostIds[i];
    const frId = frPostIds[i];
    if (!enId || !frId) {
      console.log(`  Skipping pair ${i + 1} (one or both posts failed to create)`);
      continue;
    }
    console.log(`  Linking EN ${enId} ↔ FR ${frId} (${enPosts[i].slug} ↔ ${frPosts[i].slug})`);
    await linkTranslations(enId, frId);
  }

  // Step 5: Summary
  const enSuccess = enPostIds.filter(Boolean).length;
  const frSuccess = frPostIds.filter(Boolean).length;
  console.log('\n=== Summary ===');
  console.log(`EN posts created: ${enSuccess}/${enPosts.length}`);
  console.log(`FR posts created: ${frSuccess}/${frPosts.length}`);
  console.log(`Translation pairs linked: ${enPostIds.filter((id, i) => id && frPostIds[i]).length}`);
  if (enSuccess < enPosts.length || frSuccess < frPosts.length) {
    console.log('\nSome posts failed. Check errors above.');
    process.exit(1);
  }
  console.log('\nAll posts created successfully!');
})();
