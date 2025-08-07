import React from 'react';
import type { ChatMessage as ChatMessageType } from '../types';
import { CalculatorIcon } from './icons/CalculatorIcon';

interface ChatMessageProps {
  message: ChatMessageType;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const { text, sender, timestamp, isLoading } = message;

  const isUser = sender === 'user';
  const isBot = sender === 'bot';
  const isError = sender === 'error';
  const isInfo = sender === 'info';

  const messageClass = isUser 
    ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white self-end shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]' 
    : isBot 
    ? 'bg-white/10 backdrop-blur-sm border border-white/20 text-white self-start shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]'
    : isError
    ? 'bg-gradient-to-r from-red-500/20 to-red-600/20 border border-red-400/30 text-red-200 self-start shadow-lg'
    : 'bg-gradient-to-r from-blue-500/20 to-blue-600/20 border border-blue-400/30 text-blue-200 self-start shadow-lg';

  const getIcon = () => {
    if (isBot) return <CalculatorIcon className="h-4 w-4 text-white" />;
    if (isError) return <span className="text-white font-bold text-sm">!</span>;
    if (isInfo) return <span className="text-white font-bold text-sm">i</span>;
    return null;
  };

  const getIconBg = () => {
    if (isBot) return 'bg-gradient-to-r from-teal-400 to-teal-600';
    if (isError) return 'bg-gradient-to-r from-red-400 to-red-600';
    if (isInfo) return 'bg-gradient-to-r from-blue-400 to-blue-600';
    return 'bg-gray-400';
  };

  return (
    <div className={`flex mb-3 md:mb-4 ${isUser ? 'justify-end' : 'justify-start'} group`}>
      {!isUser && (isBot || isError || isInfo) && (
        <div className={`flex-shrink-0 h-8 w-8 rounded-full ${getIconBg()} flex items-center justify-center mr-2 md:mr-3 shadow-lg animate-in scale-in duration-200`}>
          {getIcon()}
        </div>
      )}
      
      <div className={`max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg px-3 py-2 md:px-4 md:py-3 rounded-2xl shadow-lg ${messageClass}`}>
        {isLoading ? (
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-white/60 rounded-full animate-typing"></div>
              <div className="w-2 h-2 bg-white/60 rounded-full animate-typing" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-white/60 rounded-full animate-typing" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <span className="text-sm">Обрабатываю...</span>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm md:text-base whitespace-pre-wrap leading-relaxed">{text}</p>
            <div className="flex items-center justify-between text-xs opacity-60">
              <span>{new Date(timestamp).toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}</span>
              {isUser && (
                <div className="flex items-center space-x-1">
                  <div className="w-1 h-1 bg-white/60 rounded-full"></div>
                  <div className="w-1 h-1 bg-white/60 rounded-full"></div>
                  <div className="w-1 h-1 bg-white/60 rounded-full"></div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
