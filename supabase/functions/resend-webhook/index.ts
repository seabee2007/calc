import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Webhook } from "npm:svix";
import { corsHeaders } from "../_shared/cors.ts";
import { readEmailEnvConfig } from "../_shared/emailConfig.ts";
import { updateEmailEventByResendId } from "../_shared/emailEvents.ts";
import { mapResendWebhookStatus } from "../_shared/emailValidation.ts";

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

    const config = readEmailEnvConfig(Deno.env.toObject());
    const payload = await req.text();

    if (!config.webhookSecret) {
      return new Response(JSON.stringify({ error: "Webhook secret not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers = {
      "svix-id": req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    };

    const wh = new Webhook(config.webhookSecret);
    let event: { type?: string; data?: Record<string, unknown> };
    try {
      event = wh.verify(payload, headers) as { type?: string; data?: Record<string, unknown> };
    } catch {
      return new Response(JSON.stringify({ error: "Invalid webhook signature." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventType = typeof event.type === "string" ? event.type : "";
    const mappedStatus = mapResendWebhookStatus(eventType);
    const emailId =
      typeof event.data?.email_id === "string"
        ? event.data.email_id
        : typeof event.data?.id === "string"
          ? event.data.id
          : null;

    if (mappedStatus && emailId) {
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await updateEmailEventByResendId(admin, emailId, {
        status: mappedStatus,
        metadata: {
          webhookEvent: eventType,
          webhookAt: new Date().toISOString(),
        },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
