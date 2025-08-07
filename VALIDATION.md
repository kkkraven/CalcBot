# 🔍 Комплексная валидация пользовательских входных данных

## Обзор

Добавлена комплексная система валидации для всех пользовательских входных данных в API прокси и сервисе Gemini. Валидация обеспечивает безопасность, целостность данных и предотвращает ошибки на ранних этапах обработки.

## 🔧 API Прокси (`workers/api-proxy.js`)

### Функции валидации

#### 1. **validateApiKey** - Валидация API ключа
```javascript
validateApiKey: (apiKey) => {
  // Проверка наличия и типа
  // Проверка длины (10-100 символов)
  // Проверка допустимых символов (a-zA-Z0-9_-)
}
```

**Проверки:**
- ✅ Наличие API ключа
- ✅ Строковый тип
- ✅ Длина 10-100 символов
- ✅ Только допустимые символы: `a-zA-Z0-9_-`

#### 2. **validateIP** - Валидация IP адреса
```javascript
validateIP: (ip) => {
  // Проверка формата IPv4/IPv6
  // Использование регулярных выражений
}
```

**Проверки:**
- ✅ Наличие IP адреса
- ✅ Строковый тип
- ✅ Валидный формат IPv4 или IPv6

#### 3. **validateRequestStructure** - Валидация структуры запроса
```javascript
validateRequestStructure: (requestBody) => {
  // Проверка объекта
  // Проверка массива contents
  // Проверка длины массива (1-10 элементов)
}
```

**Проверки:**
- ✅ Тело запроса - объект
- ✅ Поле `contents` - массив
- ✅ Массив не пустой
- ✅ Максимум 10 элементов

#### 4. **validateContent** - Валидация содержимого сообщения
```javascript
validateContent: (content) => {
  // Проверка объекта content
  // Проверка массива parts
  // Проверка длины массива (1-50 элементов)
}
```

**Проверки:**
- ✅ Content - объект
- ✅ Поле `parts` - массив
- ✅ Массив не пустой
- ✅ Максимум 50 элементов

#### 5. **validateMessageText** - Валидация текста сообщения
```javascript
validateMessageText: (text) => {
  // Проверка типа и длины
  // Проверка на опасные паттерны
  // Лимит 100KB
}
```

**Проверки:**
- ✅ Не null/undefined
- ✅ Строковый тип
- ✅ Не пустая строка
- ✅ Максимум 100KB
- ✅ Безопасность от XSS/инъекций

**Опасные паттерны:**
- `<script>` теги
- `javascript:` протокол
- `data:text/html`
- `vbscript:` протокол
- `on*` обработчики событий

#### 6. **validateGenerationConfig** - Валидация конфигурации генерации
```javascript
validateGenerationConfig: (config) => {
  // Проверка temperature (0-2)
  // Проверка max_tokens (1-100000)
  // Проверка responseMimeType
}
```

**Проверки:**
- ✅ Temperature: 0-2
- ✅ Max_tokens: 1-100000
- ✅ ResponseMimeType: разрешенные типы

#### 7. **validateSystemInstruction** - Валидация системной инструкции
```javascript
validateSystemInstruction: (instruction) => {
  // Проверка типа и длины
  // Максимум 10KB
}
```

**Проверки:**
- ✅ Строковый тип
- ✅ Максимум 10KB

#### 8. **validateURL** - Валидация URL
```javascript
validateURL: (urlString) => {
  // Проверка формата URL
  // Проверка протокола (HTTP/HTTPS)
}
```

**Проверки:**
- ✅ Валидный формат URL
- ✅ HTTP или HTTPS протокол

#### 9. **validateMethod** - Валидация HTTP метода
```javascript
validateMethod: (method) => {
  // Проверка разрешенных методов
}
```

**Разрешенные методы:**
- GET, POST, PUT, DELETE, PATCH, OPTIONS

#### 10. **validateHeaders** - Валидация заголовков
```javascript
validateHeaders: (headers) => {
  // Проверка обязательных заголовков
  // Проверка Content-Type
}
```

**Проверки:**
- ✅ Обязательный Content-Type
- ✅ Content-Type = application/json

## 🔧 Сервис Gemini (`services/geminiService.ts`)

### Базовые функции валидации

#### 1. **validateString** - Валидация строк
```typescript
validateString: (value: any, fieldName: string, maxLength: number = 1000)
```

**Проверки:**
- ✅ Не null/undefined
- ✅ Строковый тип
- ✅ Не пустая строка
- ✅ Максимальная длина

#### 2. **validateNumber** - Валидация чисел
```typescript
validateNumber: (value: any, fieldName: string, min: number = 0, max: number = 1000000)
```

**Проверки:**
- ✅ Не null/undefined
- ✅ Числовой тип
- ✅ Конечное число
- ✅ Диапазон значений

#### 3. **validateArray** - Валидация массивов
```typescript
validateArray: (value: any, fieldName: string, maxLength: number = 100)
```

**Проверки:**
- ✅ Не null/undefined
- ✅ Массив
- ✅ Максимальная длина

#### 4. **validateObject** - Валидация объектов
```typescript
validateObject: (value: any, fieldName: string)
```

**Проверки:**
- ✅ Не null/undefined
- ✅ Объект (не массив)

#### 5. **validateEnum** - Валидация enum значений
```typescript
validateEnum: (value: any, fieldName: string, allowedValues: readonly string[])
```

