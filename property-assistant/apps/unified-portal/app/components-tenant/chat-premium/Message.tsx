'use client';

import { motion } from 'framer-motion';

interface MessageProps {
  role: 'user' | 'assistant';
  content: string;
  citations?: string[];
  fallback?: boolean;
}

export default function Message({ role, content, citations, fallback }: MessageProps) {
  const isUser = role === 'user';

  // Strip markdown bold markers (**text**) from content
  const cleanContent = content.replace(/\*\*(.*?)\*\*/g, '$1');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-1 group`}
    >
      {!isUser && (
        <div className="flex-shrink-0 mr-2 mt-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-md">
            <svg 
              className="w-5 h-5 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
        </div>
      )}
      
      <div
        className={`max-w-[70%] md:max-w-[65%] rounded-[18px] px-3.5 py-2.5 shadow-sm premium-transition ${
          isUser
            ? 'bg-black text-white border border-gold-500/20'
            : 'bg-white text-gray-900 border border-gray-200'
        }`}
      >
        <div className="whitespace-pre-wrap text-[15px] leading-relaxed">
          {cleanContent}
        </div>
        
        {citations && citations.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gold-500/20 text-xs">
            <div className="flex items-start gap-2">
              <svg 
                className="w-3.5 h-3.5 text-gold-500 flex-shrink-0 mt-0.5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                />
              </svg>
              <div>
                <span className="font-semibold text-gold-600">Sources: </span>
                <span className={isUser ? 'text-gray-300' : 'text-gray-600'}>
                  {citations.join(', ')}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {isUser && (
        <div className="flex-shrink-0 ml-3 mt-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center shadow-md text-white text-sm font-semibold">
            U
          </div>
        </div>
      )}
    </motion.div>
  );
}
