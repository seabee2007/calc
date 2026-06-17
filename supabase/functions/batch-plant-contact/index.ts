import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/requireAuth.ts";
import {
  isUsageConfigured,
  requireUsageQuota,
  trackMeteredUsage,
  usageConfigErrorResponse,
} from "../_shared/meterUsage.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

interface ContactLookupBody {
  plantName?: string;
  plantAddress?: string;
  latitude?: number;
  longitude?: number;
}

interface ContactLookupResult {
  phone: string | null;
  email: string | null;
  dispatchContact: string | null;
  website: string | null;
  confidence: "high" | "medium" | "low";
  notes: string;
  source: "ai_public_directory";
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
    const body = (await req.json()) as ContactLookupBody;
    const plantName = (body.plantName ?? "").trim();
    const plantAddress = (body.plantAddress ?? "").trim();

    if (!plantName && !plantAddress) {
      return new Response(
        JSON.stringify({ error: "plantName or plantAddress is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "OPENAI_API_KEY is not configured on the server",
          code: "missing_openai",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!isUsageConfigured()) {
      return usageConfigErrorResponse(corsHeaders);
    }

    const quota = await requireUsageQuota(
      authResult.user.id,
      "ai.batch_plant_contact",
      "ai_request",
      corsHeaders,
    );
    if (!quota.ok) return quota.response;
    const usageContext = quota.context;

    const payload = {
      plantName,
      plantAddress,
      latitude: body.latitude,
      longitude: body.longitude,
      regionHint:
        /,?\s*GU\b/i.test(plantAddress) || /guam/i.test(plantAddress) || /guam/i.test(plantName)
          ? "Guam — prefer Hawaiian Rock Products, Smithbridge Guam, Hanson, Core Tech if they match the name/address."
          : undefined,
    };

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You help concrete contractors find PUBLIC batch plant contact details for ordering ready-mix. " +
              "Only return phone numbers, emails, or dispatch contacts you are highly confident are publicly listed " +
              "for the specific plant name and address provided. If unsure, return null for that field and set confidence to low. " +
              "NEVER invent or guess phone numbers. Prefer main plant/dispatch lines over corporate HQ if both exist. " +
              'Respond with JSON only: {"phone": string|null, "email": string|null, "dispatchContact": string|null, "website": string|null, "confidence": "high"|"medium"|"low", "notes": string}. ' +
              "notes should explain what was found or tell the user to verify on the plant website.",
          },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
    });

    if (!openAiRes.ok) {
      const errText = await openAiRes.text();
      console.error("OpenAI contact lookup error:", openAiRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Contact lookup failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await openAiRes.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(
        JSON.stringify({ error: "No contact data returned" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const parsed = JSON.parse(content) as Partial<ContactLookupResult>;
    const result: ContactLookupResult = {
      phone: parsed.phone?.trim() || null,
      email: parsed.email?.trim() || null,
      dispatchContact: parsed.dispatchContact?.trim() || null,
      website: parsed.website?.trim() || null,
      confidence: parsed.confidence === "high" || parsed.confidence === "medium"
        ? parsed.confidence
        : "low",
      notes: parsed.notes?.trim() ||
        "Verify all contact details with the plant before ordering.",
      source: "ai_public_directory",
    };

    await trackMeteredUsage(usageContext, {
      featureKey: "ai.batch_plant_contact",
      usageUnit: "ai_request",
      requestId: req.headers.get("x-request-id"),
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("batch-plant-contact exception:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
