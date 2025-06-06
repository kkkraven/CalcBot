import React from 'react';

export const LoadingSpinner: React.FC<{small?: boolean}> = ({small}) => (
  <div className={`flex items-center ${small ? 'my-0' : 'justify-center my-8'}`}>
    <div className={`animate-spin rounded-full border-t-2 border-b-2 border-primary ${small ? 'h-5 w-5': 'h-10 w-10'}`}></div>
    {!small && <p className="ml-3 text-gray-300">Пожалуйста, подождите...</p>}
  </div>
);