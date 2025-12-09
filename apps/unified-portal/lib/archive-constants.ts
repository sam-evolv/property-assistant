/**
 * Smart Archive Constants
 * 
 * Shared constants for the Smart Archive feature.
 * This file can be imported by both client and server components.
 */

export type DisciplineType = 
  | 'architectural'
  | 'structural'
  | 'mechanical'
  | 'electrical'
  | 'plumbing'
  | 'civil'
  | 'landscape'
  | 'handover'
  | 'other';

export interface DisciplineSummary {
  discipline: DisciplineType;
  displayName: string;
  fileCount: number;
  lastUpdated: string | null;
}

export interface ArchiveDocument {
  id: string;
  title: string;
  file_name: string;
  file_url: string | null;
  storage_url: string | null;
  discipline: string | null;
  revision_code: string | null;
  doc_kind: string | null;
  house_type_code: string | null;
  is_important: boolean;
  must_read?: boolean;
  ai_classified?: boolean;
  folder_id?: string | null;
  mime_type: string | null;
  size_kb: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface FetchDocumentsResult {
  documents: ArchiveDocument[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const DISCIPLINES: Record<DisciplineType, { label: string; description: string; icon: string; color: string }> = {
  architectural: { label: 'Architectural', description: 'Floor plans, elevations, sections, details', icon: 'Building2', color: '#3b82f6' },
  structural: { label: 'Structural', description: 'Structural drawings, calculations, foundations', icon: 'Hammer', color: '#f97316' },
  mechanical: { label: 'Mechanical', description: 'HVAC systems, ventilation, heating', icon: 'Cog', color: '#22c55e' },
  electrical: { label: 'Electrical', description: 'Electrical layouts, lighting, power systems', icon: 'Zap', color: '#eab308' },
  plumbing: { label: 'Plumbing', description: 'Water supply, drainage, sanitary systems', icon: 'Droplet', color: '#06b6d4' },
  civil: { label: 'Civil', description: 'Site works, roads, drainage, earthworks', icon: 'Mountain', color: '#a16207' },
  landscape: { label: 'Landscape', description: 'Landscaping plans, planting, hardscape', icon: 'Trees', color: '#10b981' },
  handover: { label: 'Handover Documentation', description: 'Handover packs, certificates, warranties, manuals', icon: 'ClipboardCheck', color: '#8b5cf6' },
  other: { label: 'Other', description: 'Other documents and uncategorised files', icon: 'Files', color: '#6b7280' },
};

export function getDisciplineDisplayName(discipline: string | null): string {
  if (!discipline) return 'Other';
  const key = discipline.toLowerCase() as DisciplineType;
  return DISCIPLINES[key]?.label || discipline;
}

export function getDisciplineInfo(discipline: string | null): { label: string; description: string; icon: string; color: string } {
  if (!discipline) return DISCIPLINES.other;
  const key = discipline.toLowerCase() as DisciplineType;
  return DISCIPLINES[key] || DISCIPLINES.other;
}
