# 🔒 Руководство по безопасности

## Обзор

Этот документ описывает меры безопасности, реализованные в приложении калькулятора упаковки, а также рекомендации по их настройке и использованию.

## 🛡️ Реализованные меры безопасности

### 1. Удаление хардкода

#### Проблема
В исходном коде были захардкожены API ключи и URL, что представляло серьезную угрозу безопасности.

#### Решение
- **Переменные окружения**: Все конфиденциальные данные вынесены в переменные окружения
- **Централизованная конфигурация**: Создан файл `config/security.ts` для управления настройками безопасности
- **Безопасные примеры**: Обновлены примеры конфигурации без реальных ключей

```typescript
// Было (небезопасно):
const API_CONFIG = {
  baseUrl: 'https://packaging-calculator-api.46261vor.workers.dev',
  clientApiKey: '384e8b655b4c9bc468a411b65ce5151291a1d720823c7445af8572e7d009372b',
};

// Стало (безопасно):
const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || '',
  clientApiKey: import.meta.env.VITE_CLIENT_API_KEY || '',
};
```

### 2. Санитизация входных данных

#### Реализованные функции санитизации

```typescript
// HTML санитизация
sanitizeHtml: (input: string): string => {
  // Удаляет все HTML теги и экранирует специальные символы
}

// JSON санитизация
sanitizeJson: (input: any): any => {
  // Рекурсивно санитизирует все строки в объекте
}

// URL санитизация
sanitizeUrl: (url: string): string => {
  // Проверяет протокол и валидность URL
}

// Email санитизация
sanitizeEmail: (email: string): string => {
  // Валидирует и нормализует email адрес
}
```

#### Компонент SecureInput

Создан безопасный компонент для ввода с автоматической санитизацией:

```typescript
<SecureInput
  value={userInput}
  onChange={handleChange}
  type="text"
  maxLength={1000}
  validation={{
    sanitize: true,
    allowHtml: false
  }}
/>
```

### 3. Валидация данных

#### Типы валидации

- **Строки**: Проверка длины, формата, запрещенных символов
- **Числа**: Диапазоны, типы данных
- **Массивы**: Размер, содержимое
- **Объекты**: Глубина, структура
- **URL**: Протокол, формат
- **Email**: Формат, домен

#### Пример валидации

```typescript
const validation = validators.validateString(input, 1000);
if (!validation.valid) {
  throw new Error(validation.error);
}
```

### 4. Безопасный API сервис

Создан `SecureApiService` с встроенной защитой:

- **Rate limiting**: Ограничение количества запросов
- **Санитизация**: Автоматическая очистка всех данных
- **Валидация**: Проверка входных параметров
- **Повторные попытки**: Умная обработка ошибок
- **Логирование**: Безопасное логирование без конфиденциальных данных

### 5. Content Security Policy (CSP)

#### Настройки CSP

```json
{
  "Content-Security-Policy": {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "https:"],
    "connect-src": ["'self'", "https:"],
    "frame-src": ["'none'"],
    "object-src": ["'none'"]
  }
}
```

### 6. Заголовки безопасности

#### Обязательные заголовки

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

## 🔧 Настройка безопасности

### 1. Переменные окружения

Создайте файл `.env.local` на основе `env.local.example`:

```bash
# Скопируйте пример
cp env.local.example .env.local

# Отредактируйте файл
nano .env.local
```

#### Обязательные переменные

```env
# API конфигурация
VITE_CLIENT_API_KEY=your-secure-api-key-here
VITE_API_BASE_URL=https://your-api-domain.com

# Безопасность
VITE_STRICT_SECURITY_MODE=true
VITE_ENABLE_CSP=true
VITE_ENABLE_XSS_PROTECTION=true

# Rate limiting
VITE_MAX_REQUESTS_PER_MINUTE=100
VITE_MAX_REQUESTS_PER_HOUR=1000
```

### 2. Генерация API ключей

