import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, itemId } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is an Instagram URL
    if (!url.includes('instagram.com')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not an Instagram URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format URL - ensure it's the profile page
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Scraping Instagram URL:', formattedUrl);

    // Use Firecrawl to scrape the Instagram page
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown', 'html'],
        onlyMainContent: false,
        waitFor: 3000, // Wait for dynamic content
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Firecrawl request failed with status ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract follower count from the scraped content
    const content = data.data?.markdown || data.markdown || '';
    const html = data.data?.html || data.html || '';
    
    console.log('Scraped content length:', content.length);
    
    // Try multiple patterns to find follower count
    let followersCount: string | null = null;
    
    // Pattern 1: "X followers" format (English)
    const englishMatch = content.match(/(\d+(?:[.,]\d+)?(?:[KMkm])?)\s*[Ff]ollowers/i);
    if (englishMatch) {
      followersCount = englishMatch[1];
    }
    
    // Pattern 2: "粉絲" format (Chinese)
    if (!followersCount) {
      const chineseMatch = content.match(/(\d+(?:[.,]\d+)?(?:[KMkm萬])?)\s*(?:位)?粉絲/);
      if (chineseMatch) {
        followersCount = chineseMatch[1];
      }
    }
    
    // Pattern 3: Look for meta data in HTML
    if (!followersCount) {
      const metaMatch = html.match(/\"edge_followed_by\":\s*\{\"count\":\s*(\d+)\}/);
      if (metaMatch) {
        followersCount = metaMatch[1];
      }
    }
    
    // Pattern 4: Check for number patterns near "follower" text
    if (!followersCount) {
      const numberMatch = content.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?[KMkm]?)\s*(?:follower|追蹤|粉絲)/i);
      if (numberMatch) {
        followersCount = numberMatch[1];
      }
    }

    console.log('Extracted followers count:', followersCount);

    // If we have an itemId and followers count, update the database
    if (itemId && followersCount) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { error: updateError } = await supabase
        .from('page_items')
        .update({ followers_count: followersCount })
        .eq('id', itemId);

      if (updateError) {
        console.error('Error updating database:', updateError);
      } else {
        console.log('Database updated successfully');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        followersCount,
        rawContentPreview: content.substring(0, 500)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching Instagram data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch Instagram data';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
