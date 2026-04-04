/**
 * OpenHouse Agent App — Real pipeline data
 * Source: Supabase database, tenant "Longview Estates"
 * Last synced: 2026-04-02
 */

/* ------------------------------------------------------------------ */
/*  Scheme summaries                                                   */
/* ------------------------------------------------------------------ */

export interface Scheme {
  id: string;
  name: string;
  total: number;
  sold: number;
  contractsSigned: number;
  contractsOut: number;
  saleAgreed: number;
  reserved: number;
  available: number;
  revenue: number;
}

export const SCHEMES: Scheme[] = [
  { id: 'oak-hill', name: 'Oak Hill Estate', total: 75, sold: 62, contractsSigned: 0, contractsOut: 0, saleAgreed: 0, reserved: 14, available: 0, revenue: 27835000 },
  { id: 'riverside', name: 'Riverside Gardens', total: 68, sold: 0, contractsSigned: 35, contractsOut: 17, saleAgreed: 1, reserved: 7, available: 8, revenue: 28805000 },
  { id: 'meadow', name: 'Meadow View', total: 52, sold: 12, contractsSigned: 27, contractsOut: 0, saleAgreed: 2, reserved: 13, available: 0, revenue: 17305000 },
  { id: 'willow', name: 'Willow Brook', total: 43, sold: 3, contractsSigned: 0, contractsOut: 0, saleAgreed: 0, reserved: 40, available: 0, revenue: 1575000 },
  { id: 'harbour', name: 'Harbour View Apartments', total: 12, sold: 2, contractsSigned: 1, contractsOut: 0, saleAgreed: 0, reserved: 0, available: 9, revenue: 550000 },
];

/* ------------------------------------------------------------------ */
/*  Buyer interface                                                    */
/* ------------------------------------------------------------------ */

export interface Buyer {
  id: number;
  name: string;
  unit: string;
  scheme: string;
  type: string;
  beds: number;
  price: number;
  status: 'contracts_out' | 'sale_agreed' | 'contracts_signed' | 'sold' | 'reserved';
  saleAgreedDate: string | null;
  depositDate: string | null;
  contractsIssuedDate: string | null;
  contractsSignedDate: string | null;
  handoverDate: string | null;
  kitchenSelected: boolean | null;
  snagDate: string | null;
  estimatedCloseDate: string | null;
  mortgageExpiry: string | null;
  daysSinceIssued: number | null;
  urgent: boolean;
  initials: string;
}

/* ------------------------------------------------------------------ */
/*  Contracts Out — Riverside Gardens (17 buyers, all urgent)          */
/* ------------------------------------------------------------------ */

