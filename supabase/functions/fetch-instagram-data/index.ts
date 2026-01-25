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

// Parse follower count from various text formats
function parseFollowerCount(text: string): number | null {
  // Try exact number patterns like "9,094 followers" or "9094 Followers"
  const exactMatch = text.match(/([\d,]+)\s*(?:followers|追蹤者)/i);
  if (exactMatch) {
    const num = parseInt(exactMatch[1].replace(/,/g, ''), 10);
    if (Number.isFinite(num) && num >= 0) return num;
  }

  // Try patterns with K/M suffix like "1.5M followers" or "15K Followers"
  const suffixMatch = text.match(/([\d.]+)\s*([KkMm])\s*(?:followers|追蹤者)/i);
  if (suffixMatch) {
    const base = parseFloat(suffixMatch[1]);
    const suffix = suffixMatch[2].toUpperCase();
    if (Number.isFinite(base)) {
      const multiplier = suffix === 'M' ? 1000000 : 1000;
      return Math.round(base * multiplier);
    }
  }

  return null;
}

// Best-effort extraction of follower count from Instagram profile HTML.
function extractFollowersFromProfileHtml(html: string): number | null {
  const patterns: RegExp[] = [
    // Common embedded JSON pattern
    /"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/,
    // Alternative JSON keys
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
    const profileUrl = `https://www.instagram.com/${username}/`;

    // ===== Method 1: Use Firecrawl to scrape profile page =====
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (FIRECRAWL_API_KEY) {
      try {
        console.log('Trying Firecrawl scrape...');
        const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: profileUrl,
            formats: ['markdown', 'html'],
            onlyMainContent: false,
            waitFor: 3000, // Wait for JS to load
          }),
        });

        if (firecrawlResponse.ok) {
          const firecrawlData = await firecrawlResponse.json();
          console.log('Firecrawl response received');

          // Try to extract from the scraped HTML first
          const scrapedHtml = firecrawlData.data?.html || firecrawlData.html || '';
          if (scrapedHtml) {
            const htmlFollowers = extractFollowersFromProfileHtml(scrapedHtml);
            if (htmlFollowers !== null) {
              console.log('Found followers via Firecrawl HTML:', htmlFollowers);
              return new Response(
                JSON.stringify({
                  success: true,
                  followersCount: htmlFollowers.toString(),
                  method: 'firecrawl-html',
                  message: '成功透過 Firecrawl 解析獲取資料',
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }

          // Try to parse from markdown content
          const markdown = firecrawlData.data?.markdown || firecrawlData.markdown || '';
          if (markdown) {
            const markdownFollowers = parseFollowerCount(markdown);
            if (markdownFollowers !== null) {
              console.log('Found followers via Firecrawl markdown:', markdownFollowers);
              return new Response(
                JSON.stringify({
                  success: true,
                  followersCount: markdownFollowers.toString(),
                  method: 'firecrawl-markdown',
                  message: '成功透過 Firecrawl 解析獲取資料',
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        } else {
          const errorText = await firecrawlResponse.text();
          console.log('Firecrawl API error:', firecrawlResponse.status, errorText);
        }
      } catch (firecrawlError) {
        console.log('Firecrawl attempt failed:', firecrawlError);
      }
    }

    // ===== Method 2: Direct fetch of public profile HTML =====
    try {
      console.log('Trying direct profile HTML fetch...');
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

    // ===== Method 3: Try public Instagram API endpoints =====
    try {
      console.log('Trying web API...');
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

    // ===== Method 4: Try i.instagram.com API =====
    try {
      console.log('Trying mobile API...');
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

    // ===== Method 5: Use Lovable AI as last resort (may be stale/estimated) =====
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (LOVABLE_API_KEY) {
      try {
        console.log('Trying Lovable AI search (last resort)...');
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
                content: `You are a data extraction assistant. When asked about an Instagram account, search for the most recent public information available and extract the follower count. Return ONLY a JSON object with this exact format: {"followers": "NUMBER", "found": true} or {"found": false, "reason": "explanation"}. The followers number should be the raw number (e.g., "15000" not "15K"). Do not include any other text.`
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

          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.found && parsed.followers) {
                // Mark as estimate if it looks like a rounded/estimated value
                const rawFollowers = String(parsed.followers);
                const isEstimate = /[KkMm]$/.test(rawFollowers) || 
                                   (rawFollowers.length > 3 && rawFollowers.endsWith('00'));
                
                console.log('Found followers via AI:', parsed.followers, isEstimate ? '(estimate)' : '');
                return new Response(
                  JSON.stringify({
                    success: true,
                    followersCount: parsed.followers,
                    method: 'ai-search',
                    isEstimate,
                    message: isEstimate 
                      ? '透過 AI 搜尋獲取資料（可能為估算值）' 
                      : '成功透過 AI 搜尋獲取資料',
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

    // All methods failed
    return new Response(
      JSON.stringify({
        success: false,
        error: '所有方法皆無法獲取 Instagram 資料。建議手動輸入追蹤者數量，或使用官方 Instagram Graph API。',
        triedMethods: ['firecrawl', 'profile-html', 'web-api', 'mobile-api', 'ai-search'],
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
