import React, { useState, useRef, useEffect } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading, disabled }) => {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading && !disabled) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  // Автоматическое изменение высоты textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  return (
    <div className="p-3 md:p-4 bg-slate-800 border-t border-slate-700 animate-in slide-in-from-bottom duration-300">
      <form onSubmit={handleSubmit} className="relative">
        <div className={`flex items-end space-x-2 md:space-x-3 p-2 md:p-3 rounded-2xl border transition-all duration-300 ${
          isFocused 
            ? 'border-teal-400/50 bg-white/10 shadow-lg shadow-teal-400/20 scale-[1.02]' 
            : 'border-white/20 bg-white/5 hover:border-white/30 hover:bg-white/8'
        }`}>
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={disabled ? "Пожалуйста, подождите..." : "Опишите ваш заказ упаковки..."}
            className="flex-grow min-h-[44px] max-h-[120px] bg-transparent text-white placeholder-white/50 resize-none outline-none text-sm md:text-base leading-relaxed"
            disabled={isLoading || disabled}
            rows={1}
          />
          
          <button
            type="submit"
            disabled={isLoading || disabled || !inputValue.trim()}
            className="flex-shrink-0 p-2 md:p-3 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 disabled:from-gray-500 disabled:to-gray-600 text-white rounded-xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-105 disabled:scale-100 active:scale-95"
          >
            {isLoading ? (
              <LoadingSpinner small />
            ) : (
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="currentColor" 
                className="w-5 h-5 md:w-6 md:h-6 transition-transform duration-200 group-hover:translate-x-0.5"
              >
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            )}
          </button>
        </div>
        
        <div className="flex items-center justify-between mt-2 px-2 md:px-3 text-xs text-white/40">
          <span className="hidden sm:inline">Нажмите Enter для отправки, Shift+Enter для новой строки</span>
          <span className="sm:hidden">Enter для отправки</span>
          <span className={`transition-colors duration-200 ${
            inputValue.length > 800 ? 'text-yellow-400' : 
            inputValue.length > 950 ? 'text-red-400' : 'text-white/40'
          }`}>
            {inputValue.length}/1000
          </span>
        </div>
      </form>
    </div>
  );
};
