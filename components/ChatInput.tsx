import React, { useState } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading, disabled }) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading && !disabled) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-slate-800 border-t border-slate-700">
      <div className="flex items-center space-x-3">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={disabled ? "Пожалуйста, подождите..." : "Введите ваш ответ..."}
          className="flex-grow p-3 border border-slate-600 rounded-lg bg-slate-700 text-gray-200 placeholder-gray-500 focus:ring-primary focus:border-primary transition duration-150 disabled:opacity-60"
          disabled={isLoading || disabled}
          aria-label="Поле для ввода сообщения"
        />
        <button
          type="submit"
          disabled={isLoading || disabled || !inputValue.trim()}
          className="p-3 bg-primary text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-800 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Отправить сообщение"
        >
          {isLoading ? (
            <LoadingSpinner small />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
};
