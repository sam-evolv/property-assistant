// ============================================================
// OpenHouse AI — Developer Mobile App Design System
// Matches approved prototype exactly
// ============================================================

export const GOLD = "#D4AF37";
export const GOLD_LIGHT = "rgba(212,175,55,0.07)";
export const BG = "#ffffff";
export const SURFACE_1 = "#f9fafb";
export const SURFACE_2 = "#f3f4f6";
export const SURFACE_3 = "#e5e7eb";
export const TEXT_1 = "#111827";
export const TEXT_2 = "#6b7280";
export const TEXT_3 = "#9ca3af";
export const BORDER = "#e5e7eb";
export const BORDER_LIGHT = "#f3f4f6";
export const RED = "#dc2626";
export const RED_BG = "rgba(220,38,38,0.05)";
export const AMBER = "#d97706";
export const AMBER_BG = "rgba(217,119,6,0.05)";
export const GREEN = "#059669";
export const GREEN_BG = "rgba(5,150,105,0.05)";
export const BLUE = "#2563eb";
export const BLUE_BG = "rgba(37,99,235,0.05)";

export const EASE_PREMIUM = "cubic-bezier(0.16, 1, 0.3, 1)";

export type Sector = "bts" | "btr" | "pbsa";

export interface SectorSection {
  id: string;
  name: string;
  metric: string;
  metricColor: string;
}

export interface SectorUnit {
  unit: string;
  name: string;
  stage: string;
  stageColor: string;
  stageBg: string;
  days: number;
  status: "green" | "amber" | "red";
  phone: string;
  email: string;
  solicitor: string;
  agent: string;
  deposit: string;
  price: string;
  moveIn: string;
}

export interface SectorConfig {
  label: string;
  short: string;
  occupant: string;
  occupants: string;
  pipeline: string;
  stages: string[];
  sections: SectorSection[];
  units: SectorUnit[];
  attentionItems: { color: string; text: string; dev: string; action: string }[];
  stats: { label: string; value: number; prefix: string; suffix: string; sub: string; color: string }[];
}

