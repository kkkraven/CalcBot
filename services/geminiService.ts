
// Removed import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { FormData, ProductType, FinishType } from '../types';
import { KNOWLEDGE_BASE_STRUCTURE_PROMPT, PRICING_RULES_PROMPT, PRODUCT_TYPES, BOX_TYPES, MATERIALS, PRINT_TYPES, FINISH_TYPES, HANDLE_TYPES, HANDLE_ATTACHMENTS } from '../constants';

// Changed from absolute URL to a relative path.
// This assumes the hosting environment will proxy requests from /api-proxy/... 
// to the actual backend proxy service.
const PROXY_URL_BASE = '/api-proxy/v1beta/models';

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

async function makeGeminiRequest(
  modelName: string,
  contents: any, // This is the 'contents' property for the SDK/API
  config?: GeminiSDKConfig 
): Promise<{ text: string }> {
  const fullProxyUrl = `${PROXY_URL_BASE}/${modelName}:generateContent`;

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
    // Map other config properties to requestBody.generationConfig, requestBody.tools, requestBody.safetySettings as needed
  }

  try {
    const httpResponse = await fetch(fullProxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!httpResponse.ok) {
      let errorBodyText = "No error details from proxy.";
      try {
        errorBodyText = await httpResponse.text();
      } catch (e) {
        // ignore if reading body fails
      }
      console.error(`Proxy request failed: ${httpResponse.status} ${httpResponse.statusText}`, errorBodyText);
      throw new Error(`Запрос к прокси-сервису завершился с ошибкой ${httpResponse.status}. Детали: ${errorBodyText}`);
    }

    const responseData = await httpResponse.json();
    
    let extractedText = "";
    if (responseData.candidates && responseData.candidates.length > 0 &&
        responseData.candidates[0].content && responseData.candidates[0].content.parts &&
        responseData.candidates[0].content.parts.length > 0 && responseData.candidates[0].content.parts[0].text !== undefined) {
      extractedText = responseData.candidates[0].content.parts[0].text;
    } else if (responseData.promptFeedback && responseData.promptFeedback.blockReason) {
      const blockReason = responseData.promptFeedback.blockReason;
      const blockMessage = responseData.promptFeedback.blockReasonMessage || "";
      console.warn(`Request blocked by API via proxy: ${blockReason} - ${blockMessage}`, responseData);
      throw new Error(`Запрос был заблокирован API: ${blockReason} ${blockMessage}`);
    } else if (responseData.error) { // Handle cases where the proxy returns an error structure
        console.error("Error from proxy/Gemini:", responseData.error);
        throw new Error(`Ошибка от сервиса Gemini через прокси: ${responseData.error.message || responseData.error.status || JSON.stringify(responseData.error)}`);
    } else {
      console.warn("Proxy response format not as expected or text is missing:", responseData);
      // Fallback or throw error if text is crucial and not found
      // For now, let's assume if no error, but no text, it's an empty valid response
    }
    return { text: extractedText };

  } catch (error: any) {
    console.error("Ошибка при выполнении запроса через прокси:", error);
    // Re-throw with a generic message or specific error if identifiable
    throw new Error(error.message || 'Не удалось связаться с сервисом AI через прокси.');
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


export async function parseOrderFromStringWithGemini(userText: string): Promise<Partial<FormData>[]> {
  const extractionPrompt = `
Твоя задача - извлечь параметры заказа упаковки из текста пользователя и вернуть их СТРОГО в формате JSON-МАССИВА (даже если вариант только один, он должен быть элементом массива).
Если пользователь указывает несколько вариантов (например, разные тиражи "500/1000 шт"), КАЖДЫЙ вариант должен быть ОТДЕЛЬНЫМ ОБЪЕКТОМ в JSON-массиве.

Вот целевая структура JSON для КАЖДОГО ОБЪЕКТА в массиве (ключи должны быть именно такими, значения - строки или числа):
interface FormData {
  productType?: string; // "${PRODUCT_TYPES.join('", "')}"
  specificBoxType?: string; // "${BOX_TYPES.join('", "')}" (только если productType = "Коробка")
  material?: string; // "${MATERIALS.join('", "')}" или конкретное название если "Другой материал" / "Дизайнерская бумага"
  specificMaterialName?: string; // если material = "Дизайнерская/спецбумага" или "Другой материал" или уточнено для гофрокартона, например, "Гофрокартон Т23Б"
  materialDensity?: string | number; // Например: "250", "280 гр/м2", 250
  width?: string | number; // Размеры в мм. Если указаны в см, конвертируй в мм. Например: "300", "30см" -> 300
  height?: string | number; // Например: "400", "27см" -> 270
  depth?: string | number; // Например: "100", "18см" -> 180
  quantity?: string | number; // Например: "1000". Если "500/1000", то для первого объекта quantity: 500, для второго quantity: 1000
  printColorsOuter?: string; // Например: "4+0 CMYK", "белый логотип", "Без печати", "Полноцветная с двух сторон"
  printColorsInner?: string; // Например: "Без печати", "1+0"
  printType?: string; // "${PRINT_TYPES.join('", "')}" Например: "Офсетная", "обычная печать" (интерпретируй как Офсетная если неясно)
  finishes?: string[] | string; // Массив строк или строка через запятую. Например: ["Матовая ламинация", "Тиснение золотом"], или "матовая ламинация, тиснение". "${FINISH_TYPES.join('", "')}"
  handleType?: string; // "${HANDLE_TYPES.join('", "')}" (только если productType = "Пакет бумажный")
  handleAttachment?: string; // "${HANDLE_ATTACHMENTS.join('", "')}" (только если productType = "Пакет бумажный")
  fittings?: string; // Например: "Люверсы", "Магниты", "Ручки не нужны" (если явно указано)
  additionalInfo?: string; // Любая другая информация, например, "внутри пакет белый", "logo нанесение белое: лицевая 10х7,5см., оборотная - 14х0,5см."
}

Старайся максимально полно извлечь все упомянутые детали для каждого варианта. Если какой-то параметр отсутствует в тексте, не включай его в JSON.
Если есть сомнения в интерпретации, отдавай предпочтение более общему варианту или включай исходную формулировку.
Размеры (width, height, depth) должны быть в мм. Если пользователь указал в см (например, "ширина 36см"), конвертируй в мм (360).

Примеры пользовательского текста и ОЖИДАЕМОГО JSON-МАССИВА:

ТЕКСТ 1: "Пакет,медная бумага , 280 грамм. Внутри пакет белый. Логотип-обычная печать. Ламинация сенсорная пленка Диаметр отверстий для ручек 6 мм. Ручки сами не нужны. Темно-Серый. Ширина 36*высота 27х глубина 18см 1000штук"
ОЖИДАЕМЫЙ JSON 1:
[
  {
    "productType": "Пакет бумажный",
    "material": "Мелованная бумага",
    "materialDensity": "280 грамм",
    "additionalInfo": "Внутри пакет белый. Логотип-обычная печать. Диаметр отверстий для ручек 6 мм. Темно-Серый.",
    "printType": "Офсетная печать", 
    "finishes": ["Сенсорная ламинация"],
    "fittings": "Ручки сами не нужны",
    "width": 360,
    "height": 270,
    "depth": 180,
    "quantity": 1000
  }
]

ТЕКСТ 2: "Пакет, медная бумага. Плотность 250 грамм. Зеркальный, с вырубной ручкой,Размер 25х30х80мм, logo нанесение белое: лицевая 10х7,5см., оборотная - 14х0,5см. Количество 500/1000"
ОЖИДАЕМЫЙ JSON 2:
[
  {
    "productType": "Пакет бумажный",
    "material": "Мелованная бумага",
    "materialDensity": "250 грамм",
    "finishes": ["Глянцевая ламинация"], 
    "handleType": "Вырубная ручка",
    "width": 250, 
    "height": 300,
    "depth": 80, 
    "additionalInfo": "logo нанесение белое: лицевая 10х7,5см., оборотная - 14х0,5см.",
    "quantity": 500
  },
  {
    "productType": "Пакет бумажный",
    "material": "Мелованная бумага",
    "materialDensity": "250 грамм",
    "finishes": ["Глянцевая ламинация"], 
    "handleType": "Вырубная ручка",
    "width": 250, 
    "height": 300,
    "depth": 80, 
    "additionalInfo": "logo нанесение белое: лицевая 10х7,5см., оборотная - 14х0,5см.",
    "quantity": 1000
  }
]

ТЕКСТ 3: "Привет . Пакет , медная бумага . Зеркальный ,плотность 250гр, (волнистые) репсовые ручки белые (А5 002) , вклеенные в ребро, размер ~30см , logo нанесение белое: лицевая 10х7,5см., оборотная - 14х0,5см. Размер 230*330*90мм. Количество 500/1000"
ОЖИДАЕМЫЙ JSON 3:
[
  {
    "productType": "Пакет бумажный",
    "material": "Мелованная бумага",
    "materialDensity": "250гр",
    "finishes": ["Глянцевая ламинация"],
    "handleType": "Лента репсовая",
    "additionalInfo": "ручки белые (А5 002), logo нанесение белое: лицевая 10х7,5см., оборотная - 14х0,5см. размер ~30см",
    "handleAttachment": "Вклеенные",
    "width": 230,
    "height": 330,
    "depth": 90,
    "quantity": 500
  },
  {
    "productType": "Пакет бумажный",
    "material": "Мелованная бумага",
    "materialDensity": "250гр",
    "finishes": ["Глянцевая ламинация"],
    "handleType": "Лента репсовая",
    "additionalInfo": "ручки белые (А5 002), logo нанесение белое: лицевая 10х7,5см., оборотная - 14х0,5см. размер ~30см",
    "handleAttachment": "Вклеенные",
    "width": 230,
    "height": 330,
    "depth": 90,
    "quantity": 1000
  }
]

ТЕКСТ 4: "Привет. Пакет Материал: медная бумага . Плотность: от 250 гр/м2. Покрытие/ламинация: мутная пленка . Способ нанесения logo посчитать три варианта: 1) трафаретная печать /2) uv-лакирование/3) выпуклый эффект . Печать logo с двух сторон. Вид ручек: шнурок. Способ крепления: на куриный глаз .Цвет пакета: как на фото (Pantone C нет). Внутри неокрашен. Цвет шнурка: как на фото. Размер Пакет: вертикальный 230 мм х 180 мм х 100 мм. Длина ручек: как на фото. Количество 3000"
ОЖИДАЕМЫЙ JSON 4:
[
  {
    "productType": "Пакет бумажный",
    "material": "Мелованная бумага",
    "materialDensity": "от 250 гр/м2",
    "finishes": ["Матовая ламинация"],
    "printType": "Трафаретная печать",
    "additionalInfo": "Вариант 1: трафаретная печать. Печать logo с двух сторон. Цвет пакета: как на фото (Pantone C нет). Внутри неокрашен. Цвет шнурка: как на фото. Длина ручек: как на фото.",
    "handleType": "Шнурок",
    "handleAttachment": "Люверсы",
    "width": 180, 
    "height": 230, 
    "depth": 100,
    "quantity": 3000
  },
  {
    "productType": "Пакет бумажный",
    "material": "Мелованная бумага",
    "materialDensity": "от 250 гр/м2",
    "finishes": ["Выборочный УФ-лак"], 
    "printType": "Офсетная печать", 
    "additionalInfo": "Вариант 2: uv-лакирование. Печать logo с двух сторон. Цвет пакета: как на фото (Pantone C нет). Внутри неокрашен. Цвет шнурка: как на фото. Длина ручек: как на фото.",
    "handleType": "Шнурок",
    "handleAttachment": "Люверсы",
    "width": 180, 
    "height": 230, 
    "depth": 100,
    "quantity": 3000
  },
  {
    "productType": "Пакет бумажный",
    "material": "Мелованная бумага",
    "materialDensity": "от 250 гр/м2",
    "finishes": ["Конгревное тиснение"], 
    "printType": "Офсетная печать", 
    "additionalInfo": "Вариант 3: выпуклый эффект. Печать logo с двух сторон. Цвет пакета: как на фото (Pantone C нет). Внутри неокрашен. Цвет шнурка: как на фото. Длина ручек: как на фото.",
    "handleType": "Шнурок",
    "handleAttachment": "Люверсы",
    "width": 180, 
    "height": 230, 
    "depth": 100,
    "quantity": 3000
  }
]

Пользовательский текст для обработки:
"${userText}"

JSON результат (массив объектов):
`;
  
  try {
    const response = await makeGeminiRequest(
      "gemini-2.5-flash-preview-04-17",
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
    // Specific error messages are now handled more generically by makeGeminiRequest
    // Re-throw the error for App.tsx to handle and display
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
    const response = await makeGeminiRequest(
      "gemini-2.5-flash-preview-04-17",
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
    const response = await makeGeminiRequest(
      "gemini-2.5-flash-preview-04-17",
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