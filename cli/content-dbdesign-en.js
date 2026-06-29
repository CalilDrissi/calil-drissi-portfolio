module.exports = [
  {
    title: 'Database design and normalization (and when to denormalize)',
    slug: 'database-design-normalization',
    excerpt: 'Normalization is the default I reach for, but it is not a religion. Here is how I design schemas, why normal forms still matter, and the specific cases where I break them on purpose.',
    category: 'Databases',
    tags: ['database design', 'normalization', 'sql', 'data modeling'],
    pexels: 'server database racks',
    content: `
<p>I have inherited enough broken schemas to have strong opinions. The worst outages I have dealt with were almost never about a missing index or a slow disk. They were about a data model that lied. A column that meant three different things depending on the row. A "status" field that was secretly a free-text dumping ground. A foreign key that existed in someone's head but never in the database. Good design is the cheapest insurance you will ever buy, and you buy it before you write a single query.</p>

<p>This post is about how I actually approach normalization, what the normal forms buy you in practice, and the handful of situations where I deliberately denormalize. If you want the requirements-gathering side of this, I wrote that up separately in my <a href="/blog/data-modeling-methodology/">data modeling methodology</a> guide. This one is about the schema itself.</p>

<h2>What normalization actually protects you from</h2>

<p>People talk about normalization like it is an academic exercise. It is not. Every normal form exists to prevent a specific class of bug that will eventually wake you up at 3am. Strip away the formal language and the goal is simple. Store each fact exactly once, in the place where it belongs, so that there is no way for two copies of the same fact to disagree.</p>

<p>When the same piece of data lives in two places, those two places will drift apart. Not maybe. They will. Someone updates the customer's email in one table and forgets the other. A batch job touches half the rows. Now you have two truths and no way to know which one is correct. Normalization removes the second copy so the contradiction becomes impossible rather than merely unlikely.</p>

<h2>The normal forms, the way I think about them</h2>

<p>I do not walk around quoting the formal definitions, but I do keep their intent in my head when I sketch tables.</p>

<ul>
  <li><strong>First normal form</strong> means no repeating groups and no multi-valued columns. If you find yourself naming columns phone1, phone2, phone3, you have a separate table waiting to be born. A comma-separated list in a varchar is the same crime wearing a disguise.</li>
  <li><strong>Second normal form</strong> means every non-key column depends on the whole primary key, not just part of it. This only bites you with composite keys, but when it bites it leaves a mark.</li>
  <li><strong>Third normal form</strong> means non-key columns depend on the key and nothing but the key. If a column depends on another non-key column, it belongs in its own table. The classic example is storing a city and its postal code together when one determines the other.</li>
</ul>

<p>In day to day work, if I hit third normal form I am usually in good shape. Boyce-Codd and the higher forms matter for specific overlapping-key situations, but third normal form catches the vast majority of real modeling mistakes I see in code review.</p>

<h2>A concrete example</h2>

<p>Say we are storing orders. The naive version crams everything into one wide table, repeating the customer name and email on every single order row. Here is the normalized version I would actually ship.</p>

<pre><code>-- Customers own their own facts, once
CREATE TABLE customers (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email       CITEXT NOT NULL UNIQUE,
    full_name   TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Orders reference the customer, they do not copy it
CREATE TABLE orders (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id  BIGINT NOT NULL REFERENCES customers(id),
    status       TEXT NOT NULL
                 CHECK (status IN ('pending','paid','shipped','cancelled')),
    placed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Line items are their own grain: one row per product per order
CREATE TABLE order_items (
    order_id     BIGINT NOT NULL REFERENCES orders(id),
    product_id   BIGINT NOT NULL REFERENCES products(id),
    quantity     INT NOT NULL CHECK (quantity > 0),
    unit_price   NUMERIC(12,2) NOT NULL,
    PRIMARY KEY (order_id, product_id)
);</code></pre>

<p>Notice a few choices that are not strictly about normal forms but travel with good design. The status column has a CHECK constraint so the database itself enforces the allowed values. The unit_price lives on the line item, not on the product, because the price at the moment of sale is a different fact from the current price. That distinction is the kind of thing normalization forces you to think about. Is this the current value or the value as it was? They are not the same fact and they do not belong in the same column.</p>

<h2>Constraints are part of the design, not decoration</h2>

<p>A schema without constraints is a suggestion. I push as much invariant enforcement into the database as I reasonably can, because application code is the wrong place to guarantee data integrity. There will always be a second writer eventually. A migration script, an admin tool, a coworker poking around in a psql session. The database is the only layer all of them share.</p>

<p>So I use NOT NULL aggressively, foreign keys without apology, UNIQUE constraints on anything that should be unique, and CHECK constraints for value ranges and enumerations. If you only take one habit from this post, make it this one. Most of the "mysterious bad data" I have debugged would have been impossible with a constraint that took thirty seconds to write. I go deeper on this in my notes on <a href="/blog/database-schema-best-practices/">schema best practices</a>.</p>

<h2>When I denormalize on purpose</h2>

<p>Now the heresy. I denormalize regularly, and I do not feel bad about it, because denormalization done with intent is an optimization, not a mistake. The trick is that you only denormalize after you understand the access pattern, never before. Premature denormalization is just a data model with extra bugs.</p>

<p>Here are the cases where I reach for it.</p>

<ul>
  <li><strong>Read-heavy aggregates.</strong> If a dashboard reads an order total a thousand times for every one time the order changes, computing that total on every read is wasteful. I will store a cached total column and keep it current with a trigger or in the same transaction as the write.</li>
  <li><strong>Reporting and analytics tables.</strong> Transactional normalization and analytical query patterns pull in opposite directions. A wide, denormalized table or a star schema can turn a brutal eight-way join into a single scan. I keep these separate from the source of truth and rebuild them from it.</li>
  <li><strong>Expensive joins on the hot path.</strong> Sometimes a join is genuinely the bottleneck even after indexing. Copying one frequently-read column to avoid a join can be worth it, as long as you own the update path.</li>
</ul>

<p>The non-negotiable rule with every one of these is that the normalized version remains the source of truth. The denormalized copy is derived, disposable, and rebuildable. The moment you have two independent sources of truth you are back to the original sin that normalization existed to prevent.</p>

<h2>How I keep denormalization safe</h2>

<p>If I store a derived value, I make the derivation explicit and I make it automatic. A cached column gets updated in the same transaction as its source, or by a trigger, never by a hopeful comment that says "remember to update this." A materialized view gets a documented refresh schedule. A reporting table gets rebuilt by a job I can run on demand and verify against the source.</p>

<p>I also write a check, even a slow one I run nightly, that compares the derived value against a fresh computation and screams if they disagree. Drift is the failure mode of denormalization, and the only defense is to detect it early. Once you can prove the copy matches the source, the performance win comes with a clear conscience. When the copies do start to disagree, it is almost always because a query plan changed or an index disappeared, which is exactly the territory I cover in my <a href="/blog/database-indexing-deep-dive/">indexing deep dive</a>.</p>

<h2>The order I do things in</h2>

<p>My default sequence has not changed in years. Normalize first, to third normal form, with real constraints. Get it correct and let it be correct. Then measure. Only when a specific, measured access pattern demands it do I introduce a denormalized copy, and only as a derived artifact with an enforced update path. Correctness first, then speed, and never speed bought with a lie in the data.</p>

<p>That order matters because it is far easier to denormalize a clean model than to clean up a model that was muddy from birth. Start strict. Loosen deliberately. Your future self, paged at 3am, will thank you.</p>
`
  },
  {
    title: 'A practical data modeling methodology, from requirements to schema',
    slug: 'data-modeling-methodology',
    excerpt: 'Most schema problems are really requirements problems wearing a schema costume. This is the step by step process I use to go from a vague feature request to tables I trust.',
    category: 'Databases',
    tags: ['data modeling', 'methodology', 'database design', 'requirements'],
    pexels: 'whiteboard planning diagram',
    content: `
<p>Almost every truly painful schema I have had to live with started the same way. Someone opened a migration file and started typing CREATE TABLE before anyone had agreed on what the data actually was. The tables came first and the understanding came later, which is exactly backwards. A schema is the last artifact in modeling, not the first. By the time I write SQL, the hard thinking is already done.</p>

<p>This is the methodology I use to get from a fuzzy feature request to a schema I am willing to sign my name to. It is not heavy. It does not need special tooling. It mostly needs you to slow down for an afternoon so you can move fast for the next two years. For the design principles that govern the final schema, pair this with my post on <a href="/blog/database-design-normalization/">normalization and when to denormalize</a>.</p>

<h2>Step one, gather the nouns and the rules</h2>

<p>I start by reading or listening to how the people who actually do the work describe it. Not the engineers. The people in the domain. I am hunting for two things. The nouns, which become candidate entities, and the rules, which become constraints and relationships.</p>

<p>When a logistics coordinator says "a shipment can have many parcels but every parcel belongs to exactly one shipment," they have just handed me a one-to-many relationship and a NOT NULL foreign key, for free, in plain language. The domain experts are doing the modeling already. My job is to write it down faithfully and notice when their sentences contradict each other.</p>

<p>I keep a running glossary as I go. The single most underrated modeling tool is an agreed definition of each term. When two people use the word "account" to mean two different things, you will not find out until production, unless you forced the definition early.</p>

<h2>Step two, find the entities and their identity</h2>

<p>From the nouns, I pull out the real entities. The test I apply is identity. Does this thing have an existence of its own that I need to refer to over time? A customer does. An order does. A line on an order does. The color "blue" usually does not, it is an attribute, until the day the business needs a color catalog with its own rules, at which point it earns entity status.</p>

<p>For every entity I ask one question immediately. What makes a row unique? Sometimes there is a natural key, like an ISO country code. More often there is not, and I add a surrogate key, a generated identity column with no business meaning. I lean toward surrogate keys for most entities because natural keys have a nasty habit of changing, and a primary key that changes is a primary key that ruins your week.</p>

<h2>Step three, map the relationships</h2>

<p>Now I connect the entities, and I am precise about cardinality because cardinality is where the schema is decided.</p>

<ul>
  <li><strong>One to many</strong> is the common case. The "many" side carries a foreign key pointing back to the "one" side. An order has many items, so order_items carries the order_id.</li>
  <li><strong>Many to many</strong> always becomes a junction table. There is no other honest way to represent it. Students and courses meet in an enrollments table that carries both foreign keys.</li>
  <li><strong>One to one</strong> is rare and deserves suspicion. Usually it means you either have one entity that you split for no reason, or you have an optional extension that genuinely belongs in its own table. I make myself justify every one-to-one.</li>
</ul>

<p>For each relationship I also pin down the participation rules. Is the foreign key mandatory or optional? What should happen on delete? These are not afterthoughts. ON DELETE behavior is a real business decision dressed up as a technical one, and the business should get a vote.</p>

<h2>Step four, attributes and the grain question</h2>

<p>With entities and relationships in place, I attach attributes, and for each one I ask what it really is. Is it atomic, or is it secretly several facts crammed together? A "name" field that everyone wants to search by first and last name is two columns pretending to be one. An address is almost always several.</p>

<p>The most important question at this stage is grain. What does one row in this table represent, exactly, in one sentence? If I cannot say it cleanly, the table is confused and the queries will be too. "One row per order" is a clear grain. "One row per order, except sometimes per shipment" is a future incident report.</p>

<h2>Step five, write the schema and let the database help</h2>

<p>Only now do I write SQL, and at this point it almost writes itself, because the thinking is finished. Here is the kind of thing that falls out of the steps above for a simple course enrollment domain.</p>

<pre><code>-- One row per student
CREATE TABLE students (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email       CITEXT NOT NULL UNIQUE,
    full_name   TEXT NOT NULL,
    enrolled_on DATE NOT NULL DEFAULT CURRENT_DATE
);

-- One row per course offering
CREATE TABLE courses (
    id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code      TEXT NOT NULL UNIQUE,     -- natural key, stable per catalog
    title     TEXT NOT NULL,
    capacity  INT NOT NULL CHECK (capacity > 0)
);

-- The junction table: one row per student per course
CREATE TABLE enrollments (
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id  BIGINT NOT NULL REFERENCES courses(id)  ON DELETE RESTRICT,
    grade      TEXT CHECK (grade IN ('A','B','C','D','F') OR grade IS NULL),
    PRIMARY KEY (student_id, course_id)
);</code></pre>

<p>Look at how much of the model is now enforced by the database rather than left to hope. The many-to-many becomes a composite primary key, which also prevents a student from enrolling twice in the same course without any application code. The two different ON DELETE choices encode a real rule: deleting a student removes their enrollments, but you cannot delete a course that still has students in it.</p>

<h2>Step six, validate against the queries you will run</h2>

<p>A model is only as good as the questions it can answer. Before I call it done, I take the five or ten queries the application will actually run most often and I write them against the schema on paper. If a common question requires a tortured five-table join or a subquery nested three deep, the model is fighting the workload and I go back a step.</p>

<p>This is also where access patterns start to inform indexing, though I keep that as a separate concern. Get the model honest first, then make it fast. I walk through the performance side in detail in my <a href="/blog/database-indexing-deep-dive/">database indexing deep dive</a>.</p>

<h2>Step seven, plan for change</h2>

<p>No model survives contact with a roadmap unchanged, so I design for evolution from the start. I avoid columns that mean different things in different rows. I prefer adding a nullable column or a new table over overloading an existing one. I keep a migration discipline where every schema change is a versioned, reviewable file, never a manual edit to a live database.</p>

<p>The mindset that has served me best is this. Modeling is the act of writing down what is true about the world, carefully enough that the database can enforce it. The SQL is just the transcript. Do the thinking first, write the schema last, and validate it against the real questions, and you end up with tables that feel boring in the best possible way. Boring schemas do not page you.</p>
`
  },
  {
    title: 'Database indexing and query optimization, a deep dive',
    slug: 'database-indexing-deep-dive',
    excerpt: 'Indexes are the single highest-leverage tool for database performance, and also the easiest to get subtly wrong. Here is how indexes actually work and how I read query plans to use them.',
    category: 'Databases',
    tags: ['indexing', 'query optimization', 'performance', 'sql'],
    pexels: 'data center servers',
    content: `
<p>If you give me one slow query and an hour, the fix is an index more often than anything else. Indexes are the highest-leverage performance tool in a relational database, and they are also where I see the most confident, wrong intuition. People add an index to every column "just in case," or they add a multi-column index in the wrong order and wonder why the planner ignores it. This is my mental model for how indexes work and how I decide which ones to build.</p>

<p>None of this matters if the schema underneath is a mess, so if you have not already, the foundation comes from good <a href="/blog/database-design-normalization/">design and normalization</a>. Assume here that the model is sound and we are making it fast.</p>

<h2>What an index actually is</h2>

<p>An index is a separate, sorted data structure that lets the database find rows without scanning the whole table. The default in most relational databases is a B-tree, which keeps keys in sorted order and supports both equality lookups and range scans in logarithmic time. That sorted order is the whole point, and it explains almost everything an index can and cannot do.</p>

<p>Because the keys are sorted, a B-tree index is great at three things. Finding a specific value, finding a range of values, and returning rows already in sorted order so the database can skip a separate sort step. It is useless for the opposite. A query that asks for everything except one value, or that wraps the column in a function the index does not know about, cannot use the sorted structure and falls back to a full scan.</p>

<h2>The cost nobody mentions</h2>

<p>Every index you add makes reads faster and writes slower. That is not a slogan, it is mechanical. When you insert, update, or delete a row, the database has to update every index that covers the affected columns. A table with eight indexes pays for eight little maintenance operations on every write. Indexes also take disk space and memory, and a bloated index that does not fit in cache stops being the speed-up you wanted.</p>

<p>So I do not index defensively. I index in response to evidence. The right number of indexes is the smallest set that makes your actual queries fast, and finding that set means reading query plans rather than guessing.</p>

<h2>Reading the query plan</h2>

<p>The single most useful skill in database performance is reading EXPLAIN output. It tells you what the planner intends to do, and EXPLAIN ANALYZE tells you what actually happened with real timings. I run it constantly.</p>

<pre><code>-- See the plan and the real execution numbers
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, placed_at
FROM orders
WHERE customer_id = 42
  AND status = 'paid'
ORDER BY placed_at DESC
LIMIT 20;</code></pre>

<p>The things I look for, in order. Is there a sequential scan on a big table where I expected an index scan? That is the loudest alarm. How far off is the planner's estimated row count from the actual row count? A big gap means stale statistics and I run ANALYZE on the table. Is there an expensive sort that an index could satisfy directly? Is the same table being scanned more than once?</p>

<h2>Composite indexes and column order</h2>

<p>Multi-column indexes are where the most points are won and lost. The rule that took me too long to internalize is that column order is everything, and it follows from the sorted structure. An index on (customer_id, status, placed_at) is sorted by customer_id first, then status, then placed_at. That ordering means it can serve a query filtering on customer_id alone, or customer_id and status, or all three. It cannot efficiently serve a query that filters only on status, because status is not the leading column.</p>

<p>The guideline I use is equality columns first, then the range or sort column last. For the query above, an index on (customer_id, status, placed_at) is close to ideal. The two equality predicates narrow the search, and because placed_at is the final column and already sorted, the database can satisfy the ORDER BY and the LIMIT without a separate sort. One index, no sort step, twenty rows.</p>

<pre><code>-- Equality columns first, then the column we sort on
CREATE INDEX idx_orders_customer_status_time
    ON orders (customer_id, status, placed_at DESC);</code></pre>

<h2>Covering indexes and index-only scans</h2>

<p>There is a further trick. If an index contains every column a query needs, the database can answer the query from the index alone and never touch the table. That is an index-only scan, and it can be dramatically faster because it avoids the random reads back into the heap. I get there by including the extra columns the query returns.</p>

<pre><code>-- INCLUDE adds payload columns without changing the sort key
CREATE INDEX idx_orders_cover
    ON orders (customer_id, status)
    INCLUDE (placed_at, id);</code></pre>

<p>I do not do this everywhere, because wider indexes cost more to maintain and store. But for a hot, well-understood query that runs constantly, turning it into an index-only scan is one of the best returns on effort available.</p>

<h2>Indexes the planner will quietly refuse</h2>

<p>A surprising number of indexes go unused because of how the query is written, not how the index is built. The classic mistakes I look for first.</p>

<ul>
  <li><strong>Functions on the indexed column.</strong> WHERE lower(email) = 'x' cannot use a plain index on email. Either store the normalized value, use a case-insensitive type, or build an expression index on lower(email).</li>
  <li><strong>Leading wildcards.</strong> LIKE 'foo%' can use a B-tree, but LIKE '%foo' cannot, because the sorted order is useless when the start of the string is unknown.</li>
  <li><strong>Type mismatches.</strong> Comparing a text column to a number forces a cast that can disable the index. Match your types.</li>
  <li><strong>Low selectivity.</strong> An index on a column with two possible values rarely helps, because reading the index plus the heap is often slower than just scanning. The planner knows this and skips it, correctly.</li>
</ul>

<h2>Partial indexes for skewed data</h2>

<p>One of my favorite tools for real workloads is the partial index, which only covers rows matching a condition. If 95 percent of your orders are completed and you almost always query the small slice that is still pending, indexing only the pending rows gives you a tiny, fast index that stays hot in memory.</p>

<pre><code>-- Index only the rows we actually search for
CREATE INDEX idx_orders_pending
    ON orders (placed_at)
    WHERE status = 'pending';</code></pre>

<p>This keeps the index small, which keeps it fast and cheap to maintain. For tables with heavy skew it is often the difference between an index that fits in cache and one that does not.</p>

<h2>How I actually work</h2>

<p>My loop is boring and it works. Find the slow query from real metrics, not from a hunch. Run EXPLAIN ANALYZE and read it carefully. Identify whether the problem is a missing index, a bad column order, stale statistics, or a query written in a way that defeats indexing. Make one change. Measure again. Repeat until the plan is clean.</p>

<p>I resist the urge to add five indexes at once, because then I cannot tell which one helped and I have signed up for write overhead I may not need. One change, one measurement. And I revisit the index set periodically, because workloads drift and yesterday's essential index can become today's dead weight that only slows down writes. The same care that goes into the schema and the <a href="/blog/data-modeling-methodology/">data model</a> goes into keeping indexes honest. Measure, change one thing, measure again. That discipline beats cleverness every time.</p>
`
  }
];
