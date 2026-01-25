const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract Instagram username from URL
function getInstagramUsername(url: string): string | null {
  const match = url.match(/instagram\.com\/([^/?#]+)/);
  if (match && match[1] && !['p', 'reel', 'stories', 'explore'].includes(match[1])) {
    return match[1];
  }
  return null;
}

// Best-effort extraction of follower count from Instagram profile HTML.
// Returns a raw integer if found.
function extractFollowersFromProfileHtml(html: string): number | null {
  const patterns: RegExp[] = [
    // Common embedded JSON pattern
    /"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/,
    // Alternative JSON keys that occasionally show up
    /"follower_count"\s*:\s*(\d+)/,
    /"followers"\s*:\s*\{\s*"count"\s*:\s*(\d+)/,
  ];

  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, itemId } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const username = getInstagramUsername(url);
    if (!username) {
      return new Response(
        JSON.stringify({ success: false, error: '無法從 URL 擷取 Instagram 用戶名' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching Instagram data for username:', username);

    // Method 1: Fetch public profile HTML and parse follower count.
    // This avoids stale/estimated values from search results.
    try {
      const profileUrl = `https://www.instagram.com/${username}/`;
      const profileResponse = await fetch(profileUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (profileResponse.ok) {
        const html = await profileResponse.text();
        const followers = extractFollowersFromProfileHtml(html);
        if (followers !== null) {
          console.log('Found followers via profile HTML:', followers);
          return new Response(
            JSON.stringify({
              success: true,
              followersCount: followers.toString(),
              method: 'profile-html',
              message: '成功透過公開頁面解析獲取資料',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } catch (htmlError) {
      console.log('Profile HTML attempt failed:', htmlError);
    }

    // Method 2: Try using Lovable AI with web search capability (may be stale/estimated)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (LOVABLE_API_KEY) {
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              {
                role: 'system',
                content: `You are a data extraction assistant. When asked about an Instagram account, search for the most recent public information available and extract the follower count. Return ONLY a JSON object with this exact format: {"followers": "NUMBER", "found": true} or {"found": false, "reason": "explanation"}. The followers number should be the raw number (e.g., "15000" or "1.5M" or "150K"). Do not include any other text.`
              },
              {
                role: 'user',
                content: `What is the current follower count for the Instagram account @${username}? Search for the most recent publicly available information about this account.`
              }
            ],
            temperature: 0.1,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || '';
          console.log('AI response:', content);

          // Try to parse the JSON response
          try {
            // Extract JSON from the response (in case there's extra text)
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.found && parsed.followers) {
                console.log('Found followers via AI:', parsed.followers);
                return new Response(
                  JSON.stringify({
                    success: true,
                    followersCount: parsed.followers,
                    method: 'ai-search',
                    message: '成功透過 AI 搜尋獲取資料',
                  }),
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            }
          } catch (parseError) {
            console.log('Failed to parse AI response as JSON:', parseError);
          }
        } else {
          const errorText = await aiResponse.text();
          console.error('AI API error:', aiResponse.status, errorText);
        }
      } catch (aiError) {
        console.error('AI search failed:', aiError);
      }
    }

    // Method 3: Try public Instagram API endpoints (may be blocked but worth trying)
    try {
      // Try the public web profile info endpoint
      const webResponse = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'X-IG-App-ID': '936619743392459',
        },
      });

      if (webResponse.ok) {
        const webData = await webResponse.json();
        const followerCount = webData?.data?.user?.edge_followed_by?.count;
        if (followerCount !== undefined) {
          console.log('Found followers via web API:', followerCount);
          return new Response(
            JSON.stringify({
              success: true,
              followersCount: followerCount.toString(),
              method: 'web-api',
              message: '成功透過 Instagram API 獲取資料',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } catch (webError) {
      console.log('Web API attempt failed:', webError);
    }

    // Method 4: Try i.instagram.com API
    try {
      const mobileResponse = await fetch(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
        headers: {
          'User-Agent': 'Instagram 219.0.0.12.117 Android',
          'Accept': 'application/json',
        },
      });

      if (mobileResponse.ok) {
        const mobileData = await mobileResponse.json();
        const followerCount = mobileData?.data?.user?.edge_followed_by?.count || 
                              mobileData?.user?.follower_count;
        if (followerCount !== undefined) {
          console.log('Found followers via mobile API:', followerCount);
          return new Response(
            JSON.stringify({
              success: true,
              followersCount: followerCount.toString(),
              method: 'mobile-api',
              message: '成功透過 Instagram API 獲取資料',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } catch (mobileError) {
      console.log('Mobile API attempt failed:', mobileError);
    }

    // All methods failed
    return new Response(
      JSON.stringify({
        success: false,
        error: '所有方法皆無法獲取 Instagram 資料。建議手動輸入追蹤者數量，或使用官方 Instagram Graph API。',
        triedMethods: ['profile-html', 'ai-search', 'web-api', 'mobile-api'],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching Instagram data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch Instagram data';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
