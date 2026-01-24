export interface Milestone {
  id: string;
  label: string;
  date: string | null; // ISO date string if completed
  completed: boolean;
  current?: boolean;
  estimatedDate?: string; // "28 Jan 2026" format
}

export interface Document {
  id: string;
  name: string;
  type: string; // "PDF", "DOCX"
  size: string; // "2.4 MB"
  url: string;
  iconColor: 'red' | 'blue' | 'emerald' | 'amber' | 'violet';
  category?: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  order: number;
}

export interface Contact {
  phone: string;
  email: string;
  address: string;
  showHouseHours?: string;
}

export interface Property {
  id: string;
  address: string;
  houseType: string; // "Type B"
  bedrooms: number;
  propertyDesignation: string; // "Semi-Detached"
  status: 'on_track' | 'delayed' | 'at_risk';
  estimatedHandover: string;
}

export interface PreHandoverData {
  purchaser: {
    id: string;
    name: string;
    email: string;
  };
  property: Property;
  milestones: Milestone[];
  documents: Document[];
  faqs: FAQ[];
  contact: Contact;
}
