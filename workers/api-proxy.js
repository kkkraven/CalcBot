// Cloudflare Worker для безопасного проксирования API запросов
// Размещается на workers.dev или в вашем домене

export default {
  async fetch(request, env, ctx) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Проверка API ключа клиента
    const clientApiKey = request.headers.get('X-API-Key');
    if (!clientApiKey || clientApiKey !== env.CLIENT_API_KEY) {
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    // Rate limiting
    const clientIP = request.headers.get('CF-Connecting-IP');
    const rateLimitKey = `rate_limit:${clientIP}`;
    
    const currentRequests = await env.KV.get(rateLimitKey);
    const requestCount = currentRequests ? parseInt(currentRequests) : 0;
    
    if (requestCount > 100) { // 100 запросов в минуту
      return new Response('Rate limit exceeded', { 
        status: 429, 
        headers: corsHeaders 
      });
    }

    // Обновляем счетчик запросов
    await env.KV.put(rateLimitKey, (requestCount + 1).toString(), { 
      expirationTtl: 60 
    });

    try {
      // Проксируем запрос к Gemini API
      const url = new URL(request.url);
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models${url.pathname.replace('/api-proxy', '')}`;
      
      const geminiRequest = new Request(geminiUrl, {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.GEMINI_API_KEY}`,
        },
        body: request.method !== 'GET' ? await request.text() : undefined,
      });

      const response = await fetch(geminiRequest);
      const responseData = await response.json();

      // Логируем использование токенов
      if (responseData.usage) {
        const tokenUsage = {
          timestamp: new Date().toISOString(),
          clientIP,
          inputTokens: responseData.usage.promptTokenCount || 0,
          outputTokens: responseData.usage.candidatesTokenCount || 0,
          totalTokens: (responseData.usage.promptTokenCount || 0) + (responseData.usage.candidatesTokenCount || 0),
        };

        // Сохраняем в KV для мониторинга
        const usageKey = `usage:${new Date().toISOString().slice(0, 7)}`; // По месяцам
        const existingUsage = await env.KV.get(usageKey);
        const usageData = existingUsage ? JSON.parse(existingUsage) : { totalTokens: 0, requests: 0 };
        
        usageData.totalTokens += tokenUsage.totalTokens;
        usageData.requests += 1;
        
        await env.KV.put(usageKey, JSON.stringify(usageData), { 
          expirationTtl: 2592000 // 30 дней
        });
      }

      return new Response(JSON.stringify(responseData), {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });

    } catch (error) {
      console.error('Proxy error:', error);
      return new Response('Internal Server Error', { 
        status: 500, 
        headers: corsHeaders 
      });
    }
  },
};
