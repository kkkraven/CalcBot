
import { FormData, ProductType, BoxType, Material, PrintType, FinishType, HandleType, HandleAttachment } from '../types';
import { KNOWLEDGE_BASE_STRUCTURE_PROMPT, PRICING_RULES_PROMPT, PRODUCT_TYPES, BOX_TYPES, MATERIALS, PRINT_TYPES, FINISH_TYPES, HANDLE_TYPES, HANDLE_ATTACHMENTS } from '../constants';
import { knowledgeBase } from './knowledgeBase';

// Функции кэширования для сервиса OpenRouter
const clientCache = {
  // Простой in-memory кэш для клиентской стороны
  cache: new Map<string, { data: any; expires: number }>(),
  maxSize: 100,

  // Генерация ключа кэша
  generateKey: (modelName: string, contents: any, config?: any): string => {
    try {
      const cacheData = {
        model: modelName,
        contents: contents,
        config: config
      };
      return btoa(JSON.stringify(cacheData)).slice(0, 50).replace(/[^a-zA-Z0-9]/g, '_');
    } catch (error) {
      console.error('Error generating cache key:', error);
      return '';
    }
  },

  // Получение данных из кэша
  get: (key: string): any | null => {
    try {
      const cached = clientCache.cache.get(key);
      if (!cached) return null;

      // Проверяем, не истек ли кэш
      if (Date.now() > cached.expires) {
        clientCache.cache.delete(key);
        return null;
      }

      console.log('Client cache hit for key:', key);
      return cached.data;
    } catch (error) {
      console.error('Error getting from client cache:', error);
      return null;
    }
  },

  // Сохранение данных в кэш
  set: (key: string, data: any, ttl: number = 3600000): void => {
    try {
      // Очищаем кэш, если он слишком большой
      if (clientCache.cache.size >= clientCache.maxSize) {
        const firstKey = clientCache.cache.keys().next().value;
        if (firstKey) {
          clientCache.cache.delete(firstKey);
        }
      }

      clientCache.cache.set(key, {
        data: data,
        expires: Date.now() + ttl
      });

      console.log('Client cache set for key:', key, 'TTL:', ttl);
    } catch (error) {
      console.error('Error setting client cache:', error);
    }
  },

  // Очистка кэша
  clear: (): void => {
    try {
      clientCache.cache.clear();
      console.log('Client cache cleared');
    } catch (error) {
      console.error('Error clearing client cache:', error);
    }
  },

  // Получение статистики кэша
  getStats: (): { size: number; maxSize: number } => {
    return {
      size: clientCache.cache.size,
      maxSize: clientCache.maxSize
    };
  }
};

