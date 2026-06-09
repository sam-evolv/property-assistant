// lib/dev-app/evidence-pack.ts
// Pure PDF builders for the per-scheme HPI Evidence Pack export (no DB access).
// Renders each unit's QA 8.0 (Consumer Information & Aftercare) evidence —
// handover trail, installed systems, the issued Home User Guide — plus a
// scheme-level readiness index. Drawing approach follows the proven pdf-lib
// pattern in app/api/admin/qr-pack/route.ts, with a real page-break helper.

import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import type { HomeUserGuideContent, HomeUserGuideSection } from '@/lib/dev-app/home-user-guide';
import type { HpiQa8Evidence } from '@/lib/dev-app/unit-systems';

export interface EvidencePackUnit {
  unit: {
    id: string;
    unit_number: string | null;
    address_line_1: string | null;
    eircode: string | null;
    house_type_code: string | null;
  };
  systems: any[]; // unit_systems rows
  events: any[]; // handover_events rows (occurred_at desc)
  guide: {
    version: number;
    status: string;
    issued_at: string | null;
    content: HomeUserGuideContent | null;
  } | null;
  openSnagCount: number;
  totalSnagCount: number;
  evidence: HpiQa8Evidence;
}

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM_LIMIT = 60;

const INK = rgb(0.07, 0.09, 0.15);
const BODY = rgb(0.2, 0.2, 0.2);
const MUTED = rgb(0.45, 0.47, 0.5);
const GOLD = rgb(0.83, 0.69, 0.22);
const GREEN = rgb(0.02, 0.59, 0.41);
const AMBER = rgb(0.85, 0.47, 0.02);

interface DrawCtx {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
}

// Standard fonts are WinAnsi-encoded; strip anything they cannot encode so a
// stray character in LLM-generated guide content can never break the export.
function sanitize(text: string): string {
  return (text || '')
    .replace(/[‐-‒]/g, '-')
    .replace(/[^\x20-\x7E -ÿ–—‘’“”•…]/g, '')
    .trim();
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return sanitize(String(value));
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ensureSpace(ctx: DrawCtx, needed: number): void {
  if (ctx.y - needed < BOTTOM_LIMIT) {
    ctx.page = ctx.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    ctx.y = PAGE_HEIGHT - MARGIN;
  }
}

function drawText(
  ctx: DrawCtx,
  text: string,
  opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number; gapAfter?: number } = {},
): void {
  const size = opts.size ?? 9.5;
  ensureSpace(ctx, size + 6);
  ctx.page.drawText(sanitize(text), {
    x: opts.x ?? MARGIN,
    y: ctx.y,
    size,
    font: opts.bold ? ctx.bold : ctx.font,
    color: opts.color ?? BODY,
  });
  ctx.y -= size + (opts.gapAfter ?? 5);
}

function drawWrapped(
  ctx: DrawCtx,
  text: string,
  opts: { size?: number; x?: number; color?: ReturnType<typeof rgb>; bold?: boolean } = {},
): void {
  const size = opts.size ?? 9.5;
  const x = opts.x ?? MARGIN;
  const maxWidth = CONTENT_WIDTH - (x - MARGIN);
  const font = opts.bold ? ctx.bold : ctx.font;
  const words = sanitize(text).split(/\s+/).filter(Boolean);
  let line = '';

  const flush = () => {
    if (!line) return;
    ensureSpace(ctx, size + 5);
    ctx.page.drawText(line, { x, y: ctx.y, size, font, color: opts.color ?? BODY });
    ctx.y -= size + 4;
    line = '';
  };

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      flush();
      line = word;
    } else {
      line = test;
    }
  }
  flush();
}

function drawBullets(ctx: DrawCtx, items: string[] | undefined, indent = 12): void {
  for (const item of items ?? []) {
    drawWrapped(ctx, `• ${item}`, { x: MARGIN + indent, size: 9 });
  }
}

function drawSectionHeading(ctx: DrawCtx, text: string): void {
  ensureSpace(ctx, 34);
  ctx.y -= 8;
  drawText(ctx, text.toUpperCase(), { size: 10.5, bold: true, color: INK, gapAfter: 3 });
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y + 1 },
    end: { x: MARGIN + CONTENT_WIDTH, y: ctx.y + 1 },
    thickness: 0.7,
    color: rgb(0.88, 0.89, 0.9),
  });
  ctx.y -= 8;
}

