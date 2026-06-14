import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/requireAuth.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

interface Body {
  scope?: string;
}

function fallbackTitle(scope: string): string {
  const cleaned = scope.trim().replace(/\s+/g, " ");
  if (!cleaned) return "Concrete placement";
  const sentence = cleaned.split(/[.!?]\s/)[0]?.trim() || cleaned;
  const words = sentence.split(/\s+/).slice(0, 8).join(" ");
  return words.length > 80 ? `${words.slice(0, 77).trim()}…` : words;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authResult = await requireAuth(req, corsHeaders);
  if (!authResult.ok) return authResult.response;

  try {
    const body = (await req.json()) as Body;
    const scope = typeof body.scope === "string" ? body.scope.trim() : "";

    if (!scope) {
      return new Response(JSON.stringify({ error: "scope is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ title: fallbackTitle(scope) }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'You summarize concrete construction job scopes into short project titles for contractors. Return JSON only: {"title":"..."}. Title rules: 3-8 words, title case, no quotes, no project numbers, field-friendly (e.g. "Residential house foundation", "Warehouse slab on grade", "Sidewalk and curb replacement").',
          },
          {
            role: "user",
            content: scope,
          },
        ],
      }),
    });

    if (!openAiRes.ok) {
      console.error("OpenAI summarize scope error:", await openAiRes.text());
      return new Response(JSON.stringify({ title: fallbackTitle(scope) }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await openAiRes.json();
    const content = data?.choices?.[0]?.message?.content;
    let title = fallbackTitle(scope);

    if (typeof content === "string" && content.trim()) {
      try {
        const parsed = JSON.parse(content) as { title?: string };
        if (parsed.title?.trim()) title = parsed.title.trim();
      } catch {
        title = content.trim().replace(/^["']|["']$/g, "");
      }
    }

    if (title.length > 80) title = `${title.slice(0, 77).trim()}…`;

    return new Response(JSON.stringify({ title }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("summarize-project-scope:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
