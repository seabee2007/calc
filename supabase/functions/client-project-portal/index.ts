import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { buildClientPortalSafePayload } from "../_shared/clientPortalBuilder.ts";

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
        "id, name, pour_date, jobsite_city, jobsite_state, created_at, user_id, placement_order",
      )
      .eq("id", portal.project_id)
      .maybeSingle();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: "Portal not found or expired." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: company }, { data: proposal }, { data: qcRecords }] = await Promise.all([
      supabase
        .from("company_settings")
        .select("company_name, email, phone, logo_url")
        .eq("user_id", project.user_id)
        .maybeSingle(),
      supabase
        .from("proposals")
        .select("status, public_token, sent_at, accepted_at, deposit_paid_at")
        .eq("project_id", project.id)
        .neq("status", "draft")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("qc_records")
        .select("record_type, record_data, test_age_days, date")
        .eq("project_id", project.id),
    ]);

    const origin = req.headers.get("origin") ??
      req.headers.get("referer")?.replace(/\/[^/]*$/, "") ??
      "https://concrete-calc.com";

    const payload = buildClientPortalSafePayload({
      origin,
      project,
      company,
      proposal,
      qcRecords: qcRecords ?? [],
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