// Функции валидации для сервиса OpenRouter
const validators = {
  // Валидация строки
  validateString: (value: any, fieldName: string, maxLength: number = 1000): { valid: boolean; error?: string } => {
    if (value === undefined || value === null) {
      return { valid: false, error: `${fieldName} не может быть null или undefined` };
    }
    if (typeof value !== 'string') {
      return { valid: false, error: `${fieldName} должен быть строкой` };
    }
    if (value.trim().length === 0) {
      return { valid: false, error: `${fieldName} не может быть пустой строкой` };
    }
    if (value.length > maxLength) {
      return { valid: false, error: `${fieldName} слишком длинный (максимум ${maxLength} символов)` };
    }
    return { valid: true };
  },

  // Валидация числа
  validateNumber: (value: any, fieldName: string, min: number = 0, max: number = 1000000): { valid: boolean; error?: string } => {
    if (value === undefined || value === null) {
      return { valid: false, error: `${fieldName} не может быть null или undefined` };
    }
    if (typeof value !== 'number') {
      return { valid: false, error: `${fieldName} должен быть числом` };
    }
    if (isNaN(value) || !isFinite(value)) {
      return { valid: false, error: `${fieldName} должен быть конечным числом` };
    }
    if (value < min || value > max) {
      return { valid: false, error: `${fieldName} должен быть в диапазоне ${min}-${max}` };
    }
    return { valid: true };
  },

  // Валидация массива
  validateArray: (value: any, fieldName: string, maxLength: number = 100): { valid: boolean; error?: string } => {
    if (value === undefined || value === null) {
      return { valid: false, error: `${fieldName} не может быть null или undefined` };
    }
    if (!Array.isArray(value)) {
      return { valid: false, error: `${fieldName} должен быть массивом` };
    }
    if (value.length > maxLength) {
      return { valid: false, error: `${fieldName} слишком длинный (максимум ${maxLength} элементов)` };
    }
    return { valid: true };
  },

  // Валидация объекта
  validateObject: (value: any, fieldName: string): { valid: boolean; error?: string } => {
    if (value === undefined || value === null) {
      return { valid: false, error: `${fieldName} не может быть null или undefined` };
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      return { valid: false, error: `${fieldName} должен быть объектом` };
    }
    return { valid: true };
  },

  // Валидация enum значения
  validateEnum: (value: any, fieldName: string, allowedValues: readonly string[]): { valid: boolean; error?: string } => {
    if (value === undefined || value === null) {
      return { valid: true }; // Enum может быть необязательным
    }
    if (typeof value !== 'string') {
      return { valid: false, error: `${fieldName} должен быть строкой` };
    }
    if (!allowedValues.includes(value)) {
      return { valid: false, error: `${fieldName} должен быть одним из: ${allowedValues.join(', ')}` };
    }
    return { valid: true };
  },

  // Валидация URL
  validateURL: (value: any, fieldName: string): { valid: boolean; error?: string } => {
    if (value === undefined || value === null) {
      return { valid: false, error: `${fieldName} не может быть null или undefined` };
    }
    if (typeof value !== 'string') {
      return { valid: false, error: `${fieldName} должен быть строкой` };
    }
    try {
      new URL(value);
      return { valid: true };
    } catch {
      return { valid: false, error: `${fieldName} должен быть валидным URL` };
    }
  },

  // Валидация FormData
  validateFormData: (formData: any): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Валидация productType
    const productTypeValidation = validators.validateEnum(formData.productType, 'productType', PRODUCT_TYPES);
    if (!productTypeValidation.valid) {
      errors.push(productTypeValidation.error!);
    }

    // Валидация specificBoxType (только для коробок)
    if (formData.productType === ProductType.BOX && formData.specificBoxType) {
      const boxTypeValidation = validators.validateEnum(formData.specificBoxType, 'specificBoxType', BOX_TYPES);
      if (!boxTypeValidation.valid) {
        errors.push(boxTypeValidation.error!);
      }
    }

    // Валидация material
    const materialValidation = validators.validateEnum(formData.material, 'material', MATERIALS);
    if (!materialValidation.valid) {
      errors.push(materialValidation.error!);
    }

    // Валидация specificMaterialName
    if (formData.specificMaterialName) {
      const materialNameValidation = validators.validateString(formData.specificMaterialName, 'specificMaterialName', 200);
      if (!materialNameValidation.valid) {
        errors.push(materialNameValidation.error!);
      }
    }

    // Валидация materialDensity
    if (formData.materialDensity !== undefined) {
      const densityValidation = validators.validateNumber(formData.materialDensity, 'materialDensity', 1, 10000);
      if (!densityValidation.valid) {
        errors.push(densityValidation.error!);
      }
    }

    // Валидация размеров
    const dimensions = ['width', 'height', 'depth'];
    for (const dim of dimensions) {
      if (formData[dim] !== undefined) {
        const dimValidation = validators.validateNumber(formData[dim], dim, 1, 10000);
        if (!dimValidation.valid) {
          errors.push(dimValidation.error!);
        }
      }
    }

    // Валидация quantity
    if (formData.quantity !== undefined) {
      if (typeof formData.quantity === 'string') {
        // Если quantity - строка (например, "500/1000"), проверяем только длину
        const quantityStrValidation = validators.validateString(formData.quantity, 'quantity', 50);
        if (!quantityStrValidation.valid) {
          errors.push(quantityStrValidation.error!);
        }
      } else {
        const quantityValidation = validators.validateNumber(formData.quantity, 'quantity', 1, 1000000);
        if (!quantityValidation.valid) {
          errors.push(quantityValidation.error!);
        }
      }
    }

    // Валидация цветности печати
    if (formData.printColorsOuter) {
      const printColorsValidation = validators.validateString(formData.printColorsOuter, 'printColorsOuter', 100);
      if (!printColorsValidation.valid) {
        errors.push(printColorsValidation.error!);
      }
    }

    if (formData.printColorsInner) {
      const printColorsValidation = validators.validateString(formData.printColorsInner, 'printColorsInner', 100);
      if (!printColorsValidation.valid) {
        errors.push(printColorsValidation.error!);
      }
    }

    // Валидация типа печати
    if (formData.printType) {
      const printTypeValidation = validators.validateEnum(formData.printType, 'printType', PRINT_TYPES);
      if (!printTypeValidation.valid) {
        errors.push(printTypeValidation.error!);
      }
    }

    // Валидация отделки
    if (formData.finishes) {
      const finishesValidation = validators.validateArray(formData.finishes, 'finishes', 20);
      if (!finishesValidation.valid) {
        errors.push(finishesValidation.error!);
      } else {
        // Проверяем каждый элемент массива
        for (let i = 0; i < formData.finishes.length; i++) {
          const finishValidation = validators.validateEnum(formData.finishes[i], `finishes[${i}]`, FINISH_TYPES);
          if (!finishValidation.valid) {
            errors.push(finishValidation.error!);
          }
        }
      }
    }

    // Валидация типа ручек (только для пакетов)
    if ((formData.productType === ProductType.PAPER_BAG || formData.productType === ProductType.BAG) && formData.handleType) {
      const handleTypeValidation = validators.validateEnum(formData.handleType, 'handleType', HANDLE_TYPES);
      if (!handleTypeValidation.valid) {
        errors.push(handleTypeValidation.error!);
      }
    }

    // Валидация крепления ручек (только для пакетов)
    if ((formData.productType === ProductType.PAPER_BAG || formData.productType === ProductType.BAG) && formData.handleAttachment) {
      const handleAttachmentValidation = validators.validateEnum(formData.handleAttachment, 'handleAttachment', HANDLE_ATTACHMENTS);
      if (!handleAttachmentValidation.valid) {
        errors.push(handleAttachmentValidation.error!);
      }
    }

    // Валидация фурнитуры
    if (formData.fittings) {
      const fittingsValidation = validators.validateString(formData.fittings, 'fittings', 500);
      if (!fittingsValidation.valid) {
        errors.push(fittingsValidation.error!);
      }
    }

    // Валидация дополнительной информации
    if (formData.additionalInfo) {
      const additionalInfoValidation = validators.validateString(formData.additionalInfo, 'additionalInfo', 2000);
      if (!additionalInfoValidation.valid) {
        errors.push(additionalInfoValidation.error!);
      }
    }

    return { valid: errors.length === 0, errors };
  },

  // Валидация конфигурации Gemini
  validateGeminiConfig: (config: any): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!config) return { valid: true, errors: [] };

    // Валидация temperature
    if (config.temperature !== undefined) {
      const tempValidation = validators.validateNumber(config.temperature, 'temperature', 0, 2);
      if (!tempValidation.valid) {
        errors.push(tempValidation.error!);
      }
    }

    // Валидация responseMimeType
    if (config.responseMimeType) {
      const allowedMimeTypes = ['application/json', 'text/plain', 'text/html'];
      if (!allowedMimeTypes.includes(config.responseMimeType)) {
        errors.push(`responseMimeType должен быть одним из: ${allowedMimeTypes.join(', ')}`);
      }
    }

    // Валидация systemInstruction
    if (config.systemInstruction) {
      const instructionValidation = validators.validateString(config.systemInstruction, 'systemInstruction', 10000);
      if (!instructionValidation.valid) {
        errors.push(instructionValidation.error!);
      }
    }

    return { valid: errors.length === 0, errors };
  },

  // Валидация содержимого запроса
  validateContents: (contents: any): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!contents) {
      errors.push('contents не может быть null или undefined');
      return { valid: false, errors };
    }

    if (!Array.isArray(contents)) {
      errors.push('contents должен быть массивом');
      return { valid: false, errors };
    }

    if (contents.length === 0) {
      errors.push('contents не может быть пустым массивом');
      return { valid: false, errors };
    }

    if (contents.length > 10) {
      errors.push('contents слишком длинный (максимум 10 элементов)');
      return { valid: false, errors };
    }

    // Проверяем каждый элемент массива
    for (let i = 0; i < contents.length; i++) {
      const content = contents[i];
      
      if (!content || typeof content !== 'object') {
        errors.push(`contents[${i}] должен быть объектом`);
        continue;
      }

      if (!Array.isArray(content.parts)) {
        errors.push(`contents[${i}].parts должен быть массивом`);
        continue;
      }

      if (content.parts.length === 0) {
        errors.push(`contents[${i}].parts не может быть пустым`);
        continue;
      }

      if (content.parts.length > 50) {
        errors.push(`contents[${i}].parts слишком длинный (максимум 50 элементов)`);
        continue;
      }

      // Проверяем каждую часть
      for (let j = 0; j < content.parts.length; j++) {
        const part = content.parts[j];
        
        if (!part || typeof part !== 'object') {
          errors.push(`contents[${i}].parts[${j}] должен быть объектом`);
          continue;
        }

        if (part.text !== undefined) {
          const textValidation = validators.validateString(part.text, `contents[${i}].parts[${j}].text`, 100000);
          if (!textValidation.valid) {
            errors.push(textValidation.error!);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
};

// Импорт безопасного API сервиса
import { secureApiService } from './secureApiService';

// Конфигурация для защищенного API (теперь использует переменные окружения)
const API_CONFIG = {
  // URL вашего Cloudflare Worker
  baseUrl: import.meta.env.VITE_API_BASE_URL || '',
  
  // API ключ клиента (публичный, но ограниченный)
  clientApiKey: import.meta.env.VITE_CLIENT_API_KEY || '',
  
  // Настройки rate limiting
  maxRequestsPerMinute: parseInt(import.meta.env.VITE_MAX_REQUESTS_PER_MINUTE || '100'),
  retryAttempts: parseInt(import.meta.env.VITE_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(import.meta.env.VITE_RETRY_DELAY || '1000'),
};

interface OpenRouterConfig {
  responseMimeType?: string;
  temperature?: number;
  maxTokens?: number;
  systemInstruction?: string; 
}

interface OpenRouterRequestBody {
  contents: any; // Matches 'contents' in SDK
  generationConfig?: {
    temperature?: number;
    responseMimeType?: string;
    max_tokens?: number;
  };
  systemInstruction?: string;
}

// Обновленная функция для запросов с использованием безопасного API сервиса
async function makeSecureOpenRouterRequest(
  modelName: string,
  contents: any,
  config?: OpenRouterConfig 
): Promise<{ text: string }> {
  const startTime = performance.now();
  let operation = 'gemini_request';
  
  try {
    // Определяем тип операции для мониторинга
    const userMessage = contents?.[0]?.parts?.[0]?.text || '';
    if (userMessage.includes('Извлеки параметры')) {
      operation = 'extract_parameters';
    } else if (userMessage.includes('коррекции цены')) {
      operation = 'price_correction';
    } else if (userMessage.includes('рассчитай стоимость')) {
      operation = 'cost_estimation';
    }

    // Валидация входных параметров
    const modelNameValidation = validators.validateString(modelName, 'modelName', 100);
    if (!modelNameValidation.valid) {
      throw new Error(`Ошибка валидации modelName: ${modelNameValidation.error}`);
    }

    // Валидация содержимого запроса
    const contentsValidation = validators.validateContents(contents);
    if (!contentsValidation.valid) {
      throw new Error(`Ошибка валидации contents: ${contentsValidation.errors.join(', ')}`);
    }

    // Валидация конфигурации
    const configValidation = validators.validateGeminiConfig(config);
    if (!configValidation.valid) {
      throw new Error(`Ошибка валидации config: ${configValidation.errors.join(', ')}`);
    }

    // Используем безопасный API сервис
    const fullApiUrl = `${API_CONFIG.baseUrl}/v1beta/models/gemini:generateContent`;

    const requestBody: GeminiRequestBody = { contents };

    if (config) {
      try {
        if (config.temperature !== undefined || config.responseMimeType !== undefined) {
          requestBody.generationConfig = {};
          if (config.temperature !== undefined) {
            requestBody.generationConfig.temperature = config.temperature;
          }
          if (config.responseMimeType) {
            requestBody.generationConfig.responseMimeType = config.responseMimeType;
          }
        }
        if (config.systemInstruction) {
            requestBody.systemInstruction = config.systemInstruction;
        }
      } catch (configError) {
        logger.error('Error configuring request body', configError as Error);
        throw new Error('Ошибка конфигурации запроса');
      }
    }

    // Используем безопасный API сервис для выполнения запроса
    const response = await secureApiService.post(fullApiUrl, requestBody, {
      retryAttempts: API_CONFIG.retryAttempts,
      retryDelay: API_CONFIG.retryDelay
    });

    if (!response.success) {
      throw new Error(response.error || 'Неизвестная ошибка API');
    }

    const responseData = response.data;
    
    // Мониторинг токенов с обработкой ошибок
    try {
      const inputTokens = responseData.usage?.promptTokenCount || 0;
      const outputTokens = responseData.usage?.candidatesTokenCount || 0;
      metrics.logTokenUsage(inputTokens, outputTokens, modelName, operation);
    } catch (monitoringError) {
      logger.error('Error in token monitoring', monitoringError as Error);
      // Не прерываем выполнение при ошибке мониторинга
    }
  
    // Извлекаем текст из ответа с детальной обработкой ошибок
    let extractedText = "";
    try {
      if (responseData.candidates && responseData.candidates.length > 0 &&
          responseData.candidates[0].content && responseData.candidates[0].content.parts &&
          responseData.candidates[0].content.parts.length > 0 && responseData.candidates[0].content.parts[0].text !== undefined) {
        extractedText = responseData.candidates[0].content.parts[0].text;
      } else if (responseData.promptFeedback && responseData.promptFeedback.blockReason) {
        const blockReason = responseData.promptFeedback.blockReason;
        const blockMessage = responseData.promptFeedback.blockReasonMessage || "";
        logger.warn(`Request blocked by API: ${blockReason} - ${blockMessage}`, undefined, { responseData });
        throw new Error(`Запрос был заблокирован API: ${blockReason} ${blockMessage}`);
      } else if (responseData.error) {
        logger.error("Error from API", undefined, { error: responseData.error });
        throw new Error(`Ошибка от API: ${responseData.error.message || responseData.error.status || JSON.stringify(responseData.error)}`);
      } else {
        logger.warn("API response format not as expected or text is missing", undefined, { responseData });
        throw new Error('Неожиданный формат ответа от API');
      }
    } catch (extractionError) {
      logger.error('Error extracting text from response', extractionError as Error);
      throw extractionError;
    }
    
    return { text: extractedText };

  } catch (error) {
    logger.error('Fatal error in makeSecureOpenRouterRequest', error as Error, { operation, modelName });
    throw error;
  }
}


const findEnumMatch = (input: string | undefined | null, enumValues: readonly string[]): string | undefined => {
  if (!input) return undefined;
  const normalizedInput = input.trim().toLowerCase();
  if (normalizedInput.length < 2 && enumValues.every(ev => ev.length > 2)) return undefined;

  const sortedEnumValues = [...enumValues].sort((a, b) => b.length - a.length);

  for (const enumValue of sortedEnumValues) {
    const normalizedEnumValue = enumValue.toLowerCase();
    if (normalizedInput.includes(normalizedEnumValue)) {
      return enumValue;
    }
  }
  
  for (const enumValue of sortedEnumValues) {
      const normalizedEnumValue = enumValue.toLowerCase();
      const enumKeywords = normalizedEnumValue.split(/[\s/-]+/); 
      const inputKeywords = normalizedInput.split(/[\s/-]+/);

      if (enumKeywords.some(ek => ek.length > 2 && inputKeywords.some(ik => ik.includes(ek) || ek.includes(ik)))) {
          return enumValue;
      }
  }
  return undefined;
};


const mapSingleResponseToFormData = (parsed: Partial<FormData>): Partial<FormData> => {
    const mappedData: Partial<FormData> = {};

    if (parsed.productType) mappedData.productType = findEnumMatch(String(parsed.productType), PRODUCT_TYPES) || String(parsed.productType);
    if (parsed.specificBoxType) mappedData.specificBoxType = findEnumMatch(String(parsed.specificBoxType), BOX_TYPES) || String(parsed.specificBoxType);
    if (parsed.material) mappedData.material = findEnumMatch(String(parsed.material), MATERIALS) || String(parsed.material);
    if (parsed.specificMaterialName) mappedData.specificMaterialName = String(parsed.specificMaterialName);
    
    if (parsed.materialDensity) {
        const densityMatch = String(parsed.materialDensity).match(/(\d+)/);
        mappedData.materialDensity = densityMatch ? parseInt(densityMatch[1], 10) : String(parsed.materialDensity);
    }

    const parseDimension = (dim: any) => {
        if (typeof dim === 'number') return dim;
        if (typeof dim === 'string') {
            const numMatch = dim.match(/(\d+\.?\d*)/);
            return numMatch ? parseFloat(numMatch[1]) : dim;
        }
        return dim;
    };
    if (parsed.width) mappedData.width = parseDimension(parsed.width);
    if (parsed.height) mappedData.height = parseDimension(parsed.height);
    if (parsed.depth) mappedData.depth = parseDimension(parsed.depth);
    
    if (parsed.quantity) {
        const quantityStr = String(parsed.quantity);
        if (quantityStr.includes('/') || quantityStr.toLowerCase().includes('или') || quantityStr.toLowerCase().includes('and')) {
             mappedData.quantity = quantityStr; 
        } else {
            const quantityMatch = quantityStr.match(/(\d+)/);
            mappedData.quantity = quantityMatch ? parseInt(quantityMatch[1], 10) : quantityStr;
        }
    }

    if (parsed.printColorsOuter) mappedData.printColorsOuter = String(parsed.printColorsOuter);
    if (parsed.printColorsInner) mappedData.printColorsInner = String(parsed.printColorsInner);
    if (parsed.printType) mappedData.printType = findEnumMatch(String(parsed.printType), PRINT_TYPES) || String(parsed.printType);
    
    if (parsed.finishes) {
        let finishArray: string[] = [];
        if (Array.isArray(parsed.finishes)) {
            finishArray = parsed.finishes.map(f => String(f).trim()).filter(f => f);
        } else if (typeof parsed.finishes === 'string') {
            finishArray = parsed.finishes.split(/[,;]+/).map(f => f.trim()).filter(f => f);
        }
        
        mappedData.finishes = finishArray.map(f_str => {
            if (f_str.toLowerCase().includes("зеркальн") || f_str.toLowerCase().includes("глянцев")) {
                return FinishType.GLOSS_LAMINATION;
            }
            if (f_str.toLowerCase().includes("сенсорн") && f_str.toLowerCase().includes("ламинац")) {
                return FinishType.SOFT_TOUCH_LAMINATION;
            }
             if (f_str.toLowerCase().includes("мутн") && (f_str.toLowerCase().includes("пленка") || f_str.toLowerCase().includes("ламинац")) ) {
                return FinishType.MATTE_LAMINATION; 
            }
            return findEnumMatch(f_str, FINISH_TYPES) || f_str;
        }).filter(f => f);
    }


    if (parsed.handleType) mappedData.handleType = findEnumMatch(String(parsed.handleType), HANDLE_TYPES) || String(parsed.handleType);
    if (parsed.handleAttachment) mappedData.handleAttachment = findEnumMatch(String(parsed.handleAttachment), HANDLE_ATTACHMENTS) || String(parsed.handleAttachment);
    if (parsed.fittings) mappedData.fittings = String(parsed.fittings);
    if (parsed.additionalInfo) mappedData.additionalInfo = String(parsed.additionalInfo);

    return mappedData;
}

const mapResponseToFormDataArray = (responseText: string): Partial<FormData>[] => {
  let jsonStr = responseText.trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[2]) {
    jsonStr = match[2].trim();
  }

  try {
    let parsedJson = JSON.parse(jsonStr);
    let parsedArray: Partial<FormData>[];

    if (Array.isArray(parsedJson)) {
      parsedArray = parsedJson;
    } else if (typeof parsedJson === 'object' && parsedJson !== null) {
      console.warn("Proxy/Gemini did not return an array as expected for FormData. Wrapping single object into an array.");
      parsedArray = [parsedJson];
    } else {
      throw new Error("Parsed JSON for FormData is not an array or a valid object.");
    }
    
    return parsedArray.map(item => mapSingleResponseToFormData(item));

  } catch (e: any) {
    console.error("Failed to parse JSON array response from Proxy/Gemini or map FormData:", e, "\nRaw response text for FormData:", responseText);
    throw new Error(`Не удалось обработать ответ от AI для извлечения параметров заказа: ${e.message}`);
  }
};


export async function parseOrderFromStringWithOpenRouter(userText: string): Promise<Partial<FormData>[]> {
  return performance.measure('parse_order_from_string', async () => {
    try {
      // Валидация входного текста
      const textValidation = validators.validateString(userText, 'userText', 10000);
      if (!textValidation.valid) {
        throw new Error(`Ошибка валидации userText: ${textValidation.error}`);
      }

      const extractionPrompt = `
Извлеки параметры заказа упаковки в JSON-массив. Структура:
{
  "productType": "Пакет бумажный|Коробка|Тишью бумага|Бирка",
  "specificBoxType": "Самосборная|Складная|Подарочная" (только для коробок),
  "material": "Мелованная бумага|Гофрокартон|Крафт|Картон|Тишью",
  "materialDensity": "250гр|280г/м2",
  "width": 300, "height": 400, "depth": 100, "quantity": 1000,
  "printColorsOuter": "4+0 CMYK|1+0|Без печати",
  "printType": "Офсетная печать|Флексография",
  "finishes": ["Матовая ламинация|Глянцевая|Тиснение"],
  "handleType": "Лента репсовая|Вырубная|Шнурок" (для пакетов),
  "handleAttachment": "Вклеенные|Люверсы" (для пакетов),
  "fittings": "Люверсы|Магниты",
  "additionalInfo": "дополнительная информация"
}

Размеры в мм. Если см - конвертируй (30см=300мм). Множественные варианты - отдельные объекты в массиве.

Пример: "Пакет, медная бумага 250гр, зеркальный, 25х30х80мм, 500/1000шт" →
[
  {"productType": "Пакет бумажный", "material": "Мелованная бумага", "materialDensity": "250гр", "finishes": ["Глянцевая ламинация"], "width": 250, "height": 300, "depth": 80, "quantity": 500},
  {"productType": "Пакет бумажный", "material": "Мелованная бумага", "materialDensity": "250гр", "finishes": ["Глянцевая ламинация"], "width": 250, "height": 300, "depth": 80, "quantity": 1000}
]

Текст: "${userText}"
JSON:`;

      const response = await makeSecureOpenRouterRequest(
        MODEL_CONFIG.extraction, // Используем более дешевую модель
        extractionPrompt,
        {
          responseMimeType: "application/json",
          temperature: 0.1,
        }
      );
      
      if (!response.text) {
        throw new Error("Получен пустой JSON ответ от OpenRouter API через прокси при разборе запроса.");
      }

      try {
        return mapResponseToFormDataArray(response.text);
      } catch (mappingError) {
        logger.error("Ошибка при маппинге ответа в FormData", mappingError as Error);
        throw new Error(`Ошибка обработки ответа AI: ${mappingError instanceof Error ? mappingError.message : 'Неизвестная ошибка'}`);
      }
    } catch (error: any) {
      logger.error("Ошибка при вызове OpenRouter API через прокси для разбора запроса", error);
      throw error;
    }
  }, { userTextLength: userText.length });
}

export interface CorrectedPriceInfo {
  quantity: number;
  correctedPricePerUnit: number;
}

export async function parsePriceCorrectionFeedback(
  userInput: string, 
  orderContext: Partial<FormData>[]
): Promise<CorrectedPriceInfo[] | null> {
  return performance.measure('parse_price_correction', async () => {
    try {
      // Валидация входного текста
      const inputValidation = validators.validateString(userInput, 'userInput', 5000);
      if (!inputValidation.valid) {
        logger.warn(`Ошибка валидации userInput: ${inputValidation.error}`);
        return null;
      }

      // Валидация контекста заказа
      if (orderContext && Array.isArray(orderContext)) {
        for (let i = 0; i < orderContext.length; i++) {
          const formDataValidation = validators.validateFormData(orderContext[i]);
          if (!formDataValidation.valid) {
            logger.warn(`Ошибка валидации orderContext[${i}]: ${formDataValidation.errors.join(', ')}`);
          }
        }
      }

      let contextString = "Контекст предыдущего расчета (варианты тиражей):\n";
      try {
        if (orderContext.length > 0) {
          orderContext.forEach((variant, index) => {
            contextString += `- Вариант ${index + 1}: Тираж: ${variant.quantity || 'Не указан'}\n`;
          });
        } else {
          contextString = "Контекст предыдущего расчета отсутствует.";
        }
      } catch (contextError) {
        logger.error("Ошибка при формировании контекста", contextError as Error);
        contextString = "Контекст предыдущего расчета отсутствует.";
      }

      const prompt = `
Твоя задача - проанализировать сообщение пользователя, которое является уточнением или коррекцией цены к предыдущему расчету.
${contextString}

Сообщение пользователя с уточнением/коррекцией:
"${userInput}"

Извлеки из сообщения пользователя правильную(ые) цену(ы) за единицу (correctedPricePerUnit) и соответствующий(ие) тираж(и) (quantity).
Цена должна быть числом (например, 9.0, 7.9). Тираж должен быть числом.
Верни данные СТРОГО в формате JSON-МАССИВА ОБЪЕКТОВ. Каждый объект должен иметь ключи "quantity" (число) и "correctedPricePerUnit" (число).
Если не удается понять уточнение или извлечь данные в числовом формате, верни ПУСТОЙ МАССИВ [].

Примеры:
1. Контекст: Вариант 1: Тираж 500, Вариант 2: Тираж 1000
   Сообщение: "правильные ответы: при тираже 500 единиц - 9.0, при тираже 1000 единиц - 7,9"
   ОЖИДАЕМЫЙ JSON:
   [
     { "quantity": 500, "correctedPricePerUnit": 9.0 },
     { "quantity": 1000, "correctedPricePerUnit": 7.9 }
   ]

2. Контекст: Вариант 1: Тираж 3000
   Сообщение: "Для 3000 штук цена будет 8.5 юаней"
   ОЖИДАЕМЫЙ JSON:
   [
     { "quantity": 3000, "correctedPricePerUnit": 8.5 }
   ]

3. Контекст: Вариант 1: Тираж 100
   Сообщение: "цена за 100шт - 12.3"
   ОЖИДАЕМЫЙ JSON:
   [
     { "quantity": 100, "correctedPricePerUnit": 12.3 }
   ]

4. Контекст: Вариант 1: Тираж 500
   Сообщение: "Это неверно." (Невозможно извлечь конкретные цифры)
   ОЖИДАЕМЫЙ JSON: []

5. Контекст: Вариант 1: Тираж 500, Вариант 2: Тираж 1000
   Сообщение: "стоимость 500шт = 9, 1000шт = 7.9"
   ОЖИДАЕМЫЙ JSON:
   [
     { "quantity": 500, "correctedPricePerUnit": 9.0 },
     { "quantity": 1000, "correctedPricePerUnit": 7.9 }
   ]

JSON результат (массив объектов):
`;

      const response = await makeSecureOpenRouterRequest(
        MODEL_CONFIG.priceCorrection,
        prompt,
        {
          responseMimeType: "application/json",
          temperature: 0.0
        }
      );
      
      if (!response.text) {
        logger.warn("Получен пустой ответ от OpenRouter API через прокси при разборе коррекции цены.");
        return null;
      }
      
      try {
        let jsonStr = response.text.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) {
          jsonStr = match[2].trim();
        }

        const parsedResult = JSON.parse(jsonStr);
        if (Array.isArray(parsedResult) && 
            parsedResult.every(item => typeof item.quantity === 'number' && typeof item.correctedPricePerUnit === 'number')) {
          return parsedResult.length > 0 ? parsedResult : null;
        }
        logger.warn("Результат разбора коррекции цены не соответствует ожидаемому формату", undefined, { parsedResult });
        return null;
      } catch (parsingError) {
        logger.error("Ошибка при парсинге JSON ответа коррекции цены", parsingError as Error);
        return null;
      }

    } catch (error: any) {
      logger.error("Ошибка при вызове OpenRouter API через прокси для разбора коррекции цены", error);
      throw error;
    }
  }, { userInputLength: userInput.length, orderContextLength: orderContext.length });
}


function formatFinishesForPrompt(finishesInput?: (string | FinishType)[] | string): string {
    if (!finishesInput) return 'Нет';
    if (Array.isArray(finishesInput)) {
        return finishesInput.length > 0 ? finishesInput.join(', ') : 'Нет';
    }
    return String(finishesInput); 
}

function buildCostEstimationPrompt(formData: FormData): string {
  const {
    productType,
    specificBoxType,
    material,
    specificMaterialName,
    materialDensity,
    width,
    height,
    depth,
    quantity,
    printColorsOuter,
    printColorsInner,
    printType,
    finishes,
    handleType,
    handleAttachment,
    fittings,
    additionalInfo,
    parsedUserRequest
  } = formData;

  let userRequestDetails = `
ИСХОДНЫЙ ЗАПРОС ПОЛЬЗОВАТЕЛЯ (для контекста, если нужно, использовался для извлечения параметров ниже):
"${parsedUserRequest || 'Не предоставлен'}"

ПАРАМЕТРЫ ЗАКАЗА ДЛЯ РАСЧЕТА (извлеченные и нормализованные):
- Тип продукции: ${productType}
${productType === ProductType.BOX && specificBoxType ? `- Уточнение типа коробки: ${specificBoxType}` : ''}
- Материал: ${material} ${specificMaterialName ? `(${specificMaterialName})` : ''}
- Плотность материала: ${materialDensity ? `${materialDensity}${typeof materialDensity === 'number' ? ' г/м²' : ''}` : 'Не указана'}
- Размеры (ШхВхГ): ${width || '_'}мм x ${height || '_'}мм x ${depth || '_'}мм
- Количество (тираж): ${quantity || '_'} шт.
- Цветность (снаружи): ${printColorsOuter || 'Не указана'}
- Цветность (внутри): ${printColorsInner || 'Не указана'}
- Тип печати: ${printType || 'Не указан'}
- Отделка: ${formatFinishesForPrompt(finishes)}
${(String(productType).toLowerCase().includes('пакет') || String(productType) === ProductType.PAPER_BAG) && handleType ? `- Тип ручек: ${handleType}` : ''}
${(String(productType).toLowerCase().includes('пакет') || String(productType) === ProductType.PAPER_BAG) && handleAttachment ? `- Крепление ручек: ${handleAttachment}` : ''}
- Фурнитура: ${fittings || 'Нет'}
- Дополнительная информация: ${additionalInfo || 'Нет'}
`;

  return `
Ты - AI-ассистент для расчета ПРИМЕРНОЙ стоимости производства упаковки в Китае. Твоя задача - предоставить оценку в юанях (¥).
Используй следующую структуру базы знаний и правила ценообразования для формирования ответа.

${KNOWLEDGE_BASE_STRUCTURE_PROMPT}

${PRICING_RULES_PROMPT}

${userRequestDetails}

Твоя задача:
Проанализируй ПАРАМЕТРЫ ЗАКАЗА ДЛЯ РАСЧЕТА и, опираясь на СТРУКТУРУ БАЗЫ ЗНАНИЙ и ПРАВИЛА ЦЕНООБРАЗОВАНИЯ, рассчитай примерную стоимость.
Найди наиболее похожие заказы в своей "базе знаний" (ты не имеешь к ней прямого доступа, но представляешь, что она есть и структурирована как описано).
Учитывай все параметры, особенно ТИРАЖ, МАТЕРИАЛ, РАЗМЕРЫ, СЛОЖНОСТЬ ПЕЧАТИ и ОТДЕЛКУ.

ТРЕБОВАНИЯ К ОТВЕТУ:
1.  Ответ должен быть кратким, НЕ БОЛЕЕ 500 СИМВОЛОВ.
2.  Укажи ОДНУ наиболее вероятную примерную стоимость за единицу и ОДНУ наиболее вероятную общую сумму заказа в ЮАНЯХ (¥). Клиентская часть приложения затем рассчитает диапазон ±15% от этих значений.
3.  Добавь краткое примечание о предварительном характере оценки и важности обновления базы знаний.
4.  Формат ответа СТРОГО: "Примерная стоимость вашего заказа: [СтоимостьЗаЕдиницу] ¥ за единицу. Общая сумма: [ОбщаяСтоимость] ¥. [Краткое примечание, например: Это наиболее вероятная цена, основанная на аналогах. Для точной цены и улучшения будущих расчетов, добавьте фактическую стоимость после ответа поставщика в базу знаний.]"
    Пример: "Примерная стоимость вашего заказа: 2.85 ¥ за единицу. Общая сумма: 2850.00 ¥. Это наиболее вероятная цена, основанная на аналогах. Обновите базу для точности."

Если данных (особенно тип, материал, размеры, количество) недостаточно для уверенного расчета, или они противоречивы, укажи это и попроси пользователя уточнить. Не пытайся угадать критически важные недостающие параметры. Всё в рамках 500 символов и указанного формата, но можно заменить тело сообщения на просьбу уточнить.
Например: "Для расчета не хватает информации о размерах и количестве. Пожалуйста, уточните эти параметры."
`;
}

export async function estimatePackagingCost(formData: FormData): Promise<string> {
  return performance.measure('estimate_packaging_cost', async () => {
    try {
      // Валидация FormData
      if (!formData) {
        throw new Error('Отсутствуют данные для расчета стоимости');
      }

      const formDataValidation = validators.validateFormData(formData);
      if (!formDataValidation.valid) {
        throw new Error(`Ошибка валидации FormData: ${formDataValidation.errors.join(', ')}`);
      }

      let prompt: string;
      try {
        prompt = buildCostEstimationPrompt(formData);
      } catch (promptError) {
        logger.error("Ошибка при формировании промпта для расчета стоимости", promptError as Error);
        throw new Error('Ошибка подготовки данных для расчета');
      }
      
      const response = await makeSecureOpenRouterRequest(
        MODEL_CONFIG.costEstimation,
        prompt
      );

      if (!response.text) {
        throw new Error("Получен пустой ответ от OpenRouter API через прокси при расчете стоимости.");
      }
      return response.text;
    } catch (error: any) {
      logger.error("Ошибка при вызове OpenRouter API через прокси для расчета стоимости", error);
      throw error;
    }
  }, { 
    productType: formData.productType,
    hasFinishes: !!formData.finishes,
    hasFittings: !!formData.fittings 
  });
}

function buildCostEstimationPromptWithKnowledgeBase(formData: FormData): string {
  const {
    productType,
    specificBoxType,
    material,
    specificMaterialName,
    materialDensity,
    width,
    height,
    depth,
    quantity,
    printColorsOuter,
    printColorsInner,
    printType,
    finishes,
    handleType,
    handleAttachment,
    fittings,
    additionalInfo,
    parsedUserRequest
  } = formData;

  const userRequestDetails = `
Заказ: ${productType}${specificBoxType ? ` (${specificBoxType})` : ''}, ${material}${specificMaterialName ? ` (${specificMaterialName})` : ''}, ${materialDensity || 'плотность не указана'}, ${width || '_'}x${height || '_'}x${depth || '_'}мм, ${quantity || '_'}шт, ${printColorsOuter || 'печать не указана'}, ${printType || 'тип печати не указан'}, ${formatFinishesForPrompt(finishes)}, ${fittings || 'фурнитура не указана'}. ${additionalInfo || ''}`;

  // Получаем релевантные данные из базы знаний
  const knowledgeBaseData = knowledgeBase.exportForPrompt(formData);

  return `
Рассчитай стоимость упаковки в Китае (¥). Используй правила: цена снижается с тиражом, спецматериалы дороже, сложная печать дороже, отделка добавляет стоимость.

Ориентиры: Пакеты мелованные 200-250г: малые 1000шт ~3¥, 500шт ~4¥; средние 1000шт ~3.5¥, 500шт ~4.8¥; крупные 1000шт ~4.2¥, 500шт ~5.5¥. Крафт на 25-40% дешевле. Тиснение +0.6-1.8¥, люверсы +0.3-0.6¥. Коробки: малые 1000шт 4-7¥, средние 500шт 18-25¥.

${knowledgeBaseData}

Заказ: ${userRequestDetails}

Ответ: "Примерная стоимость: [цена] ¥ за единицу. Общая сумма: [сумма] ¥. [примечание]"
`;
}

export async function estimatePackagingCostWithKnowledgeBase(formData: FormData): Promise<string> {
  return performance.measure('estimate_packaging_cost_with_kb', async () => {
    try {
      // Валидация FormData
      if (!formData) {
        throw new Error('Отсутствуют данные для расчета стоимости');
      }

      const formDataValidation = validators.validateFormData(formData);
      if (!formDataValidation.valid) {
        throw new Error(`Ошибка валидации FormData: ${formDataValidation.errors.join(', ')}`);
      }

      let prompt: string;
      try {
        prompt = buildCostEstimationPromptWithKnowledgeBase(formData);
      } catch (promptError) {
        logger.error("Ошибка при формировании промпта с базой знаний", promptError as Error);
        throw new Error('Ошибка подготовки данных для расчета с базой знаний');
      }
      
      const response = await makeSecureOpenRouterRequest(
        MODEL_CONFIG.costEstimation,
        prompt
      );

      if (!response.text) {
        throw new Error("Получен пустой ответ от OpenRouter API через прокси при расчете стоимости.");
      }
      return response.text;
    } catch (error: any) {
      logger.error("Ошибка при вызове OpenRouter API через прокси для расчета стоимости с базой знаний", error);
      throw error;
    }
  }, { 
    productType: formData.productType,
    hasFinishes: !!formData.finishes,
    hasFittings: !!formData.fittings,
    withKnowledgeBase: true
  });
}

// Функция для сохранения заказа в базу знаний
export function saveOrderToKnowledgeBase(formData: FormData, estimatedPrice: number): string {
  return performance.measure('save_order_to_kb', () => {
    try {
      // Валидация FormData
      if (!formData) {
        throw new Error('Отсутствуют данные для сохранения');
      }

      const formDataValidation = validators.validateFormData(formData);
      if (!formDataValidation.valid) {
        throw new Error(`Ошибка валидации FormData: ${formDataValidation.errors.join(', ')}`);
      }

      // Валидация estimatedPrice
      const priceValidation = validators.validateNumber(estimatedPrice, 'estimatedPrice', 0, 1000000);
      if (!priceValidation.valid) {
        throw new Error(`Ошибка валидации estimatedPrice: ${priceValidation.error}`);
      }

      const orderData = {
        productType: formData.productType || '',
        specificType: formData.specificBoxType,
        quantity: formData.quantity as number || 0,
        pricePerUnit: estimatedPrice,
        width: formData.width as number,
        height: formData.height as number,
        depth: formData.depth as number,
        material: formData.material || '',
        materialDensity: formData.materialDensity as number,
        printColorsOuter: formData.printColorsOuter,
        printColorsInner: formData.printColorsInner,
        printType: formData.printType,
        finishes: Array.isArray(formData.finishes) ? formData.finishes : formData.finishes ? [formData.finishes] : undefined,
        handleType: formData.handleType,
        handleAttachment: formData.handleAttachment,
        fittings: formData.fittings,
        notes: formData.additionalInfo
      };

      const result = knowledgeBase.addOrder(orderData);
      logger.info('Order saved to knowledge base', undefined, { 
        productType: formData.productType,
        quantity: formData.quantity,
        estimatedPrice 
      });
      return result;
    } catch (error) {
      logger.error('Error in saveOrderToKnowledgeBase', error as Error, { 
        productType: formData?.productType,
        estimatedPrice 
      });
      throw error;
    }
  }, { 
    productType: formData?.productType,
    estimatedPrice 
  });
}

// Импорт сервиса мониторинга
import { logger, performance, metrics } from './monitoringService';

// Конфигурация моделей для оптимизации стоимости (OpenRouter)
// API прокси автоматически выбирает оптимальную модель на основе содержимого запроса
const MODEL_CONFIG = {
  // Используем универсальный endpoint - API прокси сам выберет модель
  extraction: "claude-3-haiku",        // API прокси выберет claude-3-haiku
  priceCorrection: "claude-3-haiku",   // API прокси выберет claude-3-haiku
  costEstimation: "claude-3-5-sonnet", // API прокси выберет claude-3-5-sonnet
};

// Функция для получения статистики использования
export function getTokenUsageStats() {
  return metrics.getStats();
}