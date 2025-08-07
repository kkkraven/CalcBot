
// Removed import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { FormData, ProductType, BoxType, Material, PrintType, FinishType, HandleType, HandleAttachment } from '../types';
import { KNOWLEDGE_BASE_STRUCTURE_PROMPT, PRICING_RULES_PROMPT, PRODUCT_TYPES, BOX_TYPES, MATERIALS, PRINT_TYPES, FINISH_TYPES, HANDLE_TYPES, HANDLE_ATTACHMENTS } from '../constants';
import { knowledgeBase } from './knowledgeBase';

// Конфигурация для защищенного API
const API_CONFIG = {
  // URL вашего Cloudflare Worker
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'https://packaging-calculator-api.46261vor.workers.dev',
  
  // API ключ клиента (публичный, но ограниченный)
  clientApiKey: import.meta.env.VITE_CLIENT_API_KEY || '384e8b655b4c9bc468a411b65ce5151291a1d720823c7445af8572e7d009372b',
  
  // Настройки rate limiting
  maxRequestsPerMinute: 100,
  retryAttempts: 3,
  retryDelay: 1000,
};

interface GeminiSDKConfig {
  responseMimeType?: string;
  temperature?: number;
  // Add other config properties as needed, e.g., topK, topP, maxOutputTokens, stopSequences
  systemInstruction?: string; 
  // tools, safetySettings can also be part of this if used
}

interface GeminiRequestBody {
  contents: any; // Matches 'contents' in SDK
  generationConfig?: {
    temperature?: number;
    responseMimeType?: string;
    // other generationConfig fields
  };
  systemInstruction?: string;
  // tools?: any[];
  // safetySettings?: any[];
}

// Обновленная функция для запросов с аутентификацией
async function makeSecureGeminiRequest(
  modelName: string,
  contents: any,
  config?: GeminiSDKConfig 
): Promise<{ text: string }> {
  const fullApiUrl = `${API_CONFIG.baseUrl}/v1beta/models/${modelName}:generateContent`;

  const requestBody: GeminiRequestBody = { contents };

  if (config) {
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
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= API_CONFIG.retryAttempts; attempt++) {
  try {
      const httpResponse = await fetch(fullApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
          'X-API-Key': API_CONFIG.clientApiKey,
      },
      body: JSON.stringify(requestBody),
    });

      if (httpResponse.status === 401) {
        throw new Error('Неверный API ключ клиента. Проверьте конфигурацию.');
      }

      if (httpResponse.status === 429) {
        const retryAfter = httpResponse.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : API_CONFIG.retryDelay * attempt;
        
        console.warn(`Rate limit exceeded. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

    if (!httpResponse.ok) {
        let errorBodyText = "No error details from API.";
      try {
        errorBodyText = await httpResponse.text();
      } catch (e) {
        // ignore if reading body fails
      }
        console.error(`API request failed: ${httpResponse.status} ${httpResponse.statusText}`, errorBodyText);
        throw new Error(`Запрос к API завершился с ошибкой ${httpResponse.status}. Детали: ${errorBodyText}`);
    }

    const responseData = await httpResponse.json();
      
      // Мониторинг токенов
      const inputTokens = responseData.usage?.promptTokenCount || 0;
      const outputTokens = responseData.usage?.candidatesTokenCount || 0;
      tokenMonitor.addUsage(inputTokens, outputTokens);
    
    let extractedText = "";
    if (responseData.candidates && responseData.candidates.length > 0 &&
        responseData.candidates[0].content && responseData.candidates[0].content.parts &&
        responseData.candidates[0].content.parts.length > 0 && responseData.candidates[0].content.parts[0].text !== undefined) {
      extractedText = responseData.candidates[0].content.parts[0].text;
    } else if (responseData.promptFeedback && responseData.promptFeedback.blockReason) {
      const blockReason = responseData.promptFeedback.blockReason;
      const blockMessage = responseData.promptFeedback.blockReasonMessage || "";
        console.warn(`Request blocked by API: ${blockReason} - ${blockMessage}`, responseData);
      throw new Error(`Запрос был заблокирован API: ${blockReason} ${blockMessage}`);
      } else if (responseData.error) {
        console.error("Error from API:", responseData.error);
        throw new Error(`Ошибка от API: ${responseData.error.message || responseData.error.status || JSON.stringify(responseData.error)}`);
    } else {
        console.warn("API response format not as expected or text is missing:", responseData);
    }
      
    return { text: extractedText };

  } catch (error: any) {
      lastError = error;
      console.error(`Attempt ${attempt} failed:`, error);
      
      if (attempt < API_CONFIG.retryAttempts) {
        await new Promise(resolve => setTimeout(resolve, API_CONFIG.retryDelay * attempt));
      }
    }
  }

  throw lastError || new Error('Не удалось связаться с API после нескольких попыток.');
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


export async function parseOrderFromStringWithGeminiOptimized(userText: string): Promise<Partial<FormData>[]> {
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

  try {
    const response = await makeSecureGeminiRequest(
      MODEL_CONFIG.extraction, // Используем более дешевую модель
      extractionPrompt,
      {
        responseMimeType: "application/json",
        temperature: 0.1,
      }
    );
    
    if (!response.text) {
      throw new Error("Получен пустой JSON ответ от Gemini API через прокси при разборе запроса.");
    }
    return mapResponseToFormDataArray(response.text);
  } catch (error: any) {
    console.error("Ошибка при вызове Gemini API через прокси для разбора запроса:", error);
    throw error;
  }
}

export interface CorrectedPriceInfo {
  quantity: number;
  correctedPricePerUnit: number;
}

export async function parsePriceCorrectionFeedback(
  userInput: string, 
  orderContext: Partial<FormData>[]
): Promise<CorrectedPriceInfo[] | null> {

  let contextString = "Контекст предыдущего расчета (варианты тиражей):\n";
  if (orderContext.length > 0) {
    orderContext.forEach((variant, index) => {
      contextString += `- Вариант ${index + 1}: Тираж: ${variant.quantity || 'Не указан'}\n`;
    });
  } else {
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

  try {
    const response = await makeSecureGeminiRequest(
      MODEL_CONFIG.priceCorrection,
      prompt,
      {
        responseMimeType: "application/json",
        temperature: 0.0
      }
    );
    
    if (!response.text) {
      console.warn("Получен пустой ответ от Gemini API через прокси при разборе коррекции цены.");
      return null;
    }
    
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
    console.warn("Результат разбора коррекции цены не соответствует ожидаемому формату:", parsedResult);
    return null;

  } catch (error: any) {
    console.error("Ошибка при вызове Gemini API через прокси для разбора коррекции цены:", error);
    // App.tsx will handle displaying this error
    throw error;
  }
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
  const prompt = buildCostEstimationPrompt(formData);
  
  try {
    const response = await makeSecureGeminiRequest(
      MODEL_CONFIG.costEstimation,
      prompt
    );

    if (!response.text) {
      throw new Error("Получен пустой ответ от Gemini API через прокси при расчете стоимости.");
    }
    return response.text;
  } catch (error: any) {
    console.error("Ошибка при вызове Gemini API через прокси для расчета стоимости:", error);
    // Re-throw the error for App.tsx to handle and display
    throw error;
  }
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
  const prompt = buildCostEstimationPromptWithKnowledgeBase(formData);
  
  try {
    const response = await makeSecureGeminiRequest(
      MODEL_CONFIG.costEstimation,
      prompt
    );

    if (!response.text) {
      throw new Error("Получен пустой ответ от Gemini API через прокси при расчете стоимости.");
    }
    return response.text;
  } catch (error: any) {
    console.error("Ошибка при вызове Gemini API через прокси для расчета стоимости:", error);
    throw error;
  }
}

// Функция для сохранения заказа в базу знаний
export function saveOrderToKnowledgeBase(formData: FormData, estimatedPrice: number): string {
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

  return knowledgeBase.addOrder(orderData);
}

// Система мониторинга токенов
interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: Date;
}

class TokenMonitor {
  private usage: TokenUsage[] = [];
  private monthlyLimit = 1000000; // 1M токенов в месяц
  private costPer1KTokens = 0.001; // Примерная стоимость OpenRouter

  addUsage(inputTokens: number, outputTokens: number): void {
    const totalTokens = inputTokens + outputTokens;
    const cost = (totalTokens / 1000) * this.costPer1KTokens;
    
    this.usage.push({
      inputTokens,
      outputTokens,
      totalTokens,
      cost,
      timestamp: new Date()
    });

    console.log(`Токены: ${inputTokens} входных, ${outputTokens} выходных, ${totalTokens} всего, стоимость: $${cost.toFixed(4)}`);
    
    this.checkLimits();
  }

  private checkLimits(): void {
    const currentMonth = new Date().getMonth();
    const monthlyUsage = this.usage
      .filter(u => u.timestamp.getMonth() === currentMonth)
      .reduce((sum, u) => sum + u.totalTokens, 0);

    if (monthlyUsage > this.monthlyLimit * 0.8) {
      console.warn(`⚠️ Приближение к месячному лимиту токенов: ${monthlyUsage}/${this.monthlyLimit}`);
    }

    const monthlyCost = this.usage
      .filter(u => u.timestamp.getMonth() === currentMonth)
      .reduce((sum, u) => sum + u.cost, 0);

    if (monthlyCost > 50) { // Предупреждение при превышении $50
      console.warn(`⚠️ Высокий месячный расход: $${monthlyCost.toFixed(2)}`);
    }
  }

  getMonthlyStats(): { tokens: number; cost: number } {
    const currentMonth = new Date().getMonth();
    const monthlyUsage = this.usage.filter(u => u.timestamp.getMonth() === currentMonth);
    
    return {
      tokens: monthlyUsage.reduce((sum, u) => sum + u.totalTokens, 0),
      cost: monthlyUsage.reduce((sum, u) => sum + u.cost, 0)
    };
  }
}

const tokenMonitor = new TokenMonitor();

// Конфигурация моделей для оптимизации стоимости (OpenRouter)
const MODEL_CONFIG = {
  // Дешевые модели для простых задач
  extraction: "anthropic/claude-3-haiku",        // ~$0.00025/1K токенов
  priceCorrection: "anthropic/claude-3-haiku",   // ~$0.00025/1K токенов
  
  // Дорогие модели для критически важных задач
  costEstimation: "anthropic/claude-3-5-sonnet", // ~$0.003/1K токенов
};

// Функция для получения статистики использования
export function getTokenUsageStats() {
  return tokenMonitor.getMonthlyStats();
}