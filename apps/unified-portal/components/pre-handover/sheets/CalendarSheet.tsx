'use client';

import { SheetHeader, SheetItem } from '../BottomSheet';
import type { UnitPreHandoverData } from '../types';

// Icons
const GoogleIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const AppleIcon = () => (
  <svg className="w-6 h-6 text-stone-800" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);

const OutlookIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24">
    <path fill="#0078D4" d="M24 7.387v10.478c0 .23-.08.424-.238.576-.158.154-.352.23-.58.23h-8.547v-6.959l1.6 1.229c.102.086.227.13.377.13.148 0 .273-.044.377-.13l6.632-5.052c.095-.063.178-.091.25-.091.134 0 .201.09.201.27l-.072.319z" />
    <ellipse fill="#0078D4" cx="7" cy="12" rx="4" ry="4" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-5 h-5 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

interface CalendarSheetProps {
  unit: UnitPreHandoverData;
  onClose: () => void;
}

export function CalendarSheet({ unit, onClose }: CalendarSheetProps) {
  const formatICSDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const events = [
    {
      title: `Snagging Inspection - ${unit.propertyName}`,
      start: unit.estSnaggingDate || '',
      description: 'Walk through your new home to identify any minor defects before handover.',
      location: unit.propertyName,
    },
    {
      title: `Handover - ${unit.propertyName}`,
      start: unit.estHandoverDate || '',
      description: 'Collect your keys and complete the handover of your new home.',
      location: unit.propertyName,
    },
  ].filter(e => e.start);

  const addToGoogle = () => {
    events.forEach((event) => {
      const startDate = new Date(event.start);
      const endDate = new Date(startDate);
      endDate.setHours(startDate.getHours() + 2);

      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        event.title
      )}&dates=${formatICSDate(event.start)}/${formatICSDate(
        endDate.toISOString()
      )}&details=${encodeURIComponent(event.description)}&location=${encodeURIComponent(
        event.location
      )}`;
      window.open(url, '_blank');
    });
    onClose();
  };

  const downloadICS = () => {
    let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//OpenHouse//EN\n';

    events.forEach((event) => {
      const startDate = new Date(event.start);
      const endDate = new Date(startDate);
      endDate.setHours(startDate.getHours() + 2);

      icsContent += `BEGIN:VEVENT
DTSTART:${formatICSDate(event.start)}
DTEND:${formatICSDate(endDate.toISOString())}
SUMMARY:${event.title}
DESCRIPTION:${event.description}
LOCATION:${event.location}
END:VEVENT
`;
    });

    icsContent += 'END:VCALENDAR';

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'openhouse-dates.ics';
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <>
      <SheetHeader title="Add to Calendar" subtitle="Add key dates to your calendar" />
      <div className="px-6 py-5 space-y-3">
        <SheetItem onClick={addToGoogle}>
          <div className="w-12 h-12 rounded-xl bg-white border border-stone-200 flex items-center justify-center">
            <GoogleIcon />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-brand-dark">Google Calendar</p>
          </div>
          <ChevronRightIcon />
        </SheetItem>

        <SheetItem onClick={downloadICS}>
          <div className="w-12 h-12 rounded-xl bg-white border border-stone-200 flex items-center justify-center">
            <AppleIcon />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-brand-dark">Apple Calendar</p>
          </div>
          <ChevronRightIcon />
        </SheetItem>

        <SheetItem onClick={downloadICS}>
          <div className="w-12 h-12 rounded-xl bg-white border border-stone-200 flex items-center justify-center">
            <OutlookIcon />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-brand-dark">Outlook</p>
          </div>
          <ChevronRightIcon />
        </SheetItem>
      </div>
    </>
  );
}
