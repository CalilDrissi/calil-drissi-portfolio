module.exports = [
  {
    title: 'Stack vs heap: how memory actually works',
    slug: 'stack-vs-heap-memory',
    excerpt: 'The stack and the heap are not magic. They are two regions of the same address space with very different rules. Here is what is really going on underneath your variables.',
    category: 'Low-Level Programming',
    tags: ['memory', 'stack', 'heap', 'c'],
    pexels: 'computer memory chips',
    content: `<p>People talk about "the stack" and "the heap" like they are physical objects you can point at. They are not. They are two regions of the same virtual address space, managed in completely different ways. I spent years writing C before I really internalized the difference, and once I did, a lot of confusing bugs suddenly made sense.</p>

<h2>The stack is a region, not a data structure</h2>
<p>When your program starts, the operating system hands each thread a chunk of contiguous memory called the stack. It grows in one direction, usually downward toward lower addresses on x86 and ARM. Every time you call a function, the CPU pushes a stack frame: the return address, saved registers, and room for local variables. When the function returns, that frame is gone instantly. No bookkeeping, no search, just a single register adjustment.</p>
<p>That is why stack allocation is fast. There is a register, the stack pointer, and "allocating" 64 bytes means subtracting 64 from it. Freeing means adding it back. The cost is effectively zero.</p>
<p>The catch is lifetime. A stack variable lives exactly as long as the function call that created it. Return a pointer to a local and you are pointing at memory that the next function call will scribble over.</p>

<pre><code>// This is a bug. The buffer dies when the function returns.
char *make_greeting(void) {
    char buffer[32];
    snprintf(buffer, sizeof buffer, "hello");
    return buffer;   // dangling pointer
}</code></pre>

<h2>The heap is for things that outlive a frame</h2>
<p>The heap is the rest of your usable address space, and it is managed by an allocator (malloc and friends) rather than by the CPU. When you ask for memory you get a block that stays valid until you explicitly free it. That flexibility is the whole point, and it is also where the work hides. The allocator has to track which blocks are free, find one big enough, and hand it back. I wrote a whole post on <a href="/blog/writing-a-memory-allocator/">writing a simple memory allocator</a> because that machinery is worth understanding directly.</p>

<pre><code>char *make_greeting(void) {
    char *buffer = malloc(32);   // lives on the heap
    if (!buffer) return NULL;
    snprintf(buffer, 32, "hello");
    return buffer;   // valid, but the caller now owns it
}</code></pre>

<h2>The tradeoffs you actually feel</h2>
<ul>
<li>Speed: stack allocation is a pointer bump. Heap allocation walks data structures and may call into the kernel. The gap is large.</li>
<li>Lifetime: stack memory is tied to scope. Heap memory lives until you free it, which means you have to remember to free it.</li>
<li>Size: stacks are small, often 1 to 8 MB. Try to put a 10 MB array on the stack and you get a stack overflow. Big data goes on the heap.</li>
<li>Locality: stack memory is hot. It was just touched, so it is almost always in cache. Heap memory can be scattered, which matters more than people expect.</li>
</ul>

<h2>Why this connects to performance</h2>
<p>The locality point is the one that bites in real systems. A pointer to the heap is a value, and following that pointer is a value too. Where it physically lands decides whether your CPU stalls. I dig into that in <a href="/blog/data-oriented-design-and-cache/">data-oriented design and CPU caches</a>, but the short version is that scattering your data across heap allocations can be slower than the algorithm would suggest, purely because of cache misses.</p>

<h2>What the addresses look like</h2>
<p>If you print the address of a local variable and the address of a malloc result in the same program, the difference is stark. Stack addresses tend to be high and close together, because everything in the current call chain sits in one tight region. Heap addresses sit lower and spread out as the heap grows upward to meet the stack growing downward. They are marching toward each other through the same address space, and in the old days a program that used too much of both would have them collide. Virtual memory and guard pages make that collision a clean crash today instead of silent corruption.</p>
<p>One more thing worth knowing: allocation on the stack is not just fast, it is also automatically aligned and laid out by the compiler, which knows every local's size up front. The allocator has to compute alignment and padding at runtime. That extra work is part of why the heap costs more per allocation, on top of the bookkeeping.</p>

<h2>A mental model that holds up</h2>
<p>Here is how I think about it now. The stack is a scratchpad the CPU manages for you, perfect for short-lived, known-size values. The heap is a warehouse you manage yourself, for anything whose size or lifetime you cannot pin down at compile time. Most bugs in C come from confusing the two: returning stack pointers, freeing heap memory twice, or forgetting to free it at all.</p>
<p>The reason languages like Rust feel safe is that they encode these rules into the type system so the compiler catches the mistakes. If you want to see how that works without a garbage collector, read <a href="/blog/rust-ownership-memory-safety/">memory safety with Rust ownership and borrowing</a>. But you cannot really appreciate what Rust is protecting you from until you have felt the sharp edges of the stack and the heap yourself.</p>`
  },
  {
    title: 'How pointers really work',
    slug: 'how-pointers-work',
    excerpt: 'A pointer is just a number that happens to be an address. Once you stop treating it as scary syntax and start treating it as an integer with a type, everything clears up.',
    category: 'Low-Level Programming',
    tags: ['pointers', 'memory', 'c', 'addresses'],
    pexels: 'circuit board macro',
    content: `<p>Pointers scared me for an embarrassingly long time. The syntax did not help: asterisks meaning two different things, ampersands, arrows. But the concept is simple once you strip the syntax away. A pointer is a variable whose value is a memory address. That is it. It is a number that tells you where something lives.</p>

<h2>Memory is one giant array</h2>
<p>Picture your process's address space as one enormous array of bytes, indexed from zero up to some huge number. Every variable you declare lives at some index in that array. A pointer just stores one of those indices. When you "dereference" a pointer, you are saying "go to that index and read what is there."</p>

<pre><code>int x = 42;
int *p = &x;      // p holds the address of x
printf("%d\\n", *p);   // dereference: prints 42
*p = 7;           // write through the pointer
printf("%d\\n", x);    // prints 7</code></pre>

<p>The ampersand means "address of" and the asterisk in an expression means "the thing at this address." The same asterisk in a declaration means "this variable is a pointer." Two different jobs for one symbol, which is the main reason pointers look confusing at first.</p>

<h2>The type matters more than you think</h2>
<p>A pointer is not just an address, it is an address plus a type. The type tells the compiler two things: how many bytes to read when you dereference, and how far to jump when you do arithmetic. An int pointer and a char pointer can hold the exact same numeric address and behave completely differently.</p>

<pre><code>int arr[4] = {10, 20, 30, 40};
int *p = arr;     // points at arr[0]
p++;              // now points at arr[1], moved 4 bytes not 1
printf("%d\\n", *p);   // prints 20</code></pre>

<p>That is the key insight about pointer arithmetic. Adding one to an int pointer moves it by sizeof(int) bytes, not by one byte. The compiler scales for you based on the type. This is also why arrays and pointers feel so interchangeable in C: indexing arr[i] is defined as taking the address of arr, adding i times the element size, and dereferencing.</p>

<h2>Where pointers point</h2>
<p>A pointer can hold the address of a stack variable, a heap allocation, a function, or nothing at all. The where matters because it decides whether dereferencing is safe. If you are fuzzy on stack versus heap lifetimes, that is the foundation here, and I covered it in <a href="/blog/stack-vs-heap-memory/">stack vs heap: how memory actually works</a>. A pointer to a stack variable becomes dangling the moment that frame returns. A pointer to freed heap memory is a use-after-free waiting to crash.</p>
<ul>
<li>NULL pointer: holds address zero, a deliberate "points at nothing." Dereferencing it crashes, which is actually the friendly outcome.</li>
<li>Dangling pointer: holds an address that used to be valid. Dereferencing it is undefined behavior and may silently corrupt data.</li>
<li>Wild pointer: never initialized, holds garbage. The worst kind because it can point anywhere.</li>
</ul>

<h2>Pointers to pointers</h2>
<p>Once a pointer is just a variable, a pointer to a pointer stops being mysterious. It is the address of a variable that itself holds an address. You need this whenever a function must change where a pointer points, not just what it points to.</p>

<pre><code>void allocate(int **out) {
    *out = malloc(sizeof(int));   // write a new address into the caller's pointer
    **out = 99;                   // write a value into that memory
}

int *p = NULL;
allocate(&p);     // pass the address of p so the function can modify it
printf("%d\\n", *p);   // prints 99</code></pre>

<h2>const and what is really protected</h2>
<p>One thing that trips people up is where const sits relative to the asterisk, because a pointer has two things that can be constant: the address it holds, and the data it points at. A const int pointer means you cannot change the data through it, but you can repoint it. A pointer that is itself const means you can change the data but not where it points. Reading the declaration right to left helps. This matters because the compiler will enforce it, and getting it wrong produces error messages that look more confusing than the underlying idea.</p>

<h2>Why this is worth the trouble</h2>
<p>Pointers are the mechanism behind almost everything interesting in systems code: linked structures, dynamic memory, passing large objects without copying them, talking to hardware at fixed addresses. They are also the source of most crashes in C. The allocator I describe in <a href="/blog/writing-a-memory-allocator/">writing a simple memory allocator</a> is nothing but careful pointer manipulation over a raw block of bytes. Once you see a pointer as a typed integer into the big byte array, the fear goes away and the power shows up.</p>`
  },
  {
    title: 'Writing a simple memory allocator',
    slug: 'writing-a-memory-allocator',
    excerpt: 'malloc is not magic, it is a data structure problem. Building a tiny allocator from scratch taught me more about memory than any book did.',
    category: 'Low-Level Programming',
    tags: ['malloc', 'memory', 'c', 'allocator'],
    pexels: 'computer processor chip',
    content: `<p>The first time I wrote my own malloc, the whole concept of dynamic memory stopped feeling like a black box. An allocator is just a program that manages one big block of memory and hands out pieces of it on request. The hard parts are bookkeeping and fragmentation, not anything mystical. Let me walk through a minimal version.</p>

<h2>Where the memory comes from</h2>
<p>Your allocator needs raw memory to carve up. On Unix you get it from the kernel with sbrk, which moves the program break (the top of the heap), or with mmap for larger regions. sbrk is the simplest to reason about: call it with a positive number and the heap grows, returning a pointer to the new space.</p>

<pre><code>void *region = sbrk(4096);   // ask the kernel for one page
if (region == (void *) -1) {
    // out of memory
}</code></pre>

<p>The whole game is now: take that region and parcel it out, remembering which parts are in use and which are free.</p>

<h2>Block headers: the core trick</h2>
<p>The fundamental idea is to store metadata right before each block you hand out. When the caller asks for N bytes, you actually reserve N bytes plus the size of a small header. You return a pointer past the header, so the caller never sees it. When they call free with that pointer, you step backward to find the header again.</p>

<pre><code>typedef struct block {
    size_t size;          // payload size in bytes
    int free;             // 1 if available, 0 if in use
    struct block *next;   // next block in the list
} block_t;

#define HEADER_SIZE sizeof(block_t)</code></pre>

<p>I keep a linked list of these headers. To allocate, I walk the list looking for a free block big enough. This is the first-fit strategy: take the first block that works. Best-fit (the smallest block that fits) wastes less space but is slower to search. Both are fine for learning.</p>

<h2>The allocate path</h2>
<pre><code>static block_t *head = NULL;

void *my_malloc(size_t size) {
    block_t *cur = head;
    while (cur) {
        if (cur->free && cur->size >= size) {
            cur->free = 0;
            return (void *)(cur + 1);   // memory just after the header
        }
        cur = cur->next;
    }
    // nothing free, grow the heap
    block_t *blk = sbrk(HEADER_SIZE + size);
    if (blk == (void *) -1) return NULL;
    blk->size = size;
    blk->free = 0;
    blk->next = head;
    head = blk;
    return (void *)(blk + 1);
}</code></pre>

<p>The expression cur + 1 is pointer arithmetic on a block_t pointer, so it jumps exactly past the header. If that line looks strange, my post on <a href="/blog/how-pointers-work/">how pointers really work</a> explains why adding one moves by a whole struct, not one byte.</p>

<h2>Freeing and the fragmentation problem</h2>
<p>Freeing is almost too easy: find the header and flip the free flag. The memory is not returned to the kernel, it is just marked reusable by the next allocation.</p>

<pre><code>void my_free(void *ptr) {
    if (!ptr) return;
    block_t *blk = (block_t *)ptr - 1;   // step back to the header
    blk->free = 1;
}</code></pre>

<p>This naive version has a real flaw: fragmentation. Free a 100 byte block and a 100 byte block next to each other, then ask for 150 bytes, and my allocator fails even though 200 contiguous bytes are free. The fix is coalescing: when freeing, check if the neighboring blocks are also free and merge them into one larger block. Real allocators also split oversized blocks so a request for 16 bytes does not consume a 4 KB chunk.</p>

<h2>Alignment, the detail that bites later</h2>
<p>There is one correctness issue my toy version glosses over: alignment. The CPU expects an eight byte value to sit at an address divisible by eight, and on some architectures a misaligned access faults outright. A real allocator rounds every request up so the payload always starts on a properly aligned boundary, usually 16 bytes on a 64 bit system. My version happens to work because the header is already a multiple of the alignment, but the moment you start splitting blocks you have to round the sizes or you will hand back addresses that crash on certain reads. It is the kind of bug that hides for months and then surfaces only on one platform.</p>

<h2>Why this is worth building</h2>
<ul>
<li>You stop fearing malloc and start seeing it as a tunable component.</li>
<li>You understand why allocation patterns matter for performance, which ties directly into <a href="/blog/data-oriented-design-and-cache/">data-oriented design and CPU caches</a>.</li>
<li>You see exactly why double-free and use-after-free corrupt memory: they scribble on these headers.</li>
</ul>
<p>Production allocators like jemalloc and tcmalloc add size classes, per-thread caches, and clever data structures, but the skeleton is what I just described. Knowing the skeleton is the difference between using memory and understanding it.</p>`
  },
  {
    title: 'Data-oriented design and CPU caches',
    slug: 'data-oriented-design-and-cache',
    excerpt: 'Your CPU is starving for data while it waits on memory. Laying out data the way the hardware wants to read it is often a bigger win than a better algorithm.',
    category: 'Low-Level Programming',
    tags: ['cache', 'performance', 'data-oriented', 'memory'],
    pexels: 'cpu processor closeup',
    content: `<p>The single biggest performance lesson I ever learned is that modern CPUs are not slow at computing, they are slow at waiting for memory. A cache miss to main memory can cost a couple hundred cycles. In that time the CPU could have done hundreds of additions. Once you internalize that gap, you start designing programs around how data moves, not just what operations run on it. That is the heart of data-oriented design.</p>

<h2>The memory hierarchy is the real machine</h2>
<p>Between the CPU and main memory sit several layers of cache: L1 is tiny and nearly as fast as registers, L2 is bigger and slower, L3 bigger and slower still. When the CPU needs a byte, it does not fetch one byte. It fetches a whole cache line, typically 64 bytes, and stores it in cache. If your next access is within that line, it is nearly free. If it is somewhere far away, you pay the full miss penalty.</p>
<p>This means the layout of your data in memory directly controls your performance. Two programs doing the identical arithmetic can differ by an order of magnitude based purely on access patterns.</p>

<h2>Arrays of structs versus structs of arrays</h2>
<p>The classic example is how you store a collection of records. The intuitive object-oriented layout is an array of structs:</p>

<pre><code>struct Particle {
    float x, y, z;     // position
    float vx, vy, vz;  // velocity
    float mass;
    char name[32];
};
struct Particle particles[100000];

// update positions
for (int i = 0; i < 100000; i++) {
    particles[i].x += particles[i].vx;
}</code></pre>

<p>This loop only touches x and vx, but every cache line it loads is full of mass, name, and the other fields you do not need. You are dragging cold data through cache for nothing. The data-oriented layout splits the fields into parallel arrays, a struct of arrays:</p>

<pre><code>struct Particles {
    float x[100000], y[100000], z[100000];
    float vx[100000], vy[100000], vz[100000];
    float mass[100000];
};

for (int i = 0; i < 100000; i++) {
    p.x[i] += p.vx[i];
}</code></pre>

<p>Now the x array and vx array are each densely packed. Every byte you pull into cache is a byte you use. On real hardware this kind of change routinely gives 3x to 10x speedups on hot loops, with no algorithmic change at all.</p>

<h2>Why pointer chasing hurts</h2>
<p>Linked lists and node-based trees are the opposite of cache-friendly. Each node is a separate heap allocation that can live anywhere, so traversing the list jumps all over memory and misses the cache on nearly every step. If you understand <a href="/blog/stack-vs-heap-memory/">stack vs heap memory</a> and how heap allocations scatter, this follows naturally. A flat array you scan linearly is dramatically faster than a linked list with the same number of elements, even though both are O(n), because the hardware prefetcher can predict and preload sequential access.</p>

<ul>
<li>Prefer contiguous arrays over node-based structures when you iterate often.</li>
<li>Group fields you access together, and separate the ones you do not.</li>
<li>Process data in the order it sits in memory whenever you can.</li>
<li>Keep hot data small so more of it fits in cache at once.</li>
</ul>

<h2>It is the same idea as a good allocator</h2>
<p>This is why allocation strategy matters so much. If you allocate ten thousand objects one at a time, they end up scattered. If you allocate them in one block, they sit together and iterate fast. The custom allocator in <a href="/blog/writing-a-memory-allocator/">writing a simple memory allocator</a> gives you exactly this control: you decide the layout instead of leaving it to chance.</p>

<h2>False sharing, the multicore trap</h2>
<p>There is a nastier cache effect that shows up with threads. If two cores each write to different variables that happen to live in the same 64 byte cache line, the hardware has to keep bouncing that line between their caches even though the threads never touch the same bytes. This is called false sharing, and it can quietly destroy the scaling of an otherwise parallel program. The fix is to pad or align the per-thread data so each thread's hot variables sit on their own cache line. I have seen a loop go from no speedup on eight cores to near linear scaling with nothing more than a padding field added to a struct.</p>

<h2>When to reach for this</h2>
<p>I do not restructure everything around the cache. For code that runs once or rarely, clarity wins. But for the hot loops, the inner kernels that run millions of times, data layout is usually the first thing I tune and often the highest return. Profile first, find where the cache misses are, then lay the data out the way the hardware wants to read it. The machine is happy to be fast if you stop making it wait.</p>`
  },
  {
    title: 'Memory safety with Rust ownership and borrowing',
    slug: 'rust-ownership-memory-safety',
    excerpt: 'Rust gives you the control of C without the foot-guns, and it does it at compile time with no garbage collector. The trick is a set of rules called ownership and borrowing.',
    category: 'Low-Level Programming',
    tags: ['rust', 'memory-safety', 'ownership', 'borrowing'],
    pexels: 'rust metal texture',
    content: `<p>After years of chasing dangling pointers and double-frees in C, Rust felt like someone had finally written down the rules I was holding in my head and made the compiler enforce them. Rust gives you manual control over memory with no garbage collector, yet it statically prevents the entire class of memory bugs that plague C. The mechanism is ownership and borrowing, and it is simpler than its reputation suggests.</p>

<h2>The three ownership rules</h2>
<p>Everything in Rust starts from three rules the compiler enforces:</p>
<ul>
<li>Each value has exactly one owner, a single variable responsible for it.</li>
<li>There can only be one owner at a time.</li>
<li>When the owner goes out of scope, the value is dropped and its memory freed.</li>
</ul>
<p>That last rule is the quiet genius. There is no free to call and no garbage collector to run. The compiler knows exactly where each value's scope ends and inserts the cleanup for you. This is the same scope-based lifetime you get from the stack, which I described in <a href="/blog/stack-vs-heap-memory/">stack vs heap: how memory actually works</a>, except Rust extends it to heap data too.</p>

<h2>Moves, not copies</h2>
<p>Because there is only one owner, assigning a heap value to another variable moves ownership rather than copying the data. The old variable becomes invalid, and the compiler will reject any use of it.</p>

<pre><code>let s1 = String::from("hello");
let s2 = s1;            // ownership moves from s1 to s2
// println!("{}", s1);  // compile error: s1 was moved
println!("{}", s2);     // fine, s2 owns the data now</code></pre>

<p>This single rule eliminates double-free at compile time. In C, two pointers to the same heap block both think they should free it. In Rust, only one variable owns the data, so it gets freed exactly once. The whole category of bug is gone before the program runs.</p>

<h2>Borrowing instead of moving</h2>
<p>Moving everywhere would be painful, so Rust lets you borrow a value by taking a reference. A reference is a pointer that does not own what it points to. The borrow checker enforces one more set of rules to keep references safe:</p>
<ul>
<li>You can have any number of immutable references at once.</li>
<li>Or exactly one mutable reference.</li>
<li>But never both at the same time.</li>
</ul>

<pre><code>fn main() {
    let mut data = vec![1, 2, 3];
    let r1 = &data;        // immutable borrow
    let r2 = &data;        // another one, fine
    println!("{} {}", r1[0], r2[0]);

    let m = &mut data;     // mutable borrow, allowed now r1/r2 are done
    m.push(4);
}</code></pre>

<p>This "one writer or many readers" rule is what prevents data races and use-after-free. You cannot hold a reference into a vector while another piece of code reorganizes it, because that would require a mutable and an immutable borrow simultaneously. The compiler refuses to build it.</p>

<h2>Lifetimes make dangling impossible</h2>
<p>The borrow checker also tracks how long each reference lives and guarantees a reference never outlives the data it points to. The classic dangling pointer from C, returning a reference to a local, simply does not compile.</p>

<pre><code>fn dangle() -> &String {
    let s = String::from("oops");
    &s    // error: s is dropped here, the reference would dangle
}</code></pre>

<p>If you have read <a href="/blog/how-pointers-work/">how pointers really work</a>, you know this is exactly the bug that produces silent corruption in C. Rust turns it into a compile error with a clear message.</p>

<h2>The escape hatch and why it matters</h2>
<p>Rust is not naive about the fact that some code genuinely needs to do unsafe things: dereference raw pointers, call into C, talk to hardware. It does not pretend these never happen. Instead it walls them off behind the unsafe keyword. Inside an unsafe block you get the raw pointer operations that C gives you everywhere, but the block is a visible marker. When something does go wrong with memory, you have a small audited surface to inspect instead of the whole program. The standard library is built on these blocks, carefully reviewed, so the safe code on top inherits the guarantees. That layering is the practical reason Rust scales: most code stays safe, and the unsafe parts are few and labeled.</p>

<h2>What you give up and what you get</h2>
<p>The cost is real: the borrow checker rejects programs that would actually be fine, and you spend time restructuring code to satisfy it. That learning curve is the famous "fighting the borrow checker" phase. What you get in return is C-level performance and control with none of the memory unsafety, verified before the program ever runs. After living in both worlds, I think the tradeoff is worth it for anything where correctness matters. Rust did not invent these rules. It just made the compiler the one who remembers them so I do not have to.</p>`
  }
];
