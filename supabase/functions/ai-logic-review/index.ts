import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

/**
 * AI role: semantic classifier + gap filler only.
 * TypeScript (client) runs graph validation, cycle checks, and CPM/RCS math.
 */
const SYSTEM_PROMPT = `You are a strict B2B construction scheduling data-transformer. Your job is to analyze an unstructured list of residential activity cards, standardize them, and identify explicit sequence dependencies.

CRITICAL RULES:
1. Output MUST be structured JSON only. Do NOT calculate dates, float, durations, critical path, or project duration.
2. Look for "Compound Cards" (e.g. "Rough framing and MEP inspections"). Flag these and recommend splitting structural vs. inspection components.
3. Apply standard residential logic: Mobilization -> Substructure -> Superstructure (Framing) -> Dry-In -> MEP Rough-ins -> Insulation -> Drywall -> Finishes -> Trim -> Final Inspection.
4. Respect resource constraints: do not suggest parallel heavy-trade paths that would exceed the provided available crew size on the same day.
5. Use ONLY activity codes provided. Do not invent activities.
6. Do not suggest links that already exist in existing logic links or the deterministic draft.
7. Prefer finish-to-start (FS) unless another relationship is clearly required.
8. Suggest only direct construction dependencies — no broad generic chains.
9. Do NOT merge activities. Each card is single-responsibility (one trade, one action, one phase). Suggest links only between the provided activity codes; never combine, rename, or collapse two cards into one.
10. Treat special activity types differently from normal field work when an "activityType" is provided:
   - "inspection": a hold/gate. Successor work must wait for the gate (FS); do not run dependent field work in parallel with the gate.
   - "milestone": a zero-duration marker. Link as an FS reference point only; never assign it crew demand.
   - "curing_lag": a time-only delay (concrete cure). Model as an FS link with the lag, not as crewed work.
   - "procurement_lead_time": off-site lead time (e.g. countertop fabrication). It precedes its install step via FS with the lead-time lag and carries no on-site crew.
   - "testing": a verification step that must finish before the related close-in or trim work proceeds (FS).
11. Treat "masterActivityCode" and "logicAnchor" as the AUTHORITATIVE identity and meaning of each activity. Determine sequencing from these and the standardized title/division — never infer identity or scope from "description"/notes (project-specific notes only). Two cards may share the same "masterActivityCode" but have different "activityCode"/"displayCode" values: these are distinct instances and must be linked independently. Always reference activities by their provided "activityCode" in your output.

Return JSON using this exact schema:
{
  "compoundCardAlerts": [
    {
      "activityCode": "01-02-01",
      "issue": "Combines Framing and Inspections. Suggest splitting into separate structural and municipal cards to avoid trade loops."
    }
  ],
  "suggestedGapsFilled": [
    {
      "predecessorActivityCode": "26-02-01",
      "successorActivityCode": "27-01-01",
      "relationshipType": "FS",
      "lagDays": 0,
      "confidence": 0.95,
      "reason": "Low voltage rough-in must follow the primary electrical boxes and branch wiring setup."
    }
  ]
}

Only include suggestedGapsFilled entries with confidence >= 0.75.`;

interface RequestBody {
  activities?: unknown;
  logicLinks?: unknown;
  projectType?: string;
  projectLocation?: string;
  templateContext?: boolean;
  availableCrewSize?: number;
  draftSequenceContext?: unknown[];
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
      : `Gap fill: ${predecessorActivityCode} before ${successorActivityCode}`;

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

function normalizeCompoundCardAlert(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const activityCode = typeof src.activityCode === "string" ? src.activityCode.trim() : "";
  const issue = typeof src.issue === "string" ? src.issue.trim() : "";
  if (!activityCode || !issue) return null;
  return { activityCode, issue };
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
          compoundCardAlerts: [],
          error: "OPENAI_API_KEY is not configured on this server.",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const crewSize =
      typeof body.availableCrewSize === "number" && body.availableCrewSize > 0
        ? body.availableCrewSize
        : 16;
    const draftLinks = Array.isArray(body.draftSequenceContext) ? body.draftSequenceContext : [];

    const userPrompt = [
      "Analyze the activity list. Flag compound cards and suggest missing logic links only.",
      "Do NOT calculate CPM dates, float, critical path, or project duration.",
      "",
      `Project type: ${body.projectType ?? "residential"}`,
      `Project location: ${body.projectLocation ?? "unspecified"}`,
      `Available crew size (resource constraint): ${crewSize}`,
      "",
      `Activities:\n${JSON.stringify(body.activities)}`,
      "",
      `Existing logic links:\n${JSON.stringify(body.logicLinks ?? [])}`,
      "",
      `Deterministic draft links already proposed (do not duplicate):\n${JSON.stringify(draftLinks)}`,
    ].join("\n");

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
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
        JSON.stringify({ suggestions: [], compoundCardAlerts: [], error: `OpenAI request failed: ${errorText}` }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const completion = await openAiResponse.json();
    const content = completion?.choices?.[0]?.message?.content;
    let parsed: {
      suggestions?: unknown[];
      suggestedGapsFilled?: unknown[];
      compoundCardAlerts?: unknown[];
    } = {};

    if (typeof content === "string" && content.trim()) {
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = {};
      }
    }

    const rawGapLinks = Array.isArray(parsed.suggestedGapsFilled)
      ? parsed.suggestedGapsFilled
      : Array.isArray(parsed.suggestions)
        ? parsed.suggestions
        : [];

    const suggestions = rawGapLinks
      .map((raw, index) => normalizeAiSuggestion(raw, index))
      .filter((suggestion): suggestion is Record<string, unknown> => suggestion !== null);

    const compoundCardAlerts = (Array.isArray(parsed.compoundCardAlerts) ? parsed.compoundCardAlerts : [])
      .map((raw) => normalizeCompoundCardAlert(raw))
      .filter((alert): alert is Record<string, unknown> => alert !== null);

    return new Response(JSON.stringify({ suggestions, compoundCardAlerts }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ suggestions: [], compoundCardAlerts: [], error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
