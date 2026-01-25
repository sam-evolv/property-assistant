'use client';

import { SheetHeader, SheetItem } from '../BottomSheet';
import { Bell, Languages, HelpCircle, ChevronRight } from 'lucide-react';

export function SettingsSheet() {
  return (
    <>
      <SheetHeader title="Settings" />
      <div className="px-6 py-5 space-y-3">
        <SheetItem onClick={() => {}}>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FEFCE8] to-[#FEF9C3] 
            flex items-center justify-center border border-[#D4AF37]/10
            group-hover:shadow-[0_0_12px_rgba(212,175,55,0.15)] transition-all duration-[250ms]">
            <Bell className="w-6 h-6 text-[#A67C3A]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            <p className="text-xs text-gray-500 mt-0.5">Manage push notifications</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#D4AF37] 
            group-hover:translate-x-0.5 transition-all duration-[250ms]" />
        </SheetItem>

        <SheetItem onClick={() => {}}>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FEF9C3] to-[#FEF08A] 
            flex items-center justify-center border border-[#D4AF37]/10
            group-hover:shadow-[0_0_12px_rgba(212,175,55,0.15)] transition-all duration-[250ms]">
            <Languages className="w-6 h-6 text-[#8B6428]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Language</p>
            <p className="text-xs text-gray-500 mt-0.5">English</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#D4AF37] 
            group-hover:translate-x-0.5 transition-all duration-[250ms]" />
        </SheetItem>

        <SheetItem onClick={() => {}}>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FDE047]/30 to-[#FACC15]/30 
            flex items-center justify-center border border-[#D4AF37]/10
            group-hover:shadow-[0_0_12px_rgba(212,175,55,0.15)] transition-all duration-[250ms]">
            <HelpCircle className="w-6 h-6 text-[#B8941F]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Help & Support</p>
            <p className="text-xs text-gray-500 mt-0.5">Get help with the app</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#D4AF37] 
            group-hover:translate-x-0.5 transition-all duration-[250ms]" />
        </SheetItem>

        <div className="pt-4 border-t border-[#D4AF37]/10 mt-4">
          <p className="text-xs text-center text-gray-400">OpenHouse v1.0.0</p>
        </div>
      </div>
    </>
  );
}
