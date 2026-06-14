import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/requireAuth.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

interface CrewScenarioPayload {
  laborers: number;
  finishers: number;
  foremen: number;
  crewSize: number;
  billableJobDurationHours: number;
  overtimeJobHours: number;
  totalLaborCost: number;
  laborCostPerCY: number;
  score: number;
}

interface ReviewBody {
  jobContext?: Record<string, unknown>;
  currentCrew?: CrewScenarioPayload;
  scenarios?: CrewScenarioPayload[];
}

interface ReviewResult {
  recommendedScenarioIndex: number;
  crewSize: string;
  finishers: string;
  foremen: string;
  summary: string;
  tradeoffs: string;
  confidence: "high" | "medium" | "low";
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
    const body = (await req.json()) as ReviewBody;
    const scenarios = Array.isArray(body.scenarios) ? body.scenarios : [];

    if (scenarios.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one crew scenario is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!OPENAI_API_KEY) {
      const fallback = scenarios[0];
      const result: ReviewResult = {
        recommendedScenarioIndex: 0,
        crewSize: String(fallback.crewSize),
        finishers: String(fallback.finishers),
        foremen: String(fallback.foremen),
        summary:
          "Optimizer selected the lowest-cost crew mix that keeps pour-day duration reasonable and avoids unnecessary overtime.",
        tradeoffs:
          "Adjust crew manually if you know your crew’s production rate differs from the model.",
        confidence: "medium",
      };
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      jobContext: body.jobContext ?? {},
      currentCrew: body.currentCrew ?? null,
      scenarios: scenarios.map((s, index) => ({ index, ...s })),
      guidance:
        "Pick the best balance of total labor cost and pour-day duration. " +
        "Avoid overtime when a slightly larger crew finishes under 8 hours for less total cost. " +
        "Do not recommend more finishers than needed for the finish type and weather. " +
        "Do not recommend fewer laborers than needed to place the volume before initial set.",
    };

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.15,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a concrete placement superintendent reviewing crew sizing. " +
              "You MUST choose recommendedScenarioIndex from the provided scenarios array only — never invent crew counts. " +
              "Prefer economical total labor cost while keeping pour-day duration practical (roughly 5–9 hours). " +
              "Penalize unnecessary overtime and oversized crews standing idle. " +
              "For hot weather, stamped, or hard-trowel finishes, favor enough finishers to stay ahead of the bleed. " +
              'Respond with JSON only: {"recommendedScenarioIndex": number, "crewSize": string, "finishers": string, "foremen": string, "summary": string, "tradeoffs": string, "confidence": "high"|"medium"|"low"}. ' +
              "crewSize is total headcount; laborers = crewSize - finishers - foremen. " +
              "summary is 2–3 sentences for the contractor. tradeoffs notes what they give up vs their current crew.",
          },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
    });

    if (!openAiRes.ok) {
      const errText = await openAiRes.text();
      console.error("OpenAI labor crew review error:", openAiRes.status, errText);
      const fallback = scenarios[0];
      return new Response(
        JSON.stringify({
          recommendedScenarioIndex: 0,
          crewSize: String(fallback.crewSize),
          finishers: String(fallback.finishers),
          foremen: String(fallback.foremen),
          summary: "Using optimizer recommendation (AI review unavailable).",
          tradeoffs: "",
          confidence: "medium",
        } satisfies ReviewResult),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data = await openAiRes.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(
        JSON.stringify({ error: "No review returned" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const parsed = JSON.parse(content) as Partial<ReviewResult>;
    const index = Number(parsed.recommendedScenarioIndex);
    const safeIndex =
      Number.isInteger(index) && index >= 0 && index < scenarios.length ? index : 0;
    const chosen = scenarios[safeIndex];

    const result: ReviewResult = {
      recommendedScenarioIndex: safeIndex,
      crewSize: String(chosen.crewSize),
      finishers: String(chosen.finishers),
      foremen: String(chosen.foremen),
      summary: parsed.summary?.trim() ||
        "Recommended crew balances placement rate, finishing window, and labor cost.",
      tradeoffs: parsed.tradeoffs?.trim() || "",
      confidence: parsed.confidence === "high" || parsed.confidence === "medium"
        ? parsed.confidence
        : "low",
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("labor-crew-review exception:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
