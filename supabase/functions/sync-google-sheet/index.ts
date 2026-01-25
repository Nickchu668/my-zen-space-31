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
  // Parse CSV properly handling multi-line quoted fields
  const records = parseCSVRecords(csvText);
  if (records.length < 2) return [];

  // First row is headers
  const headers = records[0];
  console.log("Detected headers:", headers);

  // Find title and content column indices
  const headerLower = headers.map(h => h.toLowerCase().trim());
  
  let titleIdx = headerLower.findIndex(h => h === 'title' || h === '標題');
  if (titleIdx === -1) {
    titleIdx = headerLower.findIndex(h => h.includes('title') || h.includes('標題'));
  }
  
  let contentIdx = headerLower.findIndex(h => h === 'content' || h === '內容');
  if (contentIdx === -1) {
    contentIdx = headerLower.findIndex(h => 
      h.includes('content') || h.includes('內容') || h.includes('note') || h.includes('筆記')
    );
  }

  if (titleIdx === -1 && headers.length > 0) titleIdx = 0;
  if (contentIdx === -1 && headers.length > 1) contentIdx = 1;
  
  console.log("Title column index:", titleIdx, "Content column index:", contentIdx);

  const rows: SheetRow[] = [];
  
  for (let i = 1; i < records.length; i++) {
    const values = records[i];
    
    let title = titleIdx >= 0 && titleIdx < values.length ? values[titleIdx].trim() : '';
    let content = contentIdx >= 0 && contentIdx < values.length ? values[contentIdx].trim() : '';

    // If title is empty but content exists, use content as title (truncated)
    if (!title && content) {
      // Get first line of content as title
      const firstLine = content.split('\n')[0].trim();
      title = firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
    }

    if (title) {
      rows.push({ title, content });
    }
  }

  return rows;
}

// Properly parse CSV with multi-line quoted fields
function parseCSVRecords(csvText: string): string[][] {
  const records: string[][] = [];
  let currentRecord: string[] = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++;
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        // Any character inside quotes (including newlines)
        currentField += char;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
      } else if (char === ',') {
        // Field separator
        currentRecord.push(currentField);
        currentField = '';
      } else if (char === '\r' && nextChar === '\n') {
        // Windows line ending - skip \r
        continue;
      } else if (char === '\n' || char === '\r') {
        // End of record
        currentRecord.push(currentField);
        if (currentRecord.some(f => f.trim())) {
          records.push(currentRecord);
        }
        currentRecord = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }
  
  // Don't forget the last field and record
  if (currentField || currentRecord.length > 0) {
    currentRecord.push(currentField);
    if (currentRecord.some(f => f.trim())) {
      records.push(currentRecord);
    }
  }
  
  return records;
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
