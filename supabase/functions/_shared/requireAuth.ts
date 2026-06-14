/**
 * requireAuth — shared JWT validation helper for Supabase Edge Functions.
 *
 * Usage:
 *   const authResult = await requireAuth(req);
 *   if (!authResult.ok) return authResult.response;
 *   const { user } = authResult;
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const UNAUTHORIZED_RESPONSE = (corsHeaders: Record<string, string>) =>
  new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export type AuthSuccess = {
  ok: true;
  user: { id: string; email?: string };
};

export type AuthFailure = {
  ok: false;
  response: Response;
};

export async function requireAuth(
  req: Request,
  corsHeaders: Record<string, string> = {},
): Promise<AuthSuccess | AuthFailure> {
  if (!SUPABASE_URL) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, response: UNAUTHORIZED_RESPONSE(corsHeaders) };
  }

  const jwt = authHeader.slice(7);
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();

  if (error || !user) {
    return { ok: false, response: UNAUTHORIZED_RESPONSE(corsHeaders) };
  }

  return { ok: true, user: { id: user.id, email: user.email } };
}
