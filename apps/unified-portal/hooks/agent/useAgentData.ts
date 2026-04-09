'use client';
import { useState, useEffect } from 'react';
import { AgentProfile, AgentScheme, AgentBuyer, AgentDocument, AgentViewing } from '@/lib/agent/types';

// Demo data - hardcoded for the demo since we don't have auth wired up for agent role yet
const DEMO_PROFILE: AgentProfile = {
  id: 'demo', user_id: 'demo', name: 'Sarah Collins',
  firm: 'Sherry FitzGerald Cork', title: 'Senior Sales Agent',
  avatar_initials: 'SC', phone: '+353 21 427 0000', created_at: '',
};

const DEMO_SCHEMES: AgentScheme[] = [
  {
    id: 's1', agent_id: 'demo', name: 'The Coppice',
    developer_name: 'Cairn Homes', location: 'Ballincollig, Cork',
    total_units: 48, completion_date: 'Q3 2025', created_at: '',
    stages: { scheme_id: 's1', deposit: 14, contracts_issued: 11, contracts_signed: 9, closed: 7 },
    units: [
      { id: 'u1', scheme_id: 's1', unit_ref: 'A1', unit_type: '3 Bed Semi', sqm: 112, price: 395000, status: 'contracts_out', buyer_name: 'Ryan Family', solicitor_name: "O'Brien & Co", aip_approved: true, contracts_status: 'out', deposit_date: '2025-01-14', contracts_date: '2025-01-22', contracts_signed_date: null, closing_date: null, is_urgent: true, created_at: '' },
      { id: 'u2', scheme_id: 's1', unit_ref: 'A2', unit_type: '3 Bed Semi', sqm: 112, price: 395000, status: 'reserved', buyer_name: 'Walsh, D.', solicitor_name: 'Murphy Sol.', aip_approved: true, contracts_status: 'pending', deposit_date: '2025-01-18', contracts_date: null, contracts_signed_date: null, closing_date: null, is_urgent: false, created_at: '' },
      { id: 'u3', scheme_id: 's1', unit_ref: 'A3', unit_type: '4 Bed Det', sqm: 148, price: 465000, status: 'exchanged', buyer_name: 'McCarthy J & S', solicitor_name: 'Crowley & Co', aip_approved: true, contracts_status: 'signed', deposit_date: '2025-01-10', contracts_date: '2025-01-19', contracts_signed_date: '2025-01-25', closing_date: null, is_urgent: false, created_at: '' },
      { id: 'u4', scheme_id: 's1', unit_ref: 'A4', unit_type: '2 Bed Apt', sqm: 78, price: 285000, status: 'available', buyer_name: null, solicitor_name: null, aip_approved: false, contracts_status: null, deposit_date: null, contracts_date: null, contracts_signed_date: null, closing_date: null, is_urgent: false, created_at: '' },
      { id: 'u5', scheme_id: 's1', unit_ref: 'A5', unit_type: '3 Bed Semi', sqm: 112, price: 410000, status: 'reserved', buyer_name: 'Brennan, M.', solicitor_name: null, aip_approved: false, contracts_status: null, deposit_date: '2025-01-20', contracts_date: null, contracts_signed_date: null, closing_date: null, is_urgent: true, created_at: '' },
      { id: 'u6', scheme_id: 's1', unit_ref: 'B1', unit_type: '2 Bed Apt', sqm: 78, price: 275000, status: 'exchanged', buyer_name: "O'Sullivan, K.", solicitor_name: 'Lynch & Ptrs', aip_approved: true, contracts_status: 'signed', deposit_date: '2025-01-08', contracts_date: '2025-01-16', contracts_signed_date: '2025-01-22', closing_date: null, is_urgent: false, created_at: '' },
      { id: 'u7', scheme_id: 's1', unit_ref: 'B2', unit_type: '3 Bed Semi', sqm: 112, price: 395000, status: 'contracts_out', buyer_name: 'Fitzgerald, C.', solicitor_name: "O'Brien & Co", aip_approved: true, contracts_status: 'out', deposit_date: '2025-01-15', contracts_date: '2025-01-23', contracts_signed_date: null, closing_date: null, is_urgent: false, created_at: '' },
      { id: 'u8', scheme_id: 's1', unit_ref: 'B3', unit_type: '3 Bed Semi', sqm: 112, price: 400000, status: 'available', buyer_name: null, solicitor_name: null, aip_approved: false, contracts_status: null, deposit_date: null, contracts_date: null, contracts_signed_date: null, closing_date: null, is_urgent: false, created_at: '' },
    ],
  },
  {
    id: 's2', agent_id: 'demo', name: 'Harbour View',
    developer_name: 'Evara Homes', location: 'Blackrock, Cork',
    total_units: 24, completion_date: 'Q1 2025', created_at: '',
    stages: { scheme_id: 's2', deposit: 8, contracts_issued: 7, contracts_signed: 6, closed: 5 },
    units: [
      { id: 'u9', scheme_id: 's2', unit_ref: 'H1', unit_type: '3 Bed Semi', sqm: 118, price: 420000, status: 'exchanged', buyer_name: 'Collins, P.', solicitor_name: 'Walsh & Co', aip_approved: true, contracts_status: 'signed', deposit_date: '2025-01-05', contracts_date: '2025-01-14', contracts_signed_date: '2025-01-20', closing_date: null, is_urgent: false, created_at: '' },
      { id: 'u10', scheme_id: 's2', unit_ref: 'H2', unit_type: '4 Bed Det', sqm: 155, price: 510000, status: 'contracts_out', buyer_name: 'Murphy, T.', solicitor_name: "O'Leary Sol.", aip_approved: true, contracts_status: 'out', deposit_date: '2025-01-12', contracts_date: '2025-01-20', contracts_signed_date: null, closing_date: null, is_urgent: true, created_at: '' },
      { id: 'u11', scheme_id: 's2', unit_ref: 'H3', unit_type: '2 Bed Apt', sqm: 82, price: 310000, status: 'available', buyer_name: null, solicitor_name: null, aip_approved: false, contracts_status: null, deposit_date: null, contracts_date: null, contracts_signed_date: null, closing_date: null, is_urgent: false, created_at: '' },
      { id: 'u12', scheme_id: 's2', unit_ref: 'H4', unit_type: '3 Bed Semi', sqm: 118, price: 430000, status: 'reserved', buyer_name: 'Healy, S.', solicitor_name: null, aip_approved: true, contracts_status: null, deposit_date: '2025-01-19', contracts_date: null, contracts_signed_date: null, closing_date: null, is_urgent: false, created_at: '' },
    ],
  },
];

