
import React from 'react';

export const CalculatorIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    {...props}
  >
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
    <line x1="8" y1="6" x2="16" y2="6"></line>
    <line x1="8" y1="10" x2="16" y2="10"></line>
    <line x1="8" y1="14" x2="10" y2="14"></line>
    <line x1="14" y1="14" x2="16" y2="14"></line>
    <line x1="8" y1="18" x2="10" y2="18"></line>
    <line x1="14" y1="18" x2="16" y2="18"></line>
    <line x1="12" y1="14" x2="12" y2="18"></line>
  </svg>
);
