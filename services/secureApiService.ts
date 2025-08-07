// Безопасный сервис для работы с API
import { defaultSecurityConfig, sanitizers, validators } from '../config/security';
import { logger } from './monitoringService';

export interface ApiRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
  success: boolean;
  error?: string;
}

export interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

class SecureApiService {
  private config = defaultSecurityConfig;
  private requestCount = 0;
  private lastRequestTime = 0;

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    // Загружаем конфигурацию из переменных окружения
    this.config.api.baseUrl = import.meta.env.VITE_API_BASE_URL || this.config.api.baseUrl;
    this.config.api.clientApiKey = import.meta.env.VITE_CLIENT_API_KEY || this.config.api.clientApiKey;
    this.config.api.maxRequestsPerMinute = parseInt(import.meta.env.VITE_MAX_REQUESTS_PER_MINUTE || '100');
    this.config.api.maxRequestsPerHour = parseInt(import.meta.env.VITE_MAX_REQUESTS_PER_HOUR || '1000');
    this.config.api.retryAttempts = parseInt(import.meta.env.VITE_RETRY_ATTEMPTS || '3');
    this.config.api.retryDelay = parseInt(import.meta.env.VITE_RETRY_DELAY || '1000');
  }

  // Санитизация и валидация URL
  private sanitizeUrl(url: string): string {
    const sanitized = sanitizers.sanitizeUrl(url);
    if (!sanitized) {
      throw new Error('Неверный формат URL');
    }
    return sanitized;
  }

  // Санитизация и валидация заголовков
  private sanitizeHeaders(headers: Record<string, string> = {}): Record<string, string> {
    const sanitized: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(headers)) {
      const sanitizedKey = sanitizers.sanitizeHtml(key);
      const sanitizedValue = sanitizers.sanitizeHtml(value);
      
      if (sanitizedKey && sanitizedValue) {
        sanitized[sanitizedKey] = sanitizedValue;
      }
    }

    return sanitized;
  }

  // Санитизация и валидация данных запроса
  private sanitizeRequestData(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    // Валидация размера данных
    const dataSize = JSON.stringify(data).length;
    if (dataSize > this.config.validation.maxStringLength) {
      throw new Error(`Размер данных слишком большой (${dataSize} символов)`);
    }

    return sanitizers.sanitizeJson(data);
  }

  // Проверка rate limiting
  private checkRateLimit(): RateLimitInfo {
    const now = Date.now();
    const minuteWindow = Math.floor(now / (60 * 1000));
    const hourWindow = Math.floor(now / (60 * 60 * 1000));

    // Простая проверка rate limiting на клиенте
    if (now - this.lastRequestTime < 1000 / this.config.api.maxRequestsPerMinute) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: this.lastRequestTime + 1000
      };
    }

    this.lastRequestTime = now;
    this.requestCount++;

    return {
      allowed: true,
      remaining: this.config.api.maxRequestsPerMinute - this.requestCount,
      resetTime: (minuteWindow + 1) * 60 * 1000
    };
  }

  // Валидация конфигурации API
  private validateApiConfig(): void {
    if (!this.config.api.baseUrl) {
      throw new Error('API base URL не настроен');
    }

    if (!this.config.api.clientApiKey) {
      throw new Error('API ключ клиента не настроен');
    }

    const urlValidation = validators.validateUrl(this.config.api.baseUrl);
    if (!urlValidation.valid) {
      throw new Error(`Неверный формат API URL: ${urlValidation.error}`);
    }
  }

  // Основной метод для выполнения запросов
  async request<T = any>(config: ApiRequestConfig): Promise<ApiResponse<T>> {
    try {
      // Валидация конфигурации API
      this.validateApiConfig();

      // Проверка rate limiting
      const rateLimit = this.checkRateLimit();
      if (!rateLimit.allowed) {
        throw new Error(`Превышен лимит запросов. Попробуйте позже.`);
      }

      // Санитизация URL
      const sanitizedUrl = this.sanitizeUrl(config.url);

      // Санитизация заголовков
      const sanitizedHeaders = this.sanitizeHeaders(config.headers);

      // Санитизация данных
      const sanitizedData = config.data ? this.sanitizeRequestData(config.data) : undefined;

      // Добавляем стандартные заголовки
      const headers = {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.api.clientApiKey,
        'User-Agent': 'PackagingCalculator/1.0',
        ...sanitizedHeaders
      };

      // Настройки запроса
      const requestConfig: RequestInit = {
        method: config.method,
        headers,
        timeout: config.timeout || 30000,
      };

      // Добавляем тело запроса для POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(config.method) && sanitizedData) {
        requestConfig.body = JSON.stringify(sanitizedData);
      }

      // Выполняем запрос с повторными попытками
      let lastError: Error | null = null;
      const maxAttempts = config.retryAttempts || this.config.api.retryAttempts;
      const retryDelay = config.retryDelay || this.config.api.retryDelay;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          logger.info('API request', undefined, {
            method: config.method,
            url: sanitizedUrl,
            attempt,
            maxAttempts
          });

          const response = await fetch(sanitizedUrl, requestConfig);

          // Обрабатываем ответ
          const responseData = await this.handleResponse<T>(response);

          logger.info('API response success', undefined, {
            method: config.method,
            url: sanitizedUrl,
            status: response.status,
            attempt
          });

          return responseData;

        } catch (error) {
          lastError = error as Error;
          logger.error('API request failed', error as Error, {
            method: config.method,
            url: sanitizedUrl,
            attempt,
            maxAttempts,
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          // Если это последняя попытка, выбрасываем ошибку
          if (attempt === maxAttempts) {
            break;
          }

          // Ждем перед следующей попыткой
          await this.delay(retryDelay * attempt);
        }
      }

      throw lastError || new Error('Неизвестная ошибка API');

    } catch (error) {
      logger.error('Secure API request failed', error as Error, {
        method: config.method,
        url: config.url,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        data: null as T,
        status: 0,
        headers: {},
        success: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      };
    }
  }

  // Обработка ответа от сервера
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Проверяем статус ответа
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const errorData = await response.json();
        if (errorData.error && errorData.error.message) {
          errorMessage = errorData.error.message;
        }
      } catch {
        // Игнорируем ошибки парсинга JSON
      }

      throw new Error(errorMessage);
    }

    // Парсим ответ
    let data: T;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text() as T;
      }
    } catch (error) {
      throw new Error('Ошибка парсинга ответа');
    }

    return {
      data,
      status: response.status,
      headers,
      success: true
    };
  }

  // Задержка для повторных попыток
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Методы для конкретных типов запросов
  async get<T = any>(url: string, config?: Partial<ApiRequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'GET',
      url,
      ...config
    });
  }

  async post<T = any>(url: string, data?: any, config?: Partial<ApiRequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'POST',
      url,
      data,
      ...config
    });
  }

  async put<T = any>(url: string, data?: any, config?: Partial<ApiRequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'PUT',
      url,
      data,
      ...config
    });
  }

  async delete<T = any>(url: string, config?: Partial<ApiRequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'DELETE',
      url,
      ...config
    });
  }

  // Метод для работы с Gemini API
  async callGeminiApi<T = any>(
    modelName: string,
    contents: any,
    config?: any
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.api.baseUrl}/v1beta/models/gemini:generateContent`;
    
    const requestBody = {
      contents: this.sanitizeRequestData(contents),
      generationConfig: config ? this.sanitizeRequestData(config) : undefined
    };

    return this.post<T>(url, requestBody);
  }

  // Получение статистики
  getStats() {
    return {
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      config: {
        baseUrl: this.config.api.baseUrl,
        maxRequestsPerMinute: this.config.api.maxRequestsPerMinute,
        maxRequestsPerHour: this.config.api.maxRequestsPerHour
      }
    };
  }

  // Сброс статистики
  resetStats() {
    this.requestCount = 0;
    this.lastRequestTime = 0;
  }
}

// Экспортируем экземпляр сервиса
export const secureApiService = new SecureApiService();

// Экспортируем типы для использования в других модулях
export type { ApiRequestConfig, ApiResponse, RateLimitInfo };
