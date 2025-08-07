# 📊 Система мониторинга калькулятора упаковки

## Обзор

Система мониторинга предоставляет комплексное логирование ошибок, отслеживание производительности и метрики использования для калькулятора упаковки. Это позволяет выявлять проблемы, оптимизировать производительность и контролировать расходы на API.

## 🏗️ Архитектура

### Компоненты системы мониторинга

1. **MonitoringService** (`services/monitoringService.ts`)
   - Центральный сервис для сбора и управления метриками
   - Singleton паттерн для глобального доступа
   - Автоматическая очистка старых данных

2. **MonitoringDashboard** (`components/MonitoringDashboard.tsx`)
   - React компонент для визуализации метрик
   - Вкладки для разных типов данных
   - Экспорт данных и очистка

3. **Интеграция с GeminiService**
   - Автоматическое логирование API запросов
   - Отслеживание использования токенов
   - Мониторинг производительности операций

## 📈 Типы метрик

### 1. Ошибки (Errors)
- **Уровни**: debug, info, warn, error, fatal
- **Контекст**: URL, User-Agent, timestamp
- **Автоматическое логирование**: критические ошибки отправляются немедленно

### 2. Производительность (Performance)
- **Время выполнения операций**
- **Медленные операции** (>5 секунд)
- **Успешность операций**

### 3. Использование токенов (Token Usage)
- **Входные/выходные токены**
- **Стоимость по моделям**
- **Предупреждения при высоком использовании**

### 4. API запросы
- **Статус ответов**
- **Время ответа**
- **Успешность запросов**

### 5. Кэш
- **Hit/Miss ratio**
- **Размер кэша**
- **Эффективность**

## 🚀 Использование

### Базовое логирование

```typescript
import { logger } from './services/monitoringService';

// Логирование ошибок
logger.error('Ошибка API', error, { context: 'additional data' });
logger.warn('Предупреждение', undefined, { warningType: 'rate_limit' });
logger.info('Информация', undefined, { operation: 'user_login' });

// Логирование производительности
import { performance } from './services/monitoringService';

const result = await performance.measure('operation_name', async () => {
  // Ваш код
  return someAsyncOperation();
}, { metadata: 'additional info' });
```

### Логирование API запросов

```typescript
import { metrics } from './services/monitoringService';

// Автоматически в GeminiService
metrics.logApiRequest('POST', '/api/endpoint', 200, 1500);
metrics.logTokenUsage(1000, 500, 'claude-3-sonnet', 'cost_estimation');
```

### Получение статистики

```typescript
import { metrics } from './services/monitoringService';

const stats = metrics.getStats();
console.log('Ошибки:', stats.errors.total);
console.log('Среднее время:', stats.performance.average);
console.log('Стоимость токенов:', stats.tokens.cost);
```

## 🎛️ Конфигурация

### Настройки MonitoringService

```typescript
const config = {
  maxLogs: 1000,           // Максимум логов в памяти
  maxMetrics: 500,         // Максимум метрик в памяти
  enableConsoleLogging: true,  // Логирование в консоль
  enableRemoteLogging: false,  // Отправка на удаленный сервер
  remoteEndpoint: '',      // URL для удаленного логирования
  batchSize: 10,           // Размер пакета для отправки
  flushInterval: 30000,    // Интервал отправки (30 сек)
};
```

### Обновление конфигурации

```typescript
import { monitoringService } from './services/monitoringService';

monitoringService.updateConfig({
  enableRemoteLogging: true,
  remoteEndpoint: 'https://your-logging-service.com/logs'
});
```

## 📊 Дашборд мониторинга

### Доступ к дашборду
- Кнопка мониторинга в правом нижнем углу
- Открывается модальное окно с вкладками

### Вкладки дашборда

1. **Обзор**
   - Общая статистика по всем метрикам
   - Ключевые показатели

2. **Ошибки**
   - Количество ошибок по уровням
   - Последние ошибки с деталями

3. **Производительность**
   - Среднее время операций
   - Самые медленные операции
   - Статистика по типам операций

