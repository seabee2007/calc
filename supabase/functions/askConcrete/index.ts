// supabase/functions/askConcrete/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, X-Client-Info, apikey, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // 1) CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // 2) Read and validate the body
    const { question } = await req.json();
    if (!question || typeof question !== "string") {
      return new Response(
        JSON.stringify({ error: "Valid 'question' field is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Call OpenAI
    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        temperature: 0.3,
        max_tokens: 512,
        messages: [
          {
            role: "system",
            content:
              "You are a friendly, expert assistant on everything about concrete—mix design, volume, curing, best practices.",
          },
          { role: "user", content: question },
        ],
      }),
    });

    if (!openAiRes.ok) {
      const errText = await openAiRes.text();
      console.error("OpenAI API error:", errText);
      return new Response(
        JSON.stringify({ error: "OpenAI API returned an error" }),
        { status: openAiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4) Parse and return
    const { choices } = await openAiRes.json();
    const answer = choices?.[0]?.message?.content?.trim() ?? "Sorry, no answer returned.";
    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("askConcrete exception:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
