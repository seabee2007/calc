import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import {
  scopeTextImpliesConcrete,
  scopeTextImpliesEarthwork,
} from "../_shared/scopeActivityDivisionClassifier.ts";

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
  scopeText?: string;
  acceptedDivisions?: unknown[];
  filterMode?: string;
  projectName?: string;
  location?: string;
}

type ScopeFilterMode = "allFromScope" | "selectedDivisionsOnly";

interface DivisionSuggestionItem {
  divisionCode: string;
  divisionName?: string;
  confidence: number;
  reason: string;
  sourceExcerpt?: string;
  suggestedWorkAreas?: string[];
  estimatingNotes?: string[];
}

interface ResponseBody {
  divisions: DivisionSuggestionItem[];
  warnings?: string[];
  fallbackUsed?: boolean;
}

const DIVISION_WORK_AREAS: Record<string, string[]> = {
  "01": ["General conditions", "Temporary facilities", "Site supervision"],
  "02": ["Existing conditions", "Selective demolition"],
  "03": ["Concrete placement", "Formwork", "Reinforcement", "Slab on grade"],
  "06": ["Wood framing", "Sheathing", "Rough carpentry"],
  "07": ["Roofing", "Waterproofing", "Insulation"],
  "08": ["Doors", "Windows", "Glazing"],
  "09": ["Drywall", "Paint", "Flooring", "Finishes"],
  "22": ["Plumbing rough-in", "Fixtures"],
  "23": ["HVAC distribution", "Mechanical equipment"],
  "26": ["Electrical rough-in", "Lighting", "Power"],
  "31": ["Excavation", "Grading", "Trenching", "Backfill", "Site prep"],
  "32": ["Paving", "Flatwork", "Landscaping"],
  "33": ["Underground utilities", "Site utilities"],
};

const DIRECT_MATCHES: Record<string, string[]> = {
  "03": ["concrete", "slab", "footing concrete", "foundation concrete", "rebar", "formwork", "sidewalk", "driveway", "curb", "pad", "anchor bolt", "sill plate"],
  "04": ["masonry", "cmu", "block", "brick"],
  "05": ["metal", "steel", "metal roof", "structural steel"],
  "06": ["wood", "framing", "carpentry", "studs", "sheathing", "truss"],
  "07": ["roof", "insulation", "waterproofing", "moisture", "flashing", "house wrap", "shingle"],
  "08": ["doors", "door", "windows", "window", "openings", "glazing"],
  "09": ["paint", "drywall", "flooring", "ceiling", "finishes", "finish", "trim", "texture"],
  "22": ["plumbing", "water line", "sewer", "toilet", "sink"],
  "23": ["hvac", "air conditioning", "duct", "ventilation"],
  "26": ["electrical", "power", "lighting", "panel"],
  "31": ["grading", "excavation", "excavate", "earthwork", "backfill", "trenching", "cleanup", "debris", "haul", "cut", "fill", "subgrade", "compaction", "site prep", "aggregate base", "haul-off", "spoil"],
  "32": ["paving", "sidewalk", "curb", "fence", "landscaping", "parking"],
  "33": ["utility", "utilities", "storm", "water service", "sewer service"],
};

const BUILDING_SCOPE_PATTERN = /\b(building|office|house|facility|structure|single-story|new build|residence|residential)\b/i;

function parseFilterMode(value: unknown): ScopeFilterMode {
  return value === "selectedDivisionsOnly" ? "selectedDivisionsOnly" : "allFromScope";
}

function findDirectMatch(code: string, scopeText: string): string | null {
  const scope = scopeText.toLowerCase();
  return DIRECT_MATCHES[code]?.find((term) => scope.includes(term)) ?? null;
}

