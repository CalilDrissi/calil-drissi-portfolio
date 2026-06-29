// Cloudflare Pages Function: /api/chat
// Real AI assistant for the portfolio, powered by Ollama Cloud (Gemma).
// Requires env vars (set in Cloudflare Pages → Settings → Environment variables):
//   OLLAMA_API_KEY  — Ollama Cloud API key (secret, NOT committed)
//   OLLAMA_MODEL    — optional, defaults to "gemma3:27b"

const OLLAMA_URL = 'https://ollama.com/api/chat';
const DEFAULT_MODEL = 'gemma3:27b';

// System message — who the assistant is and what it knows about Khalil.
const SYSTEM_PROMPT = `You are Khalil Drissi's friendly AI assistant, embedded on his portfolio site (khalildrissi.com).
Speak in the first person about Khalil in the third person ("Khalil builds...", "He works with...").
Be concise, warm, and professional. Keep answers to 1-3 short sentences unless asked for detail.

IMPORTANT — language: always reply in the SAME language the visitor writes in. If the visitor writes in French, answer entirely in French; if in English, answer in English. Never switch languages on your own.

About Khalil:
- Senior software developer (10+ years) based in Morocco (GMT+1), available for global, remote collaboration.
- Full-stack across web, mobile, desktop, and systems. Focus areas: Systems Design, Systems Development, Distributed Computing, AI/ML & Blockchain, and Cyber Security.
- Core stack: React, Next.js, TypeScript, Node.js, Python, PostgreSQL, Go, Rust; also Tailwind, GSAP, Three.js, and cloud platforms (Cloudflare).
- Chief Technology Officer at Virtus Operandi; previously Co-Founder & CTO at Circuit Dynamic SARL.
- Selected projects: Cercle Immobilier (real-estate CRM/ERP), Kiloctet ERP (transport & fleet), ShopFlow (visual automation for Shopify), Virtus Operandi (AI for manufacturing/DELMIA Apriso), ShopifyGMC (Google Merchant Center monitoring), SmartShop Automation (n8n workflows for Shopify).
- Languages: Arabic, French, English (fluent).
- Contact: khalil@drissi.org. GitHub: @CalDrissi. LinkedIn: khalil-drissi-8a4568257.

If asked something you don't know, suggest emailing khalil@drissi.org or booking a call. Never invent specific facts (rates, clients, dates) you weren't given.`;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

export async function onRequestOptions() {
  return json({});
}

export async function onRequestPost(context) {
  const { env, request } = context;

  if (!env.OLLAMA_API_KEY) {
    return json({ error: 'Chat is not configured yet.' }, 503);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const message = (payload.message || '').toString().trim();
  if (!message) return json({ error: 'Empty message.' }, 400);

  // Build conversation: system + recent history + new user turn.
  const history = Array.isArray(payload.history) ? payload.history.slice(-8) : [];
  const lang = (payload.lang || '').toString().toLowerCase();
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  if (lang === 'fr') {
    messages.push({ role: 'system', content: "The visitor is browsing the French version of the site. Reply in French unless they clearly write to you in English." });
  }
  for (const h of history) {
    if (h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string') {
      messages.push({ role: h.role, content: h.content.slice(0, 2000) });
    }
  }
  messages.push({ role: 'user', content: message.slice(0, 2000) });

  try {
    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OLLAMA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL || DEFAULT_MODEL,
        messages,
        stream: false,
        options: { temperature: 0.6 },
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.error) {
      const msg = data.error || `Upstream error (${res.status})`;
      // Surface quota/limit errors gently to the client.
      return json({ error: msg }, 502);
    }

    const reply = (data.message && data.message.content || '').trim();
    if (!reply) return json({ error: 'No response generated.' }, 502);

    return json({ reply });
  } catch (err) {
    return json({ error: 'Could not reach the AI service.' }, 502);
  }
}
