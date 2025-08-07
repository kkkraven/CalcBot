# 🔧 Исправление несоответствия моделей в API прокси

## Проблема
В API прокси (`workers/api-proxy.js`) была проблема с несоответствием моделей - клиент отправлял запросы в формате Gemini, но прокси не мог правильно определить, какую модель OpenRouter использовать для разных типов задач.

## Решение

### 1. Автоматический выбор модели на основе содержимого запроса

Добавлена логика анализа содержимого запроса для определения типа задачи:

```javascript
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
```

### 2. Оптимизация выбора модели

- **Для простых задач** (извлечение параметров, коррекция цены): `anthropic/claude-3-haiku` (~$0.00025/1K токенов)
- **Для критически важных расчетов** (оценка стоимости): `anthropic/claude-3-5-sonnet` (~$0.003/1K токенов)

### 3. Динамические system prompts

Добавлены специализированные system prompts для разных типов задач:

```javascript
let systemPrompt = 'Ты - AI-ассистент для расчета стоимости упаковки. Отвечай на русском языке.';

if (isExtractionTask) {
  systemPrompt = 'Ты - AI-ассистент для извлечения параметров заказа упаковки. Отвечай на русском языке. Всегда возвращай данные в строгом JSON формате.';
} else if (isPriceCorrectionTask) {
  systemPrompt = 'Ты - AI-ассистент для анализа коррекций цены. Отвечай на русском языке. Всегда возвращай данные в строгом JSON формате.';
} else if (isCostEstimationTask) {
  systemPrompt = 'Ты - AI-ассистент для расчета стоимости упаковки в Китае. Отвечай на русском языке. Используй базу знаний и правила ценообразования для точных расчетов.';
}
```

### 4. Улучшенный мониторинг использования

Добавлено детальное отслеживание использования по моделям и типам задач:

```javascript
const tokenUsage = {
  timestamp: new Date().toISOString(),
  clientIP,
  model,
  taskType: isExtractionTask ? 'extraction' : isPriceCorrectionTask ? 'priceCorrection' : isCostEstimationTask ? 'costEstimation' : 'general',
  inputTokens: responseData.usage.prompt_tokens || 0,
  outputTokens: responseData.usage.completion_tokens || 0,
  totalTokens: (responseData.usage.prompt_tokens || 0) + (responseData.usage.completion_tokens || 0),
};
```

### 5. Обновление клиентского кода

В `services/geminiService.ts`:
- Упрощена конфигурация моделей
- Используется универсальный endpoint
- API прокси автоматически выбирает оптимальную модель

## Результат

✅ **Исправлено несоответствие моделей** - API прокси теперь правильно обрабатывает Gemini запросы
✅ **Оптимизированы затраты** - дешевые модели для простых задач, дорогие для сложных
✅ **Улучшена точность** - специализированные system prompts для каждого типа задачи
✅ **Добавлен мониторинг** - детальное отслеживание использования токенов

## Тестирование

Для проверки исправлений:

1. Отправьте запрос на извлечение параметров - должна использоваться `claude-3-haiku`
2. Отправьте запрос на расчет стоимости - должна использоваться `claude-3-5-sonnet`
3. Проверьте логи в Cloudflare Workers для подтверждения выбора модели

## Дальнейшие улучшения

- Добавить больше типов задач для автоматического выбора модели
- Реализовать A/B тестирование для сравнения точности разных моделей
- Добавить fallback механизм при недоступности предпочтительной модели
