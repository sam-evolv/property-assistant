'use client';

import { useState, useEffect } from 'react';
import { PreHandoverHome } from '@/components/pre-handover/PreHandoverHome';
import { BottomSheet } from '@/components/pre-handover/BottomSheet';
import { TimelineSheet } from '@/components/pre-handover/TimelineSheet';
import { DocumentsSheet } from '@/components/pre-handover/DocumentsSheet';
import { FAQSheet } from '@/components/pre-handover/FAQSheet';
import { ContactSheet } from '@/components/pre-handover/ContactSheet';
import { CalendarSheet } from '@/components/pre-handover/CalendarSheet';
import { SettingsSheet } from '@/components/pre-handover/SettingsSheet';
import { ChatSheet } from '@/components/pre-handover/ChatSheet';
import type { PreHandoverData } from '@/lib/pre-handover/types';

export default function PreHandoverPage() {
  const [data, setData] = useState<PreHandoverData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/purchaser/pre-handover');
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('Failed to load pre-handover data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const openSheet = (name: string) => setActiveSheet(name);
  const closeSheet = () => setActiveSheet(null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#D4AF37] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      <PreHandoverHome data={data} onOpenSheet={openSheet} />

      {/* Bottom Sheets */}
      <BottomSheet isOpen={activeSheet === 'timeline'} onClose={closeSheet}>
        <TimelineSheet milestones={data.milestones} />
      </BottomSheet>

      <BottomSheet isOpen={activeSheet === 'docs'} onClose={closeSheet}>
        <DocumentsSheet documents={data.documents} />
      </BottomSheet>

      <BottomSheet isOpen={activeSheet === 'faq'} onClose={closeSheet}>
        <FAQSheet faqs={data.faqs} />
      </BottomSheet>

      <BottomSheet isOpen={activeSheet === 'contact'} onClose={closeSheet}>
        <ContactSheet contact={data.contact} />
      </BottomSheet>

      <BottomSheet isOpen={activeSheet === 'calendar'} onClose={closeSheet}>
        <CalendarSheet milestones={data.milestones} />
      </BottomSheet>

      <BottomSheet isOpen={activeSheet === 'settings'} onClose={closeSheet}>
        <SettingsSheet />
      </BottomSheet>

      <BottomSheet isOpen={activeSheet === 'chat'} onClose={closeSheet}>
        <ChatSheet />
      </BottomSheet>
    </>
  );
}
