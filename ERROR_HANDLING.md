# 🛡️ Улучшенная обработка ошибок

## Обзор

Добавлена комплексная обработка ошибок для всех асинхронных операций в API прокси и сервисе Gemini. Все критические операции теперь обернуты в try-catch блоки с детальным логированием и graceful degradation.

## 🔧 API Прокси (`workers/api-proxy.js`)

### Обработка ошибок по этапам:

#### 1. **Аутентификация и Rate Limiting**
```javascript
try {
  // Проверка API ключа клиента
  const clientApiKey = request.headers.get('X-API-Key');
  if (!clientApiKey || clientApiKey !== env.CLIENT_API_KEY) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  // Rate limiting с обработкой ошибок
  try {
    const clientIP = request.headers.get('CF-Connecting-IP');
    const rateLimitKey = `rate_limit:${clientIP}`;
    // ... rate limiting logic
  } catch (rateLimitError) {
    console.error('Rate limiting error:', rateLimitError);
    // Продолжаем выполнение даже при ошибке rate limiting
  }
} catch (error) {
  // Обработка критических ошибок аутентификации
}
```

#### 2. **Парсинг JSON запроса**
```javascript
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
  }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
```

#### 3. **Извлечение сообщения пользователя**
```javascript
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
  }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
```

#### 4. **Выбор модели и System Prompt**
```javascript
try {
  // Анализ содержимого для определения типа задачи
  const isExtractionTask = userMessage.includes('Извлеки параметры') || 
                          userMessage.includes('JSON-массив') ||
                          userMessage.includes('структура:');
  // ... остальная логика выбора модели
} catch (modelSelectionError) {
  console.error('Model selection error:', modelSelectionError);
  // Используем модель по умолчанию при ошибке
  model = 'anthropic/claude-3-haiku';
}
```

#### 5. **HTTP запрос к OpenRouter**
```javascript
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
  }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
```

#### 6. **Парсинг ответа OpenRouter**
```javascript
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
  }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
```

#### 7. **Логирование использования токенов**
```javascript
if (responseData.usage) {
  try {
    const tokenUsage = {
      timestamp: new Date().toISOString(),
      clientIP: request.headers.get('CF-Connecting-IP'),
      model,
      taskType: (() => {
        // Определение типа задачи
      })(),
      inputTokens: responseData.usage.prompt_tokens || 0,
      outputTokens: responseData.usage.completion_tokens || 0,
      totalTokens: (responseData.usage.prompt_tokens || 0) + (responseData.usage.completion_tokens || 0),
    };

    // Сохранение в KV
    const usageKey = `usage:${new Date().toISOString().slice(0, 7)}`;
    const existingUsage = await env.KV.get(usageKey);
    const usageData = existingUsage ? JSON.parse(existingUsage) : { 
      totalTokens: 0, requests: 0, models: {}, taskTypes: {}
    };
    
    // Обновление статистики
    usageData.totalTokens += tokenUsage.totalTokens;
    usageData.requests += 1;
    usageData.models[model] = (usageData.models[model] || 0) + tokenUsage.totalTokens;
    usageData.taskTypes[tokenUsage.taskType] = (usageData.taskTypes[tokenUsage.taskType] || 0) + tokenUsage.totalTokens;
    
    await env.KV.put(usageKey, JSON.stringify(usageData), { expirationTtl: 2592000 });
  } catch (usageError) {
    console.error('Token usage logging error:', usageError);
    // Не прерываем выполнение при ошибке логирования
  }
}
```

## 🔧 Сервис Gemini (`services/geminiService.ts`)

### Обработка ошибок в основных функциях:

#### 1. **makeSecureGeminiRequest**
- ✅ Обработка ошибок конфигурации запроса
- ✅ Обработка ошибок HTTP запросов
- ✅ Обработка ошибок парсинга JSON
- ✅ Обработка ошибок извлечения текста
- ✅ Обработка ошибок мониторинга токенов
- ✅ Graceful retry механизм

