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
    <div className="w-full max-w-2xl h-[70vh] md:h-[75vh] bg-slate-800 shadow-2xl rounded-xl flex flex-col overflow-hidden border border-slate-700">
      <div className="flex-grow p-4 space-y-2 overflow-y-auto bg-slate-850 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSendMessage={onSendMessage} isLoading={isLoading} disabled={isInputDisabled} />
    </div>
  );
};
