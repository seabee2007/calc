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
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const CONTRACTOR_FURNISH_PREFIX =
  "The contractor shall furnish all labor, materials, equipment, tools, supervision, and services necessary to";

interface RequestBody {
  scopeText?: string;
  projectType?: string;
  projectName?: string;
}

function applyContractorFurnishPrefix(scopeText: string): string {
  const trimmed = scopeText.trim();
  if (!trimmed) return trimmed;

  if (
    /^the contractor shall furnish all labor, materials, equipment, tools, supervision, and services necessary to/i
      .test(trimmed)
  ) {
    return trimmed;
  }

  let body = trimmed;
  if (/^[A-Z]/.test(body)) {
    body = body.charAt(0).toLowerCase() + body.slice(1);
  }

  return `${CONTRACTOR_FURNISH_PREFIX} ${body}`;
}

function buildUserPrompt(body: RequestBody, scopeText: string): string {
  return [
    "Rewrite this project scope into professional construction SOW language.",
    "",
    "Requirements:",
    "- Start with “The contractor shall furnish all labor, materials, equipment, tools, supervision, and services necessary to” when the wording fits.",
    "- Preserve all quantities, dimensions, locations, materials, trades, exclusions, and requirements.",
    "- Do not remove any user-provided detail.",
    "- Do not add unsupported scope.",
    "- Clean grammar and improve clarity.",
    "- Return only the improved scope.",
    "",
    `Project name:\n${typeof body.projectName === "string" && body.projectName.trim() ? body.projectName.trim() : "(not provided)"}`,
    "",
    `Project type:\n${typeof body.projectType === "string" && body.projectType.trim() ? body.projectType.trim() : "(not provided)"}`,
    "",
    `Original scope:\n${scopeText}`,
  ].join("\n");
}

function parseImprovedScope(content: unknown, fallback: string): string {
  if (typeof content !== "string" || !content.trim()) {
    return fallback;
  }

  const trimmed = content.trim();

  try {
    const parsed = JSON.parse(trimmed) as { improvedScope?: string };
    if (parsed.improvedScope?.trim()) {
      return parsed.improvedScope.trim();
    }
  } catch {
    // Plain text response
  }

  return trimmed
    .replace(/^here is the improved scope[.:]?\s*/i, "")
    .replace(/^improved scope[.:]?\s*/i, "")
    .trim();
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
    const scopeText = typeof body.scopeText === "string" ? body.scopeText.trim() : "";

    if (!scopeText) {
      return new Response(JSON.stringify({ error: "scopeText is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fallback = applyContractorFurnishPrefix(scopeText);

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ improvedScope: fallback }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isUsageConfigured()) {
      return usageConfigErrorResponse(corsHeaders);
    }

    const quota = await requireUsageQuota(
      user.id,
      "ai.project_scope_professionalize",
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
          {
            role: "system",
            content:
              "You are a professional construction scope writer. Rewrite rough project descriptions into clear, professional scope-of-work language. Preserve every user-provided detail. Do not remove, reduce, or change the meaning of any user input. Do not invent major scope items that are not stated or clearly implied. Return JSON only: {\"improvedScope\":\"...\"}. The improvedScope value must contain only the rewritten scope text with no markdown or bullet points unless the original input is already a list.",
          },
          {
            role: "user",
            content: buildUserPrompt(body, scopeText),
          },
        ],
      }),
    });

    if (!openAiRes.ok) {
      console.error("OpenAI professionalize scope error:", await openAiRes.text());
      return new Response(JSON.stringify({ error: "Could not improve scope" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await openAiRes.json();
    const content = data?.choices?.[0]?.message?.content;
    const improvedScope = parseImprovedScope(content, fallback);

    if (!improvedScope.trim()) {
      return new Response(JSON.stringify({ error: "Could not improve scope" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await trackMeteredUsage(usageContext, {
      featureKey: "ai.project_scope_professionalize",
      usageUnit: "ai_request",
      requestId: req.headers.get("x-request-id"),
    });

    return new Response(JSON.stringify({ improvedScope }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("professionalize-project-scope:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
