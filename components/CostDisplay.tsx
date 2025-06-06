import React from 'react';
import type { PackagingCostResponse } from '../types';

interface CostDisplayProps {
  response: PackagingCostResponse;
}

export const CostDisplay: React.FC<CostDisplayProps> = ({ response }) => {
  const { fullText, estimatedCostPerUnit, totalEstimatedCost } = response;

  return (
    <div className="mt-8 p-6 bg-slate-700 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold text-gray-100 mb-4">Результат расчета:</h2>
      {estimatedCostPerUnit !== null && totalEstimatedCost !== null ? (
        <>
          <div className="mb-4">
            <p className="text-lg text-gray-300">
              Примерная стоимость за единицу: 
              <span className="text-2xl font-bold text-secondary ml-2">
                {estimatedCostPerUnit.toFixed(2)} ¥
              </span>
            </p>
          </div>
          <div className="mb-6">
            <p className="text-lg text-gray-300">
              Общая примерная сумма заказа: 
              <span className="text-2xl font-bold text-secondary ml-2">
                {totalEstimatedCost.toFixed(2)} ¥
              </span>
            </p>
          </div>
          <p className="text-sm text-gray-400 italic leading-relaxed">
            {fullText.replace(/Примерная стоимость вашего заказа:.*?Общая сумма:.*?\./i, '').trim()}
          </p>
        </>
      ) : (
         <p className="text-md text-gray-300 leading-relaxed">{fullText}</p>
      )}
      <p className="text-xs text-gray-500 mt-4">
        Данный расчет является предварительным. Для повышения точности будущих оценок, пожалуйста, добавьте фактическую стоимость заказа (после получения ответа от поставщика) в вашу базу знаний (Google Таблицу).
      </p>
    </div>
  );
};