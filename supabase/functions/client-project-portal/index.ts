import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { buildClientPortalSafePayload } from "../_shared/clientPortalBuilder.ts";
import {
  resolveProposalForProject,
  type PortalProposalRow,
} from "../_shared/projectLifecycle.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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

    const body = await req.json();
    const token = String(body.token ?? "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Token is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: portal, error: portalError } = await supabase
      .from("client_portals")
      .select("id, project_id, client_name, is_active")
      .eq("token", token)
      .eq("is_active", true)
      .maybeSingle();

    if (portalError || !portal) {
      return new Response(JSON.stringify({ error: "Portal not found or expired." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select(
        "id, name, pour_date, jobsite_city, jobsite_state, created_at, user_id, placement_order, custom_estimates",
      )
      .eq("id", portal.project_id)
      .maybeSingle();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: "Portal not found or expired." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [
      { data: company },
      { data: proposalRows },
      { data: qcRecords },
      { count: calculationsCount },
      { data: laborEstimate },
      { data: contractRows },
    ] = await Promise.all([
      supabase
        .from("company_settings")
        .select("company_name, email, phone, logo_url")
        .eq("user_id", project.user_id)
        .maybeSingle(),
      supabase
        .from("proposals")
        .select(
          "status, public_token, sent_at, accepted_at, deposit_paid_at, title, data, project_id, updated_at",
        )
        .eq("user_id", project.user_id)
        .order("updated_at", { ascending: false })
        .limit(100),
      supabase
        .from("qc_records")
        .select("record_type, record_data, test_age_days, date")
        .eq("project_id", project.id),
      supabase
        .from("calculations")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project.id),
      supabase
        .from("labor_estimates")
        .select("id")
        .eq("project_id", project.id)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("contract_documents")
        .select("public_token, title, signing_status, sent_at, signed_at, public_token_expires_at, public_token_revoked_at")
        .eq("project_id", project.id)
        .in("signing_status", ["sent", "viewed", "signed"])
        .is("public_token_revoked_at", null)
        .order("updated_at", { ascending: false })
        .limit(25),
    ]);

    const proposal = resolveProposalForProject(
      { id: project.id, name: project.name },
      (proposalRows ?? []) as PortalProposalRow[],
    );

    const origin = req.headers.get("origin") ??
      req.headers.get("referer")?.replace(/\/[^/]*$/, "") ??
      "https://concrete-calc.com";

    const payload = buildClientPortalSafePayload({
      origin,
      project,
      company,
      proposal,
      qcRecords: qcRecords ?? [],
      calculationsCount: calculationsCount ?? 0,
      hasLaborEstimate: Boolean(laborEstimate),
      contracts: contractRows ?? [],
    });

    await supabase
      .from("client_portals")
      .update({ last_viewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", portal.id);

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("client-project-portal exception:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