const contractsOutBuyers: Buyer[] = [
  { id: 1, name: 'Marcelo Acher & Lislaine Lobo Goncalves Acher', unit: 'Unit 5', scheme: 'Riverside Gardens', type: '3-bed SD', beds: 3, price: 445000, status: 'contracts_out', saleAgreedDate: null, depositDate: null, contractsIssuedDate: '2025-11-04', contractsSignedDate: null, handoverDate: null, kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: 149, urgent: true, initials: 'MA' },
  { id: 2, name: 'Stephanie Flanagan & Kevin Flanagan', unit: 'Unit 40', scheme: 'Riverside Gardens', type: '3-bed T', beds: 3, price: 415000, status: 'contracts_out', saleAgreedDate: null, depositDate: null, contractsIssuedDate: '2025-12-02', contractsSignedDate: null, handoverDate: null, kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: 121, urgent: true, initials: 'SF' },
  { id: 3, name: 'Jasmine Thomas', unit: 'Unit 33', scheme: 'Riverside Gardens', type: '4-bed T', beds: 4, price: 480000, status: 'contracts_out', saleAgreedDate: null, depositDate: null, contractsIssuedDate: '2025-12-12', contractsSignedDate: null, handoverDate: null, kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: 111, urgent: true, initials: 'JT' },
  { id: 4, name: 'Aidan Oneill & Lara Farmer', unit: 'Unit 16', scheme: 'Riverside Gardens', type: '4-bed D', beds: 4, price: 530000, status: 'contracts_out', saleAgreedDate: null, depositDate: null, contractsIssuedDate: '2025-12-15', contractsSignedDate: null, handoverDate: null, kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: 108, urgent: true, initials: 'AO' },
  { id: 5, name: 'Imran Musayev & Markha Shabazova', unit: 'Unit 35', scheme: 'Riverside Gardens', type: '2-bed T', beds: 2, price: 335000, status: 'contracts_out', saleAgreedDate: null, depositDate: null, contractsIssuedDate: '2025-12-16', contractsSignedDate: null, handoverDate: null, kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: 107, urgent: true, initials: 'IM' },
  { id: 6, name: 'Cait McHenry', unit: 'Unit 24', scheme: 'Riverside Gardens', type: '3-bed SD', beds: 3, price: 445000, status: 'contracts_out', saleAgreedDate: null, depositDate: null, contractsIssuedDate: '2025-12-22', contractsSignedDate: null, handoverDate: null, kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: 101, urgent: true, initials: 'CM' },
  { id: 7, name: 'Aditya Pothody Puthatta & Nivethitha Dharmaraja', unit: 'Unit 9', scheme: 'Riverside Gardens', type: '4-bed D', beds: 4, price: 500000, status: 'contracts_out', saleAgreedDate: null, depositDate: null, contractsIssuedDate: '2025-12-23', contractsSignedDate: null, handoverDate: null, kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: 100, urgent: true, initials: 'AP' },
  { id: 8, name: 'Luca Alessandro Oliviero', unit: 'Unit 58', scheme: 'Riverside Gardens', type: '2-bed T', beds: 2, price: 335000, status: 'contracts_out', saleAgreedDate: null, depositDate: null, contractsIssuedDate: '2026-01-13', contractsSignedDate: null, handoverDate: null, kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: 79, urgent: true, initials: 'LO' },
  { id: 9, name: 'Courtney Creagh & Adam O\'Sullivan', unit: 'Unit 21', scheme: 'Riverside Gardens', type: '3-bed SD', beds: 3, price: 445000, status: 'contracts_out', saleAgreedDate: null, depositDate: null, contractsIssuedDate: '2026-01-14', contractsSignedDate: null, handoverDate: null, kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: 78, urgent: true, initials: 'CC' },
  { id: 10, name: 'Dianne Saarinas & Wendelyn Saarinas', unit: 'Unit 63', scheme: 'Riverside Gardens', type: '3-bed T', beds: 3, price: 425000, status: 'contracts_out', saleAgreedDate: null, depositDate: null, contractsIssuedDate: '2026-01-20', contractsSignedDate: null, handoverDate: null, kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: 72, urgent: true, initials: 'DS' },
  { id: 11, name: 'Ruby Rose & Reno Chacko', unit: 'Unit 60', scheme: 'Riverside Gardens', type: '4-bed T', beds: 4, price: 485000, status: 'contracts_out', saleAgreedDate: null, depositDate: null, contractsIssuedDate: '2026-01-20', contractsSignedDate: null, handoverDate: null, kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: 72, urgent: true, initials: 'RR' },
  { id: 12, name: 'Jiffin Zacharia & Delfy Rajan', unit: 'Unit 20', scheme: 'Riverside Gardens', type: '3-bed SD', beds: 3, price: 445000, status: 'contracts_out', saleAgreedDate: null, depositDate: null, contractsIssuedDate: '2026-01-23', contractsSignedDate: null, handoverDate: null, kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: 69, urgent: true, initials: 'JZ' },
  { id: 13, name: 'Enio Bagio Junior & Angela Maria Alberton de Souza', unit: 'Unit 54', scheme: 'Riverside Gardens', type: '3-bed T', beds: 3, price: 425000, status: 'contracts_out', saleAgreedDate: null, depositDate: null, contractsIssuedDate: '2026-01-26', contractsSignedDate: null, handoverDate: null, kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: 66, urgent: true, initials: 'EB' },
  { id: 14, name: 'Manju Jent & Jent Jose', unit: 'Unit 47', scheme: 'Riverside Gardens', type: '3-bed T', beds: 3, price: 430000, status: 'contracts_out', saleAgreedDate: null, depositDate: null, contractsIssuedDate: '2026-01-26', contractsSignedDate: null, handoverDate: null, kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: 66, urgent: true, initials: 'MJ' },
  { id: 15, name: 'Rheenue George Gwarimbo & Tambudzai Gwarimbo', unit: 'Unit 14', scheme: 'Riverside Gardens', type: '3-bed SD', beds: 3, price: 445000, status: 'contracts_out', saleAgreedDate: null, depositDate: null, contractsIssuedDate: '2026-02-05', contractsSignedDate: null, handoverDate: null, kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: 56, urgent: true, initials: 'RG' },
  { id: 16, name: 'Jason Murphy', unit: 'Unit 56', scheme: 'Riverside Gardens', type: '2-bed T', beds: 2, price: 335000, status: 'contracts_out', saleAgreedDate: null, depositDate: null, contractsIssuedDate: '2026-02-12', contractsSignedDate: null, handoverDate: null, kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: 49, urgent: true, initials: 'JM' },
  { id: 17, name: 'Laura Hayes & Dylan Rogers', unit: 'Unit 19', scheme: 'Riverside Gardens', type: '3-bed SD', beds: 3, price: 445000, status: 'contracts_out', saleAgreedDate: null, depositDate: null, contractsIssuedDate: '2026-02-12', contractsSignedDate: null, handoverDate: null, kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: 49, urgent: true, initials: 'LH' },
];

