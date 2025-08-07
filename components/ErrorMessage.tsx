import React from 'react';
import { X, AlertCircle } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  onClose?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onClose }) => {
  return (
    <div className="bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-xl p-3 md:p-4 shadow-lg animate-in slide-in-from-bottom duration-300">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-0.5">
          <AlertCircle className="w-5 h-5 text-red-400" />
        </div>
        <div className="flex-grow">
          <p className="text-red-200 text-sm md:text-base leading-relaxed">{message}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 text-red-300 hover:text-red-200 transition-colors duration-200 hover:bg-red-500/20 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};