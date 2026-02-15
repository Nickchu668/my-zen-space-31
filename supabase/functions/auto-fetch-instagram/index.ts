const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Combined edge function: fetches Instagram avatar URL and follower count
 * for a given username. Returns both in a single call for efficiency.
 */

function extractProfilePicFromHtml(html: string): string | null {
  const patterns: RegExp[] = [
    /<meta\s+property="og:image"\s+content="([^"]+)"/i,
    /<meta\s+content="([^"]+)"\s+property="og:image"/i,
    /"profile_pic_url_hd"\s*:\s*"([^"]+)"/,
    /"profile_pic_url"\s*:\s*"([^"]+)"/,
    /"hd_profile_pic_url_info"\s*:\s*\{\s*"url"\s*:\s*"([^"]+)"/,
    /<meta\s+name="twitter:image"\s+content="([^"]+)"/i,
    /<meta\s+content="([^"]+)"\s+name="twitter:image"/i,
  ];

  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      let url = m[1]
        .replace(/\\u0026/g, '&')
        .replace(/\\u003d/g, '=')
        .replace(/\\\//g, '/')
        .replace(/&amp;/g, '&');
      if (url.includes('cdninstagram.com') || url.includes('fbcdn.net') || url.includes('instagram')) {
        return url;
      }
    }
  }
  return null;
}

function extractFollowersFromHtml(html: string): number | null {
  const patterns: RegExp[] = [
    /"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/,
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

function parseAiFollowers(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (/^\d[\d,]*$/.test(raw)) {
    const n = Number(raw.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  const suffix = raw.match(/^([\d.]+)\s*([KkMm])$/);
  if (suffix) {
    const base = Number(suffix[1]);
    if (!Number.isFinite(base)) return null;
    const mult = suffix[2].toUpperCase() === 'M' ? 1_000_000 : 1_000;
    return Math.round(base * mult);
  }
  return null;
}

interface FetchResult {
  avatarUrl: string | null;
  followersCount: number | null;
  method: string;
}

async function tryUnavatar(username: string): Promise<string | null> {
  try {
    const resp = await fetch(`https://unavatar.io/instagram/${username}?fallback=false`, {
      redirect: 'follow',
    });
    if (resp.ok) {
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.startsWith('image/')) {
        // Return the final URL (after redirects)
        return resp.url || `https://unavatar.io/instagram/${username}`;
      }
    }
    await resp.text(); // consume body
  } catch {}
  return null;
}

async function tryWebApi(username: string): Promise<FetchResult> {
  const resp = await fetch(
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
  if (!resp.ok) return { avatarUrl: null, followersCount: null, method: 'web-api' };
  const data = await resp.json();
  const user = data?.data?.user;
  return {
    avatarUrl: user?.profile_pic_url_hd || user?.profile_pic_url || null,
    followersCount: user?.edge_followed_by?.count ?? user?.follower_count ?? null,
    method: 'web-api',
  };
}

async function tryHtmlFetch(username: string): Promise<FetchResult> {
  const resp = await fetch(`https://www.instagram.com/${username}/`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!resp.ok) { await resp.text(); return { avatarUrl: null, followersCount: null, method: 'html' }; }
  const html = await resp.text();
  return {
    avatarUrl: extractProfilePicFromHtml(html),
    followersCount: extractFollowersFromHtml(html),
    method: 'html',
  };
}

async function tryFirecrawl(username: string, apiKey: string): Promise<FetchResult> {
  const resp = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: `https://www.instagram.com/${username}/`,
      formats: ['html'],
      waitFor: 3000,
    }),
  });
  if (!resp.ok) { await resp.text(); return { avatarUrl: null, followersCount: null, method: 'firecrawl' }; }
  const data = await resp.json();
  const html = data.data?.html || '';
  return {
    avatarUrl: extractProfilePicFromHtml(html),
    followersCount: extractFollowersFromHtml(html),
    method: 'firecrawl',
  };
}

