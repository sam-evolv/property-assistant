'use client';

import type { Contact } from '@/lib/pre-handover/types';
import { Phone, Mail, MapPin, ChevronRight } from 'lucide-react';

interface Props {
  contact: Contact;
}

export function ContactSheet({ contact }: Props) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-5">Contact Us</h2>

      <div className="space-y-3">
        <a
          href={`tel:${contact.phone}`}
          className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 active:scale-[0.98] transition-transform"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Phone className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Call Sales</p>
            <p className="text-xs text-gray-500">{contact.phone}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </a>

        <a
          href={`mailto:${contact.email}`}
          className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 active:scale-[0.98] transition-transform"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Mail className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Email Us</p>
            <p className="text-xs text-gray-500">{contact.email}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </a>

        <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-50">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-violet-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Show House</p>
            <p className="text-xs text-gray-500">{contact.address}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </div>
    </div>
  );
}
