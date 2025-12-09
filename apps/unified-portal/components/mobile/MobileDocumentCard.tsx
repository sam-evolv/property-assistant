'use client';

import { FileText, Download, Eye, ChevronRight } from 'lucide-react';

interface MobileDocumentCardProps {
  title: string;
  subtitle?: string;
  fileType?: string;
  onView?: () => void;
  onDownload?: () => void;
  onClick?: () => void;
  isDarkMode?: boolean;
  badge?: string;
  badgeColor?: 'gold' | 'blue' | 'green' | 'red';
}

export function MobileDocumentCard({
  title,
  subtitle,
  fileType = 'PDF',
  onView,
  onDownload,
  onClick,
  isDarkMode = false,
  badge,
  badgeColor = 'gold',
}: MobileDocumentCardProps) {
  const badgeColors = {
    gold: isDarkMode ? 'bg-gold-900/50 text-gold-400' : 'bg-gold-100 text-gold-700',
    blue: isDarkMode ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-700',
    green: isDarkMode ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-700',
    red: isDarkMode ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-700',
  };

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
          flex-shrink-0 w-10 h-10 rounded-lg
          flex items-center justify-center
          ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}
        `}>
          <FileText className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className={`
                font-medium text-sm line-clamp-2
                ${isDarkMode ? 'text-white' : 'text-gray-900'}
              `}>
                {title}
              </h3>
              {subtitle && (
                <p className={`
                  text-xs mt-0.5 line-clamp-1
                  ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}
                `}>
                  {subtitle}
                </p>
              )}
            </div>
            
            {badge && (
              <span className={`
                flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide
                px-2 py-0.5 rounded-full
                ${badgeColors[badgeColor]}
              `}>
                {badge}
              </span>
            )}
          </div>
          
          <div className="flex items-center justify-between mt-3">
            <span className={`
              text-[10px] font-medium uppercase tracking-wide
              ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}
            `}>
              {fileType}
            </span>
            
            <div className="flex items-center gap-1">
              {onView && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onView();
                  }}
                  className={`
                    p-2 rounded-full transition tap-effect
                    ${isDarkMode 
                      ? 'text-gray-400 hover:bg-gray-800 active:bg-gray-700' 
                      : 'text-gray-500 hover:bg-gray-100 active:bg-gray-200'
                    }
                  `}
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
              {onDownload && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload();
                  }}
                  className={`
                    p-2 rounded-full transition tap-effect
                    ${isDarkMode 
                      ? 'text-gray-400 hover:bg-gray-800 active:bg-gray-700' 
                      : 'text-gray-500 hover:bg-gray-100 active:bg-gray-200'
                    }
                  `}
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
              {onClick && !onView && !onDownload && (
                <ChevronRight className={`w-4 h-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MobileDocumentCard;
