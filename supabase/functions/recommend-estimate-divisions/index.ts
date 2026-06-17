import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import {
  isUsageConfigured,
  requireUsageQuota,
  trackMeteredUsage,
  usageConfigErrorResponse,
} from "../_shared/meterUsage.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

interface AllowedDivision {
  code: string;
  name: string;
}

const ALLOWED_DIVISIONS: AllowedDivision[] = [
  { code: "00", name: "Procurement and Contracting Requirements" },
  { code: "01", name: "General Requirements" },
  { code: "02", name: "Existing Conditions" },
  { code: "03", name: "Concrete" },
  { code: "04", name: "Masonry" },
  { code: "05", name: "Metals" },
  { code: "06", name: "Wood, Plastics, and Composites" },
  { code: "07", name: "Thermal and Moisture Protection" },
  { code: "08", name: "Openings" },
  { code: "09", name: "Finishes" },
  { code: "10", name: "Specialties" },
  { code: "11", name: "Equipment" },
  { code: "12", name: "Furnishings" },
  { code: "13", name: "Special Construction" },
  { code: "14", name: "Conveying Equipment" },
  { code: "21", name: "Fire Suppression" },
  { code: "22", name: "Plumbing" },
  { code: "23", name: "HVAC" },
  { code: "25", name: "Integrated Automation" },
  { code: "26", name: "Electrical" },
  { code: "27", name: "Communications" },
  { code: "28", name: "Electronic Safety and Security" },
  { code: "31", name: "Earthwork" },
  { code: "32", name: "Exterior Improvements" },
  { code: "33", name: "Utilities" },
  { code: "34", name: "Transportation" },
  { code: "35", name: "Waterway and Marine Construction" },
  { code: "40", name: "Process Integration" },
  { code: "41", name: "Material Processing and Handling Equipment" },
  { code: "42", name: "Process Heating, Cooling, and Drying Equipment" },
  { code: "43", name: "Process Gas and Liquid Handling" },
  { code: "44", name: "Pollution and Waste Control Equipment" },
  { code: "45", name: "Industry-Specific Manufacturing Equipment" },
  { code: "46", name: "Water and Wastewater Equipment" },
  { code: "48", name: "Electrical Power Generation" },
];

const DIVISION_BY_CODE = new Map(ALLOWED_DIVISIONS.map((division) => [division.code, division]));

interface RequestBody {
  projectId?: string;
  projectName?: string;
  projectType?: string;
  projectScope?: string;
  projectDescription?: string;
  location?: string;
}

interface RecommendationItem {
  code: string;
  name: string;
  confidence: number;
  reason: string;
}

interface ResponseBody {
  recommendedDivisionCodes: string[];
  recommendations: RecommendationItem[];
  warnings?: string[];
}

function normalizeDivisionCode(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return null;
  const code = digits.padStart(2, "0").slice(-2);
  return DIVISION_BY_CODE.has(code) ? code : null;
}

function isScopeMissing(scope: string): boolean {
  return scope.trim().length === 0;
}

function isScopeVague(scope: string): boolean {
  const trimmed = scope.trim();
  if (!trimmed) return true;
  const words = trimmed.split(/\s+/).filter(Boolean);
  return trimmed.length < 24 || words.length < 4;
}

const DIRECT_MATCHES: Record<string, string[]> = {
  "03": ["concrete", "slab", "footing", "foundation", "sidewalk", "driveway", "curb", "pad"],
  "04": ["masonry", "cmu", "block", "brick"],
  "05": ["metal", "steel", "metal roof", "structural steel"],
  "06": ["wood", "framing", "carpentry", "studs", "sheathing"],
  "07": ["roof", "insulation", "waterproofing", "moisture", "flashing"],
  "08": ["doors", "door", "windows", "window", "openings", "glazing"],
  "09": ["paint", "drywall", "flooring", "ceiling", "finishes", "finish"],
  "22": ["plumbing", "water line", "sewer", "toilet", "sink"],
  "23": ["hvac", "air conditioning", "duct", "ventilation"],
  "26": ["electrical", "power", "lighting", "panel"],
  "31": ["grading", "excavation", "earthwork", "backfill", "trenching"],
  "32": ["paving", "sidewalk", "curb", "fence", "landscaping", "parking"],
  "33": ["utility", "utilities", "storm", "water service", "sewer service"],
};

const BUILDING_SCOPE_PATTERN = /\b(building|office|house|facility|structure|single-story|new build)\b/i;
const EXISTING_SCOPE_PATTERN = /\b(remodel|renovation|addition|demolition|demo|repair|replacement|existing)\b/i;