const DEMO_BUYERS: AgentBuyer[] = [
  { id: 'b1', agent_id: 'demo', initials: 'CR', name: 'Conor Ryan', unit_ref: 'Coppice A1', scheme_name: 'The Coppice', developer: 'Cairn Homes', source: 'Daft.ie', ai_score: 92, aip_approved: true, status: 'contracts_out', last_contact: '2 days ago', notes: "Solicitor 3 days late. Chase O'Brien & Co directly.", phone: '+353 87 123 4567', email: 'c.ryan@gmail.com', budget: '€420,000', timeline: 'Q2 2025', deposit_date: '2025-01-14', contracts_date: '2025-01-22', contracts_signed_date: null, closing_date: null, is_urgent: true, created_at: '' },
  { id: 'b2', agent_id: 'demo', initials: 'DW', name: 'Deirdre Walsh', unit_ref: 'Coppice A2', scheme_name: 'The Coppice', developer: 'Cairn Homes', source: 'MyHome', ai_score: 78, aip_approved: true, status: 'reserved', last_contact: '3 days ago', notes: 'Happy with A2. Awaiting solicitor appointment.', phone: '+353 86 234 5678', email: 'd.walsh@gmail.com', budget: '€380,000', timeline: 'Q3 2025', deposit_date: '2025-01-18', contracts_date: null, contracts_signed_date: null, closing_date: null, is_urgent: false, created_at: '' },
  { id: 'b3', agent_id: 'demo', initials: 'JM', name: 'James McCarthy', unit_ref: 'Coppice A3', scheme_name: 'The Coppice', developer: 'Cairn Homes', source: 'Referral', ai_score: 95, aip_approved: true, status: 'exchanged', last_contact: '1 week ago', notes: 'Contracts signed. On track Q2.', phone: '+353 85 345 6789', email: 'j.mccarthy@gmail.com', budget: '€500,000', timeline: 'Q2 2025', deposit_date: '2025-01-10', contracts_date: '2025-01-19', contracts_signed_date: '2025-01-25', closing_date: '2025-04-15', is_urgent: false, created_at: '' },
  { id: 'b4', agent_id: 'demo', initials: 'RD', name: 'R & K Donovan', unit_ref: '14 Fernwood', scheme_name: 'Standalone', developer: null, source: 'Daft.ie', ai_score: 88, aip_approved: true, status: 'contracts_out', last_contact: '1 day ago', notes: 'Strong buyers. Solicitor slow. Follow up urgently.', phone: '+353 87 456 7890', email: 'r.donovan@gmail.com', budget: '€560,000', timeline: 'ASAP', deposit_date: '2025-01-16', contracts_date: '2025-01-23', contracts_signed_date: null, closing_date: null, is_urgent: true, created_at: '' },
  { id: 'b5', agent_id: 'demo', initials: 'MB', name: 'Mark Brennan', unit_ref: 'Coppice A5', scheme_name: 'The Coppice', developer: 'Cairn Homes', source: 'Walk-in', ai_score: 61, aip_approved: false, status: 'reserved', last_contact: '4 days ago', notes: 'Needs AIP. Referred to AIB broker.', phone: '+353 86 567 8901', email: 'm.brennan@gmail.com', budget: '€420,000', timeline: 'Flexible', deposit_date: '2025-01-20', contracts_date: null, contracts_signed_date: null, closing_date: null, is_urgent: true, created_at: '' },
  { id: 'b6', agent_id: 'demo', initials: 'SD', name: 'Sarah Doyle', unit_ref: 'Unassigned', scheme_name: null, developer: null, source: 'Daft.ie', ai_score: 44, aip_approved: false, status: 'enquiry', last_contact: '1 week ago', notes: '2 beds under €300k. No viewing yet.', phone: '+353 85 678 9012', email: 's.doyle@gmail.com', budget: '€300,000', timeline: '6 months', deposit_date: null, contracts_date: null, contracts_signed_date: null, closing_date: null, is_urgent: false, created_at: '' },
];

