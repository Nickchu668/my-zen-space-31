import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHEET_ID = "1PqJ1H1vYQlE_cXi48woNUG03RBK3eSkmZY1GQoI0w14";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

interface SheetRow {
  title: string;
  content: string;
  [key: string]: string;
}

function parseCSV(csvText: string): SheetRow[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  // Parse header row
  const headers = parseCSVLine(lines[0]);
  console.log("Detected headers:", headers);

  // Parse data rows
  const rows: SheetRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: SheetRow = { title: '', content: '' };
    
    headers.forEach((header, index) => {
      const value = values[index] || '';
      row[header.toLowerCase().trim()] = value;
    });

    // Auto-detect title and content columns
    // Priority: exact match > contains match > first two columns
    let titleKey = headers.find(h => h.toLowerCase() === 'title' || h.toLowerCase() === '標題');
    let contentKey = headers.find(h => h.toLowerCase() === 'content' || h.toLowerCase() === '內容');

    if (!titleKey) {
      titleKey = headers.find(h => h.toLowerCase().includes('title') || h.toLowerCase().includes('標題'));
    }
    if (!contentKey) {
      contentKey = headers.find(h => h.toLowerCase().includes('content') || h.toLowerCase().includes('內容') || h.toLowerCase().includes('note') || h.toLowerCase().includes('筆記'));
    }

    // Fallback to first two columns
    if (!titleKey && headers.length > 0) titleKey = headers[0];
    if (!contentKey && headers.length > 1) contentKey = headers[1];

    row.title = titleKey ? (row[titleKey.toLowerCase().trim()] || '') : '';
    row.content = contentKey ? (row[contentKey.toLowerCase().trim()] || '') : '';

    // Skip empty rows
    if (row.title || row.content) {
      rows.push(row);
    }
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

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

    // Fetch Google Sheet
    console.log("Fetching Google Sheet from:", CSV_URL);
    const response = await fetch(CSV_URL);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch sheet: ${response.status}`);
    }

    const csvText = await response.text();
    console.log("CSV content length:", csvText.length);

    const rows = parseCSV(csvText);
    console.log("Parsed rows:", rows.length);

    // Get existing notes
    const { data: existingNotes } = await supabaseClient
      .from("notes")
      .select("id, title, content")
      .eq("user_id", user.id);

    const existingTitles = new Set(existingNotes?.map(n => n.title) || []);

    // Insert new notes (avoid duplicates by title)
    let insertedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
      if (!row.title) continue;

      if (existingTitles.has(row.title)) {
        skippedCount++;
        continue;
      }

      const { error: insertError } = await supabaseClient
        .from("notes")
        .insert({
          user_id: user.id,
          title: row.title,
          content: row.content || null,
        });

      if (insertError) {
        console.error("Insert error:", insertError);
      } else {
        insertedCount++;
        existingTitles.add(row.title);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `同步完成`,
        stats: {
          total: rows.length,
          inserted: insertedCount,
          skipped: skippedCount,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
