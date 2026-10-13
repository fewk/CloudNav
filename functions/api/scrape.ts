interface Env {
  PASSWORD?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-auth-password',
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

export const onRequest = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 1. 验证密码鉴权
  if (env.PASSWORD) {
    const authPassword = request.headers.get('x-auth-password');
    if (!authPassword || authPassword !== env.PASSWORD) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  // 2. 解析目标 URL
  let targetUrl = '';
  if (request.method === 'GET') {
    const urlObj = new URL(request.url);
    targetUrl = urlObj.searchParams.get('url') || '';
  } else {
    try {
      const body = await request.json() as { url?: string };
      targetUrl = body.url || '';
    } catch (e) {
      // ignore
    }
  }

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'URL parameter is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // 标准化 URL
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  let domain = '';
  try {
    const parsed = new URL(targetUrl);
    domain = parsed.hostname;
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    // 3. 服务端发起抓取 (边缘端不受浏览器 CORS 限制)
    const scrapeRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000), // 8秒超时限制
    });

    const html = await scrapeRes.text();

    // 4. 解析 HTML 元数据
    // 标题提取: og:title -> twitter:title -> <title>
    let title = '';
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    if (ogTitleMatch && ogTitleMatch[1]) {
      title = ogTitleMatch[1].trim();
    } else {
      const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleTagMatch && titleTagMatch[1]) {
        title = titleTagMatch[1].trim();
      }
    }

    // 描述提取: meta description -> og:description
    let description = '';
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    if (metaDescMatch && metaDescMatch[1]) {
      description = metaDescMatch[1].trim();
    } else {
      const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
      if (ogDescMatch && ogDescMatch[1]) {
        description = ogDescMatch[1].trim();
      }
    }

    // 关键词提取
    const keywords: string[] = [];
    const keywordsMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']keywords["']/i);
    if (keywordsMatch && keywordsMatch[1]) {
      keywordsMatch[1].split(/[,，、]/).forEach(k => {
        const trimmed = k.trim();
        if (trimmed && trimmed.length <= 15 && !keywords.includes(trimmed)) {
          keywords.push(trimmed);
        }
      });
    }

    // 图标提取: <link rel="icon"...> -> 绝对路径转换 -> fallback
    let icon = '';
    const iconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i)
      || html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i)
      || html.match(/<link[^>]*rel=["']apple-touch-icon(?:-precomposed)?["'][^>]*href=["']([^"']+)["']/i);
    
    if (iconMatch && iconMatch[1]) {
      const rawIcon = iconMatch[1].trim();
      try {
        icon = new URL(rawIcon, targetUrl).href;
      } catch (e) {
        icon = rawIcon;
      }
    }
    
    // 如果没有找到有效图标或图标是相对协议，使用高可用 Google Favicon 服务兜底
    if (!icon || !icon.startsWith('http')) {
      icon = `https://t3.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=128&url=https://${domain}`;
    }

    // 提取正文文本摘要 (过滤 script, style, html 标签)
    let bodyText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 截取前 1200 字符用于 AI 分析
    const bodyPreview = bodyText.slice(0, 1200);

    return new Response(JSON.stringify({
      success: true,
      url: targetUrl,
      domain,
      title: title || domain,
      description: description,
      icon,
      keywords: keywords.slice(0, 8),
      bodyPreview,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err: any) {
    // 抓取失败时的优雅降级响应
    return new Response(JSON.stringify({
      success: false,
      url: targetUrl,
      domain,
      title: domain,
      description: '',
      icon: `https://t3.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=128&url=https://${domain}`,
      keywords: [],
      bodyPreview: '',
      error: err?.message || 'Failed to fetch webpage',
    }), {
      status: 200, // 降级返回200，便于前端继续使用基础域名信息
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};
