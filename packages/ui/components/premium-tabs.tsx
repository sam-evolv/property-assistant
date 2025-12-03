'use client';

import React, { useState } from 'react';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface PremiumTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function PremiumTabs({ tabs, activeTab, onTabChange, className = '' }: PremiumTabsProps) {
  return (
    <div className={`border-b border-gray-200 ${className}`}>
      <nav className="flex space-x-8 px-6" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              relative flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300
              ${
                activeTab === tab.id
                  ? 'border-gold-500 text-gold-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            {tab.icon && <span className="text-lg">{tab.icon}</span>}
            <span>{tab.label}</span>
            
            {activeTab === tab.id && (
              <div 
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600"
                style={{
                  animation: 'fadeIn 0.3s ease-out',
                }}
              />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
