export type SystemType = 'solar-pv' | 'heat-pump' | 'hvac' | 'ev-charger';
export type DocType = 'document' | 'video' | 'guide' | 'faq';
export type DocStatus = 'active' | 'pending' | 'expiring' | 'archived';

export interface ArchiveItem {
  id: string;
  name: string;
  description: string;
  type: DocType;
  system: SystemType;
  client: string | null;
  jobRef: string | null;
  status: DocStatus;
  modifiedAt: string;
  modifiedLabel: string;
  modifiedRelative: string;
  flagged?: boolean;
  iconKey?: 'file-text' | 'play' | 'award' | 'shield-check' | 'book-open' | 'alert-triangle';
}

export interface SubmissionFile {
  id: string;
  name: string;
  icon: 'file-text' | 'award' | 'shield' | 'clipboard-list';
  sizeLabel: string;
  metaLabel: string;
  autoClassifiedAs: {
    system: SystemType;
    clientFolder: string;
    jobRef: string;
  };
}

export interface SubmissionFileChip {
  label: string;
  icon: 'file-text' | 'image' | 'clipboard-list' | 'award' | 'shield-check';
}

export interface Submission {
  id: string;
  installerName: string;
  installerContact: string;
  installerInitials: string;
  installerColor: 'a' | 'b' | 'c' | 'd' | 'e';
  verified: boolean;
  trustScore: number;
  jobsFiledCount: number;
  jobTitle: string;
  jobRef: string;
  location: string;
  client: string;
  clientFullName: string;
  completedAt: string;
  completedLabel: string;
  submittedAt: string;
  submittedRelative: string;
  system: SystemType;
  systemDetails: string;
  extraLabel?: string;
  extraDetails?: string;
  notes: string;
  status: 'new' | 'pending' | 'approved' | 'rejected';
  files: SubmissionFile[];
  fileChips: SubmissionFileChip[];
  photoCount: number;
}

export const ARCHIVE_TOTALS = {
  items: 2847,
  installations: 1206,
  documents: 1672,
  videos: 214,
  guides: 92,
  faqs: 869,
  solarPv: 1284,
  heatPump: 842,
  hvac: 491,
  evCharger: 230,
};

export const INBOX_COUNTS = {
  all: 5,
  pending: 5,
  approved: 142,
  filed: 1684,
  rejected: 3,
};

export const SYSTEM_LABELS: Record<SystemType, string> = {
  'solar-pv': 'Solar PV',
  'heat-pump': 'Heat Pump',
  hvac: 'HVAC',
  'ev-charger': 'EV Charger',
};

export const ARCHIVE_ITEMS: ArchiveItem[] = [
  {
    id: 'arc-1',
    name: 'SolarEdge SE3680H Warranty Certificate.pdf',
    description: 'Official 12-year product warranty certificate for SolarEdge inverter',
    type: 'document',
    system: 'solar-pv',
    client: "Margaret O'Brien",
    jobRef: 'JOB-2026-0847',
    status: 'active',
    modifiedAt: '2026-03-01',
    modifiedLabel: '1 Mar 2026',
    modifiedRelative: '2h ago',
    iconKey: 'file-text',
  },
  {
    id: 'arc-2',
    name: 'How to Read Your Energy Meter',
    description: 'Learn how to read your import and export meter readings',
    type: 'video',
    system: 'solar-pv',
    client: null,
    jobRef: null,
    status: 'active',
    modifiedAt: '2026-02-28',
    modifiedLabel: '28 Feb 2026',
    modifiedRelative: 'Yesterday',
    iconKey: 'play',
  },
  {
    id: 'arc-3',
    name: 'SEAI Grant Confirmation',
    description: 'Solar PV grant approval documentation from SEAI',
    type: 'document',
    system: 'heat-pump',
    client: 'Liam McCarthy',
    jobRef: 'JOB-2026-0823',
    status: 'pending',
    modifiedAt: '2026-02-26',
    modifiedLabel: '26 Feb 2026',
    modifiedRelative: '3d ago',
    flagged: true,
    iconKey: 'award',
  },
  {
    id: 'arc-4',
    name: 'Installation Certificate',
    description: 'Your official solar PV installation certificate',
    type: 'document',
    system: 'solar-pv',
    client: "Margaret O'Brien",
    jobRef: 'JOB-2026-0847',
    status: 'active',
    modifiedAt: '2026-02-24',
    modifiedLabel: '24 Feb 2026',
    modifiedRelative: '1w ago',
    iconKey: 'shield-check',
  },
  {
    id: 'arc-5',
    name: 'SolarEdge Inverter Error Codes',
    description: 'Complete reference guide for all SolarEdge inverter error codes',
    type: 'guide',
    system: 'solar-pv',
    client: null,
    jobRef: null,
    status: 'active',
    modifiedAt: '2026-02-20',
    modifiedLabel: '20 Feb 2026',
    modifiedRelative: '2w ago',
    iconKey: 'book-open',
  },
  {
    id: 'arc-6',
    name: 'Mitsubishi Ecodan Warranty, Expiring in 47 days',
    description: 'Manufacturer warranty coverage document',
    type: 'document',
    system: 'heat-pump',
    client: 'Seán Walsh',
    jobRef: 'JOB-2023-0412',
    status: 'expiring',
    modifiedAt: '2026-02-15',
    modifiedLabel: '15 Feb 2026',
    modifiedRelative: '2w ago',
    iconKey: 'alert-triangle',
  },
  {
    id: 'arc-7',
    name: 'Resetting After a Power Cut',
    description: 'Step-by-step video guide for restarting your solar system',
    type: 'video',
    system: 'solar-pv',
    client: null,
    jobRef: null,
    status: 'active',
    modifiedAt: '2026-02-12',
    modifiedLabel: '12 Feb 2026',
    modifiedRelative: '1mo ago',
    iconKey: 'play',
  },
  {
    id: 'arc-8',
    name: 'BER Certificate, A2 Rating',
    description: 'Energy rating assessment post-heat pump installation',
    type: 'document',
    system: 'heat-pump',
    client: 'Fiona Kelly',
    jobRef: 'JOB-2026-0798',
    status: 'active',
    modifiedAt: '2026-02-08',
    modifiedLabel: '8 Feb 2026',
    modifiedRelative: '1mo ago',
    iconKey: 'file-text',
  },
];

