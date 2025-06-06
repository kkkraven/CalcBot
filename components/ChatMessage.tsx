import React from 'react';
import type { ChatMessage as ChatMessageType } from '../types';
import { CalculatorIcon } from './icons/CalculatorIcon'; // Example icon for bot

interface ChatMessageProps {
  message: ChatMessageType;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const { text, sender, timestamp } = message;

  const isUser = sender === 'user';
  const isBot = sender === 'bot';
  const isError = sender === 'error';
  const isInfo = sender === 'info';

  const messageClass = isUser 
    ? 'bg-userMessageBg text-userMessageText self-end' 
    : isBot 
    ? 'bg-botMessageBg text-botMessageText self-start'
    : isError
    ? 'bg-red-500 text-white self-start'
    : 'bg-blue-100 text-blue-800 self-start'; // Info

  return (
    <div className={`flex mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (isBot || isError || isInfo) && (
         <div className={`flex-shrink-0 h-8 w-8 rounded-full ${isBot ? 'bg-primary' : isError ? 'bg-accent' : 'bg-gray-400'} flex items-center justify-center mr-2`}>
            {isBot && <CalculatorIcon className="h-4 w-4 text-white" />}
            {isError && <span className="text-white font-bold">!</span>}
            {isInfo && <span className="text-white font-bold">i</span>}
         </div>
      )}
      <div className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg shadow ${messageClass}`}>
        <p className="text-sm whitespace-pre-wrap">{text}</p>
        {/* 
        <span className={`text-xs mt-1 block ${isUser ? 'text-blue-200' : 'text-gray-500'}`}>
          {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        */}
      </div>
    </div>
  );
};
