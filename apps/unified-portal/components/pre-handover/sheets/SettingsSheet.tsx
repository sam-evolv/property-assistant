'use client';

import { SheetHeader, SheetItem } from '../BottomSheet';

// Icons
const BellIcon = () => (
  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const LanguageIcon = () => (
  <svg className="w-6 h-6 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
  </svg>
);

const HelpIcon = () => (
  <svg className="w-6 h-6 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-5 h-5 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export function SettingsSheet() {
  return (
    <>
      <SheetHeader title="Settings" />
      <div className="px-6 py-5 space-y-3">
        <SheetItem onClick={() => {}}>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
            <BellIcon />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-brand-dark">Notifications</p>
            <p className="text-xs text-brand-muted mt-0.5">Manage push notifications</p>
          </div>
          <ChevronRightIcon />
        </SheetItem>

        <SheetItem onClick={() => {}}>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-violet-50 flex items-center justify-center">
            <LanguageIcon />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-brand-dark">Language</p>
            <p className="text-xs text-brand-muted mt-0.5">English</p>
          </div>
          <ChevronRightIcon />
        </SheetItem>

        <SheetItem onClick={() => {}}>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-stone-100 to-stone-50 flex items-center justify-center">
            <HelpIcon />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-brand-dark">Help & Support</p>
            <p className="text-xs text-brand-muted mt-0.5">Get help with the app</p>
          </div>
          <ChevronRightIcon />
        </SheetItem>

        <div className="pt-3 border-t border-stone-100 mt-3">
          <p className="text-xs text-center text-brand-muted">OpenHouse v1.0.0</p>
        </div>
      </div>
    </>
  );
}
