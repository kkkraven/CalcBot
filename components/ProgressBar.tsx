import React from 'react';
import { TrendingUp } from 'lucide-react';

interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
  showPercentage?: boolean;
  animated?: boolean;
  color?: 'teal' | 'blue' | 'green' | 'purple';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
  current, 
  total, 
  label, 
  showPercentage = true, 
  animated = true,
  color = 'teal'
}) => {
  const percentage = Math.min((current / total) * 100, 100);
  
  const getColorClasses = () => {
    switch (color) {
      case 'blue':
        return 'bg-blue-500';
      case 'green':
        return 'bg-green-500';
      case 'purple':
        return 'bg-purple-500';
      default:
        return 'bg-teal-500';
    }
  };

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <span className="text-white/80 text-sm font-medium flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" />
              {label}
            </span>
          )}
          {showPercentage && (
            <span className="text-white/60 text-sm">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      
      <div className="w-full bg-white/20 rounded-full h-2 md:h-3 overflow-hidden">
        <div 
          className={`h-full rounded-full ${getColorClasses()} transition-all duration-1000 ease-out ${
            animated ? 'animate-pulse' : ''
          }`}
          style={{ 
            width: `${percentage}%`,
            transition: animated ? 'width 1s ease-out' : 'none'
          }}
        >
          <div className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
        </div>
      </div>
      
      <div className="flex justify-between text-xs text-white/40 mt-1">
        <span>{current}</span>
        <span>{total}</span>
      </div>
    </div>
  );
};
