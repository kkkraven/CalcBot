import React from 'react';
import { Loader2, Package, Calculator, TrendingUp } from 'lucide-react';
import { ProgressBar } from './ProgressBar';

interface LoadingStateProps {
  step: 'parsing' | 'calculating' | 'processing';
  variant?: number;
  totalVariants?: number;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ 
  step, 
  variant = 1, 
  totalVariants = 1 
}) => {
  const getStepInfo = () => {
    switch (step) {
      case 'parsing':
        return {
          title: 'Анализирую ваш запрос',
          description: 'Извлекаю параметры заказа...',
          icon: <Package className="w-6 h-6" />,
          color: 'blue' as const
        };
      case 'calculating':
        return {
          title: `Рассчитываю стоимость`,
          description: totalVariants > 1 
            ? `Вариант ${variant} из ${totalVariants}...`
            : 'Выполняю расчет...',
          icon: <Calculator className="w-6 h-6" />,
          color: 'teal' as const
        };
      case 'processing':
        return {
          title: 'Обрабатываю данные',
          description: 'Обновляю базу знаний...',
          icon: <TrendingUp className="w-6 h-6" />,
          color: 'purple' as const
        };
    }
  };

  const stepInfo = getStepInfo();

  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col items-center text-center space-y-6">
        {/* Animated icon */}
        <div className={`bg-gradient-to-r from-${stepInfo.color}-400 to-${stepInfo.color}-600 rounded-full p-4 shadow-lg animate-pulse`}>
          {stepInfo.icon}
        </div>
        
        {/* Loading spinner */}
        <div className="relative">
          <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
          <div className="absolute inset-0 bg-teal-400/20 rounded-full blur-lg animate-pulse"></div>
        </div>
        
        {/* Text content */}
        <div className="space-y-2">
          <h3 className="text-white font-medium text-lg md:text-xl">{stepInfo.title}</h3>
          <p className="text-white/60 text-sm md:text-base">{stepInfo.description}</p>
        </div>
        
        {/* Progress dots */}
        <div className="flex space-x-2">
          <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
        
        {/* Progress bar for multiple variants */}
        {totalVariants > 1 && step === 'calculating' && (
          <div className="w-full max-w-xs">
            <ProgressBar
              current={variant}
              total={totalVariants}
              label={`Вариант ${variant} из ${totalVariants}`}
              color={stepInfo.color}
              animated={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};
