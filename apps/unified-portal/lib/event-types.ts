export interface EventTypeConfig {
  label: string;
  description: string;
  category: 'access' | 'documents' | 'chat' | 'engagement' | 'system' | 'error';
  countsTowardDocumentsServed: boolean;
  icon?: string;
  color?: string;
}

export const EVENT_TYPE_MAP: Record<string, EventTypeConfig> = {
  // Access Events
  qr_scan: {
    label: 'QR Scan',
    description: 'User scanned a unit QR code',
    category: 'access',
    countsTowardDocumentsServed: false,
    color: 'blue',
  },
  portal_view: {
    label: 'Portal View',
    description: 'User viewed the homeowner portal',
    category: 'access',
    countsTowardDocumentsServed: false,
    color: 'blue',
  },
  purchaser_signup: {
    label: 'Signup',
    description: 'New user registration',
    category: 'access',
    countsTowardDocumentsServed: false,
    color: 'green',
  },
  purchaser_activate: {
    label: 'Activation',
    description: 'User activated their account',
    category: 'access',
    countsTowardDocumentsServed: false,
    color: 'green',
  },
  session_start: {
    label: 'Session Start',
    description: 'User started a new session',
    category: 'access',
    countsTowardDocumentsServed: false,
    color: 'gray',
  },
  
  // Document Events
  document_view: {
    label: 'Document View',
    description: 'User viewed a document in the portal',
    category: 'documents',
    countsTowardDocumentsServed: true,
    color: 'purple',
  },
  document_download: {
    label: 'Document Download',
    description: 'User downloaded a document',
    category: 'documents',
    countsTowardDocumentsServed: true,
    color: 'purple',
  },
  document_open: {
    label: 'Document Open',
    description: 'User opened a document from list',
    category: 'documents',
    countsTowardDocumentsServed: true,
    color: 'purple',
  },
  drawing_view: {
    label: 'Drawing View',
    description: 'User viewed architectural drawings',
    category: 'documents',
    countsTowardDocumentsServed: true,
    color: 'indigo',
  },
  drawing_download: {
    label: 'Drawing Download',
    description: 'User downloaded architectural drawings',
    category: 'documents',
    countsTowardDocumentsServed: true,
    color: 'indigo',
  },
  chat_document_served: {
    label: 'Chat Document Served',
    description: 'AI served a document link in chat',
    category: 'documents',
    countsTowardDocumentsServed: true,
    color: 'amber',
  },
  elevation_view: {
    label: 'Elevation View',
    description: 'User viewed elevation drawings',
    category: 'documents',
    countsTowardDocumentsServed: true,
    color: 'indigo',
  },
  
  // Chat Events
  chat_question: {
    label: 'Question Asked',
    description: 'User asked a question to the AI',
    category: 'chat',
    countsTowardDocumentsServed: false,
    color: 'gold',
  },
  chat_message: {
    label: 'Chat Message',
    description: 'Message exchanged in chat',
    category: 'chat',
    countsTowardDocumentsServed: false,
    color: 'gold',
  },
  chat_response: {
    label: 'AI Response',
    description: 'AI provided a response',
    category: 'chat',
    countsTowardDocumentsServed: false,
    color: 'gold',
  },
  chat_fallback: {
    label: 'Fallback Response',
    description: 'AI could not answer confidently',
    category: 'chat',
    countsTowardDocumentsServed: false,
    color: 'orange',
  },
  
  // Engagement Events
  important_docs_agreed: {
    label: 'Docs Acknowledged',
    description: 'User acknowledged important documents',
    category: 'engagement',
    countsTowardDocumentsServed: false,
    color: 'emerald',
  },
  noticeboard_view: {
    label: 'Noticeboard View',
    description: 'User viewed noticeboard',
    category: 'engagement',
    countsTowardDocumentsServed: false,
    color: 'teal',
  },
  
  // System Events
  api_call: {
    label: 'API Call',
    description: 'Internal API request',
    category: 'system',
    countsTowardDocumentsServed: false,
    color: 'gray',
  },
  
  // Error Events
  api_error: {
    label: 'API Error',
    description: 'An API request failed',
    category: 'error',
    countsTowardDocumentsServed: false,
    color: 'red',
  },
  pipeline_error: {
    label: 'Pipeline Error',
    description: 'Analytics pipeline error',
    category: 'error',
    countsTowardDocumentsServed: false,
    color: 'red',
  },
};

export const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  access: { label: 'Access', color: 'blue' },
  documents: { label: 'Documents', color: 'purple' },
  chat: { label: 'Chat', color: 'gold' },
  engagement: { label: 'Engagement', color: 'emerald' },
  system: { label: 'System', color: 'gray' },
  error: { label: 'Errors', color: 'red' },
};

export function getEventTypeConfig(eventType: string): EventTypeConfig {
  return EVENT_TYPE_MAP[eventType] || {
    label: formatEventTypeLabel(eventType),
    description: `Event: ${eventType}`,
    category: 'system',
    countsTowardDocumentsServed: false,
    color: 'gray',
  };
}

export function formatEventTypeLabel(eventType: string): string {
  return eventType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getDocumentServedEventTypes(): string[] {
  return Object.entries(EVENT_TYPE_MAP)
    .filter(([_, config]) => config.countsTowardDocumentsServed)
    .map(([type, _]) => type);
}

export function categorizeEvents(events: { eventType: string; count: number }[]): Record<string, number> {
  const categories: Record<string, number> = {};
  
  for (const { eventType, count } of events) {
    const config = getEventTypeConfig(eventType);
    categories[config.category] = (categories[config.category] || 0) + count;
  }
  
  return categories;
}

export function getEventBadgeClasses(eventType: string): string {
  const config = getEventTypeConfig(eventType);
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-800',
    purple: 'bg-purple-100 text-purple-800',
    indigo: 'bg-indigo-100 text-indigo-800',
    gold: 'bg-yellow-100 text-yellow-800',
    amber: 'bg-amber-100 text-amber-800',
    orange: 'bg-orange-100 text-orange-800',
    green: 'bg-green-100 text-green-800',
    emerald: 'bg-emerald-100 text-emerald-800',
    teal: 'bg-teal-100 text-teal-800',
    red: 'bg-red-100 text-red-800',
    gray: 'bg-gray-100 text-gray-700',
  };
  return colorMap[config.color || 'gray'] || 'bg-gray-100 text-gray-700';
}