function inferDivisionsFromScopeText(scopeText: string): string[] {
  const lower = scopeText.toLowerCase();
  const codes = new Set<string>(["01"]);

  if (/\b(remodel|renovation|renovate|addition|demolition|demo|existing|repair|replacement)\b/.test(lower)) {
    codes.add("02");
  }
  if (scopeTextImpliesConcrete(scopeText)) {
    codes.add("03");
  }
  if (/\b(masonry|cmu|block|brick|stone)\b/.test(lower)) {
    codes.add("04");
  }
  if (/\b(metal|steel|structural steel)\b/.test(lower)) {
    codes.add("05");
  }
  if (/\b(wood|framing|lumber|composite|sheathing|truss)\b/.test(lower)) {
    codes.add("06");
  }
  if (/\b(roof|roofing|waterproof|insulation|thermal|moisture|house wrap|shingle)\b/.test(lower)) {
    codes.add("07");
  }
  if (/\b(door|window|opening|glazing)\b/.test(lower)) {
    codes.add("08");
  }
  if (/\b(finish|paint|flooring|tile|drywall|interior|trim|hardware|texture)\b/.test(lower)) {
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
  if (scopeTextImpliesEarthwork(scopeText)) {
    codes.add("31");
  }
  if (/\b(paving|landscap|fence|parking|curb|sidewalk|site work|exterior)\b/.test(lower)) {
    codes.add("32");
  }
  if (/\b(utilit|storm|sewer|water main|gas line|underground)\b/.test(lower)) {
    codes.add("33");
  }

  for (const code of Object.keys(DIRECT_MATCHES)) {
    if (findDirectMatch(code, scopeText)) codes.add(code);
  }

  if (BUILDING_SCOPE_PATTERN.test(scopeText)) {
    for (const code of ["07", "08", "09", "22", "23", "26"]) {
      codes.add(code);
    }
  }

  return [...codes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function resolveTargetDivisions(
  scopeText: string,
  filterMode: ScopeFilterMode,
  acceptedDivisions: string[],
): string[] {
  if (filterMode === "selectedDivisionsOnly") {
    return acceptedDivisions.length > 0 ? acceptedDivisions : ["01"];
  }
  return inferDivisionsFromScopeText(scopeText);
}

function normalizeDivisionCode(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return null;
  const code = digits.padStart(2, "0").slice(-2);
  return DIVISION_BY_CODE.has(code) ? code : null;
}

function normalizeAcceptedDivisions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const codes = new Set<string>();
  for (const item of raw) {
    const code = normalizeDivisionCode(item);
    if (code) codes.add(code);
  }
  return [...codes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
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

function extractSourceExcerpt(scopeText: string, divisionName: string): string {
  const scope = scopeText.trim();
  if (!scope) return divisionName;
  const lowerScope = scope.toLowerCase();
  const lowerName = divisionName.toLowerCase();
  const words = lowerName.split(/\s+/).filter((word) => word.length > 3);
  for (const word of words) {
    const index = lowerScope.indexOf(word);
    if (index >= 0) {
      const start = Math.max(0, index - 40);
      const end = Math.min(scope.length, index + word.length + 60);
      return scope.slice(start, end).trim();
    }
  }
  return scope.slice(0, 120).trim();
}

function keywordFallbackDivisions(
  scopeText: string,
  filterMode: ScopeFilterMode,
  acceptedDivisions: string[],
): ResponseBody {
  const divisionCodes = resolveTargetDivisions(scopeText, filterMode, acceptedDivisions);
  const divisions: DivisionSuggestionItem[] = divisionCodes.map((code) => {
    const division = DIVISION_BY_CODE.get(code);
    const divisionName = division?.name ?? code;
    return {
      divisionCode: code,
      divisionName,
      confidence: 0.72,
      reason: `Scope references work typically covered by Division ${code} — ${divisionName}.`,
      sourceExcerpt: extractSourceExcerpt(scopeText, divisionName),
      suggestedWorkAreas: DIVISION_WORK_AREAS[code] ?? [],
    };
  });

  const warnings = isScopeVague(scopeText)
    ? ["Project scope is vague. Suggestions are based on keyword matching per division."]
    : ["AI suggestion service used keyword-based fallback."];

  return {
    divisions,
    warnings,
    fallbackUsed: true,
  };
}

function sanitizeDivisions(
  raw: unknown,
  scopeText: string,
  filterMode: ScopeFilterMode,
  acceptedDivisions: string[],
): ResponseBody {
  const parsed = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};

  const rawDivisions = Array.isArray(parsed.divisions) ? parsed.divisions : [];
  const rawWarnings = Array.isArray(parsed.warnings)
    ? parsed.warnings.filter((warning): warning is string => typeof warning === "string")
    : [];

  const allowedCodes = filterMode === "selectedDivisionsOnly"
    ? new Set(resolveTargetDivisions(scopeText, filterMode, acceptedDivisions))
    : null;

  const byCode = new Map<string, DivisionSuggestionItem>();

  for (const item of rawDivisions) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const code = normalizeDivisionCode(record.divisionCode);
    if (!code || !DIVISION_BY_CODE.has(code)) continue;
    if (allowedCodes && !allowedCodes.has(code)) continue;

    const confidenceRaw = typeof record.confidence === "number"
      ? record.confidence
      : Number(record.confidence);
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.min(1, Math.max(0, confidenceRaw))
      : 0.7;
    if (confidence < 0.5) continue;

    const divisionName =
      typeof record.divisionName === "string" && record.divisionName.trim()
        ? record.divisionName.trim()
        : DIVISION_BY_CODE.get(code)?.name ?? code;
    const reason =
      typeof record.reason === "string" && record.reason.trim()
        ? record.reason.trim()
        : `Scope references work covered by Division ${code} — ${divisionName}.`;
    const sourceExcerpt =
      typeof record.sourceExcerpt === "string" && record.sourceExcerpt.trim()
        ? record.sourceExcerpt.trim()
        : extractSourceExcerpt(scopeText, divisionName);
    const suggestedWorkAreas = Array.isArray(record.suggestedWorkAreas)
      ? record.suggestedWorkAreas.filter((area): area is string => typeof area === "string")
      : DIVISION_WORK_AREAS[code];
    const estimatingNotes = Array.isArray(record.estimatingNotes)
      ? record.estimatingNotes.filter((note): note is string => typeof note === "string")
      : undefined;

    const next: DivisionSuggestionItem = {
      divisionCode: code,
      divisionName,
      confidence,
      reason,
      sourceExcerpt,
      suggestedWorkAreas,
      estimatingNotes,
    };

    const existing = byCode.get(code);
    if (!existing || confidence > existing.confidence) {
      byCode.set(code, next);
    }
  }

  return {
    divisions: [...byCode.values()].sort((a, b) => a.divisionCode.localeCompare(b.divisionCode)),
    warnings: rawWarnings.length > 0 ? rawWarnings : undefined,
  };
}

function buildSystemPrompt(
  filterMode: ScopeFilterMode,
  contextDivisions: string[],
): string {
  const catalog = ALLOWED_DIVISIONS.map((division) => `${division.code} - ${division.name}`).join("\n");
  const contextList = contextDivisions.length > 0
    ? contextDivisions
      .map((code) => {
        const division = DIVISION_BY_CODE.get(code);
        return division ? `${division.code} - ${division.name}` : code;
      })
      .join("\n")
    : "None selected yet.";

  const filterInstruction = filterMode === "selectedDivisionsOnly"
    ? "Only return divisions from the accepted divisions listed below."
    : "Analyze the full scope of work and return all applicable CSI divisions. Existing accepted divisions are provided only as context — do not limit suggestions to those divisions.";

  return `You are a professional construction estimator.

Read the project scope and propose applicable CSI divisions for user review.
Do NOT propose construction activities, quantities, production rates, or line items.

Return strict JSON only. No markdown. No extra text.

${filterInstruction}

Valid CSI division catalog:
${catalog}

Existing accepted divisions on this estimate (context only):
${contextList}

Rules:
- Return divisions only — no activity titles, no production rates, no man-hours.
- Use only valid division codes from the catalog above.
- Each reason must reference the scope text or a clear construction inference.
- Include sourceExcerpt: a short quote or paraphrase from the scope supporting the division.
- Include suggestedWorkAreas: 2-5 typical work areas for that division implied by the scope.
- Confidence must vary; lower confidence when support is indirect.
- Do not return divisions with confidence below 0.5.
- Return all applicable divisions found in the scope (typically 3-12 for a building project).
- Do not place excavation under Division 03. Excavation, grading, trenching, cut/fill, backfill, and site preparation belong to Division 31 Earthwork. Division 03 is for concrete work only.
- Do not classify earthwork as Division 03 just because the word "foundation" appears. Foundation excavation is Division 31. Foundation or footing concrete is Division 03.

JSON shape:
{
  "divisions": [
    {
      "divisionCode": "31",
      "divisionName": "Earthwork",
      "confidence": 0.91,
      "reason": "Scope mentions excavation and site grading.",
      "sourceExcerpt": "…excavate and rough grade the building pad…",
      "suggestedWorkAreas": ["Excavation", "Site grading", "Backfill"],
      "estimatingNotes": ["Confirm cut/fill quantities from civil drawings."]
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
    const scopeText = typeof body.scopeText === "string" ? body.scopeText.trim() : "";
    const acceptedDivisions = normalizeAcceptedDivisions(body.acceptedDivisions);
    const filterMode = parseFilterMode(body.filterMode);

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

    if (isScopeMissing(scopeText)) {
      return new Response(JSON.stringify({
        divisions: [],
        warnings: ["Scope text is missing. Paste a scope description to suggest divisions."],
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contextDivisions = acceptedDivisions;
    const targetDivisions = resolveTargetDivisions(scopeText, filterMode, acceptedDivisions);
    const locationParts = [
      project.jobsite_street,
      project.jobsite_city,
      project.jobsite_state,
      project.jobsite_zip,
    ].filter((part) => typeof part === "string" && part.trim()).join(", ");

    const promptPayload = {
      projectName: typeof project.name === "string" ? project.name : body.projectName ?? "",
      scopeText,
      filterMode,
      acceptedDivisions: contextDivisions,
      targetDivisions,
      location: locationParts || body.location || "",
    };

    if (!OPENAI_API_KEY) {
      const fallback = keywordFallbackDivisions(scopeText, filterMode, acceptedDivisions);
      return new Response(JSON.stringify(fallback), {
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
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt(filterMode, contextDivisions) },
          { role: "user", content: JSON.stringify(promptPayload) },
        ],
      }),
    });

    if (!openAiRes.ok) {
      console.error("OpenAI suggest activities error:", await openAiRes.text());
      const fallback = keywordFallbackDivisions(scopeText, filterMode, acceptedDivisions);
      return new Response(JSON.stringify({
        ...fallback,
        warnings: [
          ...(fallback.warnings ?? []),
          "AI suggestion service was unavailable. Used keyword-based fallback.",
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
      const fallback = keywordFallbackDivisions(scopeText, filterMode, acceptedDivisions);
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

    const sanitized = sanitizeDivisions(parsed, scopeText, filterMode, acceptedDivisions);
    if (sanitized.divisions.length === 0) {
      const fallback = keywordFallbackDivisions(scopeText, filterMode, acceptedDivisions);
      return new Response(JSON.stringify(fallback), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isScopeVague(scopeText) && !sanitized.warnings?.length) {
      sanitized.warnings = [
        "Project scope is vague. Review suggested divisions carefully before importing.",
      ];
    }

    return new Response(JSON.stringify(sanitized), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("suggest-estimate-activities:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
