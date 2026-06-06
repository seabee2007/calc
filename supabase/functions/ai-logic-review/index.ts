import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const SYSTEM_PROMPT = `You are a professional construction scheduler and CPM logic reviewer.

Your task is to review a residential construction schedule activity list and identify likely missing logic relationships.

You must only suggest logic links between activities that already exist in the provided activity list.

Do not invent new activities.
Do not change activity titles.
Do not change durations.
Do not change costs.
Do not change crew data.
Do not delete existing logic.
Do not suggest a link that already exists.

Focus on common construction sequencing, including:
- demolition before new construction
- layout before excavation
- excavation before footings
- forms and rebar before concrete
- underground utilities before slab
- foundation before framing
- framing before rough MEP
- rough plumbing/electrical/HVAC before insulation
- inspections before covering work
- insulation before drywall
- drywall before paint
- paint before final fixtures and finishes where applicable
- cabinets/countertops before final plumbing trim where applicable
- final inspections before turnover

Use construction judgment, but avoid over-warning.

Prefer strong, useful suggestions over many weak suggestions.

Return JSON only.`;

interface RequestBody {
  activities?: unknown;
  logicLinks?: unknown;
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
      "Review the following construction schedule activities and existing logic links.",
      "Identify likely missing predecessor/successor relationships.",
      "Only suggest links between existing activity codes.",
      "Do not suggest duplicate links.",
      'Return JSON in this shape:',
      '{ "suggestions": [{ "id": "stable-id", "confidence": "low | medium | high", "issue": "plain language issue", "predecessorActivityCode": "activity code", "successorActivityCode": "activity code", "relationshipType": "FS | SS | FF | SF", "lagDays": 0, "reason": "short construction reason" }] }',
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
      console.error("[ai-logic-review] OpenAI error", errorText);
      return new Response(JSON.stringify({ error: "AI logic review failed." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    return new Response(JSON.stringify({ suggestions: parsed.suggestions ?? [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[ai-logic-review] Unexpected error", error);
    return new Response(JSON.stringify({ error: "AI logic review failed." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
