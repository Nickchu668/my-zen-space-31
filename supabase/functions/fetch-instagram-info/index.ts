import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, itemId } = await req.json();

    if (!url || !itemId) {
      return new Response(
        JSON.stringify({ error: "Missing url or itemId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract username from Instagram URL
    const usernameMatch = url.match(/instagram\.com\/([^/?]+)/);
    if (!usernameMatch) {
      return new Response(
        JSON.stringify({ error: "Invalid Instagram URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const username = usernameMatch[1];
    console.log("Fetching Instagram info for:", username);

    // Try to fetch profile info using a public endpoint
    let followersCount = null;
    
    try {
      // Use i.instagram.com API (public, no auth required for basic info)
      const response = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
          "X-IG-App-ID": "936619743392459",
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data?.data?.user?.edge_followed_by?.count) {
          followersCount = formatFollowerCount(data.data.user.edge_followed_by.count);
        }
      }
    } catch (e) {
      console.log("Instagram API fetch failed, trying alternative method:", e);
    }

    // If API failed, try scraping the page
    if (!followersCount) {
      try {
        const pageResponse = await fetch(`https://www.instagram.com/${username}/`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
          },
        });
        
        if (pageResponse.ok) {
          const html = await pageResponse.text();
          
          // Try to extract followers from meta tags or embedded data
          const followersMatch = html.match(/(\d[\d,.]*[KkMm]?)\s*(?:Followers|followers|追蹤者)/i);
          if (followersMatch) {
            followersCount = followersMatch[1];
          } else {
            // Try alternative pattern for embedded JSON
            const jsonMatch = html.match(/"edge_followed_by":\s*\{"count":\s*(\d+)\}/);
            if (jsonMatch) {
              followersCount = formatFollowerCount(parseInt(jsonMatch[1]));
            }
          }
        }
      } catch (e) {
        console.log("Page scraping failed:", e);
      }
    }

    // Update the page_item in database if we got follower count
    if (followersCount) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error: updateError } = await supabase
        .from("page_items")
        .update({ followers_count: followersCount })
        .eq("id", itemId);

      if (updateError) {
        console.error("Error updating page_item:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        username,
        followers_count: followersCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch Instagram info";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function formatFollowerCount(count: number): string {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  } else if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return count.toString();
}
