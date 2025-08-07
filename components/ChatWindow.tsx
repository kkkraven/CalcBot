import React, { useEffect, useRef } from 'react';
import type { ChatMessage as ChatMessageType } from '../types';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

interface ChatWindowProps {
  messages: ChatMessageType[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  isInputDisabled?: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ messages, onSendMessage, isLoading, isInputDisabled }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  return (
    <div className="w-full max-w-2xl md:max-w-4xl lg:max-w-5xl h-[70vh] md:h-[75vh] bg-slate-800 shadow-2xl rounded-xl flex flex-col overflow-hidden border border-slate-700 animate-in fade-in duration-500">
      {/* Header with mobile optimization */}
      <div className="p-3 md:p-4 border-b border-slate-700 bg-slate-850">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 md:space-x-3">
            <div className="w-2 h-2 md:w-3 md:h-3 bg-red-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 md:w-3 md:h-3 bg-yellow-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 md:w-3 md:h-3 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
          <div className="text-white/60 text-xs md:text-sm font-medium">Чат-Калькулятор Упаковки</div>
        </div>
      </div>

      {/* Messages area with improved mobile layout */}
      <div className="flex-grow p-3 md:p-4 space-y-3 md:space-y-4 overflow-y-auto bg-slate-850 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
        {messages.length === 0 ? (
          <div className="text-center py-8 md:py-12 animate-in fade-in duration-700">
            <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center animate-bounce-in">
              <svg className="w-6 h-6 md:w-8 md:h-8 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-white/60 text-sm md:text-base">Начните диалог, описав ваш заказ</p>
            <p className="text-white/40 text-xs md:text-sm mt-2">Например: "Коробка 200x150x50мм, мелованная бумага 250г/м²"</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={msg.id} 
              className={`animate-in ${
                msg.sender === 'user' ? 'slide-in-from-right' : 'slide-in-from-left'
              } duration-300`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <ChatMessage message={msg} />
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area with mobile optimization */}
      <ChatInput onSendMessage={onSendMessage} isLoading={isLoading} disabled={isInputDisabled} />
    </div>
  );
};
