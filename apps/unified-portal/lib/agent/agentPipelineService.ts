import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// ── Types ──

export interface PipelineUnit {
  id: string;  // pipeline id
  unitId: string;
  unitNumber: string;
  unitAddress: string;
  developmentId: string;
  developmentName: string;
  bedrooms: number | null;
  unitTypeName: string | null;
  status: 'for_sale' | 'sale_agreed' | 'contracts_issued' | 'signed' | 'sold';
  purchaserName: string | null;
  purchaserEmail: string | null;
  purchaserPhone: string | null;
  salePrice: number | null;
  saleAgreedDate: string | null;
  depositDate: string | null;
  contractsIssuedDate: string | null;
  signedContractsDate: string | null;
  counterSignedDate: string | null;
  kitchenDate: string | null;
  kitchenSelected: boolean | null;
  snagDate: string | null;
  estimatedCloseDate: string | null;
  handoverDate: string | null;
  mortgageExpiryDate: string | null;
  comments: string | null; // JSON string
}

export interface PipelineNote {
  id: string;
  pipelineId: string;
  unitId: string;
  noteType: string;
  content: string;
  isResolved: boolean;
  createdAt: string;
}

export interface UnitProfile extends PipelineUnit {
  notes: PipelineNote[];
  solicitor: { firm: string; contact: string; phone: string; email: string } | null;
  mortgage: { lender: string; approval_amount: number; expiry_date: string } | null;
}

export interface Alert {
  type: 'overdue_contracts' | 'mortgage_expiry';
  pipelineId: string;
  unitId: string;
  unitNumber: string;
  purchaserName: string;
  developmentName: string;
  daysOverdue?: number;
  daysUntilExpiry?: number;
  message: string;
}

export interface SolicitorGroup {
  firm: string;
  contact: string;
  phone: string;
  email: string;
  units: { unitId: string; unitNumber: string; purchaserName: string; pipelineId: string; status: string }[];
}

export interface AgentProfile {
  id: string;
  displayName: string;
  agencyName: string;
  phone: string;
  email: string;
  tenantId: string;
}

// ── Helper to parse comments JSON ──
function parseComments(comments: string | null): { solicitor?: any; mortgage?: any; intelligence_log?: any[] } {
  if (!comments) return {};
  try {
    return JSON.parse(comments);
  } catch {
    return {};
  }
}

// ── Service functions ──

const supabase = createClientComponentClient();

