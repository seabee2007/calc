import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/requireAuth.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

interface RegionalDefaults {
  basePrice: number;
  psiPriceAdjustments?: Record<string, number>;
  baseDeliveryFee?: number;
  minimumOrder?: number;
  smallLoadFee?: number;
  distanceFeePerMile?: number;
  baseDistanceMiles?: number;
  saturdayDeliveryFee?: number;
  afterHoursFee?: number;
  pumpTruckFee?: number;
  regionLabel?: string;
}

interface PricingLookupBody {
  plantName?: string;
  plantAddress?: string;
  plantLatitude?: number;
  plantLongitude?: number;
  jobsiteAddress?: string;
  regionalDefaults?: RegionalDefaults;
}

interface PricingLookupResult {
  usedAiPricing: boolean;
  basePrice: number;
  psiPriceAdjustments: Record<string, number>;
  deliveryFees: {
    baseDeliveryFee: number;
    minimumOrder: number;
    smallLoadFee: number;
    distanceFee: number;
    baseDistance: number;
  };
  additionalServices: {
    saturdayDeliveryFee: number;
    afterHoursFee: number;
    pumpTruckFee: number;
  };
  confidence: "high" | "medium" | "low";
  notes: string;
  source: "ai_estimate" | "regional_default";
}

function normalizeRegionalDefaults(
  input?: RegionalDefaults,
): PricingLookupResult {
  const base = input?.basePrice ?? 125;
  return {
    usedAiPricing: false,
    basePrice: base,
    psiPriceAdjustments: input?.psiPriceAdjustments ?? {
      "2500": -10,
      "3000": 0,
      "4000": 15,
      "5000": 30,
    },
    deliveryFees: {
      baseDeliveryFee: input?.baseDeliveryFee ?? 150,
      minimumOrder: input?.minimumOrder ?? 5,
      smallLoadFee: input?.smallLoadFee ?? 75,
      distanceFee: input?.distanceFeePerMile ?? 3.5,
      baseDistance: input?.baseDistanceMiles ?? 15,
    },
    additionalServices: {
      saturdayDeliveryFee: input?.saturdayDeliveryFee ?? 100,
      afterHoursFee: input?.afterHoursFee ?? 150,
      pumpTruckFee: input?.pumpTruckFee ?? 1200,
    },
    confidence: "medium",
    notes: input?.regionLabel
      ? `Using regional default pricing (${input.regionLabel}).`
      : "Using regional default pricing for your area.",
    source: "regional_default",
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

  const authResult = await requireAuth(req, corsHeaders);
  if (!authResult.ok) return authResult.response;

  try {
    const body = (await req.json()) as PricingLookupBody;
    const plantName = (body.plantName ?? "").trim();
    const plantAddress = (body.plantAddress ?? "").trim();
    const jobsiteAddress = (body.jobsiteAddress ?? "").trim();
    const regional = normalizeRegionalDefaults(body.regionalDefaults);

    if (!plantName && !plantAddress) {
      return new Response(
        JSON.stringify({ error: "plantName or plantAddress is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify(regional), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      plantName,
      plantAddress,
      jobsiteAddress,
      regionalDefaults: body.regionalDefaults,
      guidance:
        "Estimate ready-mix concrete pricing per cubic yard for this specific batch plant if you have reliable public knowledge. " +
        "If you do not know plant-specific prices, set usedAiPricing to false and the client will use regionalDefaults.",
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
        max_tokens: 600,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You estimate U.S. ready-mix concrete plant pricing for contractors. " +
              "Only provide plant-specific numbers when you are reasonably confident from public market knowledge for that plant or brand in that metro. " +
              "If unsure, set usedAiPricing to false. Never invent precise quotes — use round industry-typical values. " +
              'Respond JSON only: {"usedAiPricing":boolean,"basePrice":number,"psiPriceAdjustments":{"2500":number,"3000":number,"4000":number,"5000":number},' +
              '"deliveryFees":{"baseDeliveryFee":number,"minimumOrder":number,"smallLoadFee":number,"distanceFee":number,"baseDistance":number},' +
              '"additionalServices":{"saturdayDeliveryFee":number,"afterHoursFee":number,"pumpTruckFee":number},' +
              '"confidence":"high"|"medium"|"low","notes":string}.',
          },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
    });

    if (!openAiRes.ok) {
      console.error("OpenAI pricing error:", await openAiRes.text());
      return new Response(JSON.stringify(regional), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await openAiRes.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(JSON.stringify(regional), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(content) as Partial<PricingLookupResult> & {
      usedAiPricing?: boolean;
    };

    if (!parsed.usedAiPricing || typeof parsed.basePrice !== "number") {
      return new Response(JSON.stringify(regional), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result: PricingLookupResult = {
      usedAiPricing: true,
      basePrice: Math.max(80, Math.min(250, parsed.basePrice)),
      psiPriceAdjustments: {
        "2500": parsed.psiPriceAdjustments?.["2500"] ?? regional.psiPriceAdjustments["2500"],
        "3000": parsed.psiPriceAdjustments?.["3000"] ?? regional.psiPriceAdjustments["3000"],
        "4000": parsed.psiPriceAdjustments?.["4000"] ?? regional.psiPriceAdjustments["4000"],
        "5000": parsed.psiPriceAdjustments?.["5000"] ?? regional.psiPriceAdjustments["5000"],
      },
      deliveryFees: {
        baseDeliveryFee:
          parsed.deliveryFees?.baseDeliveryFee ?? regional.deliveryFees.baseDeliveryFee,
        minimumOrder: parsed.deliveryFees?.minimumOrder ?? regional.deliveryFees.minimumOrder,
        smallLoadFee: parsed.deliveryFees?.smallLoadFee ?? regional.deliveryFees.smallLoadFee,
        distanceFee: parsed.deliveryFees?.distanceFee ?? regional.deliveryFees.distanceFee,
        baseDistance:
          parsed.deliveryFees?.baseDistance ?? regional.deliveryFees.baseDistance,
      },
      additionalServices: {
        saturdayDeliveryFee:
          parsed.additionalServices?.saturdayDeliveryFee ??
          regional.additionalServices.saturdayDeliveryFee,
        afterHoursFee:
          parsed.additionalServices?.afterHoursFee ??
          regional.additionalServices.afterHoursFee,
        pumpTruckFee:
          parsed.additionalServices?.pumpTruckFee ??
          regional.additionalServices.pumpTruckFee,
      },
      confidence:
        parsed.confidence === "high" || parsed.confidence === "medium"
          ? parsed.confidence
          : "low",
      notes: parsed.notes?.trim() ||
        "AI-estimated plant pricing — confirm with the batch plant before bidding.",
      source: "ai_estimate",
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("batch-plant-pricing exception:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