#### 2. **parseOrderFromStringWithGeminiOptimized**
- ✅ Валидация входных данных
- ✅ Обработка ошибок маппинга ответа
- ✅ Детальное логирование ошибок

#### 3. **parsePriceCorrectionFeedback**
- ✅ Валидация входных данных
- ✅ Обработка ошибок формирования контекста
- ✅ Обработка ошибок парсинга JSON
- ✅ Graceful fallback при ошибках

#### 4. **estimatePackagingCost**
- ✅ Валидация FormData
- ✅ Обработка ошибок формирования промпта
- ✅ Обработка ошибок API запросов

#### 5. **TokenMonitor**
- ✅ Валидация входных данных токенов
- ✅ Обработка ошибок в addUsage
- ✅ Обработка ошибок в checkLimits
- ✅ Graceful fallback в getMonthlyStats

## 🎯 Типы обрабатываемых ошибок

### HTTP ошибки
- **400**: Неверный формат запроса
- **401**: Ошибка аутентификации
- **429**: Превышение лимита запросов
- **500**: Внутренняя ошибка сервера
- **503**: Сервис недоступен

### Ошибки парсинга
- JSON parsing errors
- Message extraction errors
- Response format errors

### Ошибки сети
- Fetch errors
- Timeout errors
- Connection errors

### Ошибки валидации
- Invalid input data
- Missing required fields
- Type validation errors

## 📊 Логирование и мониторинг

### Уровни логирования
- **ERROR**: Критические ошибки, требующие внимания
- **WARN**: Предупреждения, не прерывающие работу
- **INFO**: Информационные сообщения
- **DEBUG**: Отладочная информация

### Структура логов ошибок
```javascript
{
  timestamp: new Date().toISOString(),
  error: error.message,
  stack: error.stack,
  context: {
    function: 'functionName',
    attempt: attemptNumber,
    requestId: uniqueId
  }
}
```

## 🚀 Преимущества улучшенной обработки ошибок

### 1. **Надежность**
- Приложение не падает при отдельных ошибках
- Graceful degradation для некритичных операций
- Автоматические retry для временных ошибок

### 2. **Отладка**
- Детальное логирование всех ошибок
- Контекстная информация для быстрого поиска проблем
- Структурированные сообщения об ошибках

### 3. **Пользовательский опыт**
- Понятные сообщения об ошибках
- Graceful fallback вместо полного отказа
- Информативные уведомления о статусе

### 4. **Мониторинг**
- Отслеживание частоты ошибок
- Алерты при критических проблемах
- Метрики производительности

## 🔄 Retry механизм

### Стратегия retry
- **Максимум попыток**: 3
- **Экспоненциальная задержка**: 1s, 2s, 3s
- **Обрабатываемые ошибки**: 429, сетевые ошибки
- **Исключения**: 401, 400, 500+

### Пример retry логики
```javascript
for (let attempt = 1; attempt <= API_CONFIG.retryAttempts; attempt++) {
  try {
    // Выполнение операции
    return result;
  } catch (error) {
    if (shouldRetry(error) && attempt < API_CONFIG.retryAttempts) {
      await delay(API_CONFIG.retryDelay * attempt);
      continue;
    }
    throw error;
  }
}
```

## 📈 Метрики и алерты

### Отслеживаемые метрики
- Количество ошибок по типам
- Время отклика API
- Успешность retry попыток
- Использование токенов

### Рекомендуемые алерты
- Ошибки 5xx > 5% в течение 5 минут
- Время отклика > 10 секунд
- Rate limit превышен > 10 раз в минуту
- Ошибки аутентификации > 1 в минуту

## 🎉 Результат

✅ **Повышена надежность** - приложение устойчиво к ошибкам
✅ **Улучшена отладка** - детальное логирование всех проблем
✅ **Лучший UX** - понятные сообщения об ошибках
✅ **Автоматическое восстановление** - retry механизм для временных ошибок
✅ **Мониторинг** - отслеживание и алерты по проблемам

Все асинхронные операции теперь защищены от сбоев и обеспечивают стабильную работу приложения! 🛡️