**Проверки:**
- ✅ Строковый тип (если не null)
- ✅ Значение из разрешенного списка

#### 6. **validateURL** - Валидация URL
```typescript
validateURL: (value: any, fieldName: string)
```

**Проверки:**
- ✅ Валидный формат URL

### Специализированные функции валидации

#### 1. **validateFormData** - Валидация данных формы
```typescript
validateFormData: (formData: any): { valid: boolean; errors: string[] }
```

**Проверки для всех полей FormData:**
- ✅ **productType**: Enum из PRODUCT_TYPES
- ✅ **specificBoxType**: Enum из BOX_TYPES (только для коробок)
- ✅ **material**: Enum из MATERIALS
- ✅ **specificMaterialName**: Строка до 200 символов
- ✅ **materialDensity**: Число 1-10000
- ✅ **width/height/depth**: Число 1-10000
- ✅ **quantity**: Число 1-1000000 или строка до 50 символов
- ✅ **printColorsOuter/Inner**: Строка до 100 символов
- ✅ **printType**: Enum из PRINT_TYPES
- ✅ **finishes**: Массив enum из FINISH_TYPES
- ✅ **handleType**: Enum из HANDLE_TYPES (только для пакетов)
- ✅ **handleAttachment**: Enum из HANDLE_ATTACHMENTS (только для пакетов)
- ✅ **fittings**: Строка до 500 символов
- ✅ **additionalInfo**: Строка до 2000 символов

#### 2. **validateGeminiConfig** - Валидация конфигурации Gemini
```typescript
validateGeminiConfig: (config: any): { valid: boolean; errors: string[] }
```

**Проверки:**
- ✅ **temperature**: 0-2
- ✅ **responseMimeType**: Разрешенные типы
- ✅ **systemInstruction**: Строка до 10KB

#### 3. **validateContents** - Валидация содержимого запроса
```typescript
validateContents: (contents: any): { valid: boolean; errors: string[] }
```

**Проверки:**
- ✅ Массив contents
- ✅ 1-10 элементов
- ✅ Каждый элемент - объект с parts
- ✅ Parts - массив 1-50 элементов
- ✅ Каждая часть - объект с text
- ✅ Text - строка до 100KB

## 🎯 Типы валидируемых данных

### HTTP запросы
- ✅ HTTP метод
- ✅ URL
- ✅ Заголовки
- ✅ API ключ
- ✅ IP адрес

### JSON структуры
- ✅ Тело запроса
- ✅ Структура contents
- ✅ Структура parts
- ✅ Текст сообщения

### Конфигурация
- ✅ Temperature
- ✅ Max tokens
- ✅ Response MIME type
- ✅ System instruction

### Данные формы
- ✅ Все поля FormData
- ✅ Enum значения
- ✅ Числовые диапазоны
- ✅ Строковые лимиты

## 🛡️ Безопасность

### Защита от XSS
- ✅ Блокировка `<script>` тегов
- ✅ Блокировка `javascript:` протокола
- ✅ Блокировка `data:` протокола
- ✅ Блокировка обработчиков событий

### Защита от инъекций
- ✅ Валидация API ключей
- ✅ Проверка форматов данных
- ✅ Ограничение размеров

### Защита от переполнения
- ✅ Лимиты на размеры строк
- ✅ Лимиты на размеры массивов
- ✅ Лимиты на числовые значения

## 📊 Обработка ошибок валидации

### Структура ошибки
```javascript
{
  valid: boolean,
  error?: string,
  errors?: string[]
}
```

### HTTP ответы
```javascript
{
  error: {
    code: 400,
    message: "Описание ошибки валидации",
    details: { /* дополнительная информация */ }
  }
}
```

### Логирование
- ✅ Все ошибки валидации логируются
- ✅ Контекстная информация
- ✅ Детали невалидных данных

## 🚀 Преимущества валидации

### 1. **Безопасность**
- Предотвращение XSS атак
- Блокировка опасных паттернов
- Валидация API ключей

### 2. **Целостность данных**
- Проверка типов данных
- Валидация диапазонов
- Проверка обязательных полей

### 3. **Производительность**
- Раннее обнаружение ошибок
- Снижение нагрузки на API
- Оптимизация обработки

### 4. **Пользовательский опыт**
- Понятные сообщения об ошибках
- Быстрая обратная связь
- Предотвращение сбоев

### 5. **Отладка**
- Детальное логирование ошибок
- Контекстная информация
- Структурированные сообщения

## 📈 Метрики валидации

### Отслеживаемые метрики
- Количество ошибок валидации по типам
- Частота невалидных запросов
- Время обработки валидации
- Эффективность блокировки

### Рекомендуемые алерты
- Ошибки валидации > 10% запросов
- Подозрительные паттерны в данных
- Частые ошибки API ключей
- Превышение лимитов размеров

## 🎉 Результат

✅ **Повышена безопасность** - защита от XSS и инъекций
✅ **Улучшена целостность данных** - валидация всех входных данных
✅ **Оптимизирована производительность** - раннее обнаружение ошибок
✅ **Улучшен UX** - понятные сообщения об ошибках
✅ **Упрощена отладка** - детальное логирование валидации

Все пользовательские входные данные теперь проходят комплексную валидацию на всех уровнях приложения! 🔍🛡️