function tick(on: boolean): string {
  return on ? '[x]' : '[ ]';
}

function drawEvidenceLine(ctx: DrawCtx, on: boolean, label: string): void {
  ensureSpace(ctx, 16);
  ctx.page.drawText(tick(on), {
    x: MARGIN,
    y: ctx.y,
    size: 10,
    font: ctx.bold,
    color: on ? GREEN : AMBER,
  });
  ctx.page.drawText(sanitize(label), { x: MARGIN + 26, y: ctx.y, size: 10, font: ctx.font, color: BODY });
  ctx.y -= 16;
}

function newCtx(pdf: PDFDocument, font: PDFFont, bold: PDFFont): DrawCtx {
  return { pdf, page: pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]), y: PAGE_HEIGHT - MARGIN, font, bold };
}

function unitLabel(u: EvidencePackUnit): string {
  return u.unit.unit_number ? `Unit ${u.unit.unit_number}` : u.unit.address_line_1 || 'Unit';
}

const EVENT_LABELS: Record<string, string> = {
  demo_completed: 'Handover demonstration completed',
  guide_issued: 'Home User Guide issued',
  keys_handed: 'Keys handed over',
  aftercare_activated: 'Aftercare activated',
  inspection: 'Inspection',
  other: 'Other event',
};

export async function buildUnitEvidencePdf(
  developmentName: string,
  u: EvidencePackUnit,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ctx = newCtx(pdf, font, bold);

  // Header
  drawText(ctx, developmentName, { size: 10, color: MUTED, gapAfter: 4 });
  drawText(ctx, `${unitLabel(u)}${u.unit.address_line_1 ? ` — ${u.unit.address_line_1}` : ''}`, {
    size: 17,
    bold: true,
    color: INK,
    gapAfter: 4,
  });
  const meta: string[] = [];
  if (u.unit.house_type_code) meta.push(`House type ${u.unit.house_type_code}`);
  if (u.unit.eircode) meta.push(u.unit.eircode);
  meta.push(`Generated ${formatDate(new Date().toISOString())}`);
  drawText(ctx, meta.join('  ·  '), { size: 9, color: MUTED, gapAfter: 8 });
  drawText(ctx, 'HPI QA 8.0 — Consumer Information & Aftercare evidence', {
    size: 9.5,
    color: GOLD,
    bold: true,
    gapAfter: 6,
  });

  // QA 8.0 evidence summary
  drawSectionHeading(ctx, 'Evidence summary');
  drawEvidenceLine(ctx, u.evidence.guide_issued, 'Home User Guide issued to the homeowner');
  drawEvidenceLine(ctx, u.evidence.demo_completed, 'Handover demonstration completed');
  drawEvidenceLine(ctx, u.evidence.aftercare_activated, 'Aftercare activated');
  drawText(
    ctx,
    `Systems documented: ${u.evidence.systems_documented}   ·   With warranty on record: ${u.evidence.systems_with_warranty}`,
    { size: 9, color: MUTED, gapAfter: 4 },
  );
  ensureSpace(ctx, 16);
  ctx.page.drawText(u.evidence.qa8_ready ? 'QA 8.0 READY' : 'QA 8.0 INCOMPLETE', {
    x: MARGIN,
    y: ctx.y,
    size: 11,
    font: bold,
    color: u.evidence.qa8_ready ? GREEN : AMBER,
  });
  ctx.y -= 18;

  // Handover event log
  drawSectionHeading(ctx, 'Handover event log');
  if (u.events.length === 0) {
    drawText(ctx, 'No handover events recorded yet.', { size: 9, color: MUTED });
  }
  for (const e of u.events) {
    const label = EVENT_LABELS[e.event_type] || e.event_type;
    drawText(ctx, `${label} — ${formatDate(e.occurred_at)}`, { size: 9.5, bold: true, gapAfter: 2 });
    const details: string[] = [];
    if (e.conducted_by_name) details.push(`Conducted by ${e.conducted_by_name}`);
    if (e.attended_by) details.push(`Attended by ${e.attended_by}`);
    if (e.acknowledgement_ref) details.push(`Acknowledgement ref ${e.acknowledgement_ref}`);
    if (e.home_user_guide_version != null) details.push(`Guide version ${e.home_user_guide_version}`);
    if (details.length > 0) drawWrapped(ctx, details.join('  ·  '), { size: 8.5, x: MARGIN + 12, color: MUTED });
    if (e.notes) drawWrapped(ctx, e.notes, { size: 8.5, x: MARGIN + 12, color: MUTED });
    ctx.y -= 3;
  }

  // Installed systems
  drawSectionHeading(ctx, 'Installed systems, commissioning & warranties');
  if (u.systems.length === 0) {
    drawText(ctx, 'No systems documented yet.', { size: 9, color: MUTED });
  }
  for (const s of u.systems) {
    const name = [s.system_type?.replace(/_/g, ' '), s.make, s.model].filter(Boolean).join(' — ');
    drawText(ctx, name || 'System', { size: 9.5, bold: true, gapAfter: 2 });
    const bits: string[] = [];
    if (s.serial_number) bits.push(`Serial ${s.serial_number}`);
    if (s.commissioning_date) bits.push(`Commissioned ${formatDate(s.commissioning_date)}`);
    if (s.warranty_start || s.warranty_end)
      bits.push(`Warranty ${formatDate(s.warranty_start)} to ${formatDate(s.warranty_end)}`);
    if (s.maintenance_interval_months) bits.push(`Service every ${s.maintenance_interval_months} months`);
    if (bits.length > 0) drawWrapped(ctx, bits.join('  ·  '), { size: 8.5, x: MARGIN + 12, color: MUTED });
    ctx.y -= 3;
  }

  // Snagging summary
  drawSectionHeading(ctx, 'Snagging record');
  drawText(
    ctx,
    `${u.totalSnagCount} snag${u.totalSnagCount === 1 ? '' : 's'} recorded · ${u.openSnagCount} open`,
    { size: 9.5 },
  );

  // Home User Guide
  drawSectionHeading(ctx, 'Home User Guide');
  if (!u.guide || !u.guide.content) {
    drawText(ctx, 'No Home User Guide issued yet.', { size: 9, color: MUTED });
  } else {
    const g = u.guide.content;
    drawText(
      ctx,
      `Version ${u.guide.version} · ${u.guide.status}${u.guide.issued_at ? ` ${formatDate(u.guide.issued_at)}` : ''}`,
      { size: 8.5, color: MUTED, gapAfter: 6 },
    );
    drawText(ctx, g.title || 'Home User Guide', { size: 12, bold: true, color: INK, gapAfter: 5 });
    if (g.introduction) drawWrapped(ctx, g.introduction, { size: 9 });
    ctx.y -= 4;

    for (const section of g.sections ?? []) {
      renderGuideSection(ctx, section);
    }

    if ((g.general_tips ?? []).length > 0) {
      ctx.y -= 2;
      drawText(ctx, 'General tips', { size: 10, bold: true, color: INK, gapAfter: 4 });
      drawBullets(ctx, g.general_tips);
    }
    if (g.who_to_contact) {
      ctx.y -= 2;
      drawText(ctx, 'Who to contact', { size: 10, bold: true, color: INK, gapAfter: 4 });
      drawWrapped(ctx, g.who_to_contact, { size: 9 });
    }
  }

  return pdf.save();
}

