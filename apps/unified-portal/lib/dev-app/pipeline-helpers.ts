/**
 * Pipeline stage derivation from unit_sales_pipeline date columns.
 *
 * The unit_sales_pipeline table uses date columns instead of a single
 * "stage" string. This helper derives the current stage and related
 * metadata from those dates.
 */

// Ordered pipeline stages (earliest → latest)
export const PIPELINE_STAGES = [
  { key: 'release_date', label: 'Released' },
  { key: 'sale_agreed_date', label: 'Sale Agreed' },
  { key: 'deposit_date', label: 'Deposit Received' },
  { key: 'contracts_issued_date', label: 'Contracts Issued' },
  { key: 'signed_contracts_date', label: 'Contracts Signed' },
  { key: 'counter_signed_date', label: 'Counter Signed' },
  { key: 'kitchen_date', label: 'Kitchen Complete' },
  { key: 'snag_date', label: 'Snagging Complete' },
  { key: 'drawdown_date', label: 'Drawdown' },
  { key: 'handover_date', label: 'Handover Complete' },
] as const;

// Stages that count as "sold" (from Sale Agreed onward)
const SOLD_THRESHOLD_INDEX = 1; // sale_agreed_date

interface PipelineRow {
  [key: string]: any;
}

/**
 * Derive the current stage label and its date from a pipeline row.
 */
export function derivePipelineStage(row: PipelineRow): {
  stage: string;
  stageDate: string | null;
  stageIndex: number;
} {
  let lastStageIndex = -1;
  let lastStageDate: string | null = null;

  for (let i = 0; i < PIPELINE_STAGES.length; i++) {
    const dateVal = row[PIPELINE_STAGES[i].key];
    if (dateVal) {
      lastStageIndex = i;
      lastStageDate = dateVal;
    }
  }

  if (lastStageIndex < 0) {
    return { stage: 'Not Started', stageDate: null, stageIndex: -1 };
  }

  return {
    stage: PIPELINE_STAGES[lastStageIndex].label,
    stageDate: lastStageDate,
    stageIndex: lastStageIndex,
  };
}

/**
 * Calculate days at the current stage.
 */
export function daysAtStage(row: PipelineRow): number {
  const { stageDate } = derivePipelineStage(row);
  if (!stageDate) return 0;
  return Math.floor(
    (Date.now() - new Date(stageDate).getTime()) / 86400000
  );
}

/**
 * Check if a unit counts as "sold" (Sale Agreed or later).
 */
export function isSold(row: PipelineRow): boolean {
  return derivePipelineStage(row).stageIndex >= SOLD_THRESHOLD_INDEX;
}

/**
 * Check if a unit is fully handed over.
 */
export function isHandedOver(row: PipelineRow): boolean {
  return !!row.handover_date;
}

/**
 * Columns to select from unit_sales_pipeline for stage derivation.
 */
export const PIPELINE_SELECT_COLUMNS = [
  'unit_id',
  'purchaser_name',
  'purchaser_email',
  'purchaser_phone',
  'release_date',
  'sale_agreed_date',
  'deposit_date',
  'contracts_issued_date',
  'signed_contracts_date',
  'counter_signed_date',
  'kitchen_date',
  'snag_date',
  'drawdown_date',
  'handover_date',
  'updated_at',
].join(', ');

/**
 * Map compliance_documents status to display status.
 * DB values: 'missing' | 'uploaded' | 'verified' | 'expired'
 * Display:   'missing' | 'pending'  | 'complete' | 'overdue'
 */
export function mapComplianceStatus(
  dbStatus: string
): 'missing' | 'pending' | 'complete' | 'overdue' {
  switch (dbStatus) {
    case 'verified':
      return 'complete';
    case 'uploaded':
      return 'pending';
    case 'expired':
      return 'overdue';
    default:
      return 'missing';
  }
}
