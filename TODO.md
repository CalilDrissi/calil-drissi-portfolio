# TODO

## Performance Optimizations
- [ ] Add `defer` attribute to GSAP `<script>` tags to avoid render-blocking
- [ ] Preload main font (`<link rel="preload" as="font" ...>`) to eliminate FOIT/FOUT
- [ ] Lazy load videos and below-fold images (`loading="lazy"`)
- [ ] Inline critical CSS (above-fold styles) to reduce first paint time

## Alfred AI Chat — Wire to LLM with RAG
- Current: hardcoded keyword-matching responses in `index.html`
- Goal: Connect to an LLM with RAG over portfolio data (work, experience, stack, availability)
- Needs: API endpoint (Cloudflare Worker or external), vector store for context, prompt engineering

## NotebookLM Podcast Videos for Blog Posts
- Goal: Generate podcast-style audio from blog content via NotebookLM, convert to video, embed in posts
- CLI: `node cli/generate-podcast.js --slug <slug>` (to be built)