// Get agent profile by preview mode or user_id
export async function getAgentProfile(preview?: string): Promise<AgentProfile | null> {
  // If preview=savills, load Sarah Cronin directly
  if (preview === 'savills') {
    return {
      id: 'c3d4e5f6-a7b8-9012-cdef-345678901234',
      displayName: 'Sarah Cronin',
      agencyName: 'Savills Ireland',
      phone: '021 427 0000',
      email: 'sarah.cronin@savills.ie',
      tenantId: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('agent_profiles')
    .select('id, display_name, agency_name, phone, email, tenant_id')
    .eq('user_id', user.id)
    .single();

  if (!data) return null;
  return {
    id: data.id,
    displayName: data.display_name,
    agencyName: data.agency_name,
    phone: data.phone,
    email: data.email,
    tenantId: data.tenant_id,
  };
}

// Get assigned development IDs for agent
export async function getAgentAssignments(agentId: string): Promise<string[]> {
  // For the Savills preview, return Riverside Gardens
  if (agentId === 'c3d4e5f6-a7b8-9012-cdef-345678901234') {
    return ['84a559d1-89f1-4eb6-a48b-7ca068bcc164'];
  }

  const { data } = await supabase
    .from('agent_scheme_assignments')
    .select('development_id')
    .eq('agent_id', agentId)
    .eq('is_active', true);

  return (data || []).map(d => d.development_id);
}

// Get all pipeline records for a development
export async function getAgentPipeline(agentId: string, developmentId: string): Promise<PipelineUnit[]> {
  // Query pipeline with unit join
  const { data: pipelineData, error } = await supabase
    .from('unit_sales_pipeline')
    .select(`
      id, unit_id, status, purchaser_name, purchaser_email, purchaser_phone,
      sale_price, sale_agreed_date, deposit_date, contracts_issued_date,
      signed_contracts_date, counter_signed_date, kitchen_date, kitchen_selected,
      snag_date, estimated_close_date, handover_date, mortgage_expiry_date, comments
    `)
    .eq('development_id', developmentId)
    .order('created_at', { ascending: true });

  if (error || !pipelineData) return [];

  // Get units for this development
  const { data: units } = await supabase
    .from('units')
    .select('id, unit_number, address, bedrooms, unit_type_id')
    .eq('development_id', developmentId);

  // Get development name
  const { data: dev } = await supabase
    .from('developments')
    .select('name')
    .eq('id', developmentId)
    .single();

  const unitMap = new Map((units || []).map(u => [u.id, u]));

  return pipelineData.map(p => {
    const unit = unitMap.get(p.unit_id);
    return {
      id: p.id,
      unitId: p.unit_id,
      unitNumber: unit?.unit_number || 'Unknown',
      unitAddress: unit?.address || '',
      developmentId,
      developmentName: dev?.name || '',
      bedrooms: unit?.bedrooms || null,
      unitTypeName: null,
      status: p.status as PipelineUnit['status'],
      purchaserName: p.purchaser_name,
      purchaserEmail: p.purchaser_email,
      purchaserPhone: p.purchaser_phone,
      salePrice: p.sale_price ? Number(p.sale_price) : null,
      saleAgreedDate: p.sale_agreed_date,
      depositDate: p.deposit_date,
      contractsIssuedDate: p.contracts_issued_date,
      signedContractsDate: p.signed_contracts_date,
      counterSignedDate: p.counter_signed_date,
      kitchenDate: p.kitchen_date,
      kitchenSelected: p.kitchen_selected,
      snagDate: p.snag_date,
      estimatedCloseDate: p.estimated_close_date,
      handoverDate: p.handover_date,
      mortgageExpiryDate: p.mortgage_expiry_date,
      comments: p.comments,
    };
  });
}

// Get single unit profile with notes
export async function getUnitProfile(unitId: string, developmentId: string): Promise<UnitProfile | null> {
  const pipeline = await getAgentPipeline('', developmentId);
  const unit = pipeline.find(p => p.unitId === unitId);
  if (!unit) return null;

  // Get notes
  const { data: notesData } = await supabase
    .from('unit_pipeline_notes')
    .select('id, pipeline_id, unit_id, note_type, content, is_resolved, created_at')
    .eq('unit_id', unitId)
    .order('created_at', { ascending: false });

  const notes: PipelineNote[] = (notesData || []).map(n => ({
    id: n.id,
    pipelineId: n.pipeline_id,
    unitId: n.unit_id,
    noteType: n.note_type,
    content: n.content,
    isResolved: n.is_resolved,
    createdAt: n.created_at,
  }));

  const parsed = parseComments(unit.comments);

  return {
    ...unit,
    notes,
    solicitor: parsed.solicitor || null,
    mortgage: parsed.mortgage || null,
  };
}

// Get urgent alerts
export function getAgentAlerts(pipeline: PipelineUnit[]): Alert[] {
  const now = new Date();
  const alerts: Alert[] = [];

  for (const p of pipeline) {
    // Overdue contracts: issued > 60 days ago, not signed
    if (p.contractsIssuedDate && !p.signedContractsDate && p.status !== 'sold') {
      const issued = new Date(p.contractsIssuedDate);
      const daysSince = Math.floor((now.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince > 60) {
        alerts.push({
          type: 'overdue_contracts',
          pipelineId: p.id,
          unitId: p.unitId,
          unitNumber: p.unitNumber,
          purchaserName: p.purchaserName || 'Unknown',
          developmentName: p.developmentName,
          daysOverdue: daysSince,
          message: `${daysSince} days overdue: solicitor follow-up needed`,
        });
      }
    }

    // Mortgage expiry within 45 days
    if (p.mortgageExpiryDate && p.status !== 'sold') {
      const expiry = new Date(p.mortgageExpiryDate);
      const daysUntil = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 45 && daysUntil > 0) {
        alerts.push({
          type: 'mortgage_expiry',
          pipelineId: p.id,
          unitId: p.unitId,
          unitNumber: p.unitNumber,
          purchaserName: p.purchaserName || 'Unknown',
          developmentName: p.developmentName,
          daysUntilExpiry: daysUntil,
          message: `Mortgage approval expiring in ${daysUntil} days`,
        });
      }
    }
  }

  // Sort: overdue first (highest days), then mortgage expiry (lowest days)
  return alerts.sort((a, b) => {
    if (a.type === 'overdue_contracts' && b.type === 'mortgage_expiry') return -1;
    if (a.type === 'mortgage_expiry' && b.type === 'overdue_contracts') return 1;
    if (a.type === 'overdue_contracts') return (b.daysOverdue || 0) - (a.daysOverdue || 0);
    return (a.daysUntilExpiry || 0) - (b.daysUntilExpiry || 0);
  });
}

// Log a note
export async function logPipelineNote(
  unitId: string,
  pipelineId: string,
  content: string,
  noteType: string = 'manual',
  tenantId: string = '4cee69c6-be4b-486e-9c33-2b5a7d30e287'
): Promise<boolean> {
  const { error } = await supabase
    .from('unit_pipeline_notes')
    .insert({
      tenant_id: tenantId,
      pipeline_id: pipelineId,
      unit_id: unitId,
      note_type: noteType,
      content,
      created_by: '32a250fb-279f-40fb-949a-bf10630c8808',
    });
  return !error;
}

// Get solicitor directory grouped by firm
export function getSolicitorDirectory(pipeline: PipelineUnit[]): SolicitorGroup[] {
  const firmMap = new Map<string, SolicitorGroup>();

  for (const p of pipeline) {
    const parsed = parseComments(p.comments);
    if (!parsed.solicitor?.firm) continue;

    const key = parsed.solicitor.firm;
    if (!firmMap.has(key)) {
      firmMap.set(key, {
        firm: parsed.solicitor.firm,
        contact: parsed.solicitor.contact || '',
        phone: parsed.solicitor.phone || '',
        email: parsed.solicitor.email || '',
        units: [],
      });
    }

    firmMap.get(key)!.units.push({
      unitId: p.unitId,
      unitNumber: p.unitNumber,
      purchaserName: p.purchaserName || 'Available',
      pipelineId: p.id,
      status: p.status,
    });
  }

  return Array.from(firmMap.values()).sort((a, b) => b.units.length - a.units.length);
}

// Mark unit as sold
export async function markUnitAsSold(unitId: string, pipelineId: string, handoverDate: string): Promise<boolean> {
  const { error } = await supabase
    .from('unit_sales_pipeline')
    .update({ status: 'sold', handover_date: handoverDate })
    .eq('id', pipelineId);
  return !error;
}

// ── Date formatting helpers ──

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '';
  return '\u20AC' + amount.toLocaleString('en-IE');
}

export function daysFromNow(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(/[\s&]+/)
    .filter(w => w.length > 0 && w[0] === w[0].toUpperCase())
    .slice(0, 2)
    .map(w => w[0])
    .join('');
}

// Generate AI intelligence summary from pipeline data
export function generateIntelligenceSummary(unit: UnitProfile): string {
  const parts: string[] = [];

  if (unit.contractsIssuedDate && !unit.signedContractsDate) {
    const days = daysSince(unit.contractsIssuedDate);
    if (days && days > 60) {
      parts.push(`Contracts ${days} days overdue`);
    }
  }

  if (unit.mortgageExpiryDate) {
    const days = daysFromNow(unit.mortgageExpiryDate);
    if (days !== null && days <= 45) {
      parts.push(`Mortgage expires in ${days} days`);
    }
  }

  if (unit.notes.length > 0) {
    parts.push(`Last contact ${formatDateShort(unit.notes[0].createdAt)}`);
  }

  if (unit.snagDate) {
    const days = daysFromNow(unit.snagDate);
    if (days !== null && days > 0) {
      parts.push(`Snag scheduled ${formatDateShort(unit.snagDate)}`);
    }
  }

  if (parts.length === 0) {
    if (unit.status === 'for_sale') return 'Unit available for sale';
    if (unit.status === 'sold') return `Handed over ${formatDate(unit.handoverDate)}`;
    return 'No issues flagged';
  }

  return parts.join('. ') + '.';
}

// Check timeline nudge flags
export function getTimelineNudges(unit: PipelineUnit): string[] {
  const nudges: string[] = [];

  // Sale Agreed but no deposit after 14 days
  if (unit.saleAgreedDate && !unit.depositDate) {
    const days = daysSince(unit.saleAgreedDate);
    if (days && days > 14) nudges.push('deposit_overdue');
  }

  // Contracts issued but not signed after 60 days
  if (unit.contractsIssuedDate && !unit.signedContractsDate) {
    const days = daysSince(unit.contractsIssuedDate);
    if (days && days > 60) nudges.push('contracts_overdue');
  }

  // Signed but no snag after 30 days
  if (unit.signedContractsDate && !unit.snagDate) {
    const days = daysSince(unit.signedContractsDate);
    if (days && days > 30) nudges.push('snag_overdue');
  }

  return nudges;
}
