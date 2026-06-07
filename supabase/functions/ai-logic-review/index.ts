import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const SYSTEM_PROMPT = `You are a conservative construction CPM logic assistant.

Your job is to help build the Logic Network only.

Do not calculate:
- ES
- EF
- LS
- LF
- total float
- free float
- critical path
- project duration

Only suggest direct predecessor/successor relationships between existing activity codes.

Rules:
- Use only the activity codes provided.
- Do not invent activities.
- Do not suggest links that already exist.
- Do not suggest reverse logic.
- Do not create circular logic.
- Prefer finish-to-start relationships unless another relationship is clearly required.
- Prefer fewer high-confidence links over many weak links.
- Suggest only direct construction sequence links.
- Do not create broad generic chains.
- Do not assume all work in one division precedes all work in another division.
- Do not suggest a link unless the construction sequence is clear.

Good examples:
- survey/layout before excavation
- utility locate before excavation
- clearing/grubbing before rough grading
- rough grading before layout or foundation excavation where applicable
- excavation before forms
- forms before reinforcement
- reinforcement before concrete placement
- slab base/vapor barrier before slab placement
- framing before MEP rough-in
- MEP rough-ins before insulation
- insulation before drywall
- drywall before paint
- paint before flooring/fixtures where applicable
- finishes before final cleanup
- final cleanup before punch list
- punch list before final turnover

Return JSON only:
{
  "suggestions": [
    {
      "predecessorActivityCode": "string",
      "successorActivityCode": "string",
      "relationshipType": "FS",
      "lagDays": 0,
      "confidence": 0.0,
      "reason": "string"
    }
  ]
}

Only return suggestions with confidence >= 0.75.`;

interface RequestBody {
  activities?: unknown;
  logicLinks?: unknown;
}

function normalizeAiSuggestion(raw: unknown, index: number): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const predecessorActivityCode =
    typeof src.predecessorActivityCode === "string" ? src.predecessorActivityCode.trim() : "";
  const successorActivityCode =
    typeof src.successorActivityCode === "string" ? src.successorActivityCode.trim() : "";
  if (!predecessorActivityCode || !successorActivityCode) return null;

  let confidence: "low" | "medium" | "high" = "low";
  if (typeof src.confidence === "string" && ["low", "medium", "high"].includes(src.confidence)) {
    confidence = src.confidence as "low" | "medium" | "high";
  } else if (typeof src.confidence === "number" && Number.isFinite(src.confidence)) {
    confidence = src.confidence >= 0.75 ? "high" : src.confidence >= 0.5 ? "medium" : "low";
  }
  if (confidence !== "high") return null;

  const relationshipType =
    src.relationshipType === "SS" ||
    src.relationshipType === "FF" ||
    src.relationshipType === "SF"
      ? src.relationshipType
      : "FS";
  const lagDays =
    typeof src.lagDays === "number" && Number.isFinite(src.lagDays) ? Math.max(0, src.lagDays) : 0;
  const reason = typeof src.reason === "string" ? src.reason.trim() : "";
  const issue =
    typeof src.issue === "string" && src.issue.trim()
      ? src.issue.trim()
      : `Likely predecessor: ${predecessorActivityCode} before ${successorActivityCode}`;

  return {
    id: `ai-${predecessorActivityCode}-${successorActivityCode}-${index}`,
    confidence: "high",
    issue,
    predecessorActivityCode,
    successorActivityCode,
    relationshipType,
    lagDays,
    reason,
  };
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

  try {
    if (!SUPABASE_URL) {
      return new Response(JSON.stringify({ error: "Server configuration error." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    if (!Array.isArray(body.activities)) {
      return new Response(JSON.stringify({ error: "activities array is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({
          suggestions: [],
          error: "OPENAI_API_KEY is not configured on this server.",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const userPrompt = [
      "Suggest likely predecessor/successor links for the Logic Network only.",
      "Do not calculate CPM dates, float, or critical path.",
      "Only suggest links between existing activity codes.",
      "Do not suggest duplicate links.",
      "",
      `Activities:\n${JSON.stringify(body.activities)}`,
      "",
      `Existing logic links:\n${JSON.stringify(body.logicLinks ?? [])}`,
    ].join("\n");

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();
      return new Response(
        JSON.stringify({ suggestions: [], error: `OpenAI request failed: ${errorText}` }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const completion = await openAiResponse.json();
    const content = completion?.choices?.[0]?.message?.content;
    let parsed: { suggestions?: unknown[] } = { suggestions: [] };
    if (typeof content === "string" && content.trim()) {
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = { suggestions: [] };
      }
    }

    const rawSuggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    const suggestions = rawSuggestions
      .map((raw, index) => normalizeAiSuggestion(raw, index))
      .filter((suggestion): suggestion is Record<string, unknown> => suggestion !== null);

    return new Response(JSON.stringify({ suggestions }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ suggestions: [], error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
