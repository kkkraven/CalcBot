import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, XCircle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ 
  id, 
  type, 
  title, 
  message, 
  duration = 5000, 
  onClose 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Анимация появления
    const showTimer = setTimeout(() => setIsVisible(true), 100);
    
    // Автоматическое закрытие
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose(id), 300);
    }, duration);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [id, duration, onClose]);

  const getToastStyle = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-500/20 border-green-400/30',
          icon: <CheckCircle className="w-5 h-5 text-green-400" />,
          iconBg: 'bg-green-500/20'
        };
      case 'error':
        return {
          bg: 'bg-red-500/20 border-red-400/30',
          icon: <XCircle className="w-5 h-5 text-red-400" />,
          iconBg: 'bg-red-500/20'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-500/20 border-yellow-400/30',
          icon: <AlertCircle className="w-5 h-5 text-yellow-400" />,
          iconBg: 'bg-yellow-500/20'
        };
      case 'info':
        return {
          bg: 'bg-blue-500/20 border-blue-400/30',
          icon: <Info className="w-5 h-5 text-blue-400" />,
          iconBg: 'bg-blue-500/20'
        };
    }
  };

  const toastStyle = getToastStyle();

  return (
    <div 
      className={`backdrop-blur-xl border rounded-xl p-4 shadow-2xl transition-all duration-300 transform ${
        isVisible 
          ? 'translate-x-0 opacity-100 scale-100' 
          : 'translate-x-full opacity-0 scale-95'
      } ${toastStyle.bg}`}
    >
      <div className="flex items-start space-x-3">
        <div className={`flex-shrink-0 p-2 rounded-lg ${toastStyle.iconBg}`}>
          {toastStyle.icon}
        </div>
        <div className="flex-grow min-w-0">
          <h4 className="text-white font-medium text-sm md:text-base">{title}</h4>
          {message && (
            <p className="text-white/80 text-xs md:text-sm mt-1 leading-relaxed">{message}</p>
          )}
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(() => onClose(id), 300);
          }}
          className="flex-shrink-0 p-1 text-white/60 hover:text-white/80 transition-colors duration-200 hover:bg-white/10 rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Array<{
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
  }>;
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={onClose}
        />
      ))}
    </div>
  );
};
