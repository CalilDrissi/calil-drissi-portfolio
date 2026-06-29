module.exports = [
  {
    title: 'Vector databases explained: embeddings and similarity search',
    slug: 'vector-databases-explained',
    excerpt: 'What a vector database actually does, how embeddings turn text into numbers, and why similarity search behaves nothing like the SQL WHERE clauses you already know.',
    category: 'Vector Databases',
    tags: ['vector databases', 'embeddings', 'similarity search', 'machine learning'],
    pexels: 'artificial intelligence data',
    content: `<p>The first time I shipped a feature backed by a vector database, I spent an afternoon confused about why my results made no sense. I had treated it like a keyword index. It is not one. A vector database stores meaning, or at least a numerical approximation of meaning, and it answers a different kind of question than the databases I had used for years. This post is the explanation I wish someone had handed me before I started.</p>

<h2>What an embedding actually is</h2>
<p>An embedding is a list of floating point numbers that represents a piece of content. You take some text, an image, or an audio clip, run it through a model, and out comes a fixed length array. A typical text embedding might have 384, 768, or 1536 dimensions. Each number on its own means nothing you can interpret. Together they place the content at a specific point in a high dimensional space.</p>
<p>The useful property is that similar content lands in nearby positions. The sentence "my laptop will not turn on" and the sentence "my computer is dead" produce vectors that sit close together, even though they share almost no words. A keyword search would miss that connection entirely. An embedding captures it because the model that produced the vectors learned, from enormous amounts of text, that those phrases mean roughly the same thing.</p>
<p>This is the whole trick. We convert the fuzzy human notion of "these two things are about the same topic" into a geometry problem. Once it is geometry, a computer can solve it fast.</p>

<h2>How similarity is measured</h2>
<p>Closeness in this space is usually measured with cosine similarity or, equivalently for normalized vectors, dot product. Cosine similarity looks at the angle between two vectors and ignores their length. Two vectors pointing in the same direction score near 1.0, vectors at right angles score near 0, and opposite vectors score near -1.0. Some systems use Euclidean distance instead, which measures straight line distance. The choice depends on how the embedding model was trained, and getting it wrong quietly degrades your results.</p>
<p>Here is the part that surprises people coming from relational databases. There is no exact match. Every query returns a ranked list of approximately relevant items with a score attached. You decide where to cut the list off. That mental shift, from "the row that matches" to "the rows that are most similar," is the single biggest adjustment.</p>

<h2>Generating embeddings in practice</h2>
<p>You rarely train an embedding model yourself. You call one. Here is a small example that turns a few sentences into vectors and measures how close they are.</p>

<pre><code>from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer("all-MiniLM-L6-v2")

sentences = [
    "my laptop will not turn on",
    "my computer is dead",
    "what time does the store close",
]

vectors = model.encode(sentences, normalize_embeddings=True)

def cosine(a, b):
    return float(np.dot(a, b))

print("laptop vs computer:", cosine(vectors[0], vectors[1]))
print("laptop vs store:", cosine(vectors[0], vectors[2]))
</code></pre>

<p>Run that and the first pair scores high while the second pair scores low. The model never saw these exact sentences during training. It learned the relationships from context, and that generalization is what makes the whole approach work.</p>

<h2>Why you need a specialized database</h2>
<p>You could store vectors in a normal column and compare your query against every row. That is called a brute force or exact search, and it works fine up to maybe a hundred thousand vectors. Past that it falls apart, because comparing one query against ten million vectors on every request is too slow for anything interactive.</p>
<p>Vector databases solve this with approximate nearest neighbor indexes. The most common is HNSW, which stands for Hierarchical Navigable Small World. It builds a layered graph where each vector links to its neighbors, and a query walks the graph instead of scanning everything. You trade a tiny bit of accuracy for an enormous speed gain. Other index types like IVF and product quantization make different tradeoffs between memory, speed, and recall.</p>
<ul>
<li><strong>Recall</strong> is the fraction of the true nearest neighbors your index actually returns. You tune it up or down depending on how much latency you can spend.</li>
<li><strong>Latency</strong> is how long a query takes. HNSW typically answers in single digit milliseconds even over millions of vectors.</li>
<li><strong>Memory</strong> matters because HNSW graphs are large. Quantization shrinks vectors at some cost to precision.</li>
</ul>

<h2>Metadata filtering is where it gets real</h2>
<p>Pure similarity search is rarely enough on its own. In real applications you want "find documents similar to this query, but only from this user's workspace, written in the last 90 days." That means combining vector search with traditional filters on metadata. How well a database handles this combination, called filtered or hybrid search, is one of the things I care about most when I evaluate options, and it is a major theme in my notes on <a href="/blog/choosing-a-vector-database/">choosing a vector database</a>.</p>
<p>Done badly, filtering forces the engine to either scan everything or return too few results because the filter eliminated most of the candidates the index found. Done well, the filter is applied during the graph traversal so you still get fast, accurate results inside the subset you care about.</p>

<h2>A mental model that holds up</h2>
<p>I think of a vector database as a search engine for meaning rather than words. A keyword index answers "which documents contain these tokens." A vector index answers "which documents are about the same thing as this query." Those are complementary, not competing, which is why the strongest systems I have built use both at once and merge the rankings.</p>
<p>The embeddings carry the semantics. The index makes search fast at scale. The metadata filters keep results relevant to the actual user. Once those three pieces clicked for me, the rest of the field stopped feeling like magic and started feeling like engineering.</p>

<h2>Where this leads</h2>
<p>The reason vector databases exploded in popularity is that they are the storage layer underneath retrieval augmented generation. When you want a language model to answer questions about your own documents, you embed those documents, store the vectors, and retrieve the relevant ones at query time. I walk through that entire pattern in <a href="/blog/rag-with-vector-databases/">building RAG systems with vector databases</a>, and it builds directly on everything here. If you want the broader picture of how this fits into shipping real systems, my write up on <a href="/blog/practical-ai-engineering/">practical AI engineering</a> covers the surrounding decisions.</p>
<p>Start by generating a few embeddings and printing the similarity scores yourself. Seeing related sentences score high and unrelated ones score low does more to build intuition than any diagram. Everything else is detail on top of that one idea.</p>`
  },
  {
    title: 'Choosing a vector database: pgvector, Pinecone, Qdrant, Weaviate, Milvus',
    slug: 'choosing-a-vector-database',
    excerpt: 'A practical comparison of the vector databases I have actually run in production, when each one earns its place, and why the right answer is usually less exciting than people expect.',
    category: 'Vector Databases',
    tags: ['vector databases', 'pgvector', 'pinecone', 'database architecture'],
    pexels: 'database server technology',
    content: `<p>Every few weeks someone asks me which vector database they should use, and they want a single name. I never give one, because the honest answer depends on what you already run, how many vectors you have, and how much operational work you are willing to own. I have shipped systems on several of these, and here is how I actually decide. If the terms embeddings and approximate nearest neighbor are new to you, start with my explainer on <a href="/blog/vector-databases-explained/">vector databases and similarity search</a> first.</p>

<h2>Start with the boring answer: pgvector</h2>
<p>If you already run Postgres, try pgvector before anything else. It is an extension that adds a vector column type and the index types you need, and it lets you keep your embeddings in the same database as the rest of your data. That last point matters more than people admit. Filtering vector search by a user id, a tenant, or a date range is trivial when the vectors live next to those columns, because it is just a WHERE clause the planner already understands.</p>

<pre><code>CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
    id bigserial PRIMARY KEY,
    workspace_id bigint NOT NULL,
    body text NOT NULL,
    embedding vector(768)
);

CREATE INDEX ON documents
    USING hnsw (embedding vector_cosine_ops);

SELECT id, body
FROM documents
WHERE workspace_id = 42
ORDER BY embedding <=> '[0.12, -0.03, ...]'
LIMIT 5;
</code></pre>

<p>That <em>distance operator</em> does cosine distance, and the HNSW index keeps it fast. For most products with up to a few million vectors, this is all you need, and you avoid running a second system entirely. I have happily left applications on pgvector long past the point where people assumed they would have outgrown it.</p>

<h2>When you outgrow Postgres</h2>
<p>pgvector has limits. Index builds get heavy as vector counts climb into the tens of millions, memory pressure competes with your transactional workload, and you do not get the specialized knobs a dedicated engine offers. When those start to hurt, it is time to look at a purpose built database. The candidates I reach for are Qdrant, Weaviate, Milvus, and Pinecone.</p>

<h2>Qdrant</h2>
<p>Qdrant is my default recommendation for a dedicated engine when a team wants to self host. It is written in Rust, the performance is excellent, and its filtered search is genuinely good rather than bolted on. The payload filtering integrates with the vector index so you do not pay the penalty I described earlier where a filter wrecks recall. The API is clean, the docs are honest, and running it in Docker or Kubernetes is straightforward. For most teams leaving pgvector, this is where I point them.</p>

<h2>Weaviate</h2>
<p>Weaviate leans into being more than a vector store. It has built in modules for generating embeddings, doing hybrid search out of the box, and even orchestrating generative steps. If you want the database to handle more of the pipeline and you like a GraphQL flavored API, it is a strong fit. I find the extra features useful when a team is small and wants fewer moving parts, and less useful when a team already has its own embedding and retrieval code and just wants a fast store.</p>

<h2>Milvus</h2>
<p>Milvus is the heavy machinery. It is built for very large scale, with a distributed architecture that separates storage and compute, and it supports a wide range of index types. If you are dealing with hundreds of millions or billions of vectors, Milvus is designed for exactly that, and it scales horizontally in ways the others do not match as cleanly. The cost is operational complexity. It is more to run, more to understand, and overkill for a workload that fits comfortably in a single node. Reach for it when the scale genuinely demands it, not before.</p>

<h2>Pinecone</h2>
<p>Pinecone is the managed, serverless option. You do not run anything, you call an API, and it handles the scaling and operations. For teams that do not want to own infrastructure, that is worth real money, and the developer experience is smooth. The tradeoffs are the usual ones for a managed service: cost at scale, less control, and a dependency on a vendor for a core part of your system. I reach for it when a team is moving fast and infrastructure work is not where they want to spend their limited attention.</p>

<h2>How I actually choose</h2>
<ul>
<li><strong>Already on Postgres, under a few million vectors:</strong> pgvector. Do not add a system you do not need.</li>
<li><strong>Self hosting, want a fast dedicated engine with strong filtering:</strong> Qdrant.</li>
<li><strong>Want the database to own embeddings and hybrid search:</strong> Weaviate.</li>
<li><strong>Hundreds of millions of vectors and a team to run it:</strong> Milvus.</li>
<li><strong>Do not want to run infrastructure at all:</strong> Pinecone.</li>
</ul>

<h2>The factors that matter more than the logo</h2>
<p>The brand name on the database is the least interesting decision. What actually determines whether you are happy six months later is a shorter list. How well does filtered search perform, because real queries almost always combine similarity with metadata constraints. How painful is reindexing when you change embedding models, which you will. How does cost scale with vector count and query volume. And how much operational burden are you signing up for relative to the team you have.</p>
<p>I have seen far more projects suffer from a poorly tuned index or a bad chunking strategy than from picking the wrong vendor. The database is a component. The system around it, especially the retrieval quality, is where the wins and losses actually happen, which is the subject of <a href="/blog/rag-with-vector-databases/">building RAG systems with vector databases</a>.</p>

<h2>My honest default</h2>
<p>Start with pgvector. Prove the product works. Measure your real query patterns and your real vector count. Only move to a dedicated engine when you have evidence that Postgres is the bottleneck, and at that point you will know enough about your workload to choose the right one with confidence. Picking the fancy distributed system on day one is a classic way to spend weeks on operations for a problem you do not yet have.</p>`
  },
  {
    title: 'Building RAG systems with vector databases',
    slug: 'rag-with-vector-databases',
    excerpt: 'A practical walkthrough of retrieval augmented generation: chunking, embedding, retrieval, and the unglamorous details that decide whether your RAG system is useful or useless.',
    category: 'Vector Databases',
    tags: ['rag', 'vector databases', 'llm', 'retrieval'],
    pexels: 'neural network technology',
    content: `<p>Retrieval augmented generation sounds complicated and is actually simple in outline. You give a language model access to your documents by retrieving the relevant ones and pasting them into the prompt. The model answers using that context instead of relying only on what it memorized during training. The outline fits in a sentence. The reason RAG systems fail is never the outline. It is the details, and this post is about the details, because I have watched the same mistakes sink the same projects more than once.</p>
<p>This assumes you understand embeddings and similarity search already. If not, read <a href="/blog/vector-databases-explained/">vector databases explained</a> first, because the entire retrieval step depends on those ideas.</p>

<h2>The pipeline at a glance</h2>
<p>A RAG system has two phases. There is an offline ingestion phase where you process your documents and store them, and an online query phase where you answer a user's question. Ingestion looks like this: take your documents, split them into chunks, generate an embedding for each chunk, and store the vectors with their text and metadata in a vector database. Querying looks like this: embed the user's question, retrieve the most similar chunks, assemble them into a prompt, and send that to the model.</p>

<h2>Chunking is where most projects go wrong</h2>
<p>Chunking is the act of splitting documents into pieces small enough to retrieve and embed. It is also the step people give the least thought to and then wonder why their answers are bad. If your chunks are too large, each embedding becomes a blurry average of several topics and similarity search gets imprecise. If your chunks are too small, you retrieve fragments that lack the context needed to answer anything.</p>
<p>What works for me is chunking along the natural structure of the document. Split on headings and paragraphs rather than blindly every 500 characters, because a chunk that respects a section boundary carries a coherent idea. I also overlap chunks slightly so a sentence near a boundary is not orphaned from its context. A few hundred tokens per chunk with a small overlap is a reasonable starting point, but the right answer depends on your content, and you should look at actual chunks to sanity check them.</p>

<h2>Ingestion in code</h2>
<p>Here is the shape of an ingestion step using pgvector. I am keeping it deliberately small so the structure is visible.</p>

<pre><code>import psycopg2
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-mpnet-base-v2")
conn = psycopg2.connect("dbname=app")

def ingest(doc_id, chunks):
    vectors = model.encode(chunks, normalize_embeddings=True)
    with conn.cursor() as cur:
        for text, vec in zip(chunks, vectors):
            cur.execute(
                "INSERT INTO chunks (doc_id, body, embedding) "
                "VALUES (%s, %s, %s)",
                (doc_id, text, vec.tolist()),
            )
    conn.commit()
</code></pre>

<p>Nothing here is exotic. The interesting work happened before this function ran, in how the chunks were produced, and it happens after, in how you retrieve.</p>

<h2>Retrieval and the prompt</h2>
<p>At query time you embed the question with the same model you used for ingestion. Using a different model is a subtle and painful bug, because the two vector spaces do not line up and your similarity scores become meaningless. Then you retrieve the top candidates and build the prompt.</p>

<pre><code>def answer(question, k=5):
    qvec = model.encode([question], normalize_embeddings=True)[0]
    with conn.cursor() as cur:
        cur.execute(
            "SELECT body FROM chunks "
            "ORDER BY embedding <=> %s::vector LIMIT %s",
            (qvec.tolist(), k),
        )
        context = "\\n\\n".join(row[0] for row in cur.fetchall())
    prompt = (
        "Answer using only the context below. "
        "If the answer is not present, say you do not know.\\n\\n"
        "Context:\\n" + context + "\\n\\nQuestion: " + question
    )
    return call_model(prompt)
</code></pre>

<p>That instruction to say "I do not know" when the answer is not in the context is not optional. Without it the model will happily fill gaps with plausible fabrication, and a confident wrong answer is worse than no answer.</p>

<h2>Retrieval quality decides everything</h2>
<p>The model can only be as good as what you feed it. If retrieval surfaces the wrong chunks, no amount of prompt cleverness saves the answer. This is why I spend most of my RAG effort on retrieval rather than on prompt wording. A few techniques that earn their keep:</p>
<ul>
<li><strong>Hybrid search.</strong> Combine vector similarity with keyword search. Semantic search misses exact identifiers, error codes, and product names, and keyword search catches them. Merging the two rankings beats either alone in almost every system I have measured.</li>
<li><strong>Reranking.</strong> Retrieve a generous set of candidates, then run a cross encoder reranker to reorder them by relevance before you build the prompt. The reranker is slower per item but far more accurate than raw vector distance, and applying it to a small candidate set is cheap.</li>
<li><strong>Metadata filtering.</strong> Restrict retrieval to the documents the user is allowed to see and that are recent enough to matter. This is both a relevance and a security concern.</li>
</ul>

<h2>The unglamorous problems</h2>
<p>Real RAG systems live or die on the parts nobody demos. Keeping the index in sync when documents change, so you are not retrieving deleted or stale content. Handling access control so a user never retrieves a chunk from a document they cannot see, which is a genuine data leak if you get it wrong. Evaluating quality with a real test set of questions and expected answers rather than vibes, because without measurement you cannot tell whether a change helped. And managing the prompt size so you do not blow past the context window or pay for tokens you did not need.</p>
<p>The security dimension deserves more attention than it usually gets, especially once these systems start taking actions on a user's behalf. I dug into that in my piece on <a href="/blog/agentic-ai-cybersecurity/">agentic AI and cybersecurity</a>, and the access control failures there map directly onto RAG retrieval.</p>

<h2>Start simple, then measure</h2>
<p>My advice is to build the simplest version first. Naive chunking, pgvector, top five retrieval, a clear prompt. Get it answering questions end to end. Then build an evaluation set and improve one thing at a time, measuring each change. Add hybrid search and check the numbers. Add reranking and check again. Tune chunking and check once more. The teams that succeed with RAG are not the ones with the fanciest stack. They are the ones who measure retrieval quality and grind on it. For the broader engineering context around shipping these systems, see my notes on <a href="/blog/practical-ai-engineering/">practical AI engineering</a>, and when you are ready to pick a store, <a href="/blog/choosing-a-vector-database/">choosing a vector database</a> covers the options.</p>`
  }
];
