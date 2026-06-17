// supabase/functions/askConcrete/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { requireAuth } from "../_shared/requireAuth.ts";
import {
  isUsageConfigured,
  requireUsageQuota,
  trackMeteredUsage,
  usageConfigErrorResponse,
} from "../_shared/meterUsage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, X-Client-Info, apikey, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESPONSE_FORMAT = `Always structure every answer using this exact markdown template:

**Recommendation:** Go | Caution | Delay
(Use "Go", "Caution", or "Delay" for placement decisions. For general/educational questions use "N/A — informational".)

**Why:**
One or two short sentences grounded in the user's question and any project context.

**Key Checks:**
- Weather: (use ✓ ready, ⚠ confirm, or ✗ blocker when context supports it)
- Subgrade: ...
- Forms/rebar: ...
- Crew: ...
- Delivery: ...

**Action Plan:**
1. First concrete step
2. Second step
3. Third step

**Field Note:**
Verify project specs, engineer requirements, and site conditions before placing.

Rules:
- Use **bold** labels exactly as shown.
- Keep sections concise and field-ready.
- When project context is provided, give a specific go/no-go using that data — do not hedge with "maybe" if the data supports a call.
- Use numbered lists for Action Plan and bullet lists for Key Checks.
- You may use ✓ ⚠ ✗ in Key Checks when appropriate.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authResult = await requireAuth(req, corsHeaders);
  if (!authResult.ok) return authResult.response;

  if (!isUsageConfigured()) {
    return usageConfigErrorResponse(corsHeaders);
  }

  const quota = await requireUsageQuota(
    authResult.user.id,
    "ai.ask_concrete",
    "ai_request",
    corsHeaders,
  );
  if (!quota.ok) return quota.response;
  const usageContext = quota.context;

  try {
    const { question, pageLabel, projectContext } = await req.json();
    if (!question || typeof question !== "string") {
      return new Response(
        JSON.stringify({ error: "Valid 'question' field is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const contextParts: string[] = [
      "You are Arden Project OS AI — a professional concrete placement assistant for contractors.",
      "Expertise: mix design, volume, curing, placement planning, labor crew sizing, weather risk, rebar, pump/logistics, and ready-mix ordering.",
      "Tone: direct, practical, field-ready. Reference ACI 305R/306R or ASTM C94 when relevant.",
      RESPONSE_FORMAT,
    ];

    if (typeof pageLabel === "string" && pageLabel.trim()) {
      contextParts.push(
        `The user is in the Arden Project OS app on the "${pageLabel.trim()}" page.`,
      );
    }

    if (typeof projectContext === "string" && projectContext.trim()) {
      contextParts.push(
        "Use this active project data for specific recommendations. Do not invent facts not listed.",
        "Active project:\n" + projectContext.trim(),
      );
    }

    const systemContent = contextParts.join("\n\n");

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        temperature: 0.3,
        max_tokens: 900,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: question },
        ],
      }),
    });

    if (!openAiRes.ok) {
      const errText = await openAiRes.text();
      console.error("OpenAI API error:", errText);
      return new Response(
        JSON.stringify({ error: "OpenAI API returned an error" }),
        { status: openAiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { choices } = await openAiRes.json();
    const answer = choices?.[0]?.message?.content?.trim() ?? "Sorry, no answer returned.";
    await trackMeteredUsage(usageContext, {
      featureKey: "ai.ask_concrete",
      usageUnit: "ai_request",
      requestId: req.headers.get("x-request-id"),
    });
    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("askConcrete exception:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
