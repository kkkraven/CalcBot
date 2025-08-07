import React, { useState } from 'react';
import { knowledgeBase } from '../services/knowledgeBase';

interface FeedbackFormProps {
  orderId: string;
  estimatedPrice: number;
  onClose: () => void;
  onUpdate: (actualPrice: number, supplier: string) => void;
}

export const FeedbackForm: React.FC<FeedbackFormProps> = ({
  orderId,
  estimatedPrice,
  onClose,
  onUpdate
}) => {
  const [actualPrice, setActualPrice] = useState<string>('');
  const [supplier, setSupplier] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!actualPrice || isNaN(parseFloat(actualPrice))) {
      alert('Пожалуйста, введите корректную цену');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const price = parseFloat(actualPrice);
      const success = knowledgeBase.updateActualPrice(orderId, price, supplier);
      
      if (success) {
        onUpdate(price, supplier);
        onClose();
      } else {
        alert('Ошибка при обновлении цены');
      }
    } catch (error) {
      console.error('Ошибка при обновлении цены:', error);
      alert('Произошла ошибка при обновлении цены');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Обновить реальную цену</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Оценка AI: {estimatedPrice.toFixed(2)} ¥
            </label>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Реальная цена (¥)
            </label>
            <input
              type="number"
              step="0.01"
              value={actualPrice}
              onChange={(e) => setActualPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Введите реальную цену"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Поставщик (необязательно)
            </label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Название поставщика"
            />
          </div>
          
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !actualPrice}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
