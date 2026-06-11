import { mapSnagHeaders, normaliseSnagRows } from '../lib/snag-import/parse';
import { parseWorkbook, identifierKey } from '../lib/home-import/parse';
import * as xlsx from 'xlsx';

// Typical external snag engineer sheet
const rows = [
  ['Snag Report — 12 The Green'],
  ['No.', 'Room', 'Defect Description', 'Trade', 'Status'],
  ['1', 'Kitchen', 'Sealant missing around sink', 'Plumber', ''],
  ['2', 'Ensuite', 'Cracked tile beside shower door', '', 'Done'],
  ['3', 'Hall', 'Paint scuffs on skirting both sides', 'Painter', 'open'],
  ['', '', '', '', ''],
];
const ws = xlsx.utils.aoa_to_sheet(rows);
const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, ws, 'Snags');
const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

const sheet = parseWorkbook(buf, 'snags.xlsx');
if (sheet.headers.length !== 5) throw new Error(`headers: ${sheet.headers.length}`);
const { mapped, unmapped } = mapSnagHeaders(sheet.headers);
const by = Object.fromEntries(mapped.map(m => [m.field, m.header]));
if (by['room'] !== 'Room') throw new Error('room map');
if (by['description'] !== 'Defect Description') throw new Error('desc map');
if (by['trade'] !== 'Trade') throw new Error('trade map');
if (by['status'] !== 'Status') throw new Error('status map');
console.log('mapped:', mapped.map(m => `${m.field}<-${m.header}`).join(', '), '| unmapped:', unmapped);

const { rows: parsed, errors } = normaliseSnagRows(sheet.rows, mapped);
if (parsed.length !== 3) throw new Error(`rows: ${parsed.length}`);
if (parsed[0].title !== 'Sealant missing around sink') throw new Error(`title: ${parsed[0].title}`);
if (parsed[0].room !== 'Kitchen') throw new Error('room');
if (parsed[0].resolved) throw new Error('row1 should be open');
if (!parsed[1].resolved) throw new Error('row2 should be resolved (Done)');
if (parsed[2].resolved) throw new Error('row3 "open" must NOT be resolved');
if (errors.length !== 0) throw new Error(`errors: ${errors}`);

// House-column variant
const m2 = mapSnagHeaders(['House No', 'Item', 'Comments']);
const by2 = Object.fromEntries(m2.mapped.map(m => [m.field, m.header]));
if (by2['unit_identifier'] !== 'House No') throw new Error('house map');
if (by2['title'] !== 'Item') throw new Error('item map');
if (by2['description'] !== 'Comments') throw new Error('comments map');
if (identifierKey('12 THE  green') !== identifierKey('12 The Green')) throw new Error('key');
console.log('ALL SNAG-IMPORT PARSER TESTS PASSED');
