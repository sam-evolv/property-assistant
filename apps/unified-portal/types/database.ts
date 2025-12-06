export interface Unit {
  id: string;
  created_at: string;
  user_id: string | null;
  unit_type_id: string | null;
  project_id: string | null;
  unit_number: string | null;
}

export interface UnitType {
  id: string;
  created_at: string;
  project_id: string | null;
  type_name: string | null;
  floor_plan_pdf_url: string | null;
  total_area_sqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
}

export interface Project {
  id: string;
  created_at: string;
  name: string | null;
  description: string | null;
  location: string | null;
}

export interface DocumentSection {
  id: string;
  created_at: string;
  project_id: string | null;
  content: string;
  embedding: number[] | null;
  source_document: string | null;
  section_title: string | null;
}

export interface ChatRouterResult {
  type: 'floor_plan' | 'vector_search';
  floorPlanUrl?: string;
  unitType?: UnitType;
  context?: string;
  chunks?: DocumentSection[];
}
