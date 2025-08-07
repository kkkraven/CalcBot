// Сервис мониторинга для логирования ошибок и производительности
export interface LogLevel {
  DEBUG: 'debug';
  INFO: 'info';
  WARN: 'warn';
  ERROR: 'error';
  FATAL: 'fatal';
}

export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  metadata?: Record<string, any>;
}

export interface ErrorLog {
  level: keyof LogLevel;
  message: string;
  error?: Error;
  context?: Record<string, any>;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  url?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  model: string;
  operation: string;
  timestamp: Date;
}

export interface ApiRequest {
  method: string;
  url: string;
  status: number;
  duration: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
  error?: string;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  timestamp: Date;
}

class MonitoringService {
  private static instance: MonitoringService;
  private performanceMetrics: PerformanceMetric[] = [];
  private errorLogs: ErrorLog[] = [];
  private tokenUsage: TokenUsage[] = [];
  private apiRequests: ApiRequest[] = [];
  private cacheMetrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    size: 0,
    timestamp: new Date()
  };

  // Конфигурация
  private config = {
    maxLogs: 1000,
    maxMetrics: 500,
    enableConsoleLogging: true,
    enableRemoteLogging: false,
    remoteEndpoint: '',
    batchSize: 10,
    flushInterval: 30000, // 30 секунд
  };

  private constructor() {
    this.startPeriodicFlush();
  }

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  // Логирование ошибок
  public logError(
    level: keyof LogLevel,
    message: string,
    error?: Error,
    context?: Record<string, any>
  ): void {
    try {
      const errorLog: ErrorLog = {
        level,
        message,
        error,
        context: {
          ...context,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      this.errorLogs.push(errorLog);

      // Ограничиваем размер массива
      if (this.errorLogs.length > this.config.maxLogs) {
        this.errorLogs = this.errorLogs.slice(-this.config.maxLogs);
      }

      // Консольное логирование
      if (this.config.enableConsoleLogging) {
        const logMessage = `[${level.toUpperCase()}] ${message}`;
        const logData = { error, context, timestamp: errorLog.timestamp };
        
        switch (level) {
          case 'debug':
            console.debug(logMessage, logData);
            break;
          case 'info':
            console.info(logMessage, logData);
            break;
          case 'warn':
            console.warn(logMessage, logData);
            break;
          case 'error':
          case 'fatal':
            console.error(logMessage, logData);
            break;
        }
      }

      // Отправляем критические ошибки немедленно
      if (level === 'fatal' || level === 'error') {
        this.sendToRemoteLogging([errorLog]);
      }
    } catch (loggingError) {
      console.error('Error in logError:', loggingError);
    }
  }

  // Измерение производительности
  public async measurePerformance<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    let success = false;
    let result: T;

    try {
      result = await fn();
      success = true;
      return result;
    } catch (error) {
      this.logError('error', `Performance measurement failed for ${operation}`, error as Error, metadata);
      throw error;
    } finally {
      const duration = performance.now() - startTime;
      this.recordPerformanceMetric(operation, duration, success, metadata);
    }
  }

  private recordPerformanceMetric(
    operation: string,
    duration: number,
    success: boolean,
    metadata?: Record<string, any>
  ): void {
    try {
      const metric: PerformanceMetric = {
        operation,
        duration,
        timestamp: new Date(),
        success,
        metadata,
      };

      this.performanceMetrics.push(metric);

      // Ограничиваем размер массива
      if (this.performanceMetrics.length > this.config.maxMetrics) {
        this.performanceMetrics = this.performanceMetrics.slice(-this.config.maxMetrics);
      }

      // Логируем медленные операции
      if (duration > 5000) { // Более 5 секунд
        this.logError('warn', `Slow operation detected: ${operation} took ${duration.toFixed(2)}ms`, undefined, {
          duration,
          operation,
          ...metadata,
        });
      }
    } catch (error) {
      console.error('Error recording performance metric:', error);
    }
  }

  // Логирование использования токенов
  public logTokenUsage(
    inputTokens: number,
    outputTokens: number,
    model: string,
    operation: string
  ): void {
    try {
      const totalTokens = inputTokens + outputTokens;
      const cost = this.calculateTokenCost(totalTokens, model);

      const usage: TokenUsage = {
        inputTokens,
        outputTokens,
        totalTokens,
        cost,
        model,
        operation,
        timestamp: new Date(),
      };

      this.tokenUsage.push(usage);

      // Ограничиваем размер массива
      if (this.tokenUsage.length > this.config.maxMetrics) {
        this.tokenUsage = this.tokenUsage.slice(-this.config.maxMetrics);
      }

      // Логируем высокое использование токенов
      if (totalTokens > 10000) {
        this.logError('warn', `High token usage detected: ${totalTokens} tokens for ${operation}`, undefined, {
          totalTokens,
          model,
          operation,
          cost,
        });
      }
    } catch (error) {
      console.error('Error logging token usage:', error);
    }
  }

  // Логирование API запросов
  public logApiRequest(
    method: string,
    url: string,
    status: number,
    duration: number,
    error?: string
  ): void {
    try {
      const request: ApiRequest = {
        method,
        url,
        status,
        duration,
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        error,
      };

      this.apiRequests.push(request);

      // Ограничиваем размер массива
      if (this.apiRequests.length > this.config.maxMetrics) {
        this.apiRequests = this.apiRequests.slice(-this.config.maxMetrics);
      }

      // Логируем ошибки API
      if (status >= 400) {
        this.logError('error', `API request failed: ${method} ${url}`, undefined, {
          status,
          duration,
          error,
        });
      }

      // Логируем медленные запросы
      if (duration > 3000) { // Более 3 секунд
        this.logError('warn', `Slow API request: ${method} ${url}`, undefined, {
          duration,
          status,
        });
      }
    } catch (error) {
      console.error('Error logging API request:', error);
    }
  }

  // Обновление метрик кэша
  public updateCacheMetrics(hit: boolean, size?: number): void {
    try {
      if (hit) {
        this.cacheMetrics.hits++;
      } else {
        this.cacheMetrics.misses++;
      }

      if (size !== undefined) {
        this.cacheMetrics.size = size;
      }

      const total = this.cacheMetrics.hits + this.cacheMetrics.misses;
      this.cacheMetrics.hitRate = total > 0 ? this.cacheMetrics.hits / total : 0;
      this.cacheMetrics.timestamp = new Date();
    } catch (error) {
      console.error('Error updating cache metrics:', error);
    }
  }

  // Расчет стоимости токенов
  private calculateTokenCost(totalTokens: number, model: string): number {
    // Примерные цены за 1K токенов (в долларах)
    const prices: Record<string, number> = {
      'claude-3-haiku': 0.00025,
      'claude-3-sonnet': 0.003,
      'claude-3-opus': 0.015,
      'gpt-4': 0.03,
      'gpt-3.5-turbo': 0.002,
    };

    const pricePer1K = prices[model] || 0.001; // По умолчанию $0.001
    return (totalTokens / 1000) * pricePer1K;
  }

  // Получение статистики
  public getStats() {
    return {
      errors: {
        total: this.errorLogs.length,
        byLevel: this.getErrorStatsByLevel(),
        recent: this.errorLogs.slice(-10),
      },
      performance: {
        total: this.performanceMetrics.length,
        average: this.calculateAveragePerformance(),
        slowest: this.getSlowestOperations(),
        recent: this.performanceMetrics.slice(-10),
      },
      tokens: {
        total: this.tokenUsage.reduce((sum, usage) => sum + usage.totalTokens, 0),
        cost: this.tokenUsage.reduce((sum, usage) => sum + usage.cost, 0),
        byModel: this.getTokenUsageByModel(),
        recent: this.tokenUsage.slice(-10),
      },
      api: {
        total: this.apiRequests.length,
        successRate: this.calculateApiSuccessRate(),
        averageResponseTime: this.calculateAverageApiResponseTime(),
        recent: this.apiRequests.slice(-10),
      },
      cache: this.cacheMetrics,
    };
  }

  private getErrorStatsByLevel() {
    const stats: Record<string, number> = {};
    this.errorLogs.forEach(log => {
      stats[log.level] = (stats[log.level] || 0) + 1;
    });
    return stats;
  }

  private calculateAveragePerformance(): number {
    if (this.performanceMetrics.length === 0) return 0;
    const total = this.performanceMetrics.reduce((sum, metric) => sum + metric.duration, 0);
    return total / this.performanceMetrics.length;
  }

  private getSlowestOperations(): PerformanceMetric[] {
    return [...this.performanceMetrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);
  }

  private getTokenUsageByModel(): Record<string, { tokens: number; cost: number }> {
    const stats: Record<string, { tokens: number; cost: number }> = {};
    this.tokenUsage.forEach(usage => {
      if (!stats[usage.model]) {
        stats[usage.model] = { tokens: 0, cost: 0 };
      }
      stats[usage.model].tokens += usage.totalTokens;
      stats[usage.model].cost += usage.cost;
    });
    return stats;
  }

  private calculateApiSuccessRate(): number {
    if (this.apiRequests.length === 0) return 0;
    const successful = this.apiRequests.filter(req => req.status < 400).length;
    return successful / this.apiRequests.length;
  }

  private calculateAverageApiResponseTime(): number {
    if (this.apiRequests.length === 0) return 0;
    const total = this.apiRequests.reduce((sum, req) => sum + req.duration, 0);
    return total / this.apiRequests.length;
  }

  // Периодическая отправка логов
  private startPeriodicFlush(): void {
    setInterval(() => {
      this.flushLogs();
    }, this.config.flushInterval);
  }

  private async flushLogs(): Promise<void> {
    if (!this.config.enableRemoteLogging || this.errorLogs.length === 0) {
      return;
    }

    try {
      const logsToSend = this.errorLogs.slice(0, this.config.batchSize);
      await this.sendToRemoteLogging(logsToSend);
      
      // Удаляем отправленные логи
      this.errorLogs = this.errorLogs.slice(this.config.batchSize);
    } catch (error) {
      console.error('Error flushing logs:', error);
    }
  }

  private async sendToRemoteLogging(logs: ErrorLog[]): Promise<void> {
    if (!this.config.enableRemoteLogging || !this.config.remoteEndpoint) {
      return;
    }

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
        }),
      });
    } catch (error) {
      console.error('Error sending logs to remote endpoint:', error);
    }
  }

  // Экспорт данных для отладки
  public exportData(): string {
    return JSON.stringify({
      stats: this.getStats(),
      config: this.config,
      timestamp: new Date().toISOString(),
    }, null, 2);
  }

  // Очистка данных
  public clearData(): void {
    this.errorLogs = [];
    this.performanceMetrics = [];
    this.tokenUsage = [];
    this.apiRequests = [];
    this.cacheMetrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
      timestamp: new Date(),
    };
  }

  // Настройка конфигурации
  public updateConfig(newConfig: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Экспортируем экземпляр сервиса
export const monitoringService = MonitoringService.getInstance();

// Утилиты для удобного использования
export const logger = {
  debug: (message: string, context?: Record<string, any>) => 
    monitoringService.logError('debug', message, undefined, context),
  info: (message: string, context?: Record<string, any>) => 
    monitoringService.logError('info', message, undefined, context),
  warn: (message: string, context?: Record<string, any>) => 
    monitoringService.logError('warn', message, undefined, context),
  error: (message: string, error?: Error, context?: Record<string, any>) => 
    monitoringService.logError('error', message, error, context),
  fatal: (message: string, error?: Error, context?: Record<string, any>) => 
    monitoringService.logError('fatal', message, error, context),
};

export const performance = {
  measure: <T>(operation: string, fn: () => Promise<T>, metadata?: Record<string, any>) =>
    monitoringService.measurePerformance(operation, fn, metadata),
};

export const metrics = {
  logTokenUsage: (inputTokens: number, outputTokens: number, model: string, operation: string) =>
    monitoringService.logTokenUsage(inputTokens, outputTokens, model, operation),
  logApiRequest: (method: string, url: string, status: number, duration: number, error?: string) =>
    monitoringService.logApiRequest(method, url, status, duration, error),
  updateCacheMetrics: (hit: boolean, size?: number) =>
    monitoringService.updateCacheMetrics(hit, size),
  getStats: () => monitoringService.getStats(),
  exportData: () => monitoringService.exportData(),
  clearData: () => monitoringService.clearData(),
};