```bash
# Генерация безопасного API ключа
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Настройка веб-сервера

#### Nginx

```nginx
server {
    # Заголовки безопасности
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https:; frame-src 'none'; object-src 'none';";
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy strict-origin-when-cross-origin;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
}
```

#### Apache (.htaccess)

```apache
Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https:; frame-src 'none'; object-src 'none';"
Header always set X-Content-Type-Options nosniff
Header always set X-Frame-Options DENY
Header always set X-XSS-Protection "1; mode=block"
Header always set Referrer-Policy strict-origin-when-cross-origin
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
```

### 4. Cloudflare Workers

Для Cloudflare Workers используйте настройки из `public/security-headers.json`:

```javascript
// В вашем Worker
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https:; frame-src 'none'; object-src 'none';",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
};
```

## 🚨 Мониторинг безопасности

### 1. Логирование

Включите логирование безопасности:

```env
VITE_LOG_API_CALLS=true
VITE_LOG_LEVEL=info
```

### 2. Мониторинг токенов

```env
VITE_ENABLE_TOKEN_MONITORING=true
VITE_MAX_MONTHLY_TOKENS=1000000
```

### 3. Алерты

Настройте уведомления о:
- Превышении лимитов запросов
- Подозрительной активности
- Ошибках валидации
- Попытках XSS атак

## 🔍 Тестирование безопасности

### 1. Проверка заголовков

```bash
# Проверка заголовков безопасности
curl -I https://your-domain.com

# Ожидаемые заголовки:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
# Content-Security-Policy: default-src 'self'; ...
```

### 2. Тестирование XSS

```javascript
// Попробуйте ввести в поля:
<script>alert('xss')</script>
<img src="x" onerror="alert('xss')">
javascript:alert('xss')
```

Все эти попытки должны быть заблокированы или санитизированы.

### 3. Тестирование инъекций

```javascript
// SQL инъекции (если применимо)
'; DROP TABLE users; --

// NoSQL инъекции
{"$where": "function() { return true; }"}
```

### 4. Проверка CSP

Откройте консоль браузера и проверьте, что CSP работает корректно.

## 📋 Чек-лист безопасности

### Перед развертыванием

- [ ] Все API ключи вынесены в переменные окружения
- [ ] Настроены заголовки безопасности
- [ ] Включен CSP
- [ ] Настроен rate limiting
- [ ] Валидация всех входных данных
- [ ] Санитизация выходных данных
- [ ] Включен HTTPS
- [ ] Настроено логирование безопасности

### Регулярные проверки

- [ ] Обновление зависимостей
- [ ] Сканирование уязвимостей
- [ ] Проверка логов безопасности
- [ ] Тестирование мер безопасности
- [ ] Обновление API ключей
- [ ] Резервное копирование

## 🆘 Реагирование на инциденты

### 1. Обнаружение атаки

1. **Немедленно**: Остановите подозрительную активность
2. **Логирование**: Сохраните все логи
3. **Анализ**: Определите тип и масштаб атаки
4. **Блокировка**: Заблокируйте подозрительные IP/пользователей

### 2. Восстановление

1. **Оценка ущерба**: Определите, какие данные скомпрометированы
2. **Исправление**: Устраните уязвимости
3. **Восстановление**: Восстановите данные из резервных копий
4. **Уведомление**: Уведомите пользователей при необходимости

### 3. Профилактика

1. **Анализ**: Проанализируйте причины инцидента
2. **Улучшения**: Усильте меры безопасности
3. **Обучение**: Обновите процедуры безопасности
4. **Мониторинг**: Усильте мониторинг

## 📚 Дополнительные ресурсы

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Security Headers](https://securityheaders.com/)
- [Mozilla Security Guidelines](https://infosec.mozilla.org/guidelines/)

## 🤝 Сообщение об уязвимостях

Если вы обнаружили уязвимость в безопасности:

1. **НЕ** публикуйте информацию публично
2. Отправьте отчет на security@your-domain.com
3. Опишите уязвимость подробно
4. Предоставьте шаги для воспроизведения
5. Укажите возможные последствия

Мы рассмотрим ваш отчет в течение 48 часов и примем необходимые меры.

---

**Важно**: Безопасность - это непрерывный процесс. Регулярно обновляйте меры безопасности и следите за новыми угрозами.