function findDirectMatch(code: string, scopeText: string): string | null {
  const scope = scopeText.toLowerCase();
  return DIRECT_MATCHES[code]?.find((term) => scope.includes(term)) ?? null;
}

function scoreDivisionConfidence(code: string, scopeText: string): number {
  if (code === "01") return scopeText.trim() ? 0.9 : 0.5;
  if (findDirectMatch(code, scopeText)) return 0.95;
  if (code === "02" && EXISTING_SCOPE_PATTERN.test(scopeText)) return 0.9;
  if (["07", "08", "09", "22", "23", "26"].includes(code) && BUILDING_SCOPE_PATTERN.test(scopeText)) {
    return 0.78;
  }
  return 0.65;
}

function buildDivisionReason(code: string, scopeText: string): string {
  const term = findDirectMatch(code, scopeText);
  const division = DIVISION_BY_CODE.get(code);

  if (code === "01") {
    return "The scope describes a construction project, so general requirements like supervision, safety, layout, and temporary controls are needed.";
  }

  if (term) {
    const directReasons: Record<string, string> = {
      "03": `The scope mentions ${term}, so concrete work is directly required.`,
      "04": `The scope mentions ${term}, so masonry work is directly required.`,
      "05": `The scope mentions ${term}, so metals work should be included.`,
      "06": `The scope mentions ${term}, so wood, plastics, and composites work should be included.`,
      "07": `The scope mentions ${term}, so thermal and moisture protection should be included.`,
      "08": `The scope mentions ${term}, so openings should be included.`,
      "09": `The scope mentions ${term}, so finishes should be included.`,
      "22": `The scope mentions ${term}, so plumbing should be included.`,
      "23": `The scope mentions ${term}, so HVAC should be included.`,
      "26": `The scope mentions ${term}, so electrical work should be included.`,
      "31": `The scope mentions ${term}, so earthwork should be included.`,
      "32": `The scope mentions ${term}, so exterior improvements should be included.`,
      "33": `The scope mentions ${term}, so utilities should be included.`,
    };
    return directReasons[code] ?? `The scope mentions ${term}, which points to ${division?.name ?? code}.`;
  }

  if (code === "02" && EXISTING_SCOPE_PATTERN.test(scopeText)) {
    return "The scope references work around an existing condition, so existing conditions should be included.";
  }

  if (["07", "08", "09", "22", "23", "26"].includes(code) && BUILDING_SCOPE_PATTERN.test(scopeText)) {
    return `The scope describes a building or occupied structure, so ${division?.name ?? code} is likely part of the work even if not named directly.`;
  }

  return `The project scope suggests ${division?.name ?? code} may be needed, but the support is indirect.`;
}

function hasGenericReason(reason: string): boolean {
  const lower = reason.toLowerCase();
  return (
    lower.includes("recommended based on project scope") ||
    lower.includes("recommended for this project scope") ||
    lower.includes("likely needed based on the project scope") ||
    lower.includes("keyword match from project scope")
  );
}

function missingScopeResponse(): ResponseBody {
  return {
    recommendedDivisionCodes: ["01"],
    recommendations: [
      {
        code: "01",
        name: DIVISION_BY_CODE.get("01")!.name,
        confidence: 0.5,
        reason:
          "Project scope is missing. General Requirements is included as a baseline until scope details are added.",
      },
    ],
    warnings: [
      "Project scope is missing. Add a scope description for more accurate division recommendations.",
    ],
  };
}

function sanitizeRecommendations(raw: unknown, scopeText: string): ResponseBody {
  const parsed = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};

  const rawCodes = Array.isArray(parsed.recommendedDivisionCodes)
    ? parsed.recommendedDivisionCodes
    : [];
  const rawRecommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
  const rawWarnings = Array.isArray(parsed.warnings)
    ? parsed.warnings.filter((warning): warning is string => typeof warning === "string")
    : [];

  const recommendationByCode = new Map<string, RecommendationItem>();

  for (const rawCode of rawCodes) {
    const code = normalizeDivisionCode(rawCode);
    if (!code || recommendationByCode.has(code)) continue;
    const division = DIVISION_BY_CODE.get(code)!;
    recommendationByCode.set(code, {
      code,
      name: division.name,
      confidence: scoreDivisionConfidence(code, scopeText),
      reason: buildDivisionReason(code, scopeText),
    });
  }

  for (const item of rawRecommendations) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const code = normalizeDivisionCode(record.code);
    if (!code) continue;

    const division = DIVISION_BY_CODE.get(code)!;
    const confidenceRaw = typeof record.confidence === "number"
      ? record.confidence
      : Number(record.confidence);
    const fallbackConfidence = scoreDivisionConfidence(code, scopeText);
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.min(1, Math.max(0, confidenceRaw))
      : fallbackConfidence;
    const rawReason = typeof record.reason === "string" && record.reason.trim()
      ? record.reason.trim()
      : "";
    const reason = rawReason && !hasGenericReason(rawReason)
      ? rawReason
      : buildDivisionReason(code, scopeText);

    recommendationByCode.set(code, {
      code,
      name: division.name,
      confidence,
      reason,
    });
  }

  const recommendations = [...recommendationByCode.values()];
  const uniqueConfidences = new Set(recommendations.map((item) => item.confidence));
  if (scopeText.trim() && recommendations.length > 1 && uniqueConfidences.size === 1) {
    for (const item of recommendations) {
      item.confidence = scoreDivisionConfidence(item.code, scopeText);
      if (hasGenericReason(item.reason)) {
        item.reason = buildDivisionReason(item.code, scopeText);
      }
    }
  }

  const filteredRecommendations = recommendations.filter((item) => item.confidence >= 0.65);
  const recommendedDivisionCodes = filteredRecommendations.map((item) => item.code);

  return {
    recommendedDivisionCodes,
    recommendations: filteredRecommendations,
    warnings: rawWarnings.length > 0 ? rawWarnings : undefined,
  };
}

