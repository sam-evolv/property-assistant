'use client';

import { Bell, ChevronRight, Calendar } from 'lucide-react';

interface MobileNoticeCardProps {
  title: string;
  preview: string;
  date: string;
  isNew?: boolean;
  onClick?: () => void;
  isDarkMode?: boolean;
}

export function MobileNoticeCard({
  title,
  preview,
  date,
  isNew = false,
  onClick,
  isDarkMode = false,
}: MobileNoticeCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        mobile-card tap-effect
        rounded-xl p-4
        border
        ${isDarkMode 
          ? 'bg-gray-900 border-gray-800' 
          : 'bg-white border-gray-200'
        }
        ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`
          flex-shrink-0 w-10 h-10 rounded-full
          flex items-center justify-center
          ${isNew 
            ? 'bg-gold-500 text-white' 
            : isDarkMode 
              ? 'bg-gray-800 text-gray-400' 
              : 'bg-gray-100 text-gray-500'
          }
        `}>
          <Bell className="w-5 h-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className={`
              font-medium text-sm line-clamp-2
              ${isDarkMode ? 'text-white' : 'text-gray-900'}
            `}>
              {title}
            </h3>
            {isNew && (
              <span className={`
                flex-shrink-0 w-2 h-2 rounded-full bg-gold-500 mt-1.5
              `} />
            )}
          </div>
          
          <p className={`
            text-xs mt-1 line-clamp-2
            ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}
          `}>
            {preview}
          </p>
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1">
              <Calendar className={`w-3 h-3 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
              <span className={`
                text-[10px]
                ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}
              `}>
                {date}
              </span>
            </div>
            
            {onClick && (
              <ChevronRight className={`w-4 h-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MobileNoticeCard;
