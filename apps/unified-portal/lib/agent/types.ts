export interface AgentProfile {
  id: string;
  user_id: string;
  name: string;
  firm: string | null;
  title: string | null;
  avatar_initials: string | null;
  phone: string | null;
  created_at: string;
}

export interface AgentScheme {
  id: string;
  agent_id: string;
  name: string;
  developer_name: string | null;
  location: string | null;
  total_units: number;
  completion_date: string | null;
  created_at: string;
  stages?: AgentSchemeStages;
  units?: AgentUnit[];
}

export interface AgentSchemeStages {
  scheme_id: string;
  deposit: number;
  contracts_issued: number;
  contracts_signed: number;
  closed: number;
}

export interface AgentUnit {
  id: string;
  scheme_id: string;
  unit_ref: string;
  unit_type: string | null;
  sqm: number | null;
  price: number | null;
  status: string;
  buyer_name: string | null;
  solicitor_name: string | null;
  aip_approved: boolean;
  contracts_status: string | null;
  deposit_date: string | null;
  contracts_date: string | null;
  contracts_signed_date: string | null;
  closing_date: string | null;
  is_urgent: boolean;
  created_at: string;
}

export interface AgentBuyer {
  id: string;
  agent_id: string;
  initials: string | null;
  name: string;
  unit_ref: string | null;
  scheme_name: string | null;
  developer: string | null;
  source: string | null;
  ai_score: number;
  aip_approved: boolean;
  status: string;
  last_contact: string | null;
  notes: string | null;
  phone: string | null;
  email: string | null;
  budget: string | null;
  timeline: string | null;
  deposit_date: string | null;
  contracts_date: string | null;
  contracts_signed_date: string | null;
  closing_date: string | null;
  is_urgent: boolean;
  created_at: string;
}

export interface AgentDocument {
  id: string;
  agent_id: string;
  name: string;
  scheme_name: string | null;
  file_url: string | null;
  views: number;
  uploaded_at: string;
}

export interface AgentViewing {
  id: string;
  agent_id: string;
  viewing_time: string | null;
  buyer_name: string | null;
  unit_ref: string | null;
  scheme_name: string | null;
  status: string;
  viewing_date: string | null;
  created_at: string;
}

export interface Step {
  type: 'email' | 'status' | 'reminder' | 'report';
  action: string;
  to?: string;
  subject?: string;
  body?: string;
  detail?: string;
}

export interface HistoryItem {
  input: string;
  steps: Step[];
}
