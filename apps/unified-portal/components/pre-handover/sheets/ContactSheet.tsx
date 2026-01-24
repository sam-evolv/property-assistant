'use client';

import { SheetHeader, SheetItem } from '../BottomSheet';
import type { ContactInfo } from '../types';

// Icons
const PhoneIcon = () => (
  <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

const MailIcon = () => (
  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const MapPinIcon = () => (
  <svg className="w-6 h-6 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-5 h-5 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

interface ContactSheetProps {
  contacts: ContactInfo;
}

export function ContactSheet({ contacts }: ContactSheetProps) {
  const handleCall = () => {
    if (contacts.salesPhone) {
      window.location.href = `tel:${contacts.salesPhone}`;
    }
  };

  const handleEmail = () => {
    if (contacts.salesEmail) {
      window.location.href = `mailto:${contacts.salesEmail}`;
    }
  };

  const handleMap = () => {
    if (contacts.showHouseAddress) {
      window.open(`https://maps.google.com?q=${encodeURIComponent(contacts.showHouseAddress)}`, '_blank');
    }
  };

  return (
    <>
      <SheetHeader title="Get in Touch" />
      <div className="px-6 py-5 space-y-3">
        {contacts.salesPhone && (
          <SheetItem onClick={handleCall}>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center">
              <PhoneIcon />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-brand-dark">Call Sales Team</p>
              <p className="text-xs text-brand-muted mt-0.5">{contacts.salesPhone}</p>
            </div>
            <ChevronRightIcon />
          </SheetItem>
        )}

        {contacts.salesEmail && (
          <SheetItem onClick={handleEmail}>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
              <MailIcon />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-brand-dark">Email Us</p>
              <p className="text-xs text-brand-muted mt-0.5">{contacts.salesEmail}</p>
            </div>
            <ChevronRightIcon />
          </SheetItem>
        )}

        {contacts.showHouseAddress && (
          <SheetItem onClick={handleMap}>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-violet-50 flex items-center justify-center">
              <MapPinIcon />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-brand-dark">Show House</p>
              <p className="text-xs text-brand-muted mt-0.5">{contacts.showHouseAddress}</p>
            </div>
            <ChevronRightIcon />
          </SheetItem>
        )}

        {!contacts.salesPhone && !contacts.salesEmail && !contacts.showHouseAddress && (
          <div className="text-center py-8">
            <p className="text-sm text-brand-muted">Contact information not available</p>
          </div>
        )}
      </div>
    </>
  );
}
