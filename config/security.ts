// Конфигурация безопасности для приложения
export interface SecurityConfig {
  // API конфигурация
  api: {
    baseUrl: string;
    clientApiKey: string;
    maxRequestsPerMinute: number;
    maxRequestsPerHour: number;
    retryAttempts: number;
    retryDelay: number;
  };
  
  // Валидация входных данных
  validation: {
    maxStringLength: number;
    maxArrayLength: number;
    maxObjectDepth: number;
    allowedFileTypes: string[];
    maxFileSize: number;
  };
  
  // Санитизация
  sanitization: {
    allowedHtmlTags: string[];
    allowedAttributes: string[];
    maxScriptLength: number;
  };
  
  // Rate limiting
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
  };
  
  // CSP (Content Security Policy)
  csp: {
    enabled: boolean;
    directives: Record<string, string[]>;
  };
  
  // Логирование
  logging: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    sensitiveFields: string[];
  };
}

// Функции санитизации
export const sanitizers = {
  // Санитизация HTML
  sanitizeHtml: (input: string): string => {
    if (!input || typeof input !== 'string') return '';
    
    // Удаляем все HTML теги
    let sanitized = input.replace(/<[^>]*>/g, '');
    
    // Экранируем специальные символы
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
    
    return sanitized;
  },
  
  // Санитизация JSON
  sanitizeJson: (input: any): any => {
    if (input === null || input === undefined) return input;
    
    if (typeof input === 'string') {
      return sanitizers.sanitizeHtml(input);
    }
    
    if (typeof input === 'number' || typeof input === 'boolean') {
      return input;
    }
    
    if (Array.isArray(input)) {
      return input.map(item => sanitizers.sanitizeJson(item));
    }
    
    if (typeof input === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        const sanitizedKey = sanitizers.sanitizeHtml(key);
        sanitized[sanitizedKey] = sanitizers.sanitizeJson(value);
      }
      return sanitized;
    }
    
    return input;
  },
  
  // Санитизация URL
  sanitizeUrl: (url: string): string => {
    if (!url || typeof url !== 'string') return '';
    
    try {
      const parsed = new URL(url);
      // Разрешаем только HTTP и HTTPS
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return '';
      }
      return parsed.toString();
    } catch {
      return '';
    }
  },
  
  // Санитизация email
  sanitizeEmail: (email: string): string => {
    if (!email || typeof email !== 'string') return '';
    
    // Простая валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return '';
    }
    
    return email.toLowerCase().trim();
  },
  
  // Санитизация номера телефона
  sanitizePhone: (phone: string): string => {
    if (!phone || typeof phone !== 'string') return '';
    
    // Удаляем все символы кроме цифр, +, -, (, )
    const cleaned = phone.replace(/[^\d+\-()]/g, '');
    
    // Проверяем минимальную длину
    if (cleaned.length < 7) {
      return '';
    }
    
    return cleaned;
  }
};

// Функции валидации
export const validators = {
  // Валидация строки
  validateString: (value: any, maxLength: number = 1000): { valid: boolean; error?: string } => {
    if (value === undefined || value === null) {
      return { valid: false, error: 'Значение не может быть null или undefined' };
    }
    if (typeof value !== 'string') {
      return { valid: false, error: 'Значение должно быть строкой' };
    }
    if (value.trim().length === 0) {
      return { valid: false, error: 'Строка не может быть пустой' };
    }
    if (value.length > maxLength) {
      return { valid: false, error: `Строка слишком длинная (максимум ${maxLength} символов)` };
    }
    return { valid: true };
  },
  
  // Валидация числа
  validateNumber: (value: any, min: number = 0, max: number = 1000000): { valid: boolean; error?: string } => {
    if (value === undefined || value === null) {
      return { valid: false, error: 'Значение не может быть null или undefined' };
    }
    if (typeof value !== 'number') {
      return { valid: false, error: 'Значение должно быть числом' };
    }
    if (isNaN(value) || !isFinite(value)) {
      return { valid: false, error: 'Значение должно быть конечным числом' };
    }
    if (value < min || value > max) {
      return { valid: false, error: `Значение должно быть в диапазоне ${min}-${max}` };
    }
    return { valid: true };
  },
  
  // Валидация массива
  validateArray: (value: any, maxLength: number = 100): { valid: boolean; error?: string } => {
    if (value === undefined || value === null) {
      return { valid: false, error: 'Значение не может быть null или undefined' };
    }
    if (!Array.isArray(value)) {
      return { valid: false, error: 'Значение должно быть массивом' };
    }
    if (value.length > maxLength) {
      return { valid: false, error: `Массив слишком длинный (максимум ${maxLength} элементов)` };
    }
    return { valid: true };
  },
  
  // Валидация объекта
  validateObject: (value: any, maxDepth: number = 5): { valid: boolean; error?: string } => {
    if (value === undefined || value === null) {
      return { valid: false, error: 'Значение не может быть null или undefined' };
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      return { valid: false, error: 'Значение должно быть объектом' };
    }
    
    // Проверяем глубину объекта
    const checkDepth = (obj: any, depth: number = 0): boolean => {
      if (depth > maxDepth) return false;
      for (const key in obj) {
        if (obj.hasOwnProperty(key) && typeof obj[key] === 'object' && obj[key] !== null) {
          if (!checkDepth(obj[key], depth + 1)) return false;
        }
      }
      return true;
    };
    
    if (!checkDepth(value)) {
      return { valid: false, error: `Объект слишком глубокий (максимум ${maxDepth} уровней)` };
    }
    
    return { valid: true };
  },
  
  // Валидация email
  validateEmail: (email: string): { valid: boolean; error?: string } => {
    if (!email || typeof email !== 'string') {
      return { valid: false, error: 'Email должен быть строкой' };
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, error: 'Неверный формат email' };
    }
    
    return { valid: true };
  },
  
  // Валидация URL
  validateUrl: (url: string): { valid: boolean; error?: string } => {
    if (!url || typeof url !== 'string') {
      return { valid: false, error: 'URL должен быть строкой' };
    }
    
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, error: 'URL должен использовать HTTP или HTTPS протокол' };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: 'Неверный формат URL' };
    }
  }
};

