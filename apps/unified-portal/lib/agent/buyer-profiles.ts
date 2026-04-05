/**
 * Extended buyer profile data for the Agent app.
 * Enriches the base demo-data with property details, solicitor info,
 * contact details, and Intelligence activity context.
 */

import { BUYERS } from './demo-data';

/* ─── Property details by unit type ─── */

const PROPERTY_SPECS: Record<string, {
  sqMetres: number;
  sqFeet: number;
  ber: string;
  floors: number;
  parking: string;
  heating: string;
  orientation: string;
}> = {
  '2-bed T': { sqMetres: 82, sqFeet: 883, ber: 'A2', floors: 2, parking: '1 allocated space', heating: 'Air-to-water heat pump', orientation: 'South-facing' },
  '3-bed T': { sqMetres: 108, sqFeet: 1163, ber: 'A2', floors: 2, parking: '2 allocated spaces', heating: 'Air-to-water heat pump', orientation: 'South-west facing' },
  '3-bed SD': { sqMetres: 115, sqFeet: 1238, ber: 'A2', floors: 2, parking: '2 allocated spaces', heating: 'Air-to-water heat pump', orientation: 'South-facing' },
  '3-bed': { sqMetres: 110, sqFeet: 1184, ber: 'A2', floors: 2, parking: '2 allocated spaces', heating: 'Air-to-water heat pump', orientation: 'South-west facing' },
  '4-bed T': { sqMetres: 135, sqFeet: 1453, ber: 'A2', floors: 2, parking: '2 allocated spaces', heating: 'Air-to-water heat pump', orientation: 'West-facing' },
  '4-bed D': { sqMetres: 148, sqFeet: 1593, ber: 'A1', floors: 2, parking: '2 allocated spaces + driveway', heating: 'Air-to-water heat pump', orientation: 'South-facing' },
};

/* ─── Solicitor assignments ─── */

const SOLICITORS: Record<string, { firm: string; contact: string; phone: string; email: string }> = {
  'Riverside Gardens': { firm: 'O\'Brien & Partners', contact: 'Fiona O\'Brien', phone: '021 427 8800', email: 'fiona@obrienpartners.ie' },
  'Meadow View': { firm: 'McCarthy Solicitors', contact: 'David McCarthy', phone: '021 455 1200', email: 'david@mccarthysolicitors.ie' },
  'Oak Hill Estate': { firm: 'Horgan & Associates', contact: 'Claire Horgan', phone: '021 432 6100', email: 'claire@horgan.ie' },
  'Willow Brook': { firm: 'O\'Brien & Partners', contact: 'Fiona O\'Brien', phone: '021 427 8800', email: 'fiona@obrienpartners.ie' },
  'Harbour View Apartments': { firm: 'Walsh Legal', contact: 'Tom Walsh', phone: '021 490 3300', email: 'tom@walshlegal.ie' },
};

/* ─── Intelligence activity context ─── */

interface IntelligenceNote {
  date: string;
  action: string;
  detail: string;
}

const INTELLIGENCE_ACTIVITY: Record<number, IntelligenceNote[]> = {
  1: [ // Marcelo Acher
    { date: '2026-03-28', action: 'Follow-up email drafted', detail: 'Intelligence drafted a chase email to solicitor regarding contract delay. Approved and sent by Sam.' },
    { date: '2026-03-15', action: 'Follow-up email drafted', detail: 'Second reminder sent to buyer\'s solicitor re: outstanding contracts.' },
    { date: '2026-02-20', action: 'Follow-up email drafted', detail: 'Initial follow-up sent to buyer requesting solicitor status update.' },
  ],
  2: [ // Stephanie Flanagan
    { date: '2026-03-25', action: 'Follow-up email drafted', detail: 'Chase email sent to Flanagan\'s solicitor. No response received.' },
    { date: '2026-03-01', action: 'Follow-up email drafted', detail: 'Initial contract reminder sent to buyer.' },
  ],
  3: [ // Jasmine Thomas
    { date: '2026-03-30', action: 'Follow-up email drafted', detail: 'Urgent chase sent to solicitor — 111 days overdue.' },
    { date: '2026-03-10', action: 'Report generated', detail: 'Included in weekly developer report as high-priority overdue.' },
  ],
  4: [ // Aidan Oneill
    { date: '2026-03-20', action: 'Follow-up email drafted', detail: 'Solicitor follow-up email sent.' },
  ],
  21: [ // Jack Redmond
    { date: '2026-03-01', action: 'Snag list reviewed', detail: 'Intelligence compiled snag list items for Unit 14. Awaiting builder response.' },
  ],
  27: [ // Ellaine Marin
    { date: '2026-02-15', action: 'Report generated', detail: 'Closing timeline included in developer weekly report.' },
  ],
};

/* ─── Contact details (simulated) ─── */

