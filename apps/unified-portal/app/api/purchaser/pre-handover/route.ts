import { NextResponse } from 'next/server';
import type { PreHandoverData } from '@/lib/pre-handover/types';

export const dynamic = 'force-dynamic';

// Demo data for the pre-handover portal
const demoData: PreHandoverData = {
  purchaser: {
    id: 'demo-purchaser-1',
    name: 'Sarah',
    email: 'sarah@example.com',
  },
  property: {
    id: 'property-1',
    address: '14 Rathard Park',
    houseType: 'Type B',
    bedrooms: 3,
    propertyDesignation: 'Semi-Detached',
    status: 'on_track',
    estimatedHandover: 'March 2026',
  },
  milestones: [
    { id: '1', label: 'Sale Agreed', date: '2025-10-15', completed: true },
    { id: '2', label: 'Contracts Signed', date: '2025-11-02', completed: true },
    { id: '3', label: 'Kitchen Selection', date: '2025-12-10', completed: true },
    { id: '4', label: 'Snagging', date: null, completed: false, current: true, estimatedDate: '28 Jan 2026' },
    { id: '5', label: 'Closing', date: null, completed: false, estimatedDate: '15 Feb 2026' },
    { id: '6', label: 'Handover', date: null, completed: false, estimatedDate: 'March 2026' },
  ],
  documents: [
    { id: '1', name: 'Floor Plans - Type B', type: 'PDF', size: '2.4 MB', url: '#', iconColor: 'red' },
    { id: '2', name: 'Contract of Sale', type: 'PDF', size: '1.8 MB', url: '#', iconColor: 'blue' },
    { id: '3', name: 'Kitchen Selections', type: 'PDF', size: '856 KB', url: '#', iconColor: 'emerald' },
    { id: '4', name: 'BER Certificate', type: 'PDF', size: '324 KB', url: '#', iconColor: 'amber' },
    { id: '5', name: 'Site Map', type: 'PDF', size: '1.2 MB', url: '#', iconColor: 'violet' },
  ],
  faqs: [
    {
      id: '1',
      question: 'When will I get my keys?',
      answer:
        "Keys are handed over on closing day, after your solicitor confirms funds have transferred. We'll contact you to arrange a convenient time.",
      order: 1,
    },
    {
      id: '2',
      question: 'What happens at snagging?',
      answer:
        "You'll walk through your home with our site manager to identify any minor defects. These will be documented and resolved before handover.",
      order: 2,
    },
    {
      id: '3',
      question: 'How do I set up electricity?',
      answer:
        'Contact your chosen supplier before closing with the MPRN from your documents. We recommend setting this up 2 weeks before handover.',
      order: 3,
    },
    {
      id: '4',
      question: 'Can I visit the property?',
      answer:
        'Yes! We offer scheduled viewings during construction. Contact our sales team to arrange a visit.',
      order: 4,
    },
    {
      id: '5',
      question: 'What warranties are included?',
      answer:
        "Your home comes with a 10-year structural warranty (HomeBond) and a 2-year builder's warranty covering defects.",
      order: 5,
    },
  ],
  contact: {
    phone: '+353 21 456 7890',
    email: 'sales@rathardpark.ie',
    address: 'Rathard Park, Bishopstown, Cork',
  },
};

export async function GET() {
  try {
    // In production, you would:
    // 1. Get the session/auth
    // 2. Fetch the purchaser's actual data from the database
    // For now, return demo data
    return NextResponse.json(demoData);
  } catch (error) {
    console.error('Pre-handover API error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