function renderGuideSection(ctx: DrawCtx, section: HomeUserGuideSection): void {
  ctx.y -= 4;
  drawText(ctx, section.heading || 'Section', { size: 10.5, bold: true, color: INK, gapAfter: 4 });
  if (section.summary) drawWrapped(ctx, section.summary, { size: 9 });
  if ((section.how_to_use ?? []).length > 0) {
    drawText(ctx, 'How to use', { size: 8.5, bold: true, color: MUTED, gapAfter: 3 });
    drawBullets(ctx, section.how_to_use);
  }
  if ((section.do_not ?? []).length > 0) {
    drawText(ctx, 'Do not', { size: 8.5, bold: true, color: AMBER, gapAfter: 3 });
    drawBullets(ctx, section.do_not);
  }
  if ((section.seasonal_tips ?? []).length > 0) {
    drawText(ctx, 'Seasonal tips', { size: 8.5, bold: true, color: MUTED, gapAfter: 3 });
    drawBullets(ctx, section.seasonal_tips);
  }
  if ((section.maintenance ?? []).length > 0) {
    drawText(ctx, 'Maintenance', { size: 8.5, bold: true, color: MUTED, gapAfter: 3 });
    drawBullets(ctx, section.maintenance);
  }
  if (section.warranty) drawWrapped(ctx, `Warranty: ${section.warranty}`, { size: 8.5, x: MARGIN + 12, color: MUTED });
}

export async function buildSchemeIndexPdf(
  development: { name: string; address: string | null },
  units: EvidencePackUnit[],
  generatedAt: string,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ctx = newCtx(pdf, font, bold);

  drawText(ctx, 'HPI EVIDENCE PACK', { size: 10, bold: true, color: GOLD, gapAfter: 4 });
  drawText(ctx, development.name, { size: 18, bold: true, color: INK, gapAfter: 4 });
  if (development.address) drawText(ctx, development.address, { size: 9.5, color: MUTED, gapAfter: 4 });
  drawText(ctx, `Generated ${formatDate(generatedAt)}`, { size: 9, color: MUTED, gapAfter: 10 });

  drawWrapped(
    ctx,
    'This pack contains the QA 8.0 (Consumer Information & Aftercare) evidence for each home: the issued Home User Guide, the handover demonstration record, aftercare activation, and the documented building systems with commissioning and warranty details. Stored certificates are listed in manifest.json with secure links (valid 7 days) rather than duplicated into this archive.',
    { size: 9, color: BODY },
  );
  ctx.y -= 8;

  const ready = units.filter((u) => u.evidence.qa8_ready).length;
  drawSectionHeading(ctx, 'Scheme readiness');
  drawText(ctx, `${ready} of ${units.length} homes QA 8.0 ready`, { size: 12, bold: true, color: ready === units.length ? GREEN : AMBER, gapAfter: 8 });
  drawText(
    ctx,
    `Guides issued: ${units.filter((u) => u.evidence.guide_issued).length}/${units.length}   ·   Demos completed: ${units.filter((u) => u.evidence.demo_completed).length}/${units.length}   ·   Aftercare active: ${units.filter((u) => u.evidence.aftercare_activated).length}/${units.length}`,
    { size: 9, color: MUTED, gapAfter: 10 },
  );

  // Per-unit table
  drawSectionHeading(ctx, 'Per-home evidence');
  const cols = [MARGIN, MARGIN + 200, MARGIN + 265, MARGIN + 330, MARGIN + 400, MARGIN + 455];
  ensureSpace(ctx, 16);
  const header = ['UNIT', 'GUIDE', 'DEMO', 'AFTERCARE', 'SYSTEMS', 'READY'];
  header.forEach((h, i) => {
    ctx.page.drawText(h, { x: cols[i], y: ctx.y, size: 7.5, font: bold, color: MUTED });
  });
  ctx.y -= 14;

  for (const u of units) {
    ensureSpace(ctx, 15);
    const row: Array<{ text: string; color?: ReturnType<typeof rgb>; boldText?: boolean }> = [
      { text: unitLabel(u), boldText: true, color: INK },
      { text: tick(u.evidence.guide_issued), color: u.evidence.guide_issued ? GREEN : AMBER },
      { text: tick(u.evidence.demo_completed), color: u.evidence.demo_completed ? GREEN : AMBER },
      { text: tick(u.evidence.aftercare_activated), color: u.evidence.aftercare_activated ? GREEN : AMBER },
      { text: String(u.evidence.systems_documented) },
      { text: u.evidence.qa8_ready ? 'READY' : 'NOT YET', color: u.evidence.qa8_ready ? GREEN : AMBER, boldText: true },
    ];
    row.forEach((cell, i) => {
      ctx.page.drawText(sanitize(cell.text), {
        x: cols[i],
        y: ctx.y,
        size: 8.5,
        font: cell.boldText ? bold : font,
        color: cell.color ?? BODY,
      });
    });
    ctx.y -= 14;
  }

  ctx.y -= 6;
  drawWrapped(
    ctx,
    'Generated by OpenHouse. Each home has a detailed evidence PDF in the units/ folder of this archive.',
    { size: 8, color: MUTED },
  );

  return pdf.save();
}