const BUYER_CONTACTS: Record<number, { phone: string; email: string; address: string }> = {
  1: { phone: '087 123 4567', email: 'marcelo.acher@gmail.com', address: '12 Western Road, Cork City' },
  2: { phone: '086 234 5678', email: 'steph.flanagan@outlook.com', address: '45 Douglas Street, Douglas' },
  3: { phone: '085 345 6789', email: 'jasmine.thomas@gmail.com', address: '8 Barrack Street, Cork City' },
  4: { phone: '087 456 7890', email: 'aidan.oneill@hotmail.com', address: '22 Rochestown Road, Cork' },
  5: { phone: '083 567 8901', email: 'imran.musayev@gmail.com', address: '3 Ballincollig Main Street' },
  6: { phone: '086 678 9012', email: 'cait.mchenry@icloud.com', address: '17 Magazine Road, Cork' },
  7: { phone: '087 789 0123', email: 'aditya.pp@gmail.com', address: '5 South Mall, Cork City' },
  8: { phone: '085 890 1234', email: 'luca.oliviero@gmail.com', address: '28 Shandon Street, Cork' },
  9: { phone: '086 901 2345', email: 'courtney.creagh@yahoo.com', address: '14 Model Farm Road, Cork' },
  10: { phone: '087 012 3456', email: 'dianne.saarinas@gmail.com', address: '9 Glanmire Village, Cork' },
  11: { phone: '083 123 4567', email: 'ruby.rose@hotmail.com', address: '31 Blackrock Road, Cork' },
  12: { phone: '085 234 5678', email: 'jiffin.zacharia@gmail.com', address: '6 Bandon Road, Cork' },
  13: { phone: '086 345 6789', email: 'enio.bagio@gmail.com', address: '19 Parnell Place, Cork' },
  14: { phone: '087 456 7890', email: 'manju.jent@outlook.com', address: '42 Togher Road, Cork' },
  15: { phone: '083 567 8901', email: 'rheenue.gwarimbo@gmail.com', address: '7 Bishopstown Avenue' },
  16: { phone: '085 678 9012', email: 'jason.murphy@gmail.com', address: '55 Wilton Road, Cork' },
  17: { phone: '086 789 0123', email: 'laura.hayes@icloud.com', address: '23 Ballinlough Road, Cork' },
  18: { phone: '087 890 1234', email: 'shane.curtin@gmail.com', address: '11 Carrigaline Main St' },
  19: { phone: '083 901 2345', email: 'kayla.smith@hotmail.com', address: '38 Tower Road, Cork' },
  20: { phone: '085 012 3456', email: 'alban.pieprzyk@gmail.com', address: '4 Patrick Street, Cork' },
  21: { phone: '086 123 4567', email: 'jack.redmond@outlook.com', address: '16 Blarney Road, Cork' },
  22: { phone: '087 234 5678', email: 'prashant.singh@gmail.com', address: '29 Mahon Point, Cork' },
  23: { phone: '083 345 6789', email: 'sarah.clair@icloud.com', address: '8 Glasheen Road, Cork' },
  24: { phone: '085 456 7890', email: 'billy.ogorman@gmail.com', address: '47 Ballintemple, Cork' },
  25: { phone: '086 567 8901', email: 'cyriac.stephen@gmail.com', address: '12 Montenotte, Cork' },
  26: { phone: '087 678 9012', email: 'ruby.rajan@outlook.com', address: '5 Sunday\'s Well, Cork' },
  27: { phone: '083 789 0123', email: 'ellaine.marin@gmail.com', address: '33 Tivoli, Cork' },
  28: { phone: '085 890 1234', email: 'jan.silvestre@gmail.com', address: '21 Togher, Cork' },
  29: { phone: '086 901 2345', email: 'diarmuid.kenneally@outlook.com', address: '14 Frankfield, Cork' },
  30: { phone: '087 012 3456', email: 'fadhil.firyaguna@gmail.com', address: '9 Turner\'s Cross, Cork' },
  31: { phone: '083 123 4568', email: 'jayalakshmi.s@gmail.com', address: '27 Ballyphehane, Cork' },
  32: { phone: '085 234 5679', email: 'primitha.mohan@gmail.com', address: '15 Blackpool, Cork' },
  33: { phone: '086 345 6780', email: 'shauna.ring@icloud.com', address: '8 Farranree, Cork' },
  34: { phone: '087 456 7891', email: 'nima.sudhan@gmail.com', address: '3 Mayfield, Cork' },
  35: { phone: '083 567 8902', email: 'rory.oconnor@outlook.com', address: '41 Bishopstown, Cork' },
};

/* ─── Mortgage lender info ─── */

