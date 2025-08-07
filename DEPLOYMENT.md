# 🚀 Безопасное развертывание на Cloudflare

## 📋 Предварительные требования

1. **Cloudflare аккаунт** с доступом к Workers
2. **Домен** (опционально, можно использовать workers.dev)
3. **Wrangler CLI** для развертывания Workers

## 🔧 Настройка Cloudflare Workers

### 1. Установка Wrangler CLI
```bash
npm install -g wrangler
wrangler login
```

### 2. Создание KV namespace
```bash
# Создаем KV namespace для rate limiting и мониторинга
wrangler kv:namespace create "PACKAGING_CALCULATOR_KV"
wrangler kv:namespace create "PACKAGING_CALCULATOR_KV" --preview
```

### 3. Настройка секретов
```bash
# Устанавливаем секретные переменные
wrangler secret put GEMINI_API_KEY
wrangler secret put CLIENT_API_KEY
```

### 4. Обновление конфигурации
Отредактируйте `wrangler.toml`:
```toml
name = "packaging-calculator-api"
main = "workers/api-proxy.js"
compatibility_date = "2024-01-01"

# KV namespace (замените на ваши ID)
[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"
preview_id = "your-preview-kv-namespace-id"

# Переменные окружения
[vars]
CLIENT_API_KEY = "your-client-api-key-here"
```

### 5. Развертывание Worker
```bash
# Тестовое развертывание
wrangler deploy --env preview

# Продакшн развертывание
wrangler deploy --env production
```

## 🔐 Настройка безопасности

### 1. Генерация API ключей
```bash
# Генерируем безопасный клиентский ключ
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Настройка CORS (опционально)
Если у вас есть домен, добавьте в `workers/api-proxy.js`:
```javascript
const allowedOrigins = [
  'https://yourdomain.com',
  'https://www.yourdomain.com'
];

const origin = request.headers.get('Origin');
if (origin && !allowedOrigins.includes(origin)) {
  return new Response('Forbidden', { status: 403 });
}
```

### 3. Rate Limiting
Настройте лимиты в Worker:
```javascript
// В workers/api-proxy.js
const MAX_REQUESTS_PER_MINUTE = 100;
const MAX_REQUESTS_PER_HOUR = 1000;
```

## 🌐 Настройка домена (опционально)

### 1. Добавление домена в Cloudflare
1. Перейдите в Cloudflare Dashboard
2. Добавьте ваш домен
3. Настройте DNS записи

### 2. Настройка Worker Route
```bash
# Добавляем route для API
wrangler route add "api.yourdomain.com/*" packaging-calculator-api
```

### 3. SSL сертификат
Cloudflare автоматически предоставляет SSL сертификаты.

## 📱 Настройка клиентского приложения

### 1. Переменные окружения
Создайте `.env.local`:
```env
REACT_APP_CLIENT_API_KEY=your-client-api-key-here
REACT_APP_API_BASE_URL=https://api.yourdomain.com
```

### 2. Обновление конфигурации
В `services/geminiService.ts` обновите URL:
```typescript
const API_CONFIG = {
  baseUrl: process.env.REACT_APP_API_BASE_URL || 'https://packaging-calculator-api.your-subdomain.workers.dev',
  clientApiKey: process.env.REACT_APP_CLIENT_API_KEY || 'your-client-api-key',
  // ...
};
```

### 3. Развертывание на Cloudflare Pages
```bash
# Установите Cloudflare Pages CLI
npm install -g @cloudflare/wrangler

# Развертывание
wrangler pages deploy dist --project-name packaging-calculator
```

## 🔍 Мониторинг и аналитика

### 1. Cloudflare Analytics
- Перейдите в Cloudflare Dashboard
- Выберите ваш Worker
- Просмотрите метрики запросов

### 2. KV мониторинг
```bash
# Просмотр данных использования
wrangler kv:key get "usage:2024-12" --binding=KV
```

### 3. Логи Worker
```bash
# Просмотр логов в реальном времени
wrangler tail packaging-calculator-api
```

## 🛡️ Дополнительные меры безопасности

### 1. IP Whitelisting (опционально)
```javascript
// В workers/api-proxy.js
const allowedIPs = [
  '192.168.1.1',
  '10.0.0.1'
];

const clientIP = request.headers.get('CF-Connecting-IP');
if (!allowedIPs.includes(clientIP)) {
  return new Response('Forbidden', { status: 403 });
}
```

### 2. JWT токены (для продвинутой аутентификации)
```javascript
// Добавьте JWT проверку
import { verify } from 'jsonwebtoken';

const token = request.headers.get('Authorization')?.replace('Bearer ', '');
if (!token || !verify(token, env.JWT_SECRET)) {
  return new Response('Unauthorized', { status: 401 });
}
```

### 3. Webhook уведомления
```javascript
// Уведомления о превышении лимитов
if (usageData.totalTokens > 1000000) {
  await fetch(env.WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({
      text: '⚠️ Превышен месячный лимит токенов!'
    })
  });
}
```

## 🚨 Troubleshooting

### Проблема: 401 Unauthorized
**Решение:** Проверьте правильность CLIENT_API_KEY

### Проблема: 429 Rate Limited
**Решение:** Увеличьте лимиты или добавьте задержки

### Проблема: CORS ошибки
**Решение:** Проверьте настройки CORS в Worker

### Проблема: KV недоступен
**Решение:** Проверьте binding KV в wrangler.toml

## 📊 Стоимость

### Cloudflare Workers:
- **Бесплатно:** 100,000 запросов/день
- **Платно:** $0.50 за миллион запросов

### Cloudflare KV:
- **Бесплатно:** 100,000 операций/день
- **Платно:** $0.50 за миллион операций

### Cloudflare Pages:
- **Бесплатно:** Неограниченно

**Итого:** ~$5-10/месяц для среднего использования

## ✅ Чек-лист развертывания

- [ ] Установлен Wrangler CLI
- [ ] Создан KV namespace
- [ ] Настроены секреты
- [ ] Развернут Worker
- [ ] Настроен домен (опционально)
- [ ] Обновлены переменные окружения
- [ ] Протестирована аутентификация
- [ ] Настроен мониторинг
- [ ] Развернуто клиентское приложение

## 🔄 Обновления

### Обновление Worker:
```bash
wrangler deploy --env production
```

### Обновление клиента:
```bash
npm run build
wrangler pages deploy dist --project-name packaging-calculator
```

---

**Готово!** Ваше приложение теперь безопасно развернуто на Cloudflare с защищенными API ключами.