/* ------------------------------------------------------------------ */
/*  Sale Agreed / Contracts Signed transitional                        */
/* ------------------------------------------------------------------ */

const saleAgreedBuyers: Buyer[] = [
  // Shane Curtin actually has contracts signed (signed 2025-09-04), status = contracts_signed
  { id: 18, name: 'Shane Curtin', unit: 'Unit 41', scheme: 'Meadow View', type: '3-bed', beds: 3, price: 425000, status: 'contracts_signed', saleAgreedDate: '2025-08-07', depositDate: null, contractsIssuedDate: null, contractsSignedDate: '2025-09-04', handoverDate: null, kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: null, urgent: false, initials: 'SC' },
  { id: 19, name: 'Kayla Smith & Aidan King', unit: 'Unit 25', scheme: 'Meadow View', type: '3-bed', beds: 3, price: 440000, status: 'sale_agreed', saleAgreedDate: '2026-02-13', depositDate: null, contractsIssuedDate: null, contractsSignedDate: null, handoverDate: null, kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: null, urgent: false, initials: 'KS' },
  { id: 20, name: 'Alban Pieprzyk', unit: 'Unit 43', scheme: 'Riverside Gardens', type: '3-bed T', beds: 3, price: 415000, status: 'sale_agreed', saleAgreedDate: '2026-02-16', depositDate: null, contractsIssuedDate: null, contractsSignedDate: null, handoverDate: null, kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: null, urgent: false, initials: 'AP' },
];

/* ------------------------------------------------------------------ */
/*  Contracts Signed — representative sample                           */
/* ------------------------------------------------------------------ */

