import { Agent, routeAgentRequest } from "agents";
import {
  withVoice,
  WorkersAIFluxSTT,
  WorkersAITTS,
  type VoiceTurnContext,
} from "@cloudflare/voice";
import { generateText, stepCountIs, tool } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";

interface Env {
  AI: Ai;
  VoiceAgent: DurableObjectNamespace;
}

const BaseVoiceAgent = withVoice(Agent);

const SYSTEM_PROMPT = `You are the friendly voice assistant on Khalil Drissi's portfolio website (khalildrissi.com).

About Khalil: a software developer and CTO at Virtus Operandi, currently in Morocco. He builds across web, mobile, desktop and systems, works on AI models and automation, and created the Fez programming language.

Your job: greet visitors warmly and help them explore the site by voice. You can chat about Khalil's work and take commands to control the page.

You can control the website using tools. When the visitor asks, actually CALL the matching tool instead of only talking about it:
- open his playable PS1 arcade games (open_games)
- open the contact form (open_contact)
- scroll the page to the projects, blog, about, or top sections (scroll_to)

Style rules:
- Keep replies SHORT and natural — one or two spoken sentences.
- Never use Markdown, bullet lists, headings, or code blocks. This is spoken aloud.
- If you don't know something about Khalil, say so briefly instead of inventing it.`;

export class VoiceAgent extends BaseVoiceAgent<Env> {
  transcriber = new WorkersAIFluxSTT(this.env.AI);
  tts = new WorkersAITTS(this.env.AI);

  async onCallStart() {
    for (const connection of this.getConnections()) {
      await this.speak(
        connection,
        "Hey, I'm Khalil's assistant. Ask me about his work, or say 'open games' to play.",
      );
    }
  }

  /** Push a non-voice-protocol JSON message to every connected client.
   * The client parses it and, since it has no known voice `type`, emits it
   * as a `"custommessage"` event with the exact object sent here. */
  pushCustom(message: Record<string, unknown>) {
    const json = JSON.stringify(message);
    for (const connection of this.getConnections()) {
      connection.send(json);
    }
  }

  async onTurn(transcript: string, context: VoiceTurnContext) {
    console.log(`[onTurn] "${transcript}"`);
    const ai = createWorkersAI({ binding: this.env.AI });

    const tools = {
      open_games: tool({
        description:
          "Open the site's playable PS1 arcade games. Use when the visitor asks to play, open the games, or see the arcade.",
        inputSchema: z.object({}),
        execute: async () => {
          this.pushCustom({ action: "open_games" });
          return "Opening the games now.";
        },
      }),
      open_contact: tool({
        description:
          "Open the contact form. Use when the visitor wants to get in touch, contact, or message Khalil.",
        inputSchema: z.object({}),
        execute: async () => {
          this.pushCustom({ action: "open_contact" });
          return "Opening the contact form.";
        },
      }),
      scroll_to: tool({
        description:
          "Scroll the page to a section. Use when the visitor asks to go to or see projects, blog, about, or the top of the page.",
        inputSchema: z.object({
          section: z.enum(["projects", "blog", "about", "top"]),
        }),
        execute: async ({ section }) => {
          this.pushCustom({ action: "scroll_to", section });
          return section === "top"
            ? "Scrolling to the top."
            : `Scrolling to ${section}.`;
        },
      }),
    };

    const { text } = await generateText({
      model: ai("@cf/google/gemma-4-26b-a4b-it"),
      system: SYSTEM_PROMPT,
      messages: [
        ...context.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content: transcript },
      ],
      tools,
      stopWhen: stepCountIs(5),
    });

    console.log(`[response] "${text}"`);
    return text || "Sorry, could you say that again?";
  }
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    // Neural TTS endpoint for the blog "Listen" player (Deepgram Aura).
    if (url.pathname === "/tts") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }
      if (request.method === "POST") {
        let text: unknown, lang: unknown;
        try {
          ({ text, lang } = (await request.json()) as {
            text?: unknown;
            lang?: unknown;
          });
        } catch {
          return new Response("Invalid JSON", {
            status: 400,
            headers: CORS_HEADERS,
          });
        }
        if (typeof text !== "string" || !text.trim()) {
          return new Response("Missing text", {
            status: 400,
            headers: CORS_HEADERS,
          });
        }
        const input = text.slice(0, 1800); // per-request input cap
        const isFr =
          typeof lang === "string" && lang.toLowerCase().startsWith("fr");
        const mp3 = (body: BodyInit) =>
          new Response(body, {
            headers: { ...CORS_HEADERS, "Content-Type": "audio/mpeg" },
          });
        const fromB64 = (b64: string) =>
          Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const melo = async (voice: string) => {
          const out = (await env.AI.run("@cf/myshell-ai/melotts", {
            prompt: input,
            lang: voice,
          })) as { audio?: string };
          if (!out || !out.audio) throw new Error("melotts: no audio");
          return mp3(fromB64(out.audio));
        };
        try {
          // French → MeloTTS (fr). English → Deepgram Aura (natural) with a
          // MeloTTS fallback if the partner model is unavailable.
          if (isFr) return await melo("fr");
          try {
            const audio = (await env.AI.run("@cf/deepgram/aura-1", {
              text: input,
            })) as { audio?: string } | BodyInit;
            if (audio && (audio as { audio?: string }).audio) {
              return mp3(fromB64((audio as { audio: string }).audio));
            }
            return mp3(audio as BodyInit);
          } catch {
            return await melo("en");
          }
        } catch (e) {
          return new Response(
            "TTS failed: " + ((e as Error)?.message || String(e)),
            { status: 500, headers: CORS_HEADERS },
          );
        }
      }
      return new Response("Method not allowed", {
        status: 405,
        headers: CORS_HEADERS,
      });
    }

    return (
      (await routeAgentRequest(request, env)) ??
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