const DEMO_VIEWINGS: AgentViewing[] = [
  { id: 'v1', agent_id: 'demo', viewing_time: '10:00', buyer_name: 'Sarah Doyle', unit_ref: 'Coppice — A4', scheme_name: 'The Coppice', status: 'confirmed', viewing_date: 'Today', created_at: '' },
  { id: 'v2', agent_id: 'demo', viewing_time: '11:30', buyer_name: 'New Enquiry', unit_ref: '7 Orchard Close', scheme_name: null, status: 'confirmed', viewing_date: 'Today', created_at: '' },
  { id: 'v3', agent_id: 'demo', viewing_time: '14:00', buyer_name: 'Deirdre Walsh', unit_ref: 'Coppice Showhouse', scheme_name: 'The Coppice', status: 'confirmed', viewing_date: 'Tomorrow', created_at: '' },
  { id: 'v4', agent_id: 'demo', viewing_time: '15:30', buyer_name: 'Mark Brennan', unit_ref: 'Coppice — A5', scheme_name: 'The Coppice', status: 'pending', viewing_date: 'Tomorrow', created_at: '' },
];

const DEMO_DOCUMENTS: AgentDocument[] = [
  { id: 'd1', agent_id: 'demo', name: 'The Coppice — Brochure', scheme_name: 'The Coppice', file_url: null, views: 23, uploaded_at: '2025-01-12' },
  { id: 'd2', agent_id: 'demo', name: 'A1 Booking Form — Ryan Family', scheme_name: 'The Coppice', file_url: null, views: 2, uploaded_at: '2025-01-14' },
  { id: 'd3', agent_id: 'demo', name: '14 Fernwood — Sale Particulars', scheme_name: 'Standalone', file_url: null, views: 8, uploaded_at: '2025-01-18' },
  { id: 'd4', agent_id: 'demo', name: 'Harbour View — Price List', scheme_name: 'Harbour View', file_url: null, views: 14, uploaded_at: '2025-01-08' },
  { id: 'd5', agent_id: 'demo', name: 'BER Certificate — Unit A3', scheme_name: 'The Coppice', file_url: null, views: 0, uploaded_at: '2025-01-10' },
];

export function useAgentData() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  return {
    loading,
    profile: DEMO_PROFILE,
    schemes: DEMO_SCHEMES,
    buyers: DEMO_BUYERS,
    viewings: DEMO_VIEWINGS,
    documents: DEMO_DOCUMENTS,
  };
}