const contractsSignedBuyers: Buyer[] = [
  // Meadow View
  { id: 21, name: 'Jack Redmond & Megan Gallagher', unit: 'Unit 14', scheme: 'Meadow View', type: '3-bed', beds: 3, price: 495000, status: 'contracts_signed', saleAgreedDate: null, depositDate: null, contractsIssuedDate: null, contractsSignedDate: '2025-08-14', handoverDate: null, kitchenSelected: false, snagDate: '2026-01-15', estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: null, urgent: false, initials: 'JR' },
  { id: 22, name: 'Prashant & Shivangi Singh', unit: 'Unit 21', scheme: 'Meadow View', type: '3-bed', beds: 3, price: 485000, status: 'contracts_signed', saleAgreedDate: null, depositDate: null, contractsIssuedDate: null, contractsSignedDate: '2025-06-17', handoverDate: null, kitchenSelected: false, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: null, urgent: false, initials: 'PS' },
  { id: 23, name: 'Sarah Clair & Cian O\'Rourke', unit: 'Unit 26', scheme: 'Meadow View', type: '3-bed', beds: 3, price: 485000, status: 'contracts_signed', saleAgreedDate: null, depositDate: null, contractsIssuedDate: null, contractsSignedDate: '2025-07-23', handoverDate: null, kitchenSelected: false, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: null, urgent: false, initials: 'SC' },
  { id: 24, name: 'Billy O\'Gorman & Jessica O\'Callaghan', unit: 'Unit 37', scheme: 'Meadow View', type: '3-bed', beds: 3, price: 525000, status: 'contracts_signed', saleAgreedDate: null, depositDate: null, contractsIssuedDate: null, contractsSignedDate: '2025-04-24', handoverDate: null, kitchenSelected: false, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: null, urgent: false, initials: 'BO' },
  { id: 25, name: 'Cyriac Stephen', unit: 'Unit 33', scheme: 'Meadow View', type: '3-bed', beds: 3, price: 440000, status: 'contracts_signed', saleAgreedDate: null, depositDate: null, contractsIssuedDate: null, contractsSignedDate: '2025-07-25', handoverDate: null, kitchenSelected: false, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: null, urgent: false, initials: 'CS' },
  { id: 26, name: 'Ruby Rajan & Renji Arayanparambil Jacob', unit: 'Unit 31', scheme: 'Meadow View', type: '3-bed', beds: 3, price: 440000, status: 'contracts_signed', saleAgreedDate: null, depositDate: null, contractsIssuedDate: null, contractsSignedDate: '2025-07-21', handoverDate: null, kitchenSelected: false, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: null, urgent: false, initials: 'RR' },
  // Riverside Gardens
  { id: 27, name: 'Ellaine Marin & Jason Mamaril', unit: 'Unit 1', scheme: 'Riverside Gardens', type: '3-bed', beds: 3, price: 485000, status: 'contracts_signed', saleAgreedDate: null, depositDate: null, contractsIssuedDate: null, contractsSignedDate: '2026-01-29', handoverDate: null, kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: null, urgent: false, initials: 'EM' },
  { id: 28, name: 'Jan S. Silvestre & Pauline E. Imperial', unit: 'Unit 8', scheme: 'Riverside Gardens', type: '3-bed', beds: 3, price: 485000, status: 'contracts_signed', saleAgreedDate: null, depositDate: null, contractsIssuedDate: null, contractsSignedDate: '2025-10-03', handoverDate: null, kitchenSelected: false, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: null, urgent: false, initials: 'JS' },
  { id: 29, name: 'Diarmuid Kenneally & Eimear Tobin', unit: 'Unit 15', scheme: 'Riverside Gardens', type: '3-bed', beds: 3, price: 485000, status: 'contracts_signed', saleAgreedDate: null, depositDate: null, contractsIssuedDate: null, contractsSignedDate: '2025-10-16', handoverDate: null, kitchenSelected: true, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: null, urgent: false, initials: 'DK' },
  { id: 30, name: 'Fadhil Firyaguna', unit: 'Unit 13', scheme: 'Riverside Gardens', type: '3-bed', beds: 3, price: 445000, status: 'contracts_signed', saleAgreedDate: null, depositDate: null, contractsIssuedDate: null, contractsSignedDate: '2025-12-03', handoverDate: null, kitchenSelected: false, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: null, urgent: false, initials: 'FF' },
];

