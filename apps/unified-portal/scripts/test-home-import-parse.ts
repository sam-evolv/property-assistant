import { mapHeaders, normaliseRows, parseDateLoose, parseWorkbook, identifierKey } from '../lib/home-import/parse';
import * as xlsx from 'xlsx';

// Sam's exact tracker headers
const HEADERS = [
  'Address of Dwelling', 'Property Designation', 'Bedrooms', 'Phase', 'Release',
  'Price', 'Status', "Solicitor's Information", 'SADRL', 'Proof of Funds',
  'Purchaser Information', 'Deposit', 'Receipt', 'Sale Agreed & Loan Approved',
  'Date of Contract Issue', 'Date of Queries Raised', 'Date of Reply to Queries',
  'Date of Receipt of Signed Contracts', 'Date of One Part Contract Returned',
  'Projected Handover Date', 'Snagging Start Date', 'Mortgage Expiration Date', 'Comments',
];

const { mapped, unmapped } = mapHeaders(HEADERS);
console.log('--- Sam tracker headers ---');
console.log('mapped:', mapped.length, 'unmapped:', unmapped);
const byField = Object.fromEntries(mapped.map(m => [m.field, m.header]));
const expect = (field: string, header: string) => {
  if (byField[field] !== header) throw new Error(`FAIL: ${field} -> ${byField[field]} (wanted ${header})`);
};
expect('unit_identifier', 'Address of Dwelling');
expect('property_designation', 'Property Designation');
expect('phase', 'Phase');
expect('release_date', 'Release');
expect('sale_price', 'Price');
expect('status', 'Status');
expect('solicitor_name', "Solicitor's Information");
expect('sadrl_date', 'SADRL');
expect('proof_of_funds_date', 'Proof of Funds');
expect('purchaser_name', 'Purchaser Information');
expect('deposit_date', 'Deposit');
expect('deposit_receipt_date', 'Receipt');
expect('sale_agreed_date', 'Sale Agreed & Loan Approved');
expect('loan_approved_date', 'Sale Agreed & Loan Approved');
expect('contracts_issued_date', 'Date of Contract Issue');
expect('queries_raised_date', 'Date of Queries Raised');
expect('queries_replied_date', 'Date of Reply to Queries');
expect('signed_contracts_date', 'Date of Receipt of Signed Contracts');
expect('one_part_returned_date', 'Date of One Part Contract Returned');
expect('projected_handover_date', 'Projected Handover Date');
expect('snagging_start_date', 'Snagging Start Date');
expect('mortgage_expiry_date', 'Mortgage Expiration Date');
expect('comments', 'Comments');
console.log('✓ all 23 of Sam\'s headers map correctly');

// Odd variants
const odd = mapHeaders(['Plot No', 'House Design', 'Purchasers', 'Closing Date', 'Eircode', 'Random Junk Col']);
const oddBy = Object.fromEntries(odd.mapped.map(m => [m.field, m.header]));
if (oddBy['unit_identifier'] !== 'Plot No') throw new Error('FAIL plot');
if (oddBy['house_type'] !== 'House Design') throw new Error('FAIL design');
if (oddBy['purchaser_name'] !== 'Purchasers') throw new Error('FAIL purchasers');
if (oddBy['handover_date'] !== 'Closing Date') throw new Error('FAIL closing');
if (!odd.unmapped.includes('Random Junk Col')) throw new Error('FAIL junk should be unmapped');
console.log('✓ odd variants map; junk stays unmapped');

// Dates: dd/mm/yyyy must be day-first
const d1 = parseDateLoose('05/01/2026');
if (!d1 || !d1.startsWith('2026-01-05')) throw new Error(`FAIL dd/mm: ${d1}`);
const d2 = parseDateLoose(46023); // Excel serial ~ 2026-01-01
if (!d2 || !d2.startsWith('2026-01-01')) throw new Error(`FAIL serial: ${d2}`);
const d3 = parseDateLoose('2026-03-14');
if (!d3 || !d3.startsWith('2026-03-14')) throw new Error(`FAIL iso: ${d3}`);
if (parseDateLoose('TBC') !== null) throw new Error('FAIL TBC');
console.log('✓ dates: day-first, Excel serials, ISO, TBC->null');

// Full pipeline: build an xlsx in-memory with title row above headers + dupes + yes-flags
const rows = [
  ['Riverside Gardens — Sales Tracker'],
  HEADERS,
  ['12 The Green', 'House', '3', '1', '02/01/2026', '€385,000', 'Sale Agreed', 'Murphy & Co', 'Yes', 'Yes', 'John & Mary Smith', '15/01/2026', 'Yes', '20/01/2026', '01/02/2026', '', '', '', '', '30/06/2026', '01/06/2026', '20/08/2026', 'Buyer keen to close early'],
  ['14 The Green', 'House', '3', '1', '02/01/2026', '390000', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['12 The Green', 'House', '3', '1', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''], // in-file dupe
  ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''], // empty
];
const ws = xlsx.utils.aoa_to_sheet(rows);
const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, ws, 'Tracker');
const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

const sheet = parseWorkbook(buf, 'tracker.xlsx');
if (sheet.headers.length !== 23) throw new Error(`FAIL headers found: ${sheet.headers.length}`);
if (sheet.rows.length !== 3) throw new Error(`FAIL rows: ${sheet.rows.length}`);
console.log('✓ workbook: title row skipped, 23 headers, 3 data rows');

const { mapped: m2 } = mapHeaders(sheet.headers);
const { homes, errors } = normaliseRows(sheet.rows, m2);
if (homes.length !== 3) throw new Error(`FAIL homes: ${homes.length}`);
const h = homes[0];
if (h.unit_identifier !== '12 The Green') throw new Error('FAIL id');
if (h.sale_price !== 385000) throw new Error(`FAIL price: ${h.sale_price}`);
if (h.purchaser_name !== 'John & Mary Smith') throw new Error('FAIL purchaser');
if (!h.dates.sale_agreed_date?.startsWith('2026-01-20')) throw new Error(`FAIL sale agreed: ${h.dates.sale_agreed_date}`);
if (!h.dates.loan_approved_date?.startsWith('2026-01-20')) throw new Error('FAIL combo loan approved');
if (!h.dates.contracts_issued_date?.startsWith('2026-02-01')) throw new Error('FAIL contract issue');
if (!h.dates.projected_handover_date?.startsWith('2026-06-30')) throw new Error('FAIL projected handover');
if (!h.dates.mortgage_expiry_date?.startsWith('2026-08-20')) throw new Error('FAIL mortgage expiry');
if (h.flags.sadrl_date !== 'Yes') throw new Error('FAIL sadrl flag');
if (h.flags.proof_of_funds_date !== 'Yes') throw new Error('FAIL pof flag');
if (h.flags.deposit_receipt_date !== 'Yes') throw new Error('FAIL receipt flag');
if (h.comments !== 'Buyer keen to close early') throw new Error('FAIL comments');
if (h.solicitor_name !== 'Murphy & Co') throw new Error('FAIL solicitor');
// dupe detection key
if (identifierKey(' 12  THE green ') !== identifierKey('12 The Green')) throw new Error('FAIL key');
console.log('✓ rows: combo header fills both dates, yes-flags preserved, money parsed, solicitor + comments captured');
console.log('\nALL PARSER TESTS PASSED');