async function tryAiConsensus(username: string, apiKey: string): Promise<{ followersCount: number | null; confidence: string }> {
  const models = ['google/gemini-3-flash-preview', 'google/gemini-2.5-pro', 'openai/gpt-5-mini'];
  const results = await Promise.all(models.map(async (model) => {
    try {
      const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'Return ONLY JSON: {"found":true,"followers":NUMBER} or {"found":false}. followers MUST be an integer. No other text.' },
            { role: 'user', content: `Current follower count for Instagram @${username}?` },
          ],
          temperature: 0.1,
        }),
      });
      if (!resp.ok) { await resp.text(); return null; }
      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content || '';
      const jsonMatch = String(content).match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed?.found) return null;
      return parseAiFollowers(parsed.followers);
    } catch { return null; }
  }));

  const values = results.filter((n): n is number => typeof n === 'number');
  if (values.length < 2) return { followersCount: values[0] ?? null, confidence: 'low' };

  const sorted = [...values].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const diff = Math.abs(sorted[i] - sorted[j]);
      if (diff / Math.max(sorted[i], sorted[j], 1) <= 0.02) {
        return { followersCount: Math.round((sorted[i] + sorted[j]) / 2), confidence: 'high' };
      }
    }
  }
  return { followersCount: sorted[Math.floor(sorted.length / 2)], confidence: 'low' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username } = await req.json();
    if (!username) {
      return new Response(JSON.stringify({ success: false, error: 'Username is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Auto-fetch Instagram data for:', username);

    let avatarUrl: string | null = null;
    let followersCount: number | null = null;
    let method = 'none';

    // Method 0: Unavatar (most reliable for avatars, uses their proxy)
    try {
      const ua = await tryUnavatar(username);
      if (ua) {
        avatarUrl = ua;
        method = 'unavatar';
        console.log('Got avatar via unavatar');
      }
    } catch (e) { console.log('Unavatar failed:', e); }

    // Method 1: Web API (for both avatar and followers)
    try {
      const r = await tryWebApi(username);
      if (!avatarUrl && r.avatarUrl) avatarUrl = r.avatarUrl;
      if (r.followersCount !== null) followersCount = r.followersCount;
      if (followersCount !== null) method = method === 'none' ? 'web-api' : method + '+web-api';
    } catch (e) { console.log('Web API failed:', e); }

    // Method 2: HTML scrape (fill in missing data)
    if (!avatarUrl || followersCount === null) {
      try {
        const r = await tryHtmlFetch(username);
        if (!avatarUrl && r.avatarUrl) avatarUrl = r.avatarUrl;
        if (followersCount === null && r.followersCount !== null) followersCount = r.followersCount;
        if (avatarUrl || followersCount !== null) method = method === 'none' ? 'html' : method + '+html';
      } catch (e) { console.log('HTML fetch failed:', e); }
    }

    // Method 3: Firecrawl
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if ((!avatarUrl || followersCount === null) && FIRECRAWL_API_KEY) {
      try {
        const r = await tryFirecrawl(username, FIRECRAWL_API_KEY);
        if (!avatarUrl && r.avatarUrl) avatarUrl = r.avatarUrl;
        if (followersCount === null && r.followersCount !== null) followersCount = r.followersCount;
        if (avatarUrl || followersCount !== null) method = method === 'none' ? 'firecrawl' : method + '+firecrawl';
      } catch (e) { console.log('Firecrawl failed:', e); }
    }

    // Method 4: AI consensus for followers only
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (followersCount === null && LOVABLE_API_KEY) {
      try {
        const ai = await tryAiConsensus(username, LOVABLE_API_KEY);
        if (ai.followersCount !== null && ai.confidence === 'high' && ai.followersCount > 0 && ai.followersCount < 100_000_000) {
          followersCount = ai.followersCount;
          method = method === 'none' ? 'ai-consensus' : method + '+ai';
        }
      } catch (e) { console.log('AI consensus failed:', e); }
    }

    console.log(`Result for @${username}: avatar=${!!avatarUrl}, followers=${followersCount}, method=${method}`);

    return new Response(JSON.stringify({
      success: true,
      avatarUrl,
      followersCount: followersCount !== null ? String(followersCount) : null,
      method,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
