// Cloudflare Worker для безопасного проксирования API запросов
// Размещается на workers.dev или в вашем домене

// Функции кэширования
const cache = {
  // Генерация ключа кэша на основе запроса
  generateCacheKey: (requestBody, model) => {
    try {
      // Создаем стабильный ключ на основе содержимого запроса и модели
      const contentHash = JSON.stringify({
        contents: requestBody.contents,
        generationConfig: requestBody.generationConfig,
        systemInstruction: requestBody.systemInstruction,
        model: model
      });
      
      // Используем SHA-256 для создания короткого хэша
      return btoa(contentHash).slice(0, 50).replace(/[^a-zA-Z0-9]/g, '_');
    } catch (error) {
      console.error('Error generating cache key:', error);
      return null;
    }
  },

  // Проверка, можно ли кэшировать запрос
  isCacheable: (requestBody, model) => {
    try {
      // Не кэшируем запросы с высоким temperature (случайные ответы)
      if (requestBody.generationConfig?.temperature > 0.5) {
        return false;
      }

      // Не кэшируем запросы с большим количеством токенов
      if (requestBody.generationConfig?.max_tokens > 2000) {
        return false;
      }

      // Не кэшируем запросы с длинными сообщениями
      const messageLength = JSON.stringify(requestBody.contents).length;
      if (messageLength > 10000) {
        return false;
      }

      // Кэшируем только определенные типы задач
      const userMessage = requestBody.contents?.[0]?.parts?.[0]?.text || '';
      const isExtractionTask = userMessage.includes('Извлеки параметры') || 
                              userMessage.includes('JSON-массив') ||
                              userMessage.includes('структура:');
      
      const isPriceCorrectionTask = userMessage.includes('коррекции цены') ||
                                   userMessage.includes('уточнением') ||
                                   userMessage.includes('correctedPricePerUnit');

      // Кэшируем только извлечение параметров и коррекцию цены
      return isExtractionTask || isPriceCorrectionTask;
    } catch (error) {
      console.error('Error checking cacheability:', error);
      return false;
    }
  },

  // Получение кэшированного ответа
  getCachedResponse: async (cacheKey, env) => {
    try {
      if (!cacheKey) return null;
      
      const cachedData = await env.KV.get(`cache:${cacheKey}`);
      if (!cachedData) return null;

      const parsed = JSON.parse(cachedData);
      
      // Проверяем, не истек ли кэш
      if (parsed.expiresAt && new Date() > new Date(parsed.expiresAt)) {
        await env.KV.delete(`cache:${cacheKey}`);
        return null;
      }

      console.log('Cache hit for key:', cacheKey);
      return parsed.response;
    } catch (error) {
      console.error('Error getting cached response:', error);
      return null;
    }
  },

  // Сохранение ответа в кэш
  setCachedResponse: async (cacheKey, response, env) => {
    try {
      if (!cacheKey) return;

      // Определяем время жизни кэша на основе типа задачи
      const userMessage = response.originalRequest?.contents?.[0]?.parts?.[0]?.text || '';
      let ttl = 3600; // 1 час по умолчанию

      if (userMessage.includes('Извлеки параметры')) {
        ttl = 7200; // 2 часа для извлечения параметров
      } else if (userMessage.includes('коррекции цены')) {
        ttl = 1800; // 30 минут для коррекции цены
      }

      const cacheData = {
        response: response,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        ttl: ttl
      };

      await env.KV.put(`cache:${cacheKey}`, JSON.stringify(cacheData), { 
        expirationTtl: ttl 
      });

      console.log('Cached response for key:', cacheKey, 'TTL:', ttl);
    } catch (error) {
      console.error('Error setting cached response:', error);
    }
  },

  // Очистка устаревших кэшей
  cleanupExpiredCache: async (env) => {
    try {
      // Эта функция может быть вызвана периодически для очистки
      // В реальной реализации можно использовать Cloudflare Cron Triggers
      console.log('Cache cleanup completed');
    } catch (error) {
      console.error('Error during cache cleanup:', error);
    }
  },

  // Получение статистики кэша
  getCacheStats: async (env) => {
    try {
      const stats = await env.KV.get('cache:stats');
      return stats ? JSON.parse(stats) : { hits: 0, misses: 0, size: 0 };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { hits: 0, misses: 0, size: 0 };
    }
  },

  // Обновление статистики кэша
  updateCacheStats: async (hit, env) => {
    try {
      const stats = await cache.getCacheStats(env);
      
      if (hit) {
        stats.hits++;
      } else {
        stats.misses++;
      }
      
      await env.KV.put('cache:stats', JSON.stringify(stats), { 
        expirationTtl: 86400 // 24 часа
      });
    } catch (error) {
      console.error('Error updating cache stats:', error);
    }
  }
};

