/**
 * Applicant types + helpers shared between the list API, detail API and the
 * UI. Keep the DB -> UI mapping in one place so filter tabs, status pills
 * and the signals section never drift out of sync.
 */

export type ApplicationStatus =
  | 'invited'
  | 'received'
  | 'referencing'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'offer_accepted';

export type ReferencesStatus = 'not_requested' | 'requested' | 'partial' | 'complete';
export type AmlStatus = 'not_started' | 'in_progress' | 'complete' | 'flagged';

export interface ApplicantListItem {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  source: string;
  linkedPropertyCount: number;
  latestStatus: ApplicationStatus | null;
  lastActivityAt: string;
  preferredCount: number;
}

export interface ApplicantSignals {
  employmentStatus: string;
  employer: string | null;
  annualIncome: number | null;
  incomeToRentRatio: number | null;
  householdSize: number | null;
  hasPets: boolean | null;
  petDetails: string | null;
  smoker: boolean | null;
  referencesStatus: ReferencesStatus | null;
  amlStatus: AmlStatus | null;
}

export interface ApplicantDetail extends ApplicantListItem {
  currentAddress: string | null;
  budgetMonthly: number | null;
  requestedMoveInDate: string | null;
  notes: string | null;
  signals: ApplicantSignals;
  viewings: Array<{
    id: string;
    propertyAddress: string | null;
    viewingDate: string;
    wasPreferred: boolean;
    interestLevel: string | null;
  }>;
  applications: Array<{
    id: string;
    propertyAddress: string | null;
    rentPcm: number | null;
    status: ApplicationStatus;
    referencesStatus: ReferencesStatus;
    amlStatus: AmlStatus;
    applicationDate: string;
  }>;
}

const EMPLOYMENT_LABELS: Record<string, string> = {
  employed: 'Employed',
  self_employed: 'Self-employed',
  student: 'Student',
  unemployed: 'Unemployed',
  retired: 'Retired',
  unknown: 'Not known',
};

export function employmentLabel(status: string): string {
  return EMPLOYMENT_LABELS[status] || 'Not known';
}

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  invited: 'Invited',
  received: 'Received',
  referencing: 'Referencing',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  offer_accepted: 'Offer accepted',
};

export function applicationStatusLabel(status: string | null): string {
  if (!status) return 'No application yet';
  return APPLICATION_STATUS_LABELS[status] || status;
}

const REFERENCES_LABELS: Record<string, string> = {
  not_requested: 'Not requested',
  requested: 'Requested',
  partial: 'Partial',
  complete: 'Complete',
};

export function referencesLabel(status: string | null | undefined): string {
  if (!status) return 'Not requested';
  return REFERENCES_LABELS[status] || status;
}

const AML_LABELS: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  complete: 'Complete',
  flagged: 'Flagged',
};

export function amlLabel(status: string | null | undefined): string {
  if (!status) return 'Not started';
  return AML_LABELS[status] || status;
}

/**
 * Income-to-rent ratio as a simple multiple (annual income / annual rent).
 * Letting agents scan this in seconds — 2.5x and up is conventional Irish
 * affordability, but we surface the raw number and let the agent decide.
 */
export function computeIncomeToRentRatio(
  annualIncome: number | null,
  rentPcm: number | null,
): number | null {
  if (!annualIncome || !rentPcm || rentPcm <= 0) return null;
  return annualIncome / (rentPcm * 12);
}

export function formatCurrency(value: number | null | undefined, locale = 'en-IE'): string {
  if (value == null) return 'Not known';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}
