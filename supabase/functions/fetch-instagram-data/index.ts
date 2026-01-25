const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format URL - ensure it's a proper Instagram profile URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Scraping Instagram URL:', formattedUrl);

    // Use Firecrawl to scrape the Instagram page
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown', 'html'],
        onlyMainContent: false,
        waitFor: 3000, // Wait for dynamic content to load
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Request failed with status ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Firecrawl response received');

    // Extract data from the scraped content
    const html = data.data?.html || data.html || '';
    const markdown = data.data?.markdown || data.markdown || '';
    
    // Try to extract follower count from various patterns
    let followersCount: string | null = null;
    let avatarUrl: string | null = null;

    // Pattern 1: Look for "X followers" or "X Followers" in markdown/html
    const followersPatterns = [
      /(\d+(?:[.,]\d+)*[KMkm]?)\s*(?:followers|Followers|追蹤者)/i,
      /(?:followers|Followers|追蹤者)[:\s]*(\d+(?:[.,]\d+)*[KMkm]?)/i,
      /"edge_followed_by":\s*{\s*"count":\s*(\d+)/,
      /"follower_count":\s*(\d+)/,
      /(\d+(?:[.,]\d+)*)\s*(?:位追蹤者|個追蹤者)/,
    ];

    for (const pattern of followersPatterns) {
      const match = markdown.match(pattern) || html.match(pattern);
      if (match) {
        followersCount = match[1];
        console.log('Found followers count:', followersCount);
        break;
      }
    }

    // Try to extract avatar/profile picture URL
    const avatarPatterns = [
      /"profile_pic_url(?:_hd)?"\s*:\s*"([^"]+)"/,
      /src="(https:\/\/[^"]*(?:instagram|cdninstagram|fbcdn)[^"]*(?:jpg|jpeg|png)[^"]*)"/i,
      /<img[^>]+class="[^"]*profile[^"]*"[^>]+src="([^"]+)"/i,
    ];

    for (const pattern of avatarPatterns) {
      const match = html.match(pattern);
      if (match) {
        avatarUrl = match[1].replace(/\\u0026/g, '&');
        console.log('Found avatar URL');
        break;
      }
    }

    // If we found data and have an itemId, update the database
    if (itemId && (followersCount || avatarUrl)) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      
      const updateData: Record<string, string> = {};
      if (followersCount) {
        updateData.followers_count = followersCount;
      }
      
      const updateResponse = await fetch(
        `${supabaseUrl}/rest/v1/page_items?id=eq.${itemId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify(updateData),
        }
      );

      if (!updateResponse.ok) {
        console.error('Failed to update database');
      } else {
        console.log('Database updated successfully');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        followersCount,
        avatarUrl,
        message: followersCount ? '成功獲取資料' : '無法從頁面擷取追蹤者數量，Instagram 可能已阻擋抓取',
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
