'use client';

import React from 'react';

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm w-fit">
      <div className="flex gap-1">
        <div 
          className="w-2 h-2 bg-gold-500 rounded-full"
          style={{
            animation: 'bounce-subtle 1.4s ease-in-out infinite',
          }}
        />
        <div 
          className="w-2 h-2 bg-gold-500 rounded-full"
          style={{
            animation: 'bounce-subtle 1.4s ease-in-out infinite 0.2s',
          }}
        />
        <div 
          className="w-2 h-2 bg-gold-500 rounded-full"
          style={{
            animation: 'bounce-subtle 1.4s ease-in-out infinite 0.4s',
          }}
        />
      </div>
    </div>
  );
}
