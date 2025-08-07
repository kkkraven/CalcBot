
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChatWindow } from './components/ChatWindow';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorMessage as ChatErrorMessage } from './components/ErrorMessage';
import { QuickActions } from './components/QuickActions';
import { LoadingState } from './components/LoadingState';
import { ToastContainer, ToastType } from './components/Toast';
import { CalculatorIcon } from './components/icons/CalculatorIcon';
import MonitoringDashboard from './components/MonitoringDashboard';
import type { FormData, PackagingCostResponse, ChatMessage, AppStep } from './types';
import { ProductType }  from './types';
import { 
  estimatePackagingCost, 
  parseOrderFromStringWithGemini, 
  parsePriceCorrectionFeedback,
  estimatePackagingCostWithKnowledgeBase,
  parseOrderFromStringWithGeminiOptimized,
  saveOrderToKnowledgeBase,
  getTokenUsageStats
} from './services/geminiService';
import { knowledgeBase } from './services/knowledgeBase';
import { logger } from './services/monitoringService';

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
  const [savedOrderIds, setSavedOrderIds] = useState<string[]>([]);
  const [showStats, setShowStats] = useState<boolean>(false);
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
  }>>([]);

  const prevAppStepRef = useRef<AppStep>(appStep);

  const addMessage = useCallback((text: string, sender: ChatMessage['sender'], isLoadingSpinner = false) => {
    setChatMessages(prev => [...prev, { id: Date.now().toString(), text, sender, timestamp: new Date(), isLoading: isLoadingSpinner }]);
  }, []);

  const addToast = useCallback((type: ToastType, title: string, message?: string, duration?: number) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, title, message, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
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

  // Функция для отображения статистики
  const showKnowledgeBaseStats = useCallback(() => {
    const stats = knowledgeBase.getStats();
    const tokenStats = getTokenUsageStats();
    
    const statsMessage = `
📊 Статистика базы знаний:
• Всего заказов: ${stats.totalOrders}
• Заказов с реальными ценами: ${stats.ordersWithActualPrices}
• Средняя точность: ${(stats.averagePriceAccuracy * 100).toFixed(1)}%

💡 Использование токенов (текущий месяц):
• Всего токенов: ${tokenStats.tokens.toLocaleString()}
• Стоимость: $${tokenStats.cost.toFixed(2)}

${stats.recentOrders.length > 0 ? '\n🕒 Последние заказы:' : ''}
${stats.recentOrders.slice(0, 3).map(order => 
  `• ${order.productType} ${order.quantity}шт - ${order.pricePerUnit}¥${order.actualPrice ? ` (реальная: ${order.actualPrice}¥)` : ''}`
).join('\n')}`;

    addMessage(statsMessage, 'bot');
  }, [addMessage]);

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
    logger.info('User input received', undefined, { 
      inputLength: userInput.length,
      appStep 
    });
    
    addMessage(userInput, 'user');
    setError(null);

    // Обработка специальных команд
    if (userInput.toLowerCase().includes('статистика') || userInput.toLowerCase().includes('стат')) {
      showKnowledgeBaseStats();
      addToast('info', 'Статистика', 'Загружаю данные статистики...');
      return;
    }

    if (appStep === 'awaiting_description') {
      setIsLoading(true);
      addMessage("Анализирую ваш запрос...", 'bot', true);
      setAppStep('parsing_description');
      setFormData([]); 
      setLastCalculatedFormData(null); 
      addToast('info', 'Обработка', 'Анализирую ваш запрос...');
      
      try {
        // Используем оптимизированную функцию
        const parsedDataArray = await parseOrderFromStringWithGeminiOptimized(userInput);
        setChatMessages(prev => prev.filter(m => !m.isLoading));

        if (!parsedDataArray || parsedDataArray.length === 0 || parsedDataArray.some(data => Object.keys(data).length === 0 || !data.productType)) {
          addMessage("Не удалось извлечь ключевые параметры (например, тип продукции) из вашего запроса для одного или нескольких вариантов. Пожалуйста, попробуйте описать заказ подробнее или по-другому.", 'error');
          addToast('error', 'Ошибка', 'Не удалось извлечь параметры заказа');
          setAppStep('awaiting_description');
        } else {
          setFormData(parsedDataArray.map(data => ({ ...data, parsedUserRequest: userInput })));
          setAppStep('awaiting_confirmation');
          addToast('success', 'Успешно', `Извлечено ${parsedDataArray.length} вариантов заказа`);
        }
      } catch (e: any) {
        logger.error('Error parsing user input', e, { 
          userInput: userInput.substring(0, 100),
          appStep 
        });
        
        setChatMessages(prev => prev.filter(m => !m.isLoading));
        let userErrorMessage = `Ошибка при разборе запроса. Попробуйте еще раз.`;
        const errorMessageString = String(e?.message || e || '').toLowerCase();

        if (errorMessageString.includes("неверный api ключ gemini")) {
            userErrorMessage = "Произошла ошибка аутентификации с сервисом Gemini. Пожалуйста, убедитесь, что конфигурация API ключа корректна в окружении приложения. После проверки, попробуйте еще раз.";
        } else if (errorMessageString.includes("502") || errorMessageString.includes("proxying failed") || errorMessageString.includes("readablestream")) {
            userErrorMessage = "Произошла ошибка при связи с сервисом Gemini (возможно, через прокси-сервер или из-за сетевых настроек). Пожалуйста, проверьте ваше интернет-соединение и, если проблема повторяется, обратитесь за помощью. (Код: 502/Proxy)";
        } else if (e?.message) {
             userErrorMessage = `Ошибка при разборе запроса: ${e.message}. Попробуйте еще раз.`;
        }
        addMessage(userErrorMessage, 'error');
        addToast('error', 'Ошибка', 'Не удалось обработать запрос');
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
        addToast('info', 'Расчет', 'Начинаю расчет стоимости...');
        
        const results = [];
        const newOrderIds: string[] = [];

        for (let i = 0; i < formData.length; i++) {
            const variant = formData[i];
            const quantityInfo = variant.quantity ? ` (Тираж: ${variant.quantity})` : '';
            const variantLoadingMessage = `Рассчитываю вариант ${i + 1}${quantityInfo}...`;
            addMessage(variantLoadingMessage, 'bot', true);

            if (!variant.productType || !variant.material || !variant.width || !variant.height || (!variant.depth && String(variant.productType) !== ProductType.TISSUE_PAPER) || !variant.quantity) {
                 setChatMessages(prev => prev.filter(m => m.text !== variantLoadingMessage)); 
                 addMessage(`Вариант ${i + 1}: Некоторые обязательные поля (тип, материал, размеры, количество) отсутствуют или некорректны. Невозможно рассчитать.`, 'error');
                 addToast('error', 'Ошибка', `Вариант ${i + 1}: Недостаточно данных`);
                 results.push({success: false, text: `Вариант ${i+1}: Пропущен из-за отсутствия данных.`});
                 continue; 
            }
            try {
                // Используем функцию с базой знаний
                const resultTextFromGemini = await estimatePackagingCostWithKnowledgeBase(variant as FormData);
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

                    // Сохраняем заказ в базу знаний
                    try {
                        const orderId = saveOrderToKnowledgeBase(variant as FormData, estimatedCostPerUnit);
                        newOrderIds.push(orderId);
                        logger.info('Order saved to knowledge base', undefined, { 
                          orderId,
                          variantIndex: i,
                          productType: variant.productType 
                        });
                    } catch (saveError) {
                        logger.error('Error saving order to knowledge base', saveError as Error, { 
                          variantIndex: i,
                          productType: variant.productType 
                        });
                    }
                }
                
                const resultPrefix = formData.length > 1 ? `Результат для Варианта ${i + 1} (Тираж: ${variant.quantity}):\n` : '';
                addMessage(resultPrefix + formattedResultText, 'bot');
                results.push({success: true, text: resultPrefix + formattedResultText});

            } catch (e:any) {
                logger.error('Error calculating cost for variant', e, { 
                  variantIndex: i,
                  productType: variant.productType,
                  quantity: variant.quantity 
                });
                
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
                addToast('error', 'Ошибка расчета', `Вариант ${i + 1}: ${e.message || "Неизвестная ошибка"}`);
                results.push({success: false, text: errorPrefix + `Ошибка: ${e.message || "Неизвестная ошибка"}`});
            }
        }
        setChatMessages(prev => prev.filter(m => m.text !== "Рассчитываю стоимость для каждого варианта...")); 
        
        // Сохраняем ID заказов для возможного обновления реальных цен
        setSavedOrderIds(newOrderIds);
        
        setIsLoading(false);
        setAppStep('displaying_result');
        addToast('success', 'Расчет завершен', `Обработано ${results.filter(r => r.success).length} из ${results.length} вариантов`);

      } else if (confirmation === 'нет' || confirmation === 'н' || confirmation === 'no' || confirmation === 'n') {
        addMessage("Хорошо, давайте попробуем еще раз. Пожалуйста, опишите ваш заказ как можно подробнее.", 'bot');
        setAppStep('awaiting_description');
        setFormData([]);
        setLastCalculatedFormData(null);
        addToast('info', 'Начинаем заново', 'Опишите заказ подробнее');
      } else {
        addMessage("Пожалуйста, ответьте 'да' или 'нет'.", 'bot');
        addToast('warning', 'Неверный ответ', 'Ответьте "да" или "нет"');
      }
    } else if (appStep === 'awaiting_feedback_or_new_order') {
        setIsLoading(true);
        addMessage("Проверяю ваше сообщение...", 'bot', true);
        let feedbackProcessedSuccessfully = false;

        try {
            setAppStep('processing_correction');
            const corrections = await parsePriceCorrectionFeedback(userInput, lastCalculatedFormData || []);
            setChatMessages(prev => prev.filter(m => !m.isLoading));

            if (corrections && corrections.length > 0) {
                let feedbackMessage = "Спасибо за уточнение цен!\n";
                corrections.forEach(corr => {
                    feedbackMessage += `- Для тиража ${corr.quantity} шт. учтена цена ${corr.correctedPricePerUnit.toFixed(2)} ¥.\n`;
                });
                feedbackMessage += "\nЭти данные будут сохранены в базу знаний для улучшения будущих расчетов.";
                addMessage(feedbackMessage, 'bot');
                addToast('success', 'Обратная связь', 'Данные сохранены в базу знаний');
                feedbackProcessedSuccessfully = true;
            } else {
                // Это новый заказ
                addMessage("Хорошо, начинаем новый расчет. Анализирую ваш запрос...", 'bot', true);
                setAppStep('parsing_description');
                setFormData([]); 
                setLastCalculatedFormData(null); 
                const parsedDataArray = await parseOrderFromStringWithGeminiOptimized(userInput);
                setChatMessages(prev => prev.filter(m => m.text === "Проверяю ваше сообщение..." || m.text === "Хорошо, начинаем новый расчет. Анализирую ваш запрос...").filter(m => !m.isLoading));

                if (!parsedDataArray || parsedDataArray.length === 0 || parsedDataArray.some(data => Object.keys(data).length === 0 || !data.productType)) {
                    addMessage("Не удалось извлечь ключевые параметры. Пожалуйста, опишите заказ подробнее.", 'error');
                    addToast('error', 'Ошибка', 'Не удалось извлечь параметры');
                    setAppStep('awaiting_description');
                } else {
                    setFormData(parsedDataArray.map(data => ({ ...data, parsedUserRequest: userInput })));
                    setAppStep('awaiting_confirmation');
                    addToast('success', 'Новый заказ', `Извлечено ${parsedDataArray.length} вариантов`);
                }
                setIsLoading(false);
                return;
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
            addToast('error', 'Ошибка обработки', 'Начинаем новый расчет');
            setAppStep('awaiting_description');
        } finally {
            setIsLoading(false); 

            if (feedbackProcessedSuccessfully) {
                addMessage("Готов принять ваш следующий заказ.", 'bot');
            }
            
            setAppStep('awaiting_description');
            setFormData([]);
            setLastCalculatedFormData(null);
        }
    } else if (appStep === 'error_state') { 
        addMessage("Чтобы начать новый расчет, пожалуйста, опишите ваш следующий заказ.", 'bot');
        setAppStep('awaiting_description');
        setFormData([]);
        setLastCalculatedFormData(null);
        addToast('info', 'Новый расчет', 'Опишите ваш заказ');
    }
  };

  const handleTemplateSelect = (template: string) => {
    handleUserInput(template);
  };

  const handleShowHistory = () => {
    // Показываем историю в чате
    const historyMessage = history.length > 0 
      ? `История запросов:\n${history.slice(0, 5).map((item, index) => 
          `${index + 1}. ${item.text.substring(0, 50)}${item.text.length > 50 ? '...' : ''}`
        ).join('\n')}`
      : 'История пока пуста';
    addMessage(historyMessage, 'info');
  };

  const handleShowStats = () => {
    showKnowledgeBaseStats();
  };

  const isInputDisabled = isLoading || appStep === 'parsing_description' || appStep === 'calculating_cost' || appStep === 'processing_correction';

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-3 md:p-4">
      {/* Background decorations with animation */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '4s' }}></div>
      </div>
      
      <header className="w-full max-w-2xl mb-4 md:mb-6 text-center relative z-10 animate-in fade-in duration-700">
        <div className="flex items-center justify-center mb-2 md:mb-3">
          <div className="relative">
            <CalculatorIcon className="h-8 w-8 md:h-10 md:w-10 text-teal-400 mr-2 md:mr-3 animate-in scale-in duration-500" />
            <div className="absolute inset-0 bg-teal-400/20 rounded-full blur-lg animate-pulse"></div>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 via-blue-400 to-purple-400 animate-in slide-in-from-bottom duration-700">
            Чат-Калькулятор Упаковки
          </h1>
        </div>
        <p className="text-sm md:text-base text-gray-400 animate-in slide-in-from-bottom duration-700" style={{ animationDelay: '200ms' }}>
          Опишите ваш заказ, и я рассчитаю примерную стоимость.
        </p>
        <button 
          onClick={showKnowledgeBaseStats}
          className="mt-2 md:mt-3 px-3 py-1 md:px-4 md:py-2 text-xs md:text-sm bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-blue-200 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 border border-blue-500/30 hover:border-blue-500/50 animate-in slide-in-from-bottom duration-700"
          style={{ animationDelay: '400ms' }}
        >
          📊 Статистика
        </button>
      </header>
      
      <div className="relative z-10 w-full animate-in fade-in duration-1000" style={{ animationDelay: '600ms' }}>
        <ChatWindow
          messages={chatMessages}
          onSendMessage={handleUserInput}
          isLoading={isLoading && (appStep === 'parsing_description' || appStep === 'calculating_cost' || appStep === 'processing_correction')}
          isInputDisabled={isInputDisabled}
        />
      </div>

      {/* Loading State Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
          <div className="w-full max-w-md mx-4">
            <LoadingState
              step={
                appStep === 'parsing_description' ? 'parsing' :
                appStep === 'calculating_cost' ? 'calculating' :
                appStep === 'processing_correction' ? 'processing' : 'parsing'
              }
              variant={formData.length > 0 ? formData.length : 1}
              totalVariants={formData.length > 0 ? formData.length : 1}
            />
          </div>
        </div>
      )}

      {/* Quick Actions for mobile */}
      <div className="relative z-10 w-full max-w-2xl mt-4 md:hidden">
        <QuickActions
          onTemplateSelect={handleTemplateSelect}
          onShowHistory={handleShowHistory}
          onShowStats={handleShowStats}
        />
      </div>

      {error && !isLoading && appStep !== 'calculating_cost' && appStep !== 'parsing_description' && appStep !== 'processing_correction' && (
        <div className="relative z-10 w-full max-w-2xl mt-4 animate-in slide-in-from-bottom duration-300">
          <ChatErrorMessage message={error} onClose={() => setError(null)} />
        </div>
      )}
      
      <footer className="w-full max-w-2xl mt-6 md:mt-8 text-center text-gray-500 text-xs md:text-sm relative z-10 animate-in fade-in duration-700" style={{ animationDelay: '800ms' }}>
        <p>&copy; {new Date().getFullYear()} AI Packaging Estimator. Все расчеты являются предварительными.</p>
        <p className="mt-1">Напишите "статистика" для просмотра данных базы знаний.</p>
      </footer>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
      
      {/* Monitoring Dashboard */}
      <MonitoringDashboard />
    </div>
  );
};

export default App;
