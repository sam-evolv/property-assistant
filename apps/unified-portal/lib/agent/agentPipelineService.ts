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

export interface PropertySpec {
  type: string;
  sqMetres: number;
  sqFeet: number;
  ber: string;
  floors: number;
  parking: string;
  heating: string;
  orientation: string;
}

export interface UnitProfile extends PipelineUnit {
  notes: PipelineNote[];
  solicitor: { firm: string; contact: string; phone: string; email: string } | null;
  mortgage: { lender: string; approval_amount: number; expiry_date: string } | null;
  propertySpec: PropertySpec | null;
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

export type AgentType = 'scheme' | 'independent' | 'hybrid';

export interface AgentProfile {
  id: string;
  displayName: string;
  agencyName: string;
  phone: string;
  email: string;
  tenantId: string;
  agentType: AgentType;
  bio: string | null;
  location: string | null;
  specialisations: string[] | null;
}

export interface DevelopmentSummary {
  id: string;
  name: string;
  totalUnits: number;
  forSale: number;
  saleAgreed: number;
  contracted: number;
  signed: number;
  sold: number;
  percentSold: number;
}

// ── Property specs by bedroom count (standard for Irish residential developments) ──
const PROPERTY_SPECS: Record<number, PropertySpec> = {
  2: { type: '2-bed T', sqMetres: 82, sqFeet: 883, ber: 'A2', floors: 2, parking: '1 allocated space', heating: 'Air-to-water heat pump', orientation: 'South-facing' },
  3: { type: '3-bed SD', sqMetres: 115, sqFeet: 1238, ber: 'A2', floors: 2, parking: '2 allocated spaces', heating: 'Air-to-water heat pump', orientation: 'South-facing' },
  4: { type: '4-bed D', sqMetres: 148, sqFeet: 1593, ber: 'A1', floors: 2, parking: '2 allocated spaces + driveway', heating: 'Air-to-water heat pump', orientation: 'South-facing' },
};

function getPropertySpec(bedrooms: number | null): PropertySpec | null {
  if (!bedrooms) return null;
  return PROPERTY_SPECS[bedrooms] || PROPERTY_SPECS[3];
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

// Normalize status values from DB (some records use 'agreed' instead of 'sale_agreed')
function normalizeStatus(status: string): PipelineUnit['status'] {
  if (status === 'agreed') return 'sale_agreed';
  if (['for_sale', 'sale_agreed', 'contracts_issued', 'signed', 'sold'].includes(status)) {
    return status as PipelineUnit['status'];
  }
  return 'for_sale';
}

// Numeric sort helper for unit numbers
function unitNumberSort(a: string, b: string): number {
  const aNum = parseInt(a) || 0;
  const bNum = parseInt(b) || 0;
  if (aNum !== bNum) return aNum - bNum;
  return a.localeCompare(b);
}

// ── Service functions ──

const supabase = createClientComponentClient();

// Get agent profile: try auth first, fallback to first profile in DB
export async function getAgentProfile(preview?: string): Promise<AgentProfile | null> {
  if (preview === 'savills') {
    return {
      id: 'c3d4e5f6-a7b8-9012-cdef-345678901234',
      displayName: 'Sarah Cronin',
      agencyName: 'Savills Ireland',
      phone: '021 427 0000',
      email: 'sarah.cronin@savills.ie',
      tenantId: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
      agentType: 'scheme' as AgentType,
      bio: null,
      location: null,
      specialisations: null,
    };
  }

  // Try auth-based lookup first
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('agent_profiles')
        .select('id, display_name, agency_name, phone, email, tenant_id, agent_type, bio, location, specialisations')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (data) {
        return {
          id: data.id,
          displayName: data.display_name,
          agencyName: data.agency_name,
          phone: data.phone,
          email: data.email,
          tenantId: data.tenant_id,
          agentType: (data.agent_type || 'scheme') as AgentType,
          bio: data.bio || null,
          location: data.location || null,
          specialisations: data.specialisations || null,
        };
      }
    }
  } catch {
    // Auth not available, fall through
  }

