import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user is admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get request body
    const { action, title, content, value } = await req.json();

    if (!action || (!title && !content)) {
      return new Response(JSON.stringify({ error: "Missing action or identifier (title/content)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the Google Apps Script Web App URL from secrets
    const appsScriptUrl = Deno.env.get("GOOGLE_APPS_SCRIPT_URL");
    
    if (!appsScriptUrl) {
      return new Response(JSON.stringify({ error: "Google Apps Script URL not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call the Google Apps Script - send content for matching since title may be empty
    console.log("Calling Apps Script with:", { action, title, content: content?.substring(0, 50), value: value || "刪除" });
    console.log("Apps Script URL:", appsScriptUrl.substring(0, 50) + "...");
    
    const response = await fetch(appsScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        title,
        content, // Send content for matching
        value: value || "刪除",
      }),
      redirect: "follow", // Important: Apps Script redirects after execution
    });

    console.log("Apps Script response status:", response.status);
    const responseText = await response.text();
    console.log("Apps Script response:", responseText);

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      console.error("Failed to parse response as JSON:", responseText);
      throw new Error("Invalid response from Apps Script");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: result.message || "更新成功",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Update error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