const LENDERS: Record<number, { lender: string; approvalAmount: number; expiryDate: string | null }> = {
  1: { lender: 'AIB Mortgage', approvalAmount: 460000, expiryDate: '2026-05-04' },
  2: { lender: 'Bank of Ireland', approvalAmount: 430000, expiryDate: '2026-06-02' },
  3: { lender: 'Permanent TSB', approvalAmount: 500000, expiryDate: '2026-06-12' },
  4: { lender: 'AIB Mortgage', approvalAmount: 550000, expiryDate: '2026-06-15' },
  5: { lender: 'Haven Mortgages', approvalAmount: 350000, expiryDate: '2026-06-16' },
  6: { lender: 'Bank of Ireland', approvalAmount: 460000, expiryDate: '2026-06-22' },
  7: { lender: 'AIB Mortgage', approvalAmount: 520000, expiryDate: '2026-06-23' },
  8: { lender: 'Avant Money', approvalAmount: 350000, expiryDate: '2026-07-13' },
  9: { lender: 'Bank of Ireland', approvalAmount: 460000, expiryDate: '2026-07-14' },
  10: { lender: 'Permanent TSB', approvalAmount: 440000, expiryDate: '2026-07-20' },
  11: { lender: 'AIB Mortgage', approvalAmount: 500000, expiryDate: '2026-07-20' },
  12: { lender: 'Haven Mortgages', approvalAmount: 460000, expiryDate: '2026-07-23' },
  13: { lender: 'Bank of Ireland', approvalAmount: 440000, expiryDate: '2026-07-26' },
  14: { lender: 'AIB Mortgage', approvalAmount: 445000, expiryDate: '2026-07-26' },
  15: { lender: 'Permanent TSB', approvalAmount: 460000, expiryDate: '2026-08-05' },
  16: { lender: 'Bank of Ireland', approvalAmount: 350000, expiryDate: '2026-08-12' },
  17: { lender: 'AIB Mortgage', approvalAmount: 460000, expiryDate: '2026-08-12' },
};

/* ─── Exported enrichment function ─── */

export interface BuyerProfile {
  // Base buyer data
  id: number;
  name: string;
  initials: string;
  unit: string;
  scheme: string;
  type: string;
  beds: number;
  price: number;
  status: string;
  urgent: boolean;
  daysSinceIssued: number | null;

  // Dates
  saleAgreedDate: string | null;
  depositDate: string | null;
  contractsIssuedDate: string | null;
  contractsSignedDate: string | null;
  handoverDate: string | null;
  snagDate: string | null;
  estimatedCloseDate: string | null;
  kitchenSelected: boolean | null;

  // Property
  sqMetres: number;
  sqFeet: number;
  ber: string;
  floors: number;
  parking: string;
  heating: string;
  orientation: string;

  // Contact
  phone: string;
  email: string;
  address: string;

  // Solicitor
  solicitorFirm: string;
  solicitorContact: string;
  solicitorPhone: string;
  solicitorEmail: string;

  // Mortgage
  lender: string | null;
  approvalAmount: number | null;
  mortgageExpiry: string | null;

  // Intelligence context
  intelligenceNotes: IntelligenceNote[];
}

export function getBuyerProfile(buyerId: number): BuyerProfile | null {
  const buyer = BUYERS.find((b) => b.id === buyerId);
  if (!buyer) return null;

  const specs = PROPERTY_SPECS[buyer.type] || PROPERTY_SPECS['3-bed'];
  const solicitor = SOLICITORS[buyer.scheme] || SOLICITORS['Riverside Gardens'];
  const contact = BUYER_CONTACTS[buyer.id] || { phone: '—', email: '—', address: '—' };
  const lender = LENDERS[buyer.id] || null;
  const notes = INTELLIGENCE_ACTIVITY[buyer.id] || [];

  return {
    id: buyer.id,
    name: buyer.name,
    initials: buyer.initials,
    unit: buyer.unit,
    scheme: buyer.scheme,
    type: buyer.type,
    beds: buyer.beds,
    price: buyer.price,
    status: buyer.status,
    urgent: buyer.urgent,
    daysSinceIssued: buyer.daysSinceIssued,

    saleAgreedDate: buyer.saleAgreedDate,
    depositDate: buyer.depositDate,
    contractsIssuedDate: buyer.contractsIssuedDate,
    contractsSignedDate: buyer.contractsSignedDate,
    handoverDate: buyer.handoverDate,
    snagDate: buyer.snagDate,
    estimatedCloseDate: buyer.estimatedCloseDate,
    kitchenSelected: buyer.kitchenSelected,

    sqMetres: specs.sqMetres,
    sqFeet: specs.sqFeet,
    ber: specs.ber,
    floors: specs.floors,
    parking: specs.parking,
    heating: specs.heating,
    orientation: specs.orientation,

    phone: contact.phone,
    email: contact.email,
    address: contact.address,

    solicitorFirm: solicitor.firm,
    solicitorContact: solicitor.contact,
    solicitorPhone: solicitor.phone,
    solicitorEmail: solicitor.email,

    lender: lender?.lender ?? null,
    approvalAmount: lender?.approvalAmount ?? null,
    mortgageExpiry: lender?.expiryDate ?? null,

    intelligenceNotes: notes,
  };
}