  // Fallback: load first agent profile (Sam Donworth for demo/preview)
  const { data } = await supabase
    .from('agent_profiles')
    .select('id, display_name, agency_name, phone, email, tenant_id, agent_type, bio, location, specialisations')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (!data) return null;
  return {
    id: data.id,
    displayName: data.display_name,
    agencyName: data.agency_name,
    phone: data.phone,
    email: data.email,
    tenantId: data.tenant_id,
    agentType: (data.agent_type || 'scheme') as AgentType,
    bio: data.bio || null,
    location: data.location || null,
    specialisations: data.specialisations || null,
  };
}

// Get assigned development IDs for agent
export async function getAgentAssignments(agentId: string): Promise<string[]> {
  const { data } = await supabase
    .from('agent_scheme_assignments')
    .select('development_id')
    .eq('agent_id', agentId)
    .eq('is_active', true);

  return (data || []).map(d => d.development_id);
}

// Get assigned development IDs with names (uses agent_scheme_assignments which always passes RLS)
export async function getAgentAssignmentsWithNames(agentId: string): Promise<Map<string, string>> {
  const { data } = await supabase
    .from('agent_scheme_assignments')
    .select('development_id, developments!inner(id, name)')
    .eq('agent_id', agentId)
    .eq('is_active', true);

  const map = new Map<string, string>();
  for (const d of data || []) {
    const dev = d.developments as any;
    if (dev?.name) map.set(d.development_id, dev.name);
  }
  return map;
}