4. **Токены**
   - Общее использование токенов
   - Стоимость по моделям
   - Графики использования

5. **API**
   - Статистика запросов
   - Успешность API
   - Время ответа

6. **Кэш**
   - Hit/Miss ratio
   - Размер кэша
   - Эффективность

### Функции дашборда

- **Экспорт данных**: Скачивание JSON файла с метриками
- **Очистка данных**: Удаление всех собранных метрик
- **Настройка обновления**: Интервал обновления (1-30 сек)

## 🔧 Интеграция с существующим кодом

### Автоматическое логирование

Система автоматически логирует:
- Все API запросы к Gemini
- Ошибки парсинга и валидации
- Операции с базой знаний
- Пользовательские действия

### Ручное логирование

Для кастомных операций:

```typescript
// В компонентах React
import { logger } from '../services/monitoringService';

const handleUserAction = () => {
  try {
    // Ваш код
    logger.info('User action completed', undefined, { action: 'button_click' });
  } catch (error) {
    logger.error('User action failed', error, { action: 'button_click' });
  }
};
```

## 📋 Метрики по умолчанию

### Пороги предупреждений

- **Медленные операции**: >5 секунд
- **Медленные API запросы**: >3 секунд
- **Высокое использование токенов**: >10,000 токенов
- **Низкая успешность API**: <90%
- **Низкая эффективность кэша**: <60%

### Автоматические действия

- Логирование предупреждений при превышении порогов
- Немедленная отправка критических ошибок
- Периодическая очистка старых данных

## 🛠️ Расширение системы

### Добавление новых метрик

```typescript
// В MonitoringService
interface CustomMetric {
  type: string;
  value: number;
  timestamp: Date;
}

class MonitoringService {
  private customMetrics: CustomMetric[] = [];
  
  public logCustomMetric(type: string, value: number): void {
    this.customMetrics.push({
      type,
      value,
      timestamp: new Date()
    });
  }
}
```

### Кастомные дашборды

```typescript
// Создание нового компонента дашборда
const CustomDashboard: React.FC = () => {
  const stats = metrics.getStats();
  
  return (
    <div>
      {/* Ваша кастомная визуализация */}
    </div>
  );
};
```

## 🔍 Отладка

### Включение отладочного режима

```typescript
// В консоли браузера
window.monitoringService = monitoringService;
window.metrics = metrics;
window.logger = logger;

// Просмотр статистики
console.log(metrics.getStats());

// Экспорт данных
console.log(metrics.exportData());
```

### Анализ логов

```typescript
// Фильтрация логов по типу
const errorLogs = stats.errors.recent.filter(log => log.level === 'error');

// Анализ производительности
const slowOperations = stats.performance.slowest;

// Анализ использования токенов
const expensiveModels = Object.entries(stats.tokens.byModel)
  .sort(([,a], [,b]) => b.cost - a.cost);
```

## 📈 Рекомендации по использованию

### Для разработки

1. **Включите отладочное логирование** для детального анализа
2. **Мониторьте медленные операции** для оптимизации
3. **Отслеживайте ошибки** для быстрого исправления

### Для продакшена

1. **Настройте удаленное логирование** для централизованного сбора
2. **Установите алерты** на критические метрики
3. **Регулярно анализируйте** использование токенов для контроля расходов

### Для оптимизации

1. **Анализируйте hit/miss ratio** кэша
2. **Мониторьте успешность API** запросов
3. **Отслеживайте** самые дорогие модели

## 🔐 Безопасность

### Конфиденциальность данных

- Логи не содержат персональных данных пользователей
- API ключи не логируются
- Чувствительная информация маскируется

### Ограничения доступа

- Дашборд доступен только в режиме разработки
- Удаленное логирование требует настройки CORS
- Экспорт данных ограничен по размеру

## 📚 Дополнительные ресурсы

- [Документация по Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Руководство по мониторингу веб-приложений](https://web.dev/monitoring/)
- [Лучшие практики логирования](https://12factor.net/logs)
