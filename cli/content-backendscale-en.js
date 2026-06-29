module.exports = [
  {
    title: 'Backend scalability patterns that actually hold up under load',
    slug: 'backend-scalability-patterns',
    excerpt: 'Caching, queues, load balancing, and statelessness. The scalability patterns I reach for when a backend starts buckling, and the order I apply them in.',
    category: 'Backend',
    tags: ['scalability', 'caching', 'load balancing', 'architecture'],
    pexels: 'server room network',
    content: `
<p>Most backends do not fall over because of one giant problem. They fall over because of a dozen small assumptions that were fine at a thousand requests a day and quietly stop being fine at a million. I have spent a good chunk of my career chasing those assumptions down, usually at three in the morning, and the patterns below are the ones I keep coming back to. None of them are exotic. The skill is knowing which one to apply and when to stop.</p>

<h2>Scale up before you scale out</h2>
<p>The first question I ask when a service is struggling is whether I can just give it a bigger machine. Vertical scaling gets a bad reputation because it has a ceiling, but that ceiling is much higher than people think. A modern instance with 64 cores and 256 gigabytes of memory will carry an enormous amount of traffic, and you get it without touching your code, your deployment, or your mental model of the system.</p>
<p>Horizontal scaling is where you add more machines and spread the work across them. It scales further, but it forces decisions on you. State has to live somewhere shared. Requests have to be routed. Failures multiply because now you have ten things that can break instead of one. My rule is simple. I scale up until it gets expensive or I hit the instance ceiling, and only then do I scale out. Reaching for a fleet of tiny nodes on day one is how you end up debugging distributed systems problems you did not need to have yet.</p>

<h2>Statelessness is the thing that makes everything else possible</h2>
<p>You cannot spread traffic across many servers if any one server is secretly special. The moment a request only works because it landed on the same box that handled the previous request, horizontal scaling is dead. This is why I treat statelessness as the foundation rather than an optimization.</p>
<p>In practice that means no session data in local memory, no uploaded files sitting on the local disk, no in-process counters that matter. Push session state into Redis or a signed token. Push files into object storage. Push anything durable into a database. When every application node is interchangeable, a load balancer can send a request to any of them, you can add and remove nodes freely, and a crashed node costs you nothing but the in-flight requests it was holding.</p>
<p>If you want the wider context for how this fits into a system, I wrote about it in <a href="/blog/modern-fullstack-architecture/">modern fullstack architecture</a>, where statelessness shows up again as a precondition for clean deploys.</p>

<h2>Load balancing and how requests find a home</h2>
<p>Once you have several interchangeable nodes, something has to decide where each request goes. A load balancer sits in front and distributes traffic. Round robin is the obvious starting point and it is fine for uniform workloads, but it gets dumb fast when requests vary in cost. Least connections is usually a better default because it sends new work to whichever node is least busy right now.</p>
<p>The part people forget is health checks. A load balancer is only as good as its ability to notice a sick node and stop sending it traffic. I always configure active health checks with a real endpoint that touches the critical dependencies, not a route that returns 200 no matter what.</p>
<pre><code>upstream api_backend {
    least_conn;
    server 10.0.1.10:8080 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:8080 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:8080 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl;
    location / {
        proxy_pass http://api_backend;
        proxy_next_upstream error timeout http_502 http_503;
    }
    location /healthz {
        access_log off;
        proxy_pass http://api_backend;
    }
}</code></pre>

<h2>Caching, the highest leverage move you have</h2>
<p>Nothing buys you headroom faster than not doing work twice. Caching is the highest leverage tool in this whole list, and it operates at several layers. There is the CDN at the edge for static assets and cacheable responses. There is an application cache like Redis or Memcached for computed results and hot rows. There is the database query cache and the operating system page cache below that. Each layer you can serve from is a layer of work the layers beneath it never see.</p>
<p>The hard part is never reading from a cache. It is invalidation. A stale cache is worse than no cache because it lies confidently. I lean heavily on time based expiry because it is predictable, and I only reach for event based invalidation when staleness genuinely hurts. Cache-aside is my default pattern: check the cache, on a miss go to the source, then write the result back with a TTL.</p>
<pre><code>def get_user(user_id):
    key = "user:" + str(user_id)
    cached = redis.get(key)
    if cached is not None:
        return deserialize(cached)
    user = db.query("SELECT * FROM users WHERE id = %s", user_id)
    redis.setex(key, 300, serialize(user))
    return user</code></pre>
<p>Two failure modes are worth naming. A cache stampede happens when a popular key expires and a thousand requests all miss at once and slam the database together. You fight it with jittered TTLs or a short lock so only one request rebuilds the value. The second is unbounded growth, which you handle with an eviction policy like LRU and a memory cap.</p>

<h2>Queues, or how to stop doing slow work in the request path</h2>
<p>A lot of what makes requests slow does not need to happen while the user waits. Sending an email, resizing an image, generating a report, syncing to a third party. If the caller does not need the result right now, get it out of the request path and onto a queue. The web tier accepts the job, hands it to a broker like RabbitMQ or SQS, returns immediately, and a pool of workers chews through the backlog at its own pace.</p>
<p>This does two things. It makes your latency predictable because the request no longer waits on slow downstream work. And it absorbs spikes, because a queue is a buffer. When traffic triples for an hour, the queue grows and the workers catch up afterward instead of the whole system melting. The thing you must get right is idempotency. Queues redeliver. A message will be processed more than once eventually, so every worker has to be safe to run twice on the same input.</p>
<ul>
  <li>Make handlers idempotent with a dedupe key or an upsert so a redelivery is harmless.</li>
  <li>Set a dead letter queue so poison messages stop blocking the line and land somewhere you can inspect them.</li>
  <li>Watch queue depth as a first class metric. A growing queue is the earliest warning that workers cannot keep up.</li>
</ul>

<h2>Backpressure and graceful degradation</h2>
<p>Scaling is not only about handling more. It is about failing well when you cannot. A system under genuine overload should shed load deliberately rather than collapse. I put rate limits on the edges, timeouts on every outbound call, and circuit breakers around flaky dependencies so a slow downstream service does not pile up threads and take the whole process with it.</p>
<p>Graceful degradation means deciding ahead of time what to drop first. If the recommendation service is down, show a generic list instead of an error page. If the cache is cold, serve slightly stale data rather than nothing. The users who get a degraded experience are far happier than the users who get a 500.</p>

<h2>Where the database fits</h2>
<p>Everything above buys time, but it eventually runs into the database, which is almost always the real bottleneck. Caching reduces reads, queues smooth writes, but past a certain point the data layer itself has to scale. That is a big enough topic that I gave it its own write up on <a href="/blog/scaling-databases-replication-sharding/">scaling databases with replication and sharding</a>, and if your schema is fighting you before you even get there, fix that first with <a href="/blog/database-schema-best-practices/">solid schema design</a>.</p>

<h2>The order I actually apply these</h2>
<p>If I had to compress all of this into a sequence, it would be this. Make the service stateless so it can scale at all. Scale up until it is uneconomical. Put a load balancer and more nodes in front. Add caching at the layers that hurt most. Move slow work onto queues. Add backpressure so overload degrades instead of crashes. Then, and usually only then, do the harder work of scaling the database. Measure at every step, because the bottleneck is rarely where your intuition says it is, and adding capacity to the wrong layer just moves the queue around.</p>
`
  },
  {
    title: 'Scaling databases: read replicas, sharding, and partitioning',
    slug: 'scaling-databases-replication-sharding',
    excerpt: 'The database is where most backends actually hit a wall. Here is how I think about read replicas, partitioning, and sharding, and the order I reach for them.',
    category: 'Backend',
    tags: ['databases', 'replication', 'sharding', 'partitioning'],
    pexels: 'data center storage',
    content: `
<p>Almost every scaling story I have lived through ends at the database. You can cache, you can queue, you can add a hundred stateless app nodes, and it all helps right up until a single primary database is the thing every one of those nodes is waiting on. At that point you have to scale the data layer itself, and that is a different kind of problem because data has weight. Moving compute is easy. Moving and splitting data without losing or corrupting it is where the real engineering lives.</p>
<p>I think about this as a ladder. Each rung is more powerful and more painful than the last, and you should climb only as high as you actually need.</p>

<h2>First, exhaust the cheap wins</h2>
<p>Before any architectural change I make sure the database is not just doing unnecessary work. The most common cause of a database that feels too small is a database that is missing indexes, running sequential scans on large tables, or being hammered by queries that should have been cached. Connection pool exhaustion masquerades as a scaling problem constantly. A well indexed schema on a properly sized instance handles far more than people expect, and I cover the groundwork in <a href="/blog/database-schema-best-practices/">database schema best practices</a>. Do not shard a database that just needs an index.</p>

<h2>Read replicas, the first real lever</h2>
<p>Most applications read far more than they write. Timelines, product pages, dashboards, search results, all reads. So the first structural move is almost always read replicas. You keep one primary that accepts all writes, and you stream its changes to one or more replica copies that serve reads. Now your read capacity scales with the number of replicas while writes stay on the primary.</p>
<p>The catch is replication lag. A replica is a copy that is always slightly behind, usually by milliseconds but sometimes by seconds under load. This creates a subtle bug class: a user writes something, gets redirected, the read goes to a replica that has not caught up yet, and their own change appears to have vanished. The fix is read your writes routing. After a write, send that user reads to the primary for a short window, or for anything where the user expects to see their own action immediately.</p>
<pre><code>def get_connection(query_type, just_wrote=False):
    if query_type == "write" or just_wrote:
        return primary_pool.get()
    return replica_pool.get()  # round robin across replicas

# After updating a profile, read from primary briefly
update_profile(user_id, data)
profile = read_profile(user_id, just_wrote=True)</code></pre>
<p>Replicas also give you something beyond capacity. They are a warm standby. If the primary dies, you can promote a replica, which makes replicas part of your availability story and not only your performance story.</p>

<h2>Partitioning, splitting one big table sensibly</h2>
<p>Replicas multiply your read capacity but every replica still holds the entire dataset, and writes still all go to one primary. When a single table grows to hundreds of millions of rows, the table itself becomes the problem. Indexes get deep, vacuum and maintenance get slow, and queries that touch the whole table get sluggish. Partitioning splits one logical table into many physical pieces while keeping a single primary.</p>
<p>The most useful kind is range partitioning by time. Most large tables are append heavy and time ordered: events, logs, orders, messages. If you partition by month, a query for last week only touches one partition, and dropping old data becomes an instant detach of a whole partition instead of a massive delete.</p>
<pre><code>CREATE TABLE events (
    id        BIGSERIAL,
    user_id   BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    payload   JSONB
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2026_06 PARTITION OF events
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE events_2026_07 PARTITION OF events
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');</code></pre>
<p>The thing to understand is that partitioning is still one database server. It helps with table size, maintenance, and queries that can prune to a single partition. It does nothing for write throughput on the machine as a whole, because every partition lives on the same box.</p>

<h2>Sharding, the last and heaviest rung</h2>
<p>When a single primary cannot keep up with writes no matter how big the machine is, you have to split the data across multiple independent database servers. That is sharding. Each shard is its own database holding a subset of the data, and there is no single machine that has all of it. This is the move that finally scales writes horizontally, and it is also the move that costs you the most.</p>
<p>Everything depends on the shard key, the column you use to decide which shard a row lives on. Pick well and most queries hit a single shard. Pick badly and you create hot shards that take all the traffic while others sit idle, or you force queries to fan out across every shard and gather results, which is slow and fragile.</p>
<ul>
  <li>Hash based sharding spreads rows evenly by hashing the key. Great for uniform distribution, bad for range queries because related rows scatter everywhere.</li>
  <li>Range based sharding keeps related keys together, which is good for range scans but tends to create hotspots on the newest range.</li>
  <li>Directory based sharding keeps an explicit lookup table mapping keys to shards. Most flexible, lets you rebalance, but the directory itself becomes something you have to scale and protect.</li>
</ul>
<p>The shard key has to match how you actually query. If you run a multi tenant application, sharding by tenant id is usually ideal because almost every query is already scoped to one tenant, so it naturally lands on one shard. If you ever need a query that does not include the shard key, you are looking at a scatter gather across all shards, and you should design hard to avoid those on hot paths.</p>

<h2>What you give up when you shard</h2>
<p>I want to be blunt about the costs, because sharding gets romanticized. Cross shard joins effectively stop existing. You denormalize or you join in the application layer. Transactions that span shards require distributed transaction machinery that is slow and complex, so you redesign to keep each transaction inside one shard. Globally unique ids need a scheme that does not depend on a single sequence, so you move to UUIDs or a snowflake style generator. Rebalancing when one shard fills up is a genuine project, not a config change. And every one of these costs is permanent. Once you shard, you live with it.</p>
<p>This is exactly why sharding is the last rung. You climb to it only after replicas, partitioning, caching, and queues have all been pushed as far as they go.</p>

<h2>How I sequence the whole thing</h2>
<p>The path I follow almost every time looks like this. Index and tune until the cheap wins are gone. Add read replicas and route reads off the primary. Partition the giant tables so maintenance and pruning stay sane. Use caching and queues, which I cover in <a href="/blog/backend-scalability-patterns/">backend scalability patterns</a>, to take pressure off both reads and writes. Only when the write primary itself is the hard ceiling do I shard, and I treat the shard key choice as the most important decision in the entire effort.</p>
<p>The overarching lesson is that database scaling is a sequence of trade offs, not a single upgrade. Each rung buys capacity and charges complexity. The engineers who get into trouble are the ones who jump straight to the most powerful pattern because it sounds impressive, and then spend two years paying for distributed complexity they could have deferred for a long time with a couple of replicas and a good index.</p>
`
  }
];
