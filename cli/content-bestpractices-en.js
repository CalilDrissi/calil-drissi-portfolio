module.exports = [
  {
    title: 'Git workflow and branching best practices',
    slug: 'git-workflow-best-practices',
    excerpt: 'How I keep a team\'s Git history clean, reviewable, and easy to revert without ceremony getting in the way.',
    category: 'Best Practices',
    tags: ['git', 'version-control', 'workflow', 'collaboration'],
    pexels: 'version control workflow',
    content: `
<p>I have worked on teams that treated Git like a sacred ritual and teams that treated it like a junk drawer. Neither extreme ships software well. After years of cleaning up messy histories and untangling merge disasters, I have landed on a set of habits that keep things calm. None of them are clever. That is the point.</p>

<h2>Pick one branching model and stop arguing about it</h2>
<p>The model matters less than the agreement. For most product teams I use trunk-based development with short-lived feature branches. You branch off main, you do your work in a day or two, you merge back, you delete the branch. The longer a branch lives, the more it drifts, and the more painful the eventual merge becomes. Long-lived release branches have their place in software that ships on a fixed cadence to customers who cannot update on demand, but for a web app deploying several times a day they are pure overhead.</p>
<p>What I actively avoid is the elaborate GitFlow setup with develop, release, hotfix, and feature branches all interleaving. I have watched it confuse new hires for weeks. If your deployment is continuous, your branching should be too.</p>

<h2>Write commits that explain the why</h2>
<p>A commit message is a note to whoever is reading the history at 2am during an incident, and that person might be you. The diff already shows what changed. The message needs to capture why. I keep the subject line under about fifty characters, written in the imperative, and I use the body to explain reasoning when the change is not obvious.</p>
<pre><code>fix: prevent double charge on retry

The payment client retried on a 504 even though the
charge had already gone through on the gateway side.
We now key the request with an idempotency token so
the gateway dedupes it. Closes #482.</code></pre>
<p>Atomic commits are the other half of this. One logical change per commit. When a commit does three unrelated things, you can never cleanly revert one of them, and bisecting becomes useless. If you find yourself writing "and" in a subject line, that is two commits.</p>

<h2>Rebase your own work, merge shared work</h2>
<p>This is the rule that saves the most pain. Before I open a pull request, I rebase my branch onto the latest main so my changes sit on top of current reality and review is a clean read. But once a branch is shared or a PR is open and others have looked at it, I stop rebasing and merge instead, because rewriting published history forces everyone else to recover their local state.</p>
<ul>
  <li>Rebase to tidy local commits before they are public.</li>
  <li>Use interactive rebase to squash the inevitable "fix typo" and "actually fix it" commits.</li>
  <li>Never force-push a branch other people are building on.</li>
  <li>Protect main so nobody can push to it directly.</li>
</ul>

<h2>Keep main always releasable</h2>
<p>The single most valuable property of a repository is that main always works. If main is green, you can cut a release at any moment, and a broken deploy can be fixed by reverting one merge. I enforce this with required status checks: tests and linting have to pass before a merge button even appears. This connects directly to how I run reviews, which I wrote about in <a href="/blog/code-review-best-practices/">code review best practices</a>. A clean history makes reviews faster, and good reviews keep the history clean. They feed each other.</p>

<h2>Make reverting boring</h2>
<p>When something breaks in production, the fastest safe action is usually to revert, not to debug live. Squash-merging each PR into a single commit on main makes this trivial: one PR is one commit, and reverting it removes the whole feature cleanly. I like squash merges for exactly this reason on application code, though for libraries where individual commit history carries real value I keep the full history.</p>
<p>Tag your releases so you can always answer "what was running last Tuesday." A lightweight tag costs nothing and turns a vague question into a one-line answer.</p>

<h2>Some habits that pay off quietly</h2>
<ul>
  <li>Commit a sensible .gitignore on day one so secrets and build artifacts never enter history. Removing a leaked credential from history is a bad afternoon.</li>
  <li>Pull with rebase by default to avoid the noise of merge commits on every sync.</li>
  <li>Keep PRs small. A 200-line PR gets a real review. A 2000-line PR gets a rubber stamp.</li>
</ul>
<p>Git rewards discipline more than knowledge. You do not need to memorize the plumbing commands. You need a small set of agreements that everyone actually follows. The same thinking shows up when I design data stores, which I covered in <a href="/blog/database-schema-best-practices/">database schema best practices</a>, where a few firm conventions early save enormous cleanup later.</p>
`
  },
  {
    title: 'Code review best practices',
    slug: 'code-review-best-practices',
    excerpt: 'Reviews are about shared understanding and catching real problems, not gatekeeping or style policing. Here is how I run them.',
    category: 'Best Practices',
    tags: ['code-review', 'collaboration', 'quality', 'process'],
    pexels: 'code review programming',
    content: `
<p>Code review is the single highest-leverage habit a team can have, and it is also the one most often done badly. I have been on the receiving end of reviews that felt like an interrogation and reviews that approved 800 lines with a thumbs-up emoji in four seconds. Both are failures. A good review catches real problems, spreads knowledge, and leaves the author feeling supported rather than judged.</p>

<h2>Review for the things humans are good at</h2>
<p>Do not spend your attention on formatting, import order, or whether a line is too long. A linter and an auto-formatter handle those, and they never get tired or grumpy. If your team argues about style in PR comments, you have a tooling gap, not a discipline problem. Configure the formatter, commit the config, and move on.</p>
<p>What machines cannot check is whether the code is correct, whether it solves the actual problem, and whether someone six months from now will understand it. That is where my attention goes:</p>
<ul>
  <li>Does this do what the description says it does?</li>
  <li>What happens at the edges: empty input, nulls, concurrent access, a network call that hangs?</li>
  <li>Is there a simpler approach hiding behind this one?</li>
  <li>Will the naming make sense to someone who was not in the room?</li>
</ul>

<h2>Keep changes small enough to actually review</h2>
<p>The hard limit on review quality is size. Research and my own experience both say the same thing: past a few hundred lines, defect detection falls off a cliff because reviewers skim. When I get a giant PR, I ask the author to split it. A series of small, focused PRs gets genuine scrutiny on each one. This is also why I rebase and squash carefully before opening a PR, a habit I described in <a href="/blog/git-workflow-best-practices/">git workflow best practices</a>.</p>

<h2>Comment like a colleague, not a compiler</h2>
<p>Tone is most of the job. The same point lands completely differently depending on phrasing. I ask questions instead of issuing verdicts, and I make it clear which comments are blocking versus optional.</p>
<pre><code># Instead of:
This is wrong.

# Try:
What happens here if items is empty? I think
we'd index past the end. Could we guard with a
length check, or is that case impossible upstream?

# And label the small stuff:
nit: could inline this, non-blocking</code></pre>
<p>Marking nits as non-blocking is a small thing that removes a huge amount of friction. The author knows what they must fix to merge versus what is just my taste. I also make a point of saying when something is genuinely good. A review that is only criticism trains people to dread the process.</p>

<h2>Review promptly and finish what you start</h2>
<p>A PR sitting unreviewed for two days blocks a person and rots as main moves underneath it. I treat review requests as near the top of my queue, ideally same day. The cost of a stalled PR compounds: the author context-switches away, then has to reload everything when feedback finally arrives.</p>
<p>When I review, I try to give all my feedback in one pass rather than dribbling comments out over three rounds. Nothing is more demoralizing than fixing everything, getting re-reviewed, and discovering five new comments that were always visible.</p>

<h2>The author has homework too</h2>
<p>Reviews go faster when the author makes them easy. Before I request review I write a description that explains what changed and why, I leave inline comments on my own diff pointing out anything non-obvious, and I make sure CI is green. A good description can cut review time in half because the reviewer is not reverse-engineering intent from the diff.</p>
<ul>
  <li>State the problem, not just the solution.</li>
  <li>Call out anything you are unsure about and want eyes on.</li>
  <li>Include screenshots or sample output for anything user-facing.</li>
</ul>

<h2>Disagree, then commit</h2>
<p>Sometimes the author and reviewer just see it differently. When the disagreement is about taste rather than correctness, I default to the author's call after voicing my view once. Dragging a PR through five rounds over a stylistic preference burns goodwill that you will want later. Save the firm stands for things that actually matter: correctness, security, and the data contracts I care so much about in <a href="/blog/rest-api-design-guidelines/">REST API design guidelines</a>. Get those right and let the small stuff go.</p>
`
  },
  {
    title: 'REST API design guidelines',
    slug: 'rest-api-design-guidelines',
    excerpt: 'Practical rules for designing HTTP APIs that are predictable, versionable, and pleasant to consume.',
    category: 'Best Practices',
    tags: ['api', 'rest', 'http', 'backend'],
    pexels: 'api integration design',
    content: `
<p>An API is a promise. Once a client depends on it, every quirk you shipped becomes permanent, because someone out there wrote code against that quirk. I have maintained APIs for years and the ones that aged well all shared the same trait: they were boring and predictable. Here is how I get there.</p>

<h2>Model resources as nouns, use verbs from HTTP</h2>
<p>The URL should name a thing. The method says what you are doing to it. I see endpoints like /getUser and /createOrderNow constantly, and they fight the whole point of HTTP. A clean design uses plural nouns for collections and lets the method carry the action.</p>
<pre><code>GET    /orders          list orders
POST   /orders          create an order
GET    /orders/42       fetch one order
PATCH  /orders/42       update some fields
DELETE /orders/42       remove it

GET    /orders/42/items nested resource</code></pre>
<p>PATCH for partial updates and PUT for full replacement is a distinction worth keeping. Most real updates touch a few fields, so PATCH is what I reach for, and PUT becomes the rare case where the client genuinely owns the entire representation.</p>

<h2>Use status codes the way clients expect</h2>
<p>Return the status code that matches reality. A 200 on a failed request because "we put the error in the body" breaks every generic client and monitoring tool that reads the status line. The set I use covers almost everything:</p>
<ul>
  <li>200 for a successful read or update, 201 when you created something.</li>
  <li>400 for malformed input, 422 when the input is well-formed but semantically invalid.</li>
  <li>401 when you do not know who they are, 403 when you know and they are not allowed.</li>
  <li>404 for a missing resource, 409 for a conflict like a duplicate.</li>
  <li>500 only for genuine server faults, never for a client mistake.</li>
</ul>

<h2>Make errors machine-readable</h2>
<p>An error body should help the calling code react, not just print a string. I return a stable machine code alongside a human message, so clients can branch on the code without parsing prose that I might reword later.</p>
<pre><code>{
  "error": {
    "code": "insufficient_funds",
    "message": "The card was declined.",
    "field": "payment_method"
  }
}</code></pre>
<p>Consistency here matters more than cleverness. Every error in the API should have the same shape, so a client writes one error handler instead of ten. This is the same instinct I bring to logging, which I wrote about in <a href="/blog/logging-and-observability-best-practices/">logging and observability best practices</a>: structure beats prose when something else has to read it.</p>

<h2>Plan for versioning before you need it</h2>
<p>You will need to make a breaking change eventually. Decide how before you ship v1. I put the version in the path, /v1/orders, because it is visible, cacheable, and trivial to route. Header-based versioning is more elegant on paper and more annoying in practice when someone is debugging with curl. Whatever you pick, the rule is that you never break an existing version. Additive changes like new optional fields are fine. Removing a field or changing its type is a new version.</p>

<h2>Paginate and filter from day one</h2>
<p>Any collection that can grow will grow, and a GET that returns ten thousand rows will eventually time out and take a database with it. I add pagination to every list endpoint at the start, even when the data is tiny, because retrofitting it later is a breaking change. Cursor-based pagination handles large, shifting datasets better than offset, since offset drifts when rows are inserted mid-scroll.</p>
<ul>
  <li>Return a stable cursor and a clear "has more" signal.</li>
  <li>Allow filtering with query parameters, and document exactly which fields are filterable.</li>
  <li>Cap the page size server-side so a client cannot ask for everything at once.</li>
</ul>

<h2>Be strict about what you accept, generous about what you return</h2>
<p>Validate input hard at the boundary and reject anything malformed with a clear 400 or 422. The closer to the edge you catch bad data, the less it can corrupt downstream, which ties straight back to the constraints I rely on in <a href="/blog/database-schema-best-practices/">database schema best practices</a>. On the output side, keep responses stable and predictable so clients can trust the shape. An API that is strict at the door and consistent on the way out is one people enjoy building against, and that good will is what gets your platform adopted.</p>
`
  },
  {
    title: 'Database schema best practices',
    slug: 'database-schema-best-practices',
    excerpt: 'Schema decisions are the hardest to reverse in any system. Here is how I design tables that hold up under growth.',
    category: 'Best Practices',
    tags: ['database', 'sql', 'schema', 'data-modeling'],
    pexels: 'database server storage',
    content: `
<p>The schema is the part of a system that is hardest to change once it is full of data. You can rewrite a service in a weekend. Migrating a billion-row table without downtime is a project. So I spend real time on the schema up front, because the cost of getting it wrong only grows. These are the decisions I do not regret.</p>

<h2>Let the database enforce the rules</h2>
<p>Application code is not the place to guarantee data integrity, because there is always another path in: a migration script, a manual fix, a second service, a developer in a console. The database is the one chokepoint everything passes through, so that is where the rules belong. I use NOT NULL aggressively, foreign keys to enforce relationships, unique constraints to prevent duplicates, and check constraints for value ranges.</p>
<pre><code>CREATE TABLE orders (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES customers(id),
  status      text   NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','paid','shipped','cancelled')),
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);</code></pre>
<p>Every constraint here is a bug that can never reach production. A status of "shippd" gets rejected at write time instead of breaking a report three weeks later.</p>

<h2>Normalize first, denormalize on evidence</h2>
<p>I start normalized: each fact lives in exactly one place. Duplicated data is duplicated truth, and the copies drift apart the moment someone updates one and forgets the other. Normalization keeps writes simple and correctness cheap.</p>
<p>Denormalization is a performance optimization, and like any optimization I want a measurement before I do it. When a specific query is genuinely too slow and the profile points at joins, then I will cache a computed value or duplicate a column, knowing I am taking on the job of keeping the copies in sync. Doing it preemptively is how you get a schema full of fields nobody trusts.</p>

<h2>Choose keys and types deliberately</h2>
<p>Every table gets a synthetic primary key, usually a bigint identity or a UUID. I avoid natural keys like email addresses as primary keys, because the one thing you can promise about a natural key is that it will change, and changing a primary key that is referenced everywhere is misery. Use types that mean something:</p>
<ul>
  <li>Store money as integer cents, never floats. Floating point and currency are old enemies.</li>
  <li>Always use timestamp-with-time-zone for time, and store UTC.</li>
  <li>Reach for a native enum or a check constraint instead of free-text status fields.</li>
  <li>Use the database's real JSON type for genuinely unstructured data, not a text blob.</li>
</ul>

<h2>Index for your reads, but know the cost</h2>
<p>An index makes reads fast and writes slightly slower, and it takes space. I index foreign keys, columns I filter on regularly, and columns I sort by. I do not index everything, because an unused index is pure overhead on every insert. The way to know is to look: most databases will tell you which indexes go untouched, and those are candidates for removal.</p>
<p>Composite indexes are worth understanding because column order matters. An index on (customer_id, created_at) helps a query filtering by customer and sorting by date, but it does nothing for a query that only filters by date. The same observability mindset I described in <a href="/blog/logging-and-observability-best-practices/">logging and observability best practices</a> applies here: measure the real query patterns before you guess.</p>

<h2>Treat migrations as code</h2>
<p>Every schema change goes through a migration file, checked into version control, reviewed like any other change. No manual ALTER statements run by hand in production, ever, because the next environment will not have them and you will spend a day chasing the difference. The same review discipline from <a href="/blog/code-review-best-practices/">code review best practices</a> applies, with extra care, since a bad migration can lock a table or drop data.</p>
<ul>
  <li>Make migrations forward-only and additive where you can. Add a column, backfill, then later remove the old one in a separate step.</li>
  <li>Avoid changes that take a long exclusive lock on a large, live table.</li>
  <li>Test the migration against a copy of production-sized data before you run it for real.</li>
</ul>
<p>A schema you can evolve safely is worth more than a perfect schema you are afraid to touch. Build for change, because change is the only certainty.</p>
`
  },
  {
    title: 'Logging and observability best practices',
    slug: 'logging-and-observability-best-practices',
    excerpt: 'When production breaks at 3am, your logging and metrics are the only thing standing between you and guesswork.',
    category: 'Best Practices',
    tags: ['observability', 'logging', 'monitoring', 'operations'],
    pexels: 'server monitoring dashboard',
    content: `
<p>You find out how good your observability is at the worst possible moment: when something is broken, customers are noticing, and you have no idea why. Everything I do here is aimed at that moment. The goal is to answer "what is happening and why" in minutes, not hours. Good observability is the difference between a calm incident and a frantic one.</p>

<h2>Log structured data, not sentences</h2>
<p>Human-readable log lines feel friendly until you need to search ten million of them. Then you are writing fragile regexes against prose. I log structured records, key-value or JSON, so logs are queryable like a database instead of grepped like a diary.</p>
<pre><code>// Not this:
log.info("User " + userId + " failed login from " + ip)

// This:
log.info("login_failed", {
  user_id: userId,
  ip: ip,
  reason: "bad_password",
  attempt: 3
})</code></pre>
<p>Now "show me all failed logins for this user in the last hour" is a filter, not an archaeology project. Pick consistent field names across services so the same concept has the same key everywhere, and a query written once works across the whole system.</p>

<h2>Use levels with discipline</h2>
<p>Log levels only help if they mean something consistent. When everything is logged at INFO, the level is noise. My rule of thumb:</p>
<ul>
  <li>ERROR is something broken that a human needs to look at. If it does not warrant attention, it is not an error.</li>
  <li>WARN is unexpected but handled, the kind of thing worth watching for a pattern.</li>
  <li>INFO is significant business events: an order placed, a job finished.</li>
  <li>DEBUG is detail for local development, usually off in production.</li>
</ul>
<p>The test for ERROR is simple: if a page fired for every one, would you be angry? If yes, it is not really an error, and you have just trained yourself to ignore the level that is supposed to wake you up.</p>

<h2>Carry a request ID through everything</h2>
<p>In any system with more than one service, a single user action becomes a dozen log lines scattered across machines. Without a thread connecting them you are guessing. I generate a correlation ID at the edge and pass it through every downstream call and into every log line. Then one ID reconstructs the entire path of a request, which is the same reason I keep error shapes consistent in <a href="/blog/rest-api-design-guidelines/">REST API design guidelines</a>: when something else has to follow the trail, structure wins.</p>

<h2>Measure the three things that tell you about health</h2>
<p>Logs tell you about specific events. Metrics tell you about the system as a whole, and they are what your dashboards and alerts run on. For any service that handles requests I track rate, errors, and duration: how many requests, how many failed, and how long they took. Watching the latency distribution rather than the average matters, because the average hides the slow tail where real users suffer.</p>
<ul>
  <li>Track the 95th and 99th percentile latency, not just the mean.</li>
  <li>Track error rate as a percentage so it is meaningful at any traffic level.</li>
  <li>Track saturation, how full your resources are, so you see trouble before it becomes an outage.</li>
</ul>

<h2>Alert on symptoms, not causes</h2>
<p>An alert should mean a human needs to act now. If it does not, it should be a dashboard, not a page. The fastest way to make on-call hate their life is alerts that fire constantly and mean nothing, because people learn to swipe them away and then miss the one that mattered. I alert on user-facing symptoms, like error rate crossing a threshold or latency blowing past its budget, rather than on internal causes like high CPU, which may be perfectly fine.</p>
<p>One more thing that pays off: never log secrets, passwords, tokens, or full payment details. It is easy to leak them into logs by accident, and logs sprawl across systems that have weaker access controls than your database. The same constraint-driven care I described in <a href="/blog/database-schema-best-practices/">database schema best practices</a> belongs here too. Decide what is sensitive, then make sure it never reaches a log line in the first place.</p>
`
  }
];
