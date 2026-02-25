// ============================================
// OpenHouse Developer App — Design Tokens & Constants
// ============================================

export const COLORS = {
  gold: "#D4AF37",
  goldLight: "rgba(212,175,55,0.07)",
  bg: "#ffffff",
  surface1: "#f9fafb",
  surface2: "#f3f4f6",
  surface3: "#e5e7eb",
  text1: "#111827",
  text2: "#6b7280",
  text3: "#9ca3af",
  border: "#e5e7eb",
  borderLight: "#f3f4f6",
  red: "#dc2626",
  redBg: "rgba(220,38,38,0.05)",
  amber: "#d97706",
  amberBg: "rgba(217,119,6,0.05)",
  green: "#059669",
  greenBg: "rgba(5,150,105,0.05)",
  blue: "#2563eb",
  blueBg: "rgba(37,99,235,0.05)",
} as const;

export const TYPOGRAPHY = {
  h1: { fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em" },
  h2: { fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" },
  h3: { fontSize: 15, fontWeight: 700 },
  body: { fontSize: 14, fontWeight: 450 },
  bodyStrong: { fontSize: 14, fontWeight: 600 },
  caption: { fontSize: 12, fontWeight: 500 },
  tiny: { fontSize: 11, fontWeight: 500 },
} as const;

export const CARD_STYLE = {
  background: "#ffffff",
  borderRadius: 16,
  border: "1px solid #f3f4f6",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
  padding: 16,
} as const;

export const CARD_ELEVATED = {
  ...CARD_STYLE,
  boxShadow: "0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
} as const;

export const EASING = {
  premium: "cubic-bezier(0.16, 1, 0.3, 1)",
  spring: "cubic-bezier(0.2, 0.8, 0.2, 1)",
} as const;

// Multi-sector terminology
export const SECTOR_TERMINOLOGY = {
  bts: {
    label: "Build to Sell",
    short: "BTS",
    color: "#2563eb",
    occupant: "Purchaser",
    occupants: "Purchasers",
    pipeline: "Pipeline",
    stages: [
      "Booking Deposit",
      "Contracts Signed",
      "Mortgage Approval",
      "Loan Approved",
      "Snagging",
      "Handover",
    ],
    sections: [
      "Pipeline",
      "Archive",
      "Compliance",
      "Snagging",
      "Selections",
      "Homeowners",
    ],
  },
  btr: {
    label: "Build to Rent",
    short: "BTR",
    color: "#7c3aed",
    occupant: "Tenant",
    occupants: "Tenants",
    pipeline: "Leasing",
    stages: [
      "Enquiry",
      "Viewing",
      "Application",
      "Approved",
      "Lease Signed",
      "Occupancy",
    ],
    sections: [
      "Leasing",
      "Archive",
      "Compliance",
      "Maintenance",
      "Fit-out",
      "Tenants",
    ],
  },
  pbsa: {
    label: "Student Accommodation",
    short: "PBSA",
    color: "#059669",
    occupant: "Student",
    occupants: "Students",
    pipeline: "Bookings",
    stages: [
      "Enquiry",
      "Offer",
      "Deposit Paid",
      "Accepted",
      "Room Allocated",
      "Check-in",
    ],
    sections: [
      "Bookings",
      "Archive",
      "Compliance",
      "Maintenance",
      "Room Setup",
      "Students",
    ],
  },
} as const;

export type Sector = keyof typeof SECTOR_TERMINOLOGY;

export const ATTENTION_RULES = [
  {
    type: "mortgage_expiring" as const,
    severity: "red" as const,
    template: "{count} mortgage approvals expiring within 7 days",
  },
  {
    type: "selection_deadline" as const,
    severity: "amber" as const,
    template: "Purchaser hasn't selected kitchen — deadline in {days} days",
  },
  {
    type: "compliance_overdue" as const,
    severity: "amber" as const,
    template: "BCMS submission overdue for {count} units",
  },
  {
    type: "unanswered_question" as const,
    severity: "blue" as const,
    template: "{count} new purchaser questions awaiting response",
  },
  {
    type: "stuck_pipeline" as const,
    severity: "red" as const,
    template: "{count} units stuck in pipeline for over 30 days",
  },
] as const;

export const TABS = [
  { id: "overview", label: "Overview", icon: "LayoutDashboard" },
  { id: "developments", label: "Devs", icon: "Building2" },
  { id: "intelligence", label: "Intel", icon: "Sparkles" },
  { id: "activity", label: "Activity", icon: "Activity" },
] as const;
