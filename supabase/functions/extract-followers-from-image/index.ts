const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractJsonObject(text: string): any | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

function parseFollowersToInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (/^\d[\d,]*$/.test(raw)) {
    const n = Number(raw.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return new Response(JSON.stringify({ success: false, error: 'imageBase64 is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'AI not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalize possible data URL
    const normalized = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/png;base64,${imageBase64}`;

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'system',
            content:
              'You are an OCR+extraction assistant. The user provides a screenshot of an Instagram profile page. Extract the follower count number shown on screen. Return ONLY JSON: {"found":true,"followers":INTEGER} or {"found":false,"reason":"..."}. followers must be an integer (no K/M).',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  'Read the follower count displayed in this screenshot. If the screenshot does not clearly show the follower count, return found=false.',
              },
              {
                type: 'image_url',
                image_url: { url: normalized },
              },
            ],
          },
        ],
        temperature: 0.0,
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ success: false, error: 'AI 請求過於頻繁，請稍後再試。' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ success: false, error: 'AI 額度不足，請先補充使用額度。' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const t = await aiResp.text();
      console.error('AI gateway error:', aiResp.status, t);
      return new Response(JSON.stringify({ success: false, error: 'AI 服務錯誤' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await aiResp.json();
    const content = data.choices?.[0]?.message?.content || '';
    const parsed = extractJsonObject(String(content));
    if (!parsed?.found) {
      return new Response(JSON.stringify({ success: false, error: parsed?.reason || '無法從截圖辨識追蹤者數量' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const followers = parseFollowersToInt(parsed.followers);
    if (followers === null) {
      return new Response(JSON.stringify({ success: false, error: '辨識結果格式不正確' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: true, followersCount: String(followers), method: 'image-ocr' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('extract-followers-from-image error:', e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
