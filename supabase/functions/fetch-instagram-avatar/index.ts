const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract profile picture URL from Instagram page HTML
function extractProfilePicFromHtml(html: string): string | null {
  const patterns: RegExp[] = [
    // og:image meta tag - most reliable
    /<meta\s+property="og:image"\s+content="([^"]+)"/i,
    /<meta\s+content="([^"]+)"\s+property="og:image"/i,
    // JSON embedded data patterns
    /"profile_pic_url_hd"\s*:\s*"([^"]+)"/,
    /"profile_pic_url"\s*:\s*"([^"]+)"/,
    /"hd_profile_pic_url_info"\s*:\s*\{\s*"url"\s*:\s*"([^"]+)"/,
    // Twitter card image
    /<meta\s+name="twitter:image"\s+content="([^"]+)"/i,
    /<meta\s+content="([^"]+)"\s+name="twitter:image"/i,
  ];

  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      // Unescape unicode characters and HTML entities
      let url = m[1]
        .replace(/\\u0026/g, '&')
        .replace(/\\u003d/g, '=')
        .replace(/\\\//g, '/')
        .replace(/&amp;/g, '&');
      
      // Validate it's a proper Instagram CDN URL
      if (url.includes('cdninstagram.com') || url.includes('fbcdn.net') || url.includes('instagram')) {
        return url;
      }
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username } = await req.json();

    if (!username) {
      return new Response(
        JSON.stringify({ success: false, error: 'Username is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching Instagram avatar for username:', username);
    const profileUrl = `https://www.instagram.com/${username}/`;

    // Method 1: Try Instagram web API first (fastest when it works)
    try {
      console.log('Trying Instagram web API...');
      const webResponse = await fetch(
        `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'X-IG-App-ID': '936619743392459',
            'X-Requested-With': 'XMLHttpRequest',
          },
        }
      );

      if (webResponse.ok) {
        const data = await webResponse.json();
        const avatarUrl = data?.data?.user?.profile_pic_url_hd || data?.data?.user?.profile_pic_url;
        if (avatarUrl) {
          console.log('Found avatar URL via web API');
          return new Response(
            JSON.stringify({
              success: true,
              avatarUrl,
              method: 'web-api',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } catch (err) {
      console.log('Web API fetch failed:', err);
    }

    // Method 2: Try direct Instagram page fetch with mobile user agent
    try {
      console.log('Trying direct Instagram HTML fetch with mobile UA...');
      const response = await fetch(profileUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (response.ok) {
        const html = await response.text();
        const avatarUrl = extractProfilePicFromHtml(html);
        if (avatarUrl) {
          console.log('Found avatar URL via mobile HTML');
          return new Response(
            JSON.stringify({
              success: true,
              avatarUrl,
              method: 'mobile-html',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } catch (err) {
      console.log('Mobile HTML fetch failed:', err);
    }

    // Method 3: Try Firecrawl if available
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (FIRECRAWL_API_KEY) {
      try {
        console.log('Trying Firecrawl scrape for avatar...');
        const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: profileUrl,
            formats: ['html'],
            waitFor: 2000,
          }),
        });

        if (firecrawlResponse.ok) {
          const fcData = await firecrawlResponse.json();
          const html = fcData.data?.html || '';
          const avatarUrl = extractProfilePicFromHtml(html);
          if (avatarUrl) {
            console.log('Found avatar URL via Firecrawl');
            return new Response(
              JSON.stringify({
                success: true,
                avatarUrl,
                method: 'firecrawl',
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (err) {
        console.log('Firecrawl fetch failed:', err);
      }
    }

    // Method 4: Use AI to get the avatar URL (with timeout)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (LOVABLE_API_KEY) {
      try {
        console.log('Trying AI search for avatar...');
        
        // Create AbortController with 5 second timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash', // Use faster model
            messages: [
              {
                role: 'system',
                content: 'Return ONLY JSON: {"found":true,"avatarUrl":"URL"} or {"found":false}. No other text.',
              },
              {
                role: 'user',
                content: `Instagram profile picture URL for @${username}?`,
              },
            ],
            temperature: 0,
            max_tokens: 200,
          }),
        });
        
        clearTimeout(timeoutId);

        if (aiResponse.ok) {
          const data = await aiResponse.json();
          const content = data.choices?.[0]?.message?.content || '';
          console.log('AI response:', content);
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed?.found && parsed?.avatarUrl?.startsWith('http')) {
                console.log('Found avatar URL via AI');
                return new Response(
                  JSON.stringify({
                    success: true,
                    avatarUrl: parsed.avatarUrl,
                    method: 'ai-search',
                  }),
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            } catch {
              console.log('Failed to parse AI JSON response');
            }
          }
        }
      } catch (err) {
        console.log('AI search failed:', err);
      }
    }

    // All methods failed - return a placeholder based on username initial
    // This at least gives something visual
    console.log('All methods failed, returning failure');
    return new Response(
      JSON.stringify({
        success: false,
        error: '無法獲取 Instagram 頭像',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching Instagram avatar:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
