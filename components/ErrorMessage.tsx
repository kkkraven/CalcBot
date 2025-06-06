import React from 'react';

interface ErrorMessageProps {
  message: string;
  onClose?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onClose }) => (
  <div className="my-2 p-3 bg-red-200 border border-red-400 text-red-800 rounded-md shadow-sm relative text-sm">
    <strong className="font-semibold">Ошибка!</strong>
    <span className="block sm:inline ml-1">{message}</span>
    {onClose && (
      <button 
        onClick={onClose} 
        className="absolute top-0 bottom-0 right-0 px-3 py-2 text-red-600 hover:text-red-800"
        aria-label="Закрыть сообщение об ошибке"
      >
        <svg className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/></svg>
      </button>
    )}
  </div>
);