function keywordFallbackRecommendations(scope: string): ResponseBody {
  const lower = scope.toLowerCase();
  const codes = new Set<string>(["01"]);

  if (/\b(remodel|renovation|renovate|addition|demolition|demo|existing|repair|replacement)\b/.test(lower)) {
    codes.add("02");
  }
  if (/\b(concrete|slab|footing|foundation|sidewalk|driveway|pavement|curb|pad)\b/.test(lower)) {
    codes.add("03");
  }
  if (/\b(masonry|cmu|block|brick|stone)\b/.test(lower)) {
    codes.add("04");
  }
  if (/\b(metal|steel|roof|structural steel)\b/.test(lower)) {
    codes.add("05");
  }
  if (/\b(wood|framing|lumber|composite)\b/.test(lower)) {
    codes.add("06");
  }
  if (/\b(roofing|waterproof|insulation|thermal|moisture)\b/.test(lower)) {
    codes.add("07");
  }
  if (/\b(door|window|opening|glazing)\b/.test(lower)) {
    codes.add("08");
  }
  if (/\b(finish|paint|flooring|tile|drywall|interior)\b/.test(lower)) {
    codes.add("09");
  }
  if (/\b(plumb|plumbing|fixture|sewer|water line)\b/.test(lower)) {
    codes.add("22");
  }
  if (/\b(hvac|mechanical|air condition|ventilation)\b/.test(lower)) {
    codes.add("23");
  }
  if (/\b(electric|electrical|lighting|power)\b/.test(lower)) {
    codes.add("26");
  }
  if (/\b(grading|excavat|trench|backfill|site prep|earthwork)\b/.test(lower)) {
    codes.add("31");
  }
  if (/\b(paving|landscap|fence|parking|curb|sidewalk|site work|exterior)\b/.test(lower)) {
    codes.add("32");
  }
  if (/\b(utilit|storm|sewer|water main|gas line|underground)\b/.test(lower)) {
    codes.add("33");
  }

  const recommendedDivisionCodes = [...codes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const recommendations = recommendedDivisionCodes.map((code) => {
    const division = DIVISION_BY_CODE.get(code)!;
    return {
      code,
      name: division.name,
      confidence: scoreDivisionConfidence(code, scope),
      reason: buildDivisionReason(code, scope),
    };
  });

  const warnings = isScopeVague(scope)
    ? ["Project scope is vague. Recommendations are based on simple keyword matching."]
    : undefined;

  return { recommendedDivisionCodes, recommendations, warnings };
}

function buildSystemPrompt(): string {
  const catalog = ALLOWED_DIVISIONS.map((division) => `${division.code} - ${division.name}`).join("\n");

  return `You are a professional construction estimator and project planner.

Your job is to read a project scope and recommend CSI MasterFormat divisions of work.

Return strict JSON only. No markdown. No extra text.

Allowed divisions:
${catalog}

Rules:
- Recommend only divisions likely needed for the project.
- Do not select every division.
- Include 01 - General Requirements for most real construction projects.
- Include 02 - Existing Conditions for remodels, renovations, additions, demolition, repair, replacement, or work around existing facilities.
- Include 03 - Concrete for slabs, foundations, footings, sidewalks, driveways, curbs, pads, or structural concrete.
- Include 31 - Earthwork for grading, excavation, trenching, backfill, foundations, or site prep.
- Include 32 - Exterior Improvements for paving, fencing, landscaping, sidewalks, curbs, parking, and site improvements.
- Include 33 - Utilities for water, sewer, storm drainage, gas, or underground utilities.
- If the scope is vague, return a warning.
- Do not use generic reasons.
- Each reason must reference the actual scope text or a clear construction inference.
- Confidence values must not all be the same.
- If you are unsure, lower the confidence.
- Only recommend divisions with confidence >= 0.65.

Confidence guide:
- 0.95 to 1.0: the scope directly names this work, such as concrete slab, plumbing, HVAC, electrical, or metal roof.
- 0.85 to 0.94: the work is strongly implied, such as general requirements for a real construction project.
- 0.70 to 0.84: the work is likely but not directly stated, such as common building systems implied by a new building.
- 0.50 to 0.69: possible but uncertain; usually do not recommend unless important.
- Below 0.50: do not recommend.

JSON shape:
{
  "recommendedDivisionCodes": ["01", "03", "31"],
  "recommendations": [
    {
      "code": "01",
      "name": "General Requirements",
      "confidence": 0.95,
      "reason": "Most construction projects need general project management, supervision, safety, and temporary controls."
    }
  ],
  "warnings": []
}`;
}

async function userCanAccessProject(
  admin: ReturnType<typeof createClient>,
  userId: string,
  projectId: string,
  ownerId: string,
): Promise<boolean> {
  if (ownerId === userId) return true;

  const { data } = await admin
    .from("employee_project_assignments")
    .select("id")
    .eq("project_id", projectId)
    .eq("employee_id", userId)
    .maybeSingle();

  return !!data;
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
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
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

    const jwt = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";

    if (!projectId) {
      return new Response(JSON.stringify({ error: "projectId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("id, name, description, user_id, jobsite_city, jobsite_state, jobsite_street, jobsite_zip")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const canAccess = await userCanAccessProject(
      admin,
      user.id,
      projectId,
      String(project.user_id ?? ""),
    );

    if (!canAccess) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const savedScope = typeof project.description === "string" ? project.description.trim() : "";
    const locationParts = [
      project.jobsite_street,
      project.jobsite_city,
      project.jobsite_state,
      project.jobsite_zip,
    ].filter((part) => typeof part === "string" && part.trim()).join(", ");

    if (isScopeMissing(savedScope)) {
      return new Response(JSON.stringify(missingScopeResponse()), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const promptPayload = {
      projectName: typeof project.name === "string" ? project.name : body.projectName ?? "",
      projectType: body.projectType ?? "",
      projectScope: savedScope,
      location: locationParts || body.location || "",
    };

    if (!OPENAI_API_KEY) {
      const fallback = keywordFallbackRecommendations(savedScope);
      return new Response(JSON.stringify(fallback), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isUsageConfigured()) {
      return usageConfigErrorResponse(corsHeaders);
    }

    const quota = await requireUsageQuota(
      user.id,
      "ai.estimate_divisions",
      "ai_request",
      corsHeaders,
    );
    if (!quota.ok) return quota.response;
    const usageContext = quota.context;

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
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
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: JSON.stringify(promptPayload) },
        ],
      }),
    });

    if (!openAiRes.ok) {
      console.error("OpenAI recommend divisions error:", await openAiRes.text());
      const fallback = keywordFallbackRecommendations(savedScope);
      return new Response(JSON.stringify({
        ...fallback,
        warnings: [
          ...(fallback.warnings ?? []),
          "AI recommendation service was unavailable. Used keyword-based fallback.",
        ],
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await openAiRes.json();
    const content = data?.choices?.[0]?.message?.content;
    let parsed: unknown = null;

    if (typeof content === "string" && content.trim()) {
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = null;
      }
    }

    if (!parsed) {
      const fallback = keywordFallbackRecommendations(savedScope);
      return new Response(JSON.stringify({
        ...fallback,
        warnings: [
          ...(fallback.warnings ?? []),
          "AI returned an invalid response. Used keyword-based fallback.",
        ],
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitized = sanitizeRecommendations(parsed, savedScope);
    if (sanitized.recommendedDivisionCodes.length === 0) {
      const fallback = keywordFallbackRecommendations(savedScope);
      return new Response(JSON.stringify(fallback), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isScopeVague(savedScope) && !sanitized.warnings?.length) {
      sanitized.warnings = [
        "Project scope is vague. Review recommendations carefully and adjust divisions manually.",
      ];
    }

    await trackMeteredUsage(usageContext, {
      featureKey: "ai.estimate_divisions",
      usageUnit: "ai_request",
      requestId: req.headers.get("x-request-id"),
    });

    return new Response(JSON.stringify(sanitized), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("recommend-estimate-divisions:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