/* ------------------------------------------------------------------ */
/*  Recently Sold (last 90 days)                                       */
/* ------------------------------------------------------------------ */

const recentlySoldBuyers: Buyer[] = [
  { id: 31, name: 'Jayalakshmi Sridharan & Nijin Punnakkan', unit: 'Unit 20', scheme: 'Meadow View', type: '3-bed', beds: 3, price: 440000, status: 'sold', saleAgreedDate: null, depositDate: null, contractsIssuedDate: null, contractsSignedDate: null, handoverDate: '2026-02-06', kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: null, urgent: false, initials: 'JS' },
  { id: 32, name: 'Primitha Mohan & Gireesh Nadesan', unit: 'Unit 13', scheme: 'Meadow View', type: '3-bed', beds: 3, price: 495000, status: 'sold', saleAgreedDate: null, depositDate: null, contractsIssuedDate: null, contractsSignedDate: null, handoverDate: '2026-01-29', kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: null, urgent: false, initials: 'PM' },
  { id: 33, name: 'Shauna Ring', unit: 'Unit 46', scheme: 'Meadow View', type: '3-bed', beds: 3, price: 335000, status: 'sold', saleAgreedDate: null, depositDate: null, contractsIssuedDate: null, contractsSignedDate: null, handoverDate: '2026-01-27', kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: null, urgent: false, initials: 'SR' },
  { id: 34, name: 'Nima Sal Sudhan & Samuel Aldana Delgado', unit: 'Unit 45', scheme: 'Meadow View', type: '3-bed', beds: 3, price: 410000, status: 'sold', saleAgreedDate: null, depositDate: null, contractsIssuedDate: null, contractsSignedDate: null, handoverDate: '2026-01-13', kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: null, urgent: false, initials: 'NS' },
  { id: 35, name: 'Rory O\'Connor', unit: 'Unit 15', scheme: 'Meadow View', type: '3-bed', beds: 3, price: 445000, status: 'sold', saleAgreedDate: null, depositDate: null, contractsIssuedDate: null, contractsSignedDate: null, handoverDate: '2026-01-06', kitchenSelected: null, snagDate: null, estimatedCloseDate: null, mortgageExpiry: null, daysSinceIssued: null, urgent: false, initials: 'RO' },
];

/* ------------------------------------------------------------------ */
/*  Combined BUYERS array                                              */
/* ------------------------------------------------------------------ */

export const BUYERS: Buyer[] = [
  ...contractsOutBuyers,
  ...saleAgreedBuyers,
  ...contractsSignedBuyers,
  ...recentlySoldBuyers,
];

/* ------------------------------------------------------------------ */
/*  Agent stats for Home tab                                           */
/* ------------------------------------------------------------------ */

export const AGENT_STATS = {
  totalSold: 79,        // 62 Oak Hill + 12 Meadow View + 2 Harbour View + 3 Willow Brook
  activePipeline: 57,   // 17 contracts out + 3 sale agreed + 37 contracts signed
  urgent: 17,           // all contracts out (>30 days)
  schemesActive: 5,
};

/* ------------------------------------------------------------------ */
/*  Top 5 most urgent (longest contracts outstanding)                  */
/* ------------------------------------------------------------------ */

export const URGENT_TOP5 = contractsOutBuyers
  .sort((a, b) => (b.daysSinceIssued ?? 0) - (a.daysSinceIssued ?? 0))
  .slice(0, 5);

/* ------------------------------------------------------------------ */
/*  Helper: format price as €XXXk                                      */
/* ------------------------------------------------------------------ */

export function formatPrice(price: number): string {
  if (price >= 1000000) {
    return `\u20AC${(price / 1000000).toFixed(1)}m`;
  }
  return `\u20AC${Math.round(price / 1000)}k`;
}
