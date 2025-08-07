import React from 'react';
import { TrendingUp, Package, DollarSign, Clock, CheckCircle } from 'lucide-react';

interface ResultCardProps {
  variant: number;
  quantity: number;
  costPerUnit: number;
  totalCost: number;
  confidence: number;
  productType: string;
  material: string;
  isAnimated?: boolean;
}

export const ResultCard: React.FC<ResultCardProps> = ({ 
  variant, 
  quantity, 
  costPerUnit, 
  totalCost, 
  confidence, 
  productType, 
  material,
  isAnimated = true 
}) => {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-400';
    if (confidence >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConfidenceBg = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-500';
    if (confidence >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className={`bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] ${
      isAnimated ? 'animate-in slide-in-from-bottom duration-500' : ''
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-r from-teal-400 to-teal-600 rounded-lg p-2">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-medium text-sm md:text-base">Вариант {variant}</h3>
            <p className="text-white/60 text-xs md:text-sm">{productType}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-white/60" />
          <span className="text-white/60 text-xs md:text-sm">{quantity} шт</span>
        </div>
      </div>
      
      <div className="space-y-3 md:space-y-4">
        <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
          <div className="flex items-center space-x-2">
            <DollarSign className="w-4 h-4 text-teal-400" />
            <span className="text-white/80 text-sm md:text-base">За единицу:</span>
          </div>
          <span className="text-teal-400 font-bold text-lg md:text-xl">{costPerUnit.toFixed(2)} ¥</span>
        </div>
        
        <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-teal-400" />
            <span className="text-white/80 text-sm md:text-base">Общая сумма:</span>
          </div>
          <span className="text-teal-400 font-bold text-xl md:text-2xl">{totalCost.toFixed(2)} ¥</span>
        </div>
        
        <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-teal-400" />
            <span className="text-white/80 text-sm md:text-base">Точность:</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-16 md:w-20 bg-white/20 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-1000 ${getConfidenceBg(confidence)}`}
                style={{ width: `${confidence}%` }}
              ></div>
            </div>
            <span className={`font-medium text-sm md:text-base ${getConfidenceColor(confidence)}`}>
              {confidence}%
            </span>
          </div>
        </div>
      </div>
      
      <div className="mt-4 p-3 bg-white/5 rounded-lg">
        <p className="text-white/60 text-xs md:text-sm">
          <strong>Материал:</strong> {material}
        </p>
      </div>
    </div>
  );
};