// Функции для работы с CSP
export const cspHelpers = {
  // Генерация CSP заголовка
  generateCSPHeader: (directives: Record<string, string[]>): string => {
    const parts: string[] = [];
    
    for (const [directive, sources] of Object.entries(directives)) {
      if (sources && sources.length > 0) {
        parts.push(`${directive} ${sources.join(' ')}`);
      }
    }
    
    return parts.join('; ');
  },
  
  // Проверка соответствия CSP
  validateCSP: (csp: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!csp || typeof csp !== 'string') {
      errors.push('CSP должен быть строкой');
      return { valid: false, errors };
    }
    
    const directives = csp.split(';').map(d => d.trim()).filter(d => d);
    
    for (const directive of directives) {
      const [name, ...sources] = directive.split(' ');
      if (!name || sources.length === 0) {
        errors.push(`Неверный формат директивы: ${directive}`);
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
};

// Функции для работы с rate limiting
export const rateLimitHelpers = {
  // Генерация ключа для rate limiting
  generateRateLimitKey: (identifier: string, windowMs: number): string => {
    const window = Math.floor(Date.now() / windowMs);
    return `rate_limit:${identifier}:${window}`;
  },
  
  // Проверка rate limit
  checkRateLimit: async (
    identifier: string, 
    maxRequests: number, 
    windowMs: number,
    storage: { get: (key: string) => Promise<string | null>; put: (key: string, value: string, options?: any) => Promise<void> }
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> => {
    const key = rateLimitHelpers.generateRateLimitKey(identifier, windowMs);
    const current = await storage.get(key);
    const currentCount = current ? parseInt(current) : 0;
    
    if (currentCount >= maxRequests) {
      const resetTime = Math.ceil(Date.now() / windowMs) * windowMs;
      return { allowed: false, remaining: 0, resetTime };
    }
    
    await storage.put(key, (currentCount + 1).toString(), { expirationTtl: Math.ceil(windowMs / 1000) });
    
    return { 
      allowed: true, 
      remaining: maxRequests - currentCount - 1, 
      resetTime: Math.ceil(Date.now() / windowMs) * windowMs 
    };
  }
};

// Экспорт конфигурации по умолчанию
export const defaultSecurityConfig: SecurityConfig = {
  api: {
    baseUrl: process.env.VITE_API_BASE_URL || '',
    clientApiKey: process.env.VITE_CLIENT_API_KEY || '',
    maxRequestsPerMinute: 100,
    maxRequestsPerHour: 1000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  validation: {
    maxStringLength: 10000,
    maxArrayLength: 1000,
    maxObjectDepth: 10,
    allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxFileSize: 5 * 1024 * 1024, // 5MB
  },
  sanitization: {
    allowedHtmlTags: [],
    allowedAttributes: [],
    maxScriptLength: 1000,
  },
  rateLimiting: {
    enabled: true,
    windowMs: 60 * 1000, // 1 минута
    maxRequests: 100,
    skipSuccessfulRequests: false,
  },
  csp: {
    enabled: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'", 'https:'],
      'font-src': ["'self'"],
      'object-src': ["'none'"],
      'media-src': ["'self'"],
      'frame-src': ["'none'"],
    },
  },
  logging: {
    enabled: true,
    level: 'info',
    sensitiveFields: ['password', 'apiKey', 'token', 'secret'],
  },
};