export const SECTORS: Record<Sector, SectorConfig> = {
  bts: {
    label: "Build to Sell", short: "BTS", occupant: "Purchaser", occupants: "Purchasers",
    pipeline: "Pipeline", stages: ["All", "Booking", "Contracts", "Loan", "Snag", "Handover"],
    sections: [
      { id: "pipeline", name: "Pipeline", metric: "3 need action", metricColor: AMBER },
      { id: "archive", name: "Archive", metric: "247 docs", metricColor: TEXT_3 },
      { id: "compliance", name: "Compliance", metric: "89%", metricColor: GREEN },
      { id: "snagging", name: "Snagging", metric: "4 open", metricColor: AMBER },
      { id: "selections", name: "Selections", metric: "6 pending", metricColor: AMBER },
      { id: "homeowners", name: "Homeowners", metric: "34 active", metricColor: GREEN },
    ],
    units: [
      { unit: "Unit 7", name: "J. Smith", stage: "Contracts Signed", stageColor: GREEN, stageBg: GREEN_BG, days: 3, status: "green", phone: "+353 87 123 4567", email: "jsmith@gmail.com", solicitor: "O'Brien & Partners", agent: "Savills Cork", deposit: "€5,000", price: "€385,000", moveIn: "15 Apr 2026" },
      { unit: "Unit 14", name: "M. Murphy", stage: "Loan Approved", stageColor: BLUE, stageBg: BLUE_BG, days: 12, status: "green", phone: "+353 86 234 5678", email: "mmurphy@outlook.com", solicitor: "Ronan Daly Jermyn", agent: "Sherry FitzGerald", deposit: "€5,000", price: "€410,000", moveIn: "22 May 2026" },
      { unit: "Unit 18", name: "S. O'Connor", stage: "Mortgage Approval", stageColor: AMBER, stageBg: AMBER_BG, days: 28, status: "amber", phone: "+353 85 345 6789", email: "soconnor@gmail.com", solicitor: "Matheson", agent: "Savills Cork", deposit: "€5,000", price: "€395,000", moveIn: "TBC" },
      { unit: "Unit 22", name: "P. Kelly", stage: "Mortgage Approval", stageColor: RED, stageBg: RED_BG, days: 45, status: "red", phone: "+353 87 456 7890", email: "pkelly@live.com", solicitor: "A&L Goodbody", agent: "DNG", deposit: "€5,000", price: "€375,000", moveIn: "TBC" },
      { unit: "Unit 26", name: "D. Walsh", stage: "Booking Deposit", stageColor: GOLD, stageBg: GOLD_LIGHT, days: 5, status: "green", phone: "+353 86 567 8901", email: "dwalsh@gmail.com", solicitor: "BCM Hanby Wallace", agent: "Savills Cork", deposit: "€5,000", price: "€420,000", moveIn: "TBC" },
    ],
    attentionItems: [
      { color: RED, text: "3 mortgage approvals expiring within 7 days", dev: "Willow Brook — Units 14, 18, 22", action: "View" },
      { color: AMBER, text: "Purchaser hasn't selected kitchen — deadline in 4 days", dev: "Riverside Gardens — Unit 7", action: "Remind" },
      { color: AMBER, text: "BCMS submission overdue for 4 units", dev: "Willow Brook — Units 22-26", action: "View" },
      { color: BLUE, text: "2 new purchaser questions awaiting response", dev: "Across all developments", action: "Respond" },
    ],
    stats: [
      { label: "Pipeline Value", value: 14.2, prefix: "€", suffix: "M", sub: "↑ 3.2% this month", color: GOLD },
      { label: "Units Sold", value: 60, prefix: "", suffix: "", sub: "of 87 total", color: GREEN },
      { label: "Compliance", value: 89, prefix: "", suffix: "%", sub: "4 items overdue", color: AMBER },
      { label: "Handover Ready", value: 12, prefix: "", suffix: "", sub: "units fully cleared", color: GREEN },
    ],
  },
  btr: {
    label: "Build to Rent", short: "BTR", occupant: "Tenant", occupants: "Tenants",
    pipeline: "Leasing", stages: ["All", "Enquiry", "Viewing", "Applied", "Approved", "Moved In"],
    sections: [
      { id: "pipeline", name: "Leasing", metric: "8 enquiries", metricColor: AMBER },
      { id: "archive", name: "Archive", metric: "189 docs", metricColor: TEXT_3 },
      { id: "compliance", name: "Compliance", metric: "94%", metricColor: GREEN },
      { id: "snagging", name: "Maintenance", metric: "12 open", metricColor: AMBER },
      { id: "selections", name: "Fit-Out", metric: "All complete", metricColor: GREEN },
      { id: "homeowners", name: "Tenants", metric: "86 occupied", metricColor: GREEN },
    ],
    units: [
      { unit: "Apt 101", name: "C. Doyle", stage: "Lease Signed", stageColor: GREEN, stageBg: GREEN_BG, days: 2, status: "green", phone: "+353 87 111 2222", email: "cdoyle@gmail.com", solicitor: "—", agent: "CBRE", deposit: "€2,400", price: "€2,400/mo", moveIn: "1 Mar 2026" },
      { unit: "Apt 204", name: "L. Byrne", stage: "Application", stageColor: AMBER, stageBg: AMBER_BG, days: 5, status: "amber", phone: "+353 85 333 4444", email: "lbyrne@outlook.com", solicitor: "—", agent: "Hooke & MacDonald", deposit: "€2,200", price: "€2,200/mo", moveIn: "TBC" },
      { unit: "Apt 312", name: "T. Nolan", stage: "Viewing Booked", stageColor: BLUE, stageBg: BLUE_BG, days: 1, status: "green", phone: "+353 86 555 6666", email: "tnolan@gmail.com", solicitor: "—", agent: "Direct", deposit: "—", price: "€1,950/mo", moveIn: "TBC" },
    ],
    attentionItems: [
      { color: RED, text: "3 lease renewals due within 30 days", dev: "The Elms — Apts 101, 118, 205", action: "View" },
      { color: AMBER, text: "Maintenance request unresolved — 5 days", dev: "The Elms — Apt 312", action: "Assign" },
      { color: AMBER, text: "2 void units exceeding 21-day target", dev: "The Elms — Apts 415, 422", action: "View" },
    ],
    stats: [
      { label: "Occupancy", value: 94, prefix: "", suffix: "%", sub: "86 of 92 units", color: GREEN },
      { label: "Monthly Revenue", value: 198, prefix: "€", suffix: "K", sub: "↑ 2.1% vs last month", color: GOLD },
      { label: "Compliance", value: 94, prefix: "", suffix: "%", sub: "2 items pending", color: GREEN },
      { label: "Avg Void Period", value: 14, prefix: "", suffix: "d", sub: "target: 21 days", color: GREEN },
    ],
  },
  pbsa: {
    label: "Student", short: "PBSA", occupant: "Student", occupants: "Students",
    pipeline: "Bookings", stages: ["All", "Enquiry", "Applied", "Offer", "Accepted", "Checked In"],
    sections: [
      { id: "pipeline", name: "Bookings", metric: "24 pending", metricColor: AMBER },
      { id: "archive", name: "Archive", metric: "156 docs", metricColor: TEXT_3 },
      { id: "compliance", name: "Compliance", metric: "97%", metricColor: GREEN },
      { id: "snagging", name: "Maintenance", metric: "8 open", metricColor: AMBER },
      { id: "selections", name: "Room Config", metric: "All set", metricColor: GREEN },
      { id: "homeowners", name: "Students", metric: "340 residents", metricColor: GREEN },
    ],
    units: [
      { unit: "Room 4A-12", name: "E. Chen", stage: "Checked In", stageColor: GREEN, stageBg: GREEN_BG, days: 120, status: "green", phone: "+353 83 111 2222", email: "echen@ucc.ie", solicitor: "—", agent: "Direct", deposit: "€500", price: "€220/wk", moveIn: "2 Sep 2025" },
      { unit: "Room 2B-08", name: "A. Patel", stage: "Accepted", stageColor: GREEN, stageBg: GREEN_BG, days: 10, status: "green", phone: "+353 89 333 4444", email: "apatel@ucc.ie", solicitor: "—", agent: "University", deposit: "€500", price: "€195/wk", moveIn: "1 Sep 2026" },
    ],
    attentionItems: [
      { color: RED, text: "Check-out inspections due — 18 rooms", dev: "Student Village — Block 4A", action: "Schedule" },
      { color: AMBER, text: "24 booking offers awaiting acceptance", dev: "Across all blocks", action: "Chase" },
      { color: AMBER, text: "Maintenance backlog — 3 items > 48hrs", dev: "Block 2B", action: "Assign" },
    ],
    stats: [
      { label: "Occupancy", value: 98, prefix: "", suffix: "%", sub: "340 of 348 rooms", color: GREEN },
      { label: "Bookings 26/27", value: 72, prefix: "", suffix: "%", sub: "252 confirmed", color: AMBER },
      { label: "Compliance", value: 97, prefix: "", suffix: "%", sub: "1 item pending", color: GREEN },
      { label: "Maintenance SLA", value: 91, prefix: "", suffix: "%", sub: "within 48hrs", color: GREEN },
    ],
  },
};

