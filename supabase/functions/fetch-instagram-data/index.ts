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

    // Instagram is commonly blocked from scraping (TOS/technical). Avoid returning non-2xx
    // so the frontend doesn't treat it as a hard error.
    if (formattedUrl.includes('instagram.com') || formattedUrl.includes('instagr.am')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Instagram 不支援自動抓取（已被封鎖/條款限制），請改用官方 API 或手動維護數據。',
          status: 403,
          blocklisted: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scraping URL:', formattedUrl);

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
        JSON.stringify({
          success: false,
          error: data.error || `Request failed with status ${response.status}`,
          status: response.status,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
    // Always return 200 so the client can show a friendly message instead of crashing on non-2xx.
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, status: 500 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
