'use client';

import { Bell, Globe, HelpCircle, ChevronRight } from 'lucide-react';

export function SettingsSheet() {
  const settings = [
    {
      id: 'notifications',
      label: 'Notifications',
      sublabel: 'Manage alerts & updates',
      icon: Bell,
      bg: 'bg-blue-100',
      iconColor: 'text-blue-500',
    },
    {
      id: 'language',
      label: 'Language',
      sublabel: 'English (Ireland)',
      icon: Globe,
      bg: 'bg-violet-100',
      iconColor: 'text-violet-500',
    },
    {
      id: 'help',
      label: 'Help & Support',
      sublabel: 'Get assistance',
      icon: HelpCircle,
      bg: 'bg-gray-100',
      iconColor: 'text-gray-500',
    },
  ];

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-5">Settings</h2>

      <div className="space-y-3">
        {settings.map((item) => (
          <button
            key={item.id}
            className="w-full flex items-center gap-4 p-3 rounded-xl bg-gray-50 active:scale-[0.98] transition-transform"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.bg}`}>
              <item.icon className={`w-5 h-5 ${item.iconColor}`} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-gray-900">{item.label}</p>
              <p className="text-xs text-gray-500">{item.sublabel}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400 text-center mt-6">OpenHouse v1.0.0</p>
    </div>
  );
}
