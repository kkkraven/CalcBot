
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChatWindow } from './components/ChatWindow';
import { ErrorMessage as ChatErrorMessage } from './components/ErrorMessage';
import { CalculatorIcon } from './components/icons/CalculatorIcon';
import type { FormData, ChatMessage, AppStep } from './types';
import { ProductType }  from './types';
import { estimatePackagingCost, parseOrderFromStringWithGemini, parsePriceCorrectionFeedback } from './services/geminiService';

const App: React.FC = () => {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    {
      id: Date.now().toString(),
      text: "Здравствуйте! Пожалуйста, опишите ваш заказ на упаковку одним сообщением. Я постараюсь извлечь все необходимые параметры, включая варианты тиражей, если они указаны (например, 500/1000 шт).",
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [formData, setFormData] = useState<Partial<FormData>[]>([]);
  const [lastCalculatedFormData, setLastCalculatedFormData] = useState<Partial<FormData>[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [appStep, setAppStep] = useState<AppStep>('awaiting_description');

  const prevAppStepRef = useRef<AppStep>(appStep);

  const addMessage = useCallback((text: string, sender: ChatMessage['sender'], isLoadingSpinner = false) => {
    setChatMessages(prev => [...prev, { id: Date.now().toString(), text, sender, timestamp: new Date(), isLoading: isLoadingSpinner }]);
  }, []);

  const translateKeyToRussian = useCallback((key: keyof FormData): string => {
    const translations: Record<keyof FormData, string> = {
        parsedUserRequest: "Исходный запрос",
        productType: "Тип продукции",
        specificBoxType: "Тип коробки",
        material: "Материал",
        specificMaterialName: "Название материала",
        materialDensity: "Плотность материала (г/м²)",
        width: "Ширина (мм)",
        height: "Высота (мм)",
        depth: "Глубина (мм)",
        quantity: "Количество (шт)",
        printColorsOuter: "Цветность снаружи",
        printColorsInner: "Цветность внутри",
        printType: "Тип печати",
        finishes: "Отделка",
        handleType: "Тип ручек",
        handleAttachment: "Крепление ручек",
        fittings: "Фурнитура",
        additionalInfo: "Доп. информация"
    };
    return translations[key] || key;
  }, []);

  useEffect(() => {
    const previousStep = prevAppStepRef.current;

    if (appStep === 'awaiting_confirmation' && previousStep === 'parsing_description') {
      if (formData.length > 0 && formData.every(fd => fd.parsedUserRequest && Object.keys(fd).length > 1)) {
        let confirmationText = "Я понял ваш заказ так:\n";
        formData.forEach((variant, index) => {
            confirmationText += `\n--- Вариант ${index + 1} ---\n`;
            for (const [key, value] of Object.entries(variant)) {
                if (value !== undefined && value !== null && value !== '' && key !== 'parsedUserRequest') {
                    let displayValue = value;
                    if (Array.isArray(value)) {
                        displayValue = value.join(', ');
                    } else if (typeof value === 'object') {
                        displayValue = JSON.stringify(value);
                    }
                    confirmationText += `- ${translateKeyToRussian(key as keyof FormData)}: ${displayValue}\n`;
                }
            }
        });
        confirmationText += "\nВсе верно? (да/нет)";
        addMessage(confirmationText, 'bot');
      } else {
         addMessage("Не удалось извлечь достаточно данных из вашего запроса для подтверждения или один из вариантов не содержит тип продукции. Пожалуйста, попробуйте описать заказ более подробно.", 'error');
         setAppStep('awaiting_description');
         setFormData([]);
      }
    } else if (appStep === 'displaying_result' && previousStep === 'calculating_cost') {
        setLastCalculatedFormData(formData); 
        addMessage("Расчет завершен. Вы можете предоставить обратную связь по ценам (например, 'верная цена для 500шт - 9.0') или описать следующий заказ.", 'bot');
        setAppStep('awaiting_feedback_or_new_order');
    }


    if (previousStep !== appStep) {
      prevAppStepRef.current = appStep;
    }
  }, [appStep, formData, addMessage, translateKeyToRussian, setAppStep, setFormData, setLastCalculatedFormData]);


  const handleUserInput = async (userInput: string) => {
    addMessage(userInput, 'user');
    setError(null);

    if (appStep === 'awaiting_description') {
      setIsLoading(true);
      addMessage("Анализирую ваш запрос...", 'bot', true);
      setAppStep('parsing_description');
      setFormData([]); 
      setLastCalculatedFormData(null); 
      try {
        const parsedDataArray = await parseOrderFromStringWithGemini(userInput);
        setChatMessages(prev => prev.filter(m => !m.isLoading));

        if (!parsedDataArray || parsedDataArray.length === 0 || parsedDataArray.some(data => Object.keys(data).length === 0 || !data.productType)) {
            addMessage("Не удалось извлечь ключевые параметры (например, тип продукции) из вашего запроса для одного или нескольких вариантов. Пожалуйста, попробуйте описать заказ подробнее или по-другому.", 'error');
            setAppStep('awaiting_description');
        } else {
            setFormData(parsedDataArray.map(data => ({ ...data, parsedUserRequest: userInput })));
            setAppStep('awaiting_confirmation');
        }
      } catch (e: any) {
        setChatMessages(prev => prev.filter(m => !m.isLoading));
        let userErrorMessage = `Ошибка при разборе запроса. Попробуйте еще раз.`; // Default concise message
        const errorMessageString = String(e?.message || e || '').toLowerCase();

        if (errorMessageString.includes("неверный api ключ gemini")) {
            userErrorMessage = "Произошла ошибка аутентификации с сервисом Gemini. Пожалуйста, убедитесь, что конфигурация API ключа корректна в окружении приложения. После проверки, попробуйте еще раз.";
        } else if (errorMessageString.includes("502") || errorMessageString.includes("proxying failed") || errorMessageString.includes("readablestream")) {
            userErrorMessage = "Произошла ошибка при связи с сервисом Gemini (возможно, через прокси-сервер или из-за сетевых настроек). Пожалуйста, проверьте ваше интернет-соединение и, если проблема повторяется, обратитесь за помощью. (Код: 502/Proxy)";
        } else if (e?.message) {
             userErrorMessage = `Ошибка при разборе запроса: ${e.message}. Попробуйте еще раз.`;
        }
        addMessage(userErrorMessage, 'error');
        setAppStep('awaiting_description');
      } finally {
        setIsLoading(false);
      }
    } else if (appStep === 'awaiting_confirmation') {
      const confirmation = userInput.trim().toLowerCase();
      if (confirmation === 'да' || confirmation === 'д' || confirmation === 'yes' || confirmation === 'y') {
        setIsLoading(true);
        addMessage("Рассчитываю стоимость для каждого варианта...", 'bot', true);
        setAppStep('calculating_cost');
        
        const results = [];

        for (let i = 0; i < formData.length; i++) {
            const variant = formData[i];
            const quantityInfo = variant.quantity ? ` (Тираж: ${variant.quantity})` : '';
            const variantLoadingMessage = `Рассчитываю вариант ${i + 1}${quantityInfo}...`;
            addMessage(variantLoadingMessage, 'bot', true);

            if (!variant.productType || !variant.material || !variant.width || !variant.height || (!variant.depth && String(variant.productType) !== ProductType.TISSUE_PAPER) || !variant.quantity) {
                 setChatMessages(prev => prev.filter(m => m.text !== variantLoadingMessage)); 
                 addMessage(`Вариант ${i + 1}: Некоторые обязательные поля (тип, материал, размеры, количество) отсутствуют или некорректны. Невозможно рассчитать.`, 'error');
                 results.push({success: false, text: `Вариант ${i+1}: Пропущен из-за отсутствия данных.`});
                 continue; 
            }
            try {
                const resultTextFromGemini = await estimatePackagingCost(variant as FormData);
                setChatMessages(prev => prev.filter(m => m.text !== variantLoadingMessage));
                
                const unitCostMatch = resultTextFromGemini.match(/(\d+\.?\d*)\s*¥\s*за\s*единицу/);
                const totalCostMatch = resultTextFromGemini.match(/Общая\s*сумма:\s*(\d+\.?\d*)\s*¥/);
                
                let formattedResultText = resultTextFromGemini;

                if (unitCostMatch && totalCostMatch) {
                    const estimatedCostPerUnit = parseFloat(unitCostMatch[1]);
                    const totalEstimatedCost = parseFloat(totalCostMatch[1]);

                    const costPerUnitLower = estimatedCostPerUnit * 0.85;
                    const costPerUnitUpper = estimatedCostPerUnit * 1.15;
                    const totalCostLower = totalEstimatedCost * 0.85;
                    const totalCostUpper = totalEstimatedCost * 1.15;
                    
                    const noteMatch = resultTextFromGemini.match(/\.\s*([^.]*?\.\s*Обновите базу[^.]*\.)$/i);
                    const note = noteMatch && noteMatch[1] ? noteMatch[1].trim() : "Расчет предварительный. Для точной цены обновите базу.";

                    formattedResultText = `Примерный диапазон стоимости: ${costPerUnitLower.toFixed(2)} - ${costPerUnitUpper.toFixed(2)} ¥ за единицу. 
Общая сумма в диапазоне: ${totalCostLower.toFixed(2)} - ${totalCostUpper.toFixed(2)} ¥. 
${note}`;
                }
                
                const resultPrefix = formData.length > 1 ? `Результат для Варианта ${i + 1} (Тираж: ${variant.quantity}):\n` : '';
                addMessage(resultPrefix + formattedResultText, 'bot');
                results.push({success: true, text: resultPrefix + formattedResultText});

            } catch (e:any) {
                setChatMessages(prev => prev.filter(m => m.text !== variantLoadingMessage));
                const errorPrefix = formData.length > 1 ? `Ошибка для Варианта ${i + 1} (Тираж: ${variant.quantity}):\n` : '';
                let calcErrorMessage = `Ошибка при расчете. Попробуйте еще раз.`;
                const errorMessageString = String(e?.message || e || '').toLowerCase();

                if (errorMessageString.includes("неверный api ключ gemini")) {
                    calcErrorMessage = "Ошибка аутентификации с Gemini при расчете. Пожалуйста, убедитесь, что конфигурация API ключа корректна в окружении приложения.";
                } else if (errorMessageString.includes("502") || errorMessageString.includes("proxying failed") || errorMessageString.includes("readablestream")) {
                    calcErrorMessage = "Ошибка при связи с сервисом Gemini (возможно, через прокси-сервер или из-за сетевых настроек) во время расчета. Пожалуйста, проверьте ваше интернет-соединение. (Код: 502/Proxy)";
                } else if (e?.message) {
                    calcErrorMessage = `Ошибка при расчете: ${e.message}`;
                }
                addMessage(errorPrefix + calcErrorMessage, 'error');
                results.push({success: false, text: errorPrefix + `Ошибка: ${e.message || "Неизвестная ошибка"}`});
            }
        }
        setChatMessages(prev => prev.filter(m => m.text !== "Рассчитываю стоимость для каждого варианта...")); 
        
        setIsLoading(false);
        setAppStep('displaying_result');

      } else if (confirmation === 'нет' || confirmation === 'н' || confirmation === 'no' || confirmation === 'n') {
        addMessage("Хорошо, давайте попробуем еще раз. Пожалуйста, опишите ваш заказ как можно подробнее.", 'bot');
        setAppStep('awaiting_description');
        setFormData([]);
        setLastCalculatedFormData(null);
      } else {
        addMessage("Пожалуйста, ответьте 'да' или 'нет'.", 'bot');
      }
    } else if (appStep === 'awaiting_feedback_or_new_order') {
        setIsLoading(true);
        addMessage("Проверяю ваше сообщение...", 'bot', true);
        // Note: appStep variable in this scope will be 'awaiting_feedback_or_new_order'.
        // setAppStep calls below queue updates for the next render.
        let feedbackProcessedSuccessfully = false;

        try {
            setAppStep('processing_correction'); // Queued for next render
            const corrections = await parsePriceCorrectionFeedback(userInput, lastCalculatedFormData || []);
            setChatMessages(prev => prev.filter(m => !m.isLoading));

            if (corrections && corrections.length > 0) {
                let feedbackMessage = "Спасибо за уточнение цен!\n";
                corrections.forEach(corr => {
                    feedbackMessage += `- Для тиража ${corr.quantity} шт. учтена цена ${corr.correctedPricePerUnit.toFixed(2)} ¥.\n`;
                });
                feedbackMessage += "\nПожалуйста, не забудьте внести эти данные в вашу Google Таблицу. Это поможет улучшить общие инструкции для будущих расчетов, так как я не могу обновлять таблицу напрямую.";
                addMessage(feedbackMessage, 'bot');
                feedbackProcessedSuccessfully = true;
                // State will be reset to 'awaiting_description' in finally
            } else {
                // This is a new order description
                addMessage("Хорошо, начинаем новый расчет. Анализирую ваш запрос...", 'bot', true);
                setAppStep('parsing_description'); // Queued for next render
                setFormData([]); 
                setLastCalculatedFormData(null); 
                const parsedDataArray = await parseOrderFromStringWithGemini(userInput);
                setChatMessages(prev => prev.filter(m => m.text === "Проверяю ваше сообщение..." || m.text === "Хорошо, начинаем новый расчет. Анализирую ваш запрос...").filter(m => !m.isLoading));

                if (!parsedDataArray || parsedDataArray.length === 0 || parsedDataArray.some(data => Object.keys(data).length === 0 || !data.productType)) {
                    addMessage("Не удалось извлечь ключевые параметры. Пожалуйста, опишите заказ подробнее.", 'error');
                    setAppStep('awaiting_description'); // Queued for next render
                } else {
                    setFormData(parsedDataArray.map(data => ({ ...data, parsedUserRequest: userInput })));
                    setAppStep('awaiting_confirmation'); // Queued for next render
                }
                setIsLoading(false); // Crucial: set loading false before returning
                return; // Exit handleUserInput, finally block below will not be executed for this path
            }
        } catch (e: any) {
            setChatMessages(prev => prev.filter(m => !m.isLoading));
            let feedbackErrorMessage = `Ошибка при обработке вашего сообщения. Начинаем новый расчет. Опишите ваш заказ.`;
            const errorMessageString = String(e?.message || e || '').toLowerCase();
            if (errorMessageString.includes("неверный api ключ gemini")) {
                 feedbackErrorMessage = `Ошибка аутентификации с Gemini: ${e.message}. Убедитесь в корректности конфигурации API ключа в окружении и попробуйте снова.`;
            } else if (errorMessageString.includes("502") || errorMessageString.includes("proxying failed") || errorMessageString.includes("readablestream")) {
                 feedbackErrorMessage = `Ошибка при связи с сервисом Gemini (возможно, через прокси-сервер) при обработке отзыва. Ошибка: ${e.message}`;
            } else if (e?.message) {
                feedbackErrorMessage = `Ошибка при обработке вашего сообщения: ${e.message}. Начинаем новый расчет. Опишите ваш заказ.`;
            }
            addMessage(feedbackErrorMessage, 'error');
            // Error occurred, ensure feedbackProcessedSuccessfully remains false.
            // State will be reset to 'awaiting_description' in finally.
            setAppStep('awaiting_description'); // Queued for next render
        } finally {
            // This finally block is executed if the 'return' in the new order path was NOT hit.
            // This means either feedback was processed, or an error occurred.
            // The 'appStep' variable in this scope is still 'awaiting_feedback_or_new_order'.
            setIsLoading(false); 

            if (feedbackProcessedSuccessfully) {
                addMessage("Готов принять ваш следующий заказ.", 'bot');
            }
            
            // Reset state for the next interaction, as 'return' was not hit.
            setAppStep('awaiting_description');
            setFormData([]);
            setLastCalculatedFormData(null);
        }
    } else if (appStep === 'error_state') { 
        addMessage("Чтобы начать новый расчет, пожалуйста, опишите ваш следующий заказ.", 'bot');
        setAppStep('awaiting_description');
        setFormData([]);
        setLastCalculatedFormData(null);
    }
  };

  const isInputDisabled = isLoading || appStep === 'parsing_description' || appStep === 'calculating_cost' || appStep === 'processing_correction';

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen bg-slate-900 p-4">
      <header className="w-full max-w-2xl mb-6 text-center">
        <div className="flex items-center justify-center mb-2">
          <CalculatorIcon className="h-10 w-10 text-primary mr-2" />
          <h1 className="text-3xl sm:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
            Чат-Калькулятор Упаковки
          </h1>
        </div>
        <p className="text-md text-gray-400">
          Опишите ваш заказ, и я рассчитаю примерную стоимость.
        </p>
      </header>
      
      <ChatWindow
        messages={chatMessages}
        onSendMessage={handleUserInput}
        isLoading={isLoading && (appStep === 'parsing_description' || appStep === 'calculating_cost' || appStep === 'processing_correction')}
        isInputDisabled={isInputDisabled}
      />

      {error && !isLoading && appStep !== 'calculating_cost' && appStep !== 'parsing_description' && appStep !== 'processing_correction' && <ChatErrorMessage message={error} onClose={() => setError(null)} />}
      
      <footer className="w-full max-w-2xl mt-8 text-center text-gray-500 text-sm">
        <p>&copy; {new Date().getFullYear()} AI Packaging Estimator. Все расчеты являются предварительными.</p>
      </footer>
    </div>
  );
};

export default App;
