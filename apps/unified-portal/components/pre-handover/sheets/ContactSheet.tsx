'use client';

import { SheetHeader, SheetItem } from '../BottomSheet';
import type { ContactInfo } from '../types';
import { Phone, Mail, MapPin, ChevronRight } from 'lucide-react';

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
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FEFCE8] to-[#FEF9C3] 
              flex items-center justify-center border border-[#D4AF37]/10
              group-hover:shadow-[0_0_12px_rgba(212,175,55,0.15)] transition-all duration-[250ms]">
              <Phone className="w-6 h-6 text-[#A67C3A]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Call Sales Team</p>
              <p className="text-xs text-gray-500 mt-0.5">{contacts.salesPhone}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#D4AF37] 
              group-hover:translate-x-0.5 transition-all duration-[250ms]" />
          </SheetItem>
        )}

        {contacts.salesEmail && (
          <SheetItem onClick={handleEmail}>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FEF9C3] to-[#FEF08A] 
              flex items-center justify-center border border-[#D4AF37]/10
              group-hover:shadow-[0_0_12px_rgba(212,175,55,0.15)] transition-all duration-[250ms]">
              <Mail className="w-6 h-6 text-[#8B6428]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Email Us</p>
              <p className="text-xs text-gray-500 mt-0.5">{contacts.salesEmail}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#D4AF37] 
              group-hover:translate-x-0.5 transition-all duration-[250ms]" />
          </SheetItem>
        )}

        {contacts.showHouseAddress && (
          <SheetItem onClick={handleMap}>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FDE047]/30 to-[#FACC15]/30 
              flex items-center justify-center border border-[#D4AF37]/10
              group-hover:shadow-[0_0_12px_rgba(212,175,55,0.15)] transition-all duration-[250ms]">
              <MapPin className="w-6 h-6 text-[#B8941F]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Show House</p>
              <p className="text-xs text-gray-500 mt-0.5">{contacts.showHouseAddress}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#D4AF37] 
              group-hover:translate-x-0.5 transition-all duration-[250ms]" />
          </SheetItem>
        )}

        {!contacts.salesPhone && !contacts.salesEmail && !contacts.showHouseAddress && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#FEFCE8] to-[#FEF9C3] 
              flex items-center justify-center border border-[#D4AF37]/20">
              <Phone className="w-7 h-7 text-[#D4AF37]" />
            </div>
            <p className="text-sm text-gray-500">Contact information not available</p>
          </div>
        )}
      </div>
    </>
  );
}