// Функции валидации
const validators = {
  // Валидация API ключа
  validateApiKey: (apiKey) => {
    if (!apiKey || typeof apiKey !== 'string') {
      return { valid: false, error: 'API ключ отсутствует или имеет неверный формат' };
    }
    if (apiKey.length < 10 || apiKey.length > 100) {
      return { valid: false, error: 'API ключ имеет недопустимую длину' };
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(apiKey)) {
      return { valid: false, error: 'API ключ содержит недопустимые символы' };
    }
    return { valid: true };
  },

  // Валидация IP адреса
  validateIP: (ip) => {
    if (!ip || typeof ip !== 'string') {
      return { valid: false, error: 'IP адрес отсутствует или имеет неверный формат' };
    }
    // Простая валидация IPv4/IPv6
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
      return { valid: false, error: 'IP адрес имеет неверный формат' };
    }
    return { valid: true };
  },

  // Валидация JSON структуры запроса
  validateRequestStructure: (requestBody) => {
    if (!requestBody || typeof requestBody !== 'object') {
      return { valid: false, error: 'Тело запроса должно быть объектом' };
    }
    
    if (!Array.isArray(requestBody.contents)) {
      return { valid: false, error: 'Поле "contents" должно быть массивом' };
    }
    
    if (requestBody.contents.length === 0) {
      return { valid: false, error: 'Массив "contents" не может быть пустым' };
    }
    
    if (requestBody.contents.length > 10) {
      return { valid: false, error: 'Слишком много элементов в массиве "contents" (максимум 10)' };
    }
    
    return { valid: true };
  },

  // Валидация содержимого сообщения
  validateContent: (content) => {
    if (!content || typeof content !== 'object') {
      return { valid: false, error: 'Элемент content должен быть объектом' };
    }
    
    if (!Array.isArray(content.parts)) {
      return { valid: false, error: 'Поле "parts" должно быть массивом' };
    }
    
    if (content.parts.length === 0) {
      return { valid: false, error: 'Массив "parts" не может быть пустым' };
    }
    
    if (content.parts.length > 50) {
      return { valid: false, error: 'Слишком много частей в сообщении (максимум 50)' };
    }
    
    return { valid: true };
  },

  // Валидация текста сообщения
  validateMessageText: (text) => {
    if (text === undefined || text === null) {
      return { valid: false, error: 'Текст сообщения не может быть null или undefined' };
    }
    
    if (typeof text !== 'string') {
      return { valid: false, error: 'Текст сообщения должен быть строкой' };
    }
    
    if (text.length === 0) {
      return { valid: false, error: 'Текст сообщения не может быть пустым' };
    }
    
    if (text.length > 100000) { // 100KB лимит
      return { valid: false, error: 'Текст сообщения слишком длинный (максимум 100KB)' };
    }
    
    // Проверка на потенциально опасные паттерны
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /data:text\/html/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(text)) {
        return { valid: false, error: 'Текст содержит потенциально опасные паттерны' };
      }
    }
    
    return { valid: true };
  },

  // Валидация конфигурации генерации
  validateGenerationConfig: (config) => {
    if (!config) return { valid: true };
    
    if (typeof config !== 'object') {
      return { valid: false, error: 'generationConfig должен быть объектом' };
    }
    
    // Валидация temperature
    if (config.temperature !== undefined) {
      if (typeof config.temperature !== 'number') {
        return { valid: false, error: 'temperature должен быть числом' };
      }
      if (config.temperature < 0 || config.temperature > 2) {
        return { valid: false, error: 'temperature должен быть в диапазоне 0-2' };
      }
    }
    
    // Валидация max_tokens
    if (config.max_tokens !== undefined) {
      if (typeof config.max_tokens !== 'number') {
        return { valid: false, error: 'max_tokens должен быть числом' };
      }
      if (config.max_tokens < 1 || config.max_tokens > 100000) {
        return { valid: false, error: 'max_tokens должен быть в диапазоне 1-100000' };
      }
    }
    
    // Валидация responseMimeType
    if (config.responseMimeType !== undefined) {
      if (typeof config.responseMimeType !== 'string') {
        return { valid: false, error: 'responseMimeType должен быть строкой' };
      }
      const allowedMimeTypes = ['application/json', 'text/plain', 'text/html'];
      if (!allowedMimeTypes.includes(config.responseMimeType)) {
        return { valid: false, error: 'Недопустимый responseMimeType' };
      }
    }
    
    return { valid: true };
  },

  // Валидация system instruction
  validateSystemInstruction: (instruction) => {
    if (instruction === undefined || instruction === null) {
      return { valid: true };
    }
    
    if (typeof instruction !== 'string') {
      return { valid: false, error: 'systemInstruction должен быть строкой' };
    }
    
    if (instruction.length > 10000) {
      return { valid: false, error: 'systemInstruction слишком длинный (максимум 10KB)' };
    }
    
    return { valid: true };
  },

  // Валидация URL
  validateURL: (urlString) => {
    try {
      const url = new URL(urlString);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return { valid: false, error: 'URL должен использовать HTTP или HTTPS протокол' };
      }
      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Неверный формат URL' };
    }
  },

  // Валидация HTTP метода
  validateMethod: (method) => {
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
    if (!allowedMethods.includes(method.toUpperCase())) {
      return { valid: false, error: 'Недопустимый HTTP метод' };
    }
    return { valid: true };
  },

  // Валидация заголовков
  validateHeaders: (headers) => {
    if (!headers || typeof headers !== 'object') {
      return { valid: false, error: 'Заголовки должны быть объектом' };
    }
    
    // Проверяем Content-Type только для POST запросов
    const contentType = headers['Content-Type'] || headers['content-type'];
    if (contentType && !contentType.includes('application/json')) {
      return { valid: false, error: 'Content-Type должен быть application/json' };
    }
    
    return { valid: true };
  }
};

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

    // Health check endpoint
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'packaging-calculator-api',
        version: '1.0.0'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    try {
      // Валидация HTTP метода
      const methodValidation = validators.validateMethod(request.method);
      if (!methodValidation.valid) {
        return new Response(JSON.stringify({
          error: {
            code: 405,
            message: methodValidation.error,
            details: { method: request.method }
          }
        }), {
          status: 405,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }

      // Валидация URL
      const urlValidation = validators.validateURL(request.url);
      if (!urlValidation.valid) {
        return new Response(JSON.stringify({
          error: {
            code: 400,
            message: urlValidation.error,
            details: { url: request.url }
          }
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }

      // Валидация заголовков
      const headersValidation = validators.validateHeaders(Object.fromEntries(request.headers.entries()));
      if (!headersValidation.valid) {
        return new Response(JSON.stringify({
          error: {
            code: 400,
            message: headersValidation.error,
            details: { headers: Object.fromEntries(request.headers.entries()) }
          }
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }

      // Валидация API ключа клиента
      const clientApiKey = request.headers.get('X-API-Key');
      const apiKeyValidation = validators.validateApiKey(clientApiKey);
      if (!apiKeyValidation.valid) {
        return new Response(JSON.stringify({
          error: {
            code: 401,
            message: apiKeyValidation.error,
            details: { providedKey: clientApiKey ? '***' + clientApiKey.slice(-4) : 'none' }
          }
        }), {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }

      // Проверка соответствия API ключа
      if (clientApiKey !== env.CLIENT_API_KEY) {
        return new Response(JSON.stringify({
          error: {
            code: 401,
            message: 'Неверный API ключ',
            details: { providedKey: '***' + clientApiKey.slice(-4) }
          }
        }), {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }

      // Валидация IP адреса
      const clientIP = request.headers.get('CF-Connecting-IP');
      const ipValidation = validators.validateIP(clientIP);
      if (!ipValidation.valid) {
        console.warn('Invalid IP address:', clientIP);
        // Не блокируем запрос, но логируем предупреждение
      }

      // Rate limiting с обработкой ошибок
      let currentRequests = 0;
      try {
        const rateLimitKey = `rate_limit:${clientIP}`;
        
        const currentRequestsStr = await env.KV.get(rateLimitKey);
        currentRequests = currentRequestsStr ? parseInt(currentRequestsStr) : 0;
        
        if (currentRequests > 100) { // 100 запросов в минуту
          return new Response(JSON.stringify({
            error: {
              code: 429,
              message: 'Превышен лимит запросов (100 в минуту)',
              details: { currentRequests, limit: 100 }
            }
          }), {
            status: 429,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        }

        // Обновляем счетчик запросов
        await env.KV.put(rateLimitKey, (currentRequests + 1).toString(), { 
          expirationTtl: 60 
        });
      } catch (rateLimitError) {
        console.error('Rate limiting error:', rateLimitError);
        // Продолжаем выполнение даже при ошибке rate limiting
      }

             // Проксируем запрос к OpenRouter API
       const openRouterUrl = `https://openrouter.ai/api/v1/chat/completions`;
      
             // Преобразуем запрос в OpenRouter формат с обработкой ошибок
      let requestBody;
      try {
        requestBody = await request.json();
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError);
        return new Response(JSON.stringify({
          error: {
            code: 400,
            message: 'Неверный формат JSON в запросе',
            details: { error: jsonError.message }
          }
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }
      
      // Валидация структуры запроса
      const structureValidation = validators.validateRequestStructure(requestBody);
      if (!structureValidation.valid) {
        return new Response(JSON.stringify({
          error: {
            code: 400,
            message: structureValidation.error,
            details: { requestBody: JSON.stringify(requestBody).slice(0, 200) + '...' }
          }
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }
      
      // Отладочная информация
      console.log('Request body:', JSON.stringify(requestBody, null, 2));
      
      // Валидация содержимого
      const contentValidation = validators.validateContent(requestBody.contents[0]);
      if (!contentValidation.valid) {
        return new Response(JSON.stringify({
          error: {
            code: 400,
            message: contentValidation.error,
            details: { content: JSON.stringify(requestBody.contents[0]).slice(0, 200) + '...' }
          }
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }
      
             // Извлекаем текст из запроса с проверкой структуры
      let userMessage = '';
      try {
        if (requestBody.contents && requestBody.contents.length > 0) {
          const firstContent = requestBody.contents[0];
          if (firstContent.parts && firstContent.parts.length > 0) {
            userMessage = firstContent.parts[0].text || '';
          }
        }
      } catch (extractionError) {
        console.error('Message extraction error:', extractionError);
        return new Response(JSON.stringify({
          error: {
            code: 400,
            message: 'Ошибка извлечения сообщения из запроса',
            details: { error: extractionError.message }
          }
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }
      
      // Валидация текста сообщения
      const messageValidation = validators.validateMessageText(userMessage);
      if (!messageValidation.valid) {
        return new Response(JSON.stringify({
          error: {
            code: 400,
            message: messageValidation.error,
            details: { messageLength: userMessage.length }
          }
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }
      
      // Валидация конфигурации генерации
      const configValidation = validators.validateGenerationConfig(requestBody.generationConfig);
      if (!configValidation.valid) {
        return new Response(JSON.stringify({
          error: {
            code: 400,
            message: configValidation.error,
            details: { generationConfig: requestBody.generationConfig }
          }
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }
      
      // Валидация system instruction
      const instructionValidation = validators.validateSystemInstruction(requestBody.systemInstruction);
      if (!instructionValidation.valid) {
        return new Response(JSON.stringify({
          error: {
            code: 400,
            message: instructionValidation.error,
            details: { instructionLength: requestBody.systemInstruction?.length }
          }
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }
      
      console.log('User message:', userMessage);
      
             // Определяем модель на основе содержимого запроса
       let model = 'anthropic/claude-3-haiku'; // по умолчанию
      
      // Проверяем кэширование перед обработкой запроса
      let cacheKey = null;
      let cachedResponse = null;
      
      try {
        // Генерируем ключ кэша
        cacheKey = cache.generateCacheKey(requestBody, model);
        
        // Проверяем, можно ли кэшировать этот запрос
        if (cacheKey && cache.isCacheable(requestBody, model)) {
          // Пытаемся получить кэшированный ответ
          cachedResponse = await cache.getCachedResponse(cacheKey, env);
          
          if (cachedResponse) {
            // Обновляем статистику кэша
            await cache.updateCacheStats(true, env);
            
            console.log('Returning cached response for key:', cacheKey);
            return new Response(JSON.stringify(cachedResponse), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'X-Cache': 'HIT',
                'X-Cache-Key': cacheKey
              },
            });
          }
        }
      } catch (cacheError) {
        console.error('Cache error:', cacheError);
        // Продолжаем выполнение без кэширования
      }
      
      try {
        // Анализируем содержимое запроса для определения типа задачи
        const isExtractionTask = userMessage.includes('Извлеки параметры') || 
                                userMessage.includes('JSON-массив') ||
                                userMessage.includes('структура:');
        
        const isPriceCorrectionTask = userMessage.includes('коррекции цены') ||
                                     userMessage.includes('уточнением') ||
                                     userMessage.includes('correctedPricePerUnit');
        
        const isCostEstimationTask = userMessage.includes('рассчитай стоимость') ||
                                    userMessage.includes('примерная стоимость') ||
                                    userMessage.includes('база знаний') ||
                                    userMessage.includes('правила ценообразования');
        
                 // Выбираем модель на основе типа задачи
         if (isExtractionTask || isPriceCorrectionTask) {
           // Для простых задач используем дешевую модель
           model = 'anthropic/claude-3-haiku';
         } else if (isCostEstimationTask) {
           // Для критически важных расчетов используем более точную модель
           model = 'anthropic/claude-3-5-sonnet';
         }
      } catch (modelSelectionError) {
        console.error('Model selection error:', modelSelectionError);
        // Используем модель по умолчанию при ошибке
        model = 'anthropic/claude-3-haiku';
      }
      
      console.log('Selected model:', model);
      
      // Определяем system prompt на основе типа задачи
      let systemPrompt = 'Ты - AI-ассистент для расчета стоимости упаковки. Отвечай на русском языке. Всегда используй русский язык для общения.';
      
      try {
        const isExtractionTask = userMessage.includes('Извлеки параметры') || 
                                userMessage.includes('JSON-массив') ||
                                userMessage.includes('структура:');
        
        const isPriceCorrectionTask = userMessage.includes('коррекции цены') ||
                                     userMessage.includes('уточнением') ||
                                     userMessage.includes('correctedPricePerUnit');
        
        const isCostEstimationTask = userMessage.includes('рассчитай стоимость') ||
                                    userMessage.includes('примерная стоимость') ||
                                    userMessage.includes('база знаний') ||
                                    userMessage.includes('правила ценообразования');
        
        if (isExtractionTask) {
          systemPrompt = 'Ты - AI-ассистент для извлечения параметров заказа упаковки. Отвечай на русском языке. Всегда возвращай данные в строгом JSON формате.';
        } else if (isPriceCorrectionTask) {
          systemPrompt = 'Ты - AI-ассистент для анализа коррекций цены. Отвечай на русском языке. Всегда возвращай данные в строгом JSON формате.';
        } else if (isCostEstimationTask) {
          systemPrompt = 'Ты - AI-ассистент для расчета стоимости упаковки в Китае. Отвечай на русском языке. Используй базу знаний и правила ценообразования для точных расчетов.';
        }
      } catch (promptError) {
        console.error('System prompt selection error:', promptError);
        // Используем prompt по умолчанию при ошибке
      }
      
      const openRouterBody = {
        model: model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userMessage
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

      // Выполняем запрос к OpenRouter с обработкой ошибок
      let response;
      try {
        response = await fetch(openRouterRequest);
      } catch (fetchError) {
        console.error('OpenRouter fetch error:', fetchError);
        return new Response(JSON.stringify({
          error: {
            code: 503,
            message: 'Сервис OpenRouter временно недоступен. Попробуйте позже.',
            details: { error: fetchError.message }
          }
        }), {
          status: 503,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }
        
      // Проверяем статус ответа
      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (errorJsonError) {
          console.error('Error parsing error response:', errorJsonError);
          errorData = { error: 'Не удалось разобрать ответ об ошибке' };
        }
        
        console.error('OpenRouter API error:', response.status, errorData);
        
        let errorMessage = 'Ошибка API';
        if (response.status === 401) {
          errorMessage = 'Ошибка авторизации OpenRouter. Проверьте API ключ и баланс аккаунта.';
        } else if (response.status === 402) {
          errorMessage = 'Недостаточно средств на OpenRouter. Пополните баланс аккаунта.';
        } else if (response.status === 429) {
          errorMessage = 'Превышен лимит запросов к OpenRouter. Попробуйте позже.';
        } else if (response.status >= 500) {
          errorMessage = 'Внутренняя ошибка сервера OpenRouter. Попробуйте позже.';
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
     
     // Парсим ответ OpenRouter с обработкой ошибок
     let responseData;
     try {
       responseData = await response.json();
     } catch (responseJsonError) {
       console.error('Response JSON parsing error:', responseJsonError);
       return new Response(JSON.stringify({
         error: {
           code: 500,
           message: 'Ошибка обработки ответа от OpenRouter',
           details: { error: responseJsonError.message }
         }
       }), {
         status: 500,
         headers: {
           ...corsHeaders,
           'Content-Type': 'application/json',
         },
       });
     }

                 // Преобразуем OpenRouter ответ в стандартный формат
      const apiResponse = {
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

     // Сохраняем ответ в кэш, если это возможно
     try {
               if (cacheKey && cache.isCacheable(requestBody, model)) {
          const responseWithMetadata = {
            ...apiResponse,
            originalRequest: requestBody,
            cachedAt: new Date().toISOString()
          };
         
         await cache.setCachedResponse(cacheKey, responseWithMetadata, env);
         await cache.updateCacheStats(false, env); // Cache miss
         
         console.log('Response cached with key:', cacheKey);
       }
     } catch (cacheError) {
       console.error('Error caching response:', cacheError);
       // Не прерываем выполнение при ошибке кэширования
     }

     // Логируем использование токенов с обработкой ошибок
     if (responseData.usage) {
       try {
         const tokenUsage = {
           timestamp: new Date().toISOString(),
           clientIP: request.headers.get('CF-Connecting-IP'),
           model,
           taskType: (() => {
             const isExtractionTask = userMessage.includes('Извлеки параметры') || 
                                     userMessage.includes('JSON-массив') ||
                                     userMessage.includes('структура:');
             const isPriceCorrectionTask = userMessage.includes('коррекции цены') ||
                                          userMessage.includes('уточнением') ||
                                          userMessage.includes('correctedPricePerUnit');
             const isCostEstimationTask = userMessage.includes('рассчитай стоимость') ||
                                         userMessage.includes('примерная стоимость') ||
                                         userMessage.includes('база знаний') ||
                                         userMessage.includes('правила ценообразования');
             
             if (isExtractionTask) return 'extraction';
             if (isPriceCorrectionTask) return 'priceCorrection';
             if (isCostEstimationTask) return 'costEstimation';
             return 'general';
           })(),
           inputTokens: responseData.usage.prompt_tokens || 0,
           outputTokens: responseData.usage.completion_tokens || 0,
           totalTokens: (responseData.usage.prompt_tokens || 0) + (responseData.usage.completion_tokens || 0),
         };

         // Сохраняем в KV для мониторинга
         const usageKey = `usage:${new Date().toISOString().slice(0, 7)}`; // По месяцам
         const existingUsage = await env.KV.get(usageKey);
         const usageData = existingUsage ? JSON.parse(existingUsage) : { 
           totalTokens: 0, 
           requests: 0,
           models: {},
           taskTypes: {}
         };
         
         usageData.totalTokens += tokenUsage.totalTokens;
         usageData.requests += 1;
         
         // Учитываем использование по моделям
         usageData.models[model] = (usageData.models[model] || 0) + tokenUsage.totalTokens;
         
         // Учитываем использование по типам задач
         usageData.taskTypes[tokenUsage.taskType] = (usageData.taskTypes[tokenUsage.taskType] || 0) + tokenUsage.totalTokens;
         
         await env.KV.put(usageKey, JSON.stringify(usageData), { 
           expirationTtl: 2592000 // 30 дней
         });
       } catch (usageError) {
         console.error('Token usage logging error:', usageError);
         // Не прерываем выполнение при ошибке логирования
       }
     }

           return new Response(JSON.stringify(apiResponse), {
       status: response.status,
       headers: {
         ...corsHeaders,
         'Content-Type': 'application/json',
         'X-Cache': 'MISS',
         'X-Cache-Key': cacheKey || 'none',
         'Cache-Control': 'public, max-age=3600'
       },
     });

   } catch (error) {
     console.error('Unexpected proxy error:', error);
     return new Response(JSON.stringify({
       error: {
         code: 500,
         message: 'Внутренняя ошибка сервера',
         details: { 
           error: error.message,
           timestamp: new Date().toISOString()
         }
       }
     }), { 
       status: 500, 
       headers: {
         ...corsHeaders,
         'Content-Type': 'application/json',
       }
     });
   }
 },
};