export interface DevSummary {
  name: string;
  loc: string;
  units: number;
  pct: number;
  sold: number;
  active: number;
  handed: number;
}

export const DEV_DATA: Record<Sector, DevSummary[]> = {
  bts: [
    { name: "Willow Brook", loc: "Rathard Park, Cork", units: 45, pct: 62, sold: 28, active: 12, handed: 5 },
    { name: "Riverside Gardens", loc: "Árdan View, Cork", units: 32, pct: 45, sold: 18, active: 8, handed: 3 },
    { name: "Meadow View", loc: "Rathard Lawn, Cork", units: 28, pct: 78, sold: 14, active: 4, handed: 10 },
  ],
  btr: [
    { name: "The Elms", loc: "Blackpool, Cork", units: 92, pct: 94, sold: 86, active: 4, handed: 2 },
    { name: "Harbour Quarter", loc: "Cobh, Cork", units: 64, pct: 88, sold: 56, active: 5, handed: 3 },
  ],
  pbsa: [
    { name: "Student Village", loc: "UCC Campus, Cork", units: 348, pct: 98, sold: 340, active: 6, handed: 2 },
    { name: "Scholar's Gate", loc: "CIT Campus, Cork", units: 180, pct: 92, sold: 166, active: 10, handed: 4 },
  ],
};

export const SEC_ICON_MAP: Record<string, string> = {
  pipeline: "bar",
  archive: "folder",
  compliance: "shield",
  snagging: "wrench",
  selections: "grid",
  homeowners: "users",
};
