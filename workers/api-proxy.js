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
      // Проксируем запрос к OpenRouter API
      const url = new URL(request.url);
      const openRouterUrl = `https://openrouter.ai/api/v1/chat/completions`;
      
      // Преобразуем Gemini формат в OpenRouter формат
      const requestBody = await request.json();
      
      // Определяем модель на основе URL
      const modelPath = url.pathname;
      let model = 'anthropic/claude-3-haiku'; // по умолчанию
      
      if (modelPath.includes('claude-3-5-sonnet')) {
        model = 'anthropic/claude-3-5-sonnet';
      } else if (modelPath.includes('claude-3-haiku')) {
        model = 'anthropic/claude-3-haiku';
      }
      
      const openRouterBody = {
        model: model,
        messages: [
          {
            role: 'system',
            content: 'Ты - AI-ассистент для расчета стоимости упаковки. Отвечай на русском языке. Всегда используй русский язык для общения.'
          },
          {
            role: 'user',
            content: requestBody.contents?.[0]?.parts?.[0]?.text || ''
          }
        ],
        temperature: requestBody.generationConfig?.temperature || 0.7,
        max_tokens: 4000
      };
      
      const openRouterRequest = new Request(openRouterUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://packaging-calculator.com',
          'X-Title': 'Packaging Calculator'
        },
        body: JSON.stringify(openRouterBody),
      });

             const response = await fetch(openRouterRequest);
       
       // Проверяем статус ответа
       if (!response.ok) {
         const errorData = await response.json().catch(() => ({}));
         console.error('OpenRouter API error:', response.status, errorData);
         
         let errorMessage = 'Ошибка API';
         if (response.status === 401) {
           errorMessage = 'Ошибка авторизации OpenRouter. Проверьте API ключ и баланс аккаунта.';
         } else if (response.status === 402) {
           errorMessage = 'Недостаточно средств на OpenRouter. Пополните баланс аккаунта.';
         } else if (response.status === 429) {
           errorMessage = 'Превышен лимит запросов к OpenRouter. Попробуйте позже.';
         }
         
         return new Response(JSON.stringify({
           error: {
             code: response.status,
             message: errorMessage,
             details: errorData
           }
         }), {
           status: response.status,
           headers: {
             ...corsHeaders,
             'Content-Type': 'application/json',
           },
         });
       }
       
       const responseData = await response.json();

       // Преобразуем OpenRouter ответ в Gemini формат
       const geminiResponse = {
         candidates: [{
           content: {
             parts: [{
               text: responseData.choices?.[0]?.message?.content || ''
             }]
           }
         }],
         usage: {
           promptTokenCount: responseData.usage?.prompt_tokens || 0,
           candidatesTokenCount: responseData.usage?.completion_tokens || 0
         }
       };

      // Логируем использование токенов
      if (responseData.usage) {
        const tokenUsage = {
          timestamp: new Date().toISOString(),
          clientIP,
          inputTokens: responseData.usage.prompt_tokens || 0,
          outputTokens: responseData.usage.completion_tokens || 0,
          totalTokens: (responseData.usage.prompt_tokens || 0) + (responseData.usage.completion_tokens || 0),
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

      return new Response(JSON.stringify(geminiResponse), {
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