export const RECENT_ITEMS: ArchiveItem[] = [
  ARCHIVE_ITEMS[0],
  ARCHIVE_ITEMS[1],
  ARCHIVE_ITEMS[6],
  ARCHIVE_ITEMS[3],
];

export const SUGGESTION_CHIPS: string[] = [
  'Warranties expiring in 60 days',
  'Missing certificates from 2025',
  'All SEAI grant docs',
  'Jobs in Ballincollig',
];

export const SUBMISSIONS: Submission[] = [
  {
    id: 'sub-1',
    installerName: "O'Sullivan Renewables",
    installerContact: "Darragh O'Sullivan, Sub-contractor",
    installerInitials: 'OR',
    installerColor: 'a',
    verified: true,
    trustScore: 98,
    jobsFiledCount: 47,
    jobTitle: 'Solar PV Install, 6.2kW System + Battery',
    jobRef: 'JOB-2026-0891',
    location: 'Ballincollig, Cork',
    client: 'C. Murphy',
    clientFullName: 'Ciarán Murphy',
    completedAt: '2026-04-16',
    completedLabel: '16 Apr 2026',
    submittedAt: '2026-04-16T11:48:00',
    submittedRelative: '12m ago',
    system: 'solar-pv',
    systemDetails: 'SolarEdge SE6000H, 14x 440W',
    extraLabel: 'Battery',
    extraDetails: 'BYD HVS 10.2kWh',
    notes:
      'System commissioned successfully. Customer briefed on monitoring app. Grant paperwork signed on site. Battery firmware updated to latest. Follow-up monitoring check scheduled for 30 days.',
    status: 'new',
    files: [
      {
        id: 'f1',
        name: 'Installation_Certificate_0891.pdf',
        icon: 'file-text',
        sizeLabel: '892 KB',
        metaLabel: '892 KB, Scanned & signed',
        autoClassifiedAs: { system: 'solar-pv', clientFolder: 'C. Murphy', jobRef: 'JOB-2026-0891' },
      },
      {
        id: 'f2',
        name: 'SEAI_Grant_Confirmation_Murphy.pdf',
        icon: 'award',
        sizeLabel: '1.2 MB',
        metaLabel: '1.2 MB, PDF, 3 pages',
        autoClassifiedAs: { system: 'solar-pv', clientFolder: 'C. Murphy', jobRef: 'JOB-2026-0891' },
      },
      {
        id: 'f3',
        name: 'SolarEdge_Warranty_Certificate.pdf',
        icon: 'shield',
        sizeLabel: '2.4 MB',
        metaLabel: '2.4 MB, PDF, 12-year',
        autoClassifiedAs: { system: 'solar-pv', clientFolder: 'C. Murphy', jobRef: 'JOB-2026-0891' },
      },
      {
        id: 'f4',
        name: 'Commissioning_Report_0891.pdf',
        icon: 'clipboard-list',
        sizeLabel: '645 KB',
        metaLabel: '645 KB, PDF, Signed',
        autoClassifiedAs: { system: 'solar-pv', clientFolder: 'C. Murphy', jobRef: 'JOB-2026-0891' },
      },
    ],
    fileChips: [
      { label: '4 PDFs', icon: 'file-text' },
      { label: '12 photos', icon: 'image' },
      { label: 'Commissioning report', icon: 'clipboard-list' },
    ],
    photoCount: 12,
  },
  {
    id: 'sub-2',
    installerName: 'Celtic Energy Solutions',
    installerContact: 'Mark Ryan, Lead installer',
    installerInitials: 'CE',
    installerColor: 'b',
    verified: true,
    trustScore: 94,
    jobsFiledCount: 32,
    jobTitle: 'Heat Pump Install, Daikin Altherma 11kW',
    jobRef: 'JOB-2026-0887',
    location: 'Douglas, Cork',
    client: 'A. Nolan',
    clientFullName: 'Aoife Nolan',
    completedAt: '2026-04-15',
    completedLabel: '15 Apr 2026',
    submittedAt: '2026-04-16T10:00:00',
    submittedRelative: '1h ago',
    system: 'heat-pump',
    systemDetails: 'Daikin Altherma 11kW',
    notes:
      'Heat pump install complete. Hydronic balancing verified. Owner briefed on thermostat schedules and DHW cycle.',
    status: 'new',
    files: [
      {
        id: 'f2-1',
        name: 'Installation_Certificate_0887.pdf',
        icon: 'file-text',
        sizeLabel: '780 KB',
        metaLabel: '780 KB, Scanned & signed',
        autoClassifiedAs: { system: 'heat-pump', clientFolder: 'A. Nolan', jobRef: 'JOB-2026-0887' },
      },
    ],
    fileChips: [
      { label: '6 PDFs', icon: 'file-text' },
      { label: '18 photos', icon: 'image' },
      { label: 'SEAI grant form', icon: 'award' },
      { label: 'BER cert', icon: 'shield-check' },
    ],
    photoCount: 18,
  },
  {
    id: 'sub-3',
    installerName: 'McKenna & Sons Electrical',
    installerContact: 'Patrick McKenna, Owner',
    installerInitials: 'MK',
    installerColor: 'c',
    verified: false,
    trustScore: 88,
    jobsFiledCount: 18,
    jobTitle: 'EV Charger Install, Zappi 7kW',
    jobRef: 'JOB-2026-0884',
    location: 'Blackrock, Cork',
    client: 'F. Kelly',
    clientFullName: 'Fiona Kelly',
    completedAt: '2026-04-15',
    completedLabel: '15 Apr 2026',
    submittedAt: '2026-04-16T08:00:00',
    submittedRelative: '3h ago',
    system: 'ev-charger',
    systemDetails: 'Zappi 7kW tethered',
    notes: 'Zappi installed in driveway. Load balancing with CT clamp on main feed. Eco+ mode enabled by default.',
    status: 'pending',
    files: [],
    fileChips: [
      { label: '2 PDFs', icon: 'file-text' },
      { label: '6 photos', icon: 'image' },
    ],
    photoCount: 6,
  },
  {
    id: 'sub-4',
    installerName: 'Munster Heating Co.',
    installerContact: 'Joanne Barry, Technical',
    installerInitials: 'MH',
    installerColor: 'd',
    verified: false,
    trustScore: 82,
    jobsFiledCount: 11,
    jobTitle: 'HVAC Service Call, Annual Maintenance',
    jobRef: 'JOB-2026-0879',
    location: 'Midleton, Cork',
    client: 'L. McCarthy',
    clientFullName: 'Liam McCarthy',
    completedAt: '2026-04-14',
    completedLabel: '14 Apr 2026',
    submittedAt: '2026-04-15T10:00:00',
    submittedRelative: 'Yesterday',
    system: 'hvac',
    systemDetails: 'Mitsubishi split HVAC, annual service',
    notes: 'Filters cleaned, refrigerant pressure checked, condensate trap cleared.',
    status: 'pending',
    files: [],
    fileChips: [
      { label: '1 PDF', icon: 'file-text' },
      { label: 'Service log', icon: 'clipboard-list' },
      { label: '4 photos', icon: 'image' },
    ],
    photoCount: 4,
  },
  {
    id: 'sub-5',
    installerName: 'Green Roof Ireland',
    installerContact: 'David Quinn, Installer',
    installerInitials: 'GR',
    installerColor: 'e',
    verified: false,
    trustScore: 79,
    jobsFiledCount: 8,
    jobTitle: 'Solar PV Install, 4.8kW Roof Mount',
    jobRef: 'JOB-2026-0871',
    location: 'Carrigaline, Cork',
    client: "S. O'Donnell",
    clientFullName: "Sinéad O'Donnell",
    completedAt: '2026-04-13',
    completedLabel: '13 Apr 2026',
    submittedAt: '2026-04-14T10:00:00',
    submittedRelative: '2d ago',
    system: 'solar-pv',
    systemDetails: 'SolarEdge SE5000H, 12x 400W',
    notes: 'Pitched roof install. String optimisers on each panel. Customer portal credentials provided.',
    status: 'pending',
    files: [],
    fileChips: [
      { label: '3 PDFs', icon: 'file-text' },
      { label: '9 photos', icon: 'image' },
      { label: 'Warranty', icon: 'award' },
    ],
    photoCount: 9,
  },
];
