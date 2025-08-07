import React from 'react';

interface LoadingSpinnerProps {
  small?: boolean;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ small = false, className = '' }) => {
  const size = small ? 'w-4 h-4' : 'w-6 h-6';
  
  return (
    <div className={`animate-spin rounded-full border-2 border-white/20 border-t-white ${size} ${className}`}>
      <span className="sr-only">Загрузка...</span>
    </div>
  );
};