// Get all pipeline records for a development, sorted by unit number
export async function getAgentPipeline(agentId: string, developmentId: string, knownDevName?: string): Promise<PipelineUnit[]> {
  const { data: pipelineData, error } = await supabase
    .from('unit_sales_pipeline')
    .select(`
      id, unit_id, status, purchaser_name, purchaser_email, purchaser_phone,
      sale_price, sale_agreed_date, deposit_date, contracts_issued_date,
      signed_contracts_date, counter_signed_date, kitchen_date, kitchen_selected,
      snag_date, estimated_close_date, handover_date, mortgage_expiry_date, comments
    `)
    .eq('development_id', developmentId);

  if (error || !pipelineData) return [];

  const { data: units } = await supabase
    .from('units')
    .select('id, unit_number, address, bedrooms, unit_type_id')
    .eq('development_id', developmentId);

  // Use pre-fetched name if available, otherwise query (may fail if RLS blocks)
  let devName = knownDevName || '';
  if (!devName) {
    const { data: dev } = await supabase
      .from('developments')
      .select('name')
      .eq('id', developmentId)
      .single();
    devName = dev?.name || '';
  }

  const unitMap = new Map((units || []).map(u => [u.id, u]));

  const result = pipelineData.map(p => {
    const unit = unitMap.get(p.unit_id);
    return {
      id: p.id,
      unitId: p.unit_id,
      unitNumber: unit?.unit_number || 'Unknown',
      unitAddress: unit?.address || '',
      developmentId,
      developmentName: devName,
      bedrooms: unit?.bedrooms || null,
      unitTypeName: null,
      status: normalizeStatus(p.status || 'for_sale'),
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

  // Sort by unit number numerically
  result.sort((a, b) => unitNumberSort(a.unitNumber, b.unitNumber));
  return result;
}

// Get pipeline for ALL developments — includes available units without pipeline records
export async function getAgentPipelineAll(agentId: string, developmentIds: string[]): Promise<PipelineUnit[]> {
  // Pre-fetch development names via agent_scheme_assignments join (always passes agent RLS)
  const devNameMap = await getAgentAssignmentsWithNames(agentId);

  // Fallback: also try direct developments query (now has agent RLS policy)
  if (devNameMap.size === 0 && developmentIds.length > 0) {
    const { data: devNames } = await supabase
      .from('developments')
      .select('id, name')
      .in('id', developmentIds);
    for (const d of devNames || []) {
      devNameMap.set(d.id, d.name);
    }
  }

  const allUnits: PipelineUnit[] = [];
  for (const devId of developmentIds) {
    const knownName = devNameMap.get(devId) || '';
    const units = await getAgentPipeline(agentId, devId, knownName);
    allUnits.push(...units);

    // Include units that have no pipeline record (truly available/for_sale)
    const pipelineUnitIds = new Set(units.map(u => u.unitId));
    const { data: allDevUnits } = await supabase
      .from('units')
      .select('id, unit_number, address, bedrooms')
      .eq('development_id', devId);

    for (const u of (allDevUnits || [])) {
      if (!pipelineUnitIds.has(u.id)) {
        allUnits.push({
          id: `virtual_${u.id}`,
          unitId: u.id,
          unitNumber: u.unit_number || 'Unknown',
          unitAddress: u.address || '',
          developmentId: devId,
          developmentName: devNameMap.get(devId) || '',
          bedrooms: u.bedrooms || null,
          unitTypeName: null,
          status: 'for_sale',
          purchaserName: null,
          purchaserEmail: null,
          purchaserPhone: null,
          salePrice: null,
          saleAgreedDate: null,
          depositDate: null,
          contractsIssuedDate: null,
          signedContractsDate: null,
          counterSignedDate: null,
          kitchenDate: null,
          kitchenSelected: null,
          snagDate: null,
          estimatedCloseDate: null,
          handoverDate: null,
          mortgageExpiryDate: null,
          comments: null,
        });
      }
    }
  }
  return allUnits;
}

// Get development summaries from pipeline data
export function getDevelopmentSummaries(pipeline: PipelineUnit[]): DevelopmentSummary[] {
  const devMap = new Map<string, PipelineUnit[]>();
  for (const p of pipeline) {
    if (!devMap.has(p.developmentId)) devMap.set(p.developmentId, []);
    devMap.get(p.developmentId)!.push(p);
  }

  const summaries: DevelopmentSummary[] = [];
  for (const [devId, units] of devMap) {
    const total = units.length;
    const sold = units.filter(u => u.status === 'sold').length;
    summaries.push({
      id: devId,
      name: units[0]?.developmentName || 'Unknown',
      totalUnits: total,
      forSale: units.filter(u => u.status === 'for_sale').length,
      saleAgreed: units.filter(u => u.status === 'sale_agreed').length,
      contracted: units.filter(u => u.status === 'contracts_issued').length,
      signed: units.filter(u => u.status === 'signed').length,
      sold,
      percentSold: total > 0 ? Math.round((sold / total) * 100) : 0,
    });
  }

  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

// Get single unit profile with notes
export async function getUnitProfile(unitId: string, allPipeline: PipelineUnit[]): Promise<UnitProfile | null> {
  const unit = allPipeline.find(p => p.unitId === unitId);
  if (!unit) return null;

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
    propertySpec: getPropertySpec(unit.bedrooms),
  };
}

// Get urgent alerts
export function getAgentAlerts(pipeline: PipelineUnit[]): Alert[] {
  const now = new Date();
  const alerts: Alert[] = [];

  for (const p of pipeline) {
    if (p.contractsIssuedDate && !p.signedContractsDate && p.status !== 'sold') {
      const issued = new Date(p.contractsIssuedDate);
      const daysSinceVal = Math.floor((now.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceVal > 60) {
        alerts.push({
          type: 'overdue_contracts',
          pipelineId: p.id,
          unitId: p.unitId,
          unitNumber: p.unitNumber,
          purchaserName: p.purchaserName || 'Unknown',
          developmentName: p.developmentName,
          daysOverdue: daysSinceVal,
          message: `${daysSinceVal} days overdue: solicitor follow-up needed`,
        });
      }
    }

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

export function getTimelineNudges(unit: PipelineUnit): string[] {
  const nudges: string[] = [];

  if (unit.saleAgreedDate && !unit.depositDate) {
    const days = daysSince(unit.saleAgreedDate);
    if (days && days > 14) nudges.push('deposit_overdue');
  }

  if (unit.contractsIssuedDate && !unit.signedContractsDate) {
    const days = daysSince(unit.contractsIssuedDate);
    if (days && days > 60) nudges.push('contracts_overdue');
  }

  if (unit.signedContractsDate && !unit.snagDate) {
    const days = daysSince(unit.signedContractsDate);
    if (days && days > 30) nudges.push('snag_overdue');
  }

  return nudges;
}
