export type ProjectType = 'bts' | 'btr' | 'mixed';
export type UnitMode = 'sale' | 'rent';
export type UnitStatus = 'available' | 'occupied' | 'vacant' | 'void' | 'maintenance';

export type TenancyStatus = 'pending' | 'active' | 'notice_given' | 'ended' | 'cancelled';

export interface Tenancy {
  id: string;
  unit_id: string;
  development_id: string;
  tenant_id?: string;
  tenant_name: string;
  tenant_email?: string;
  tenant_phone?: string;
  lease_start: string;
  lease_end?: string;
  move_in_date?: string;
  move_out_date?: string;
  status: TenancyStatus;
  access_code?: string;
  monthly_rent?: number;
  deposit_amount?: number;
  deposit_held?: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type MaintenanceCategory =
  | 'plumbing' | 'electrical' | 'heating' | 'structural'
  | 'appliance' | 'pest' | 'exterior' | 'common_area' | 'general';

export type MaintenancePriority = 'emergency' | 'urgent' | 'routine' | 'low';

export type MaintenanceStatus =
  | 'submitted' | 'acknowledged' | 'assigned' | 'in_progress'
  | 'awaiting_parts' | 'scheduled' | 'resolved' | 'closed' | 'cancelled';

export interface MaintenanceRequest {
  id: string;
  unit_id: string;
  development_id: string;
  tenancy_id?: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  title: string;
  description: string;
  photos: string[];
  status: MaintenanceStatus;
  assigned_to?: string;
  assigned_vendor?: string;
  scheduled_date?: string;
  scheduled_time_slot?: string;
  resolved_at?: string;
  resolution_notes?: string;
  resolution_cost?: number;
  tenant_rating?: number;
  tenant_feedback?: string;
  ai_diagnosis?: string;
  ai_suggested_category?: string;
  ai_suggested_priority?: string;
  is_warranty_claim?: boolean;
  is_recurring?: boolean;
  related_request_id?: string;
  created_at: string;
  updated_at: string;
  acknowledged_at?: string;
  first_response_at?: string;
  unit?: { address: string };
  tenancy?: { tenant_name: string };
}

export type ComplianceType =
  | 'fire_safety' | 'gas_safety' | 'electrical' | 'ber_cert'
  | 'smoke_co_detectors' | 'legionella' | 'lift_inspection'
  | 'insurance' | 'rtu_registration' | 'custom';

export type ComplianceStatus = 'upcoming' | 'due_soon' | 'overdue' | 'completed' | 'not_applicable';

export interface ComplianceItem {
  id: string;
  development_id: string;
  unit_id?: string;
  type: ComplianceType;
  title: string;
  description?: string;
  due_date: string;
  completed_date?: string;
  recurrence_months?: number;
  status: ComplianceStatus;
  document_url?: string;
  certificate_number?: string;
  provider_name?: string;
  provider_contact?: string;
  cost?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  unit?: { address: string };
}

export type AmenityType =
  | 'gym' | 'meeting_room' | 'rooftop' | 'bbq' | 'ev_charger'
  | 'parking' | 'bike_storage' | 'cinema' | 'pool'
  | 'co_working' | 'laundry' | 'other';

export interface Amenity {
  id: string;
  development_id: string;
  name: string;
  type: AmenityType;
  description?: string;
  location?: string;
  is_bookable: boolean;
  max_duration_hours: number;
  max_advance_days: number;
  max_active_bookings: number;
  requires_deposit: boolean;
  deposit_amount?: number;
  available_from: string;
  available_until: string;
  available_days: number[];
  capacity?: number;
  photo_url?: string;
  rules?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AmenityBooking {
  id: string;
  amenity_id: string;
  tenancy_id: string;
  development_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  notes?: string;
  created_at: string;
  updated_at: string;
  amenity?: Amenity;
  tenancy?: { tenant_name: string; unit?: { address: string } };
}

export interface WelcomeSequenceItem {
  id: string;
  development_id: string;
  day_number: number;
  title: string;
  message: string;
  category: 'essentials' | 'appliances' | 'local_area' | 'community' | 'general';
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BTRDashboardStats {
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  voidUnits: number;
  maintenanceUnits: number;
  occupancyRate: number;
  openMaintenanceRequests: number;
  overdueCompliance: number;
  upcomingCompliance: number;
  averageResolutionDays: number;
  monthlyRentRoll: number;
  activeTenancies: number;
}

export const CATEGORY_CONFIG: Record<MaintenanceCategory, { label: string; icon: string; color: string }> = {
  plumbing: { label: 'Plumbing', icon: 'Droplets', color: '#3B82F6' },
  electrical: { label: 'Electrical', icon: 'Zap', color: '#F59E0B' },
  heating: { label: 'Heating', icon: 'Flame', color: '#EF4444' },
  structural: { label: 'Structural', icon: 'Building2', color: '#6B7280' },
  appliance: { label: 'Appliance', icon: 'Settings', color: '#8B5CF6' },
  pest: { label: 'Pest Control', icon: 'Bug', color: '#10B981' },
  exterior: { label: 'Exterior', icon: 'Trees', color: '#059669' },
  common_area: { label: 'Common Area', icon: 'Users', color: '#6366F1' },
  general: { label: 'General', icon: 'HelpCircle', color: '#9CA3AF' },
};

export const PRIORITY_CONFIG: Record<MaintenancePriority, { label: string; color: string; bgColor: string }> = {
  emergency: { label: 'Emergency', color: '#DC2626', bgColor: '#FEF2F2' },
  urgent: { label: 'Urgent', color: '#F59E0B', bgColor: '#FFFBEB' },
  routine: { label: 'Routine', color: '#3B82F6', bgColor: '#EFF6FF' },
  low: { label: 'Low', color: '#6B7280', bgColor: '#F9FAFB' },
};

export const STATUS_CONFIG: Record<MaintenanceStatus, { label: string; color: string; bgColor: string }> = {
  submitted: { label: 'Submitted', color: '#6B7280', bgColor: '#F9FAFB' },
  acknowledged: { label: 'Acknowledged', color: '#3B82F6', bgColor: '#EFF6FF' },
  assigned: { label: 'Assigned', color: '#8B5CF6', bgColor: '#F5F3FF' },
  in_progress: { label: 'In Progress', color: '#F59E0B', bgColor: '#FFFBEB' },
  awaiting_parts: { label: 'Awaiting Parts', color: '#F97316', bgColor: '#FFF7ED' },
  scheduled: { label: 'Scheduled', color: '#06B6D4', bgColor: '#ECFEFF' },
  resolved: { label: 'Resolved', color: '#10B981', bgColor: '#ECFDF5' },
  closed: { label: 'Closed', color: '#059669', bgColor: '#ECFDF5' },
  cancelled: { label: 'Cancelled', color: '#EF4444', bgColor: '#FEF2F2' },
};

export const COMPLIANCE_TYPE_CONFIG: Record<ComplianceType, { label: string; icon: string }> = {
  fire_safety: { label: 'Fire Safety', icon: 'Flame' },
  gas_safety: { label: 'Gas Safety', icon: 'Wind' },
  electrical: { label: 'Electrical Inspection', icon: 'Zap' },
  ber_cert: { label: 'BER Certificate', icon: 'Leaf' },
  smoke_co_detectors: { label: 'Smoke/CO Detectors', icon: 'AlertTriangle' },
  legionella: { label: 'Legionella Check', icon: 'Droplets' },
  lift_inspection: { label: 'Lift Inspection', icon: 'ArrowUpDown' },
  insurance: { label: 'Building Insurance', icon: 'Shield' },
  rtu_registration: { label: 'RTB Registration', icon: 'FileText' },
  custom: { label: 'Custom', icon: 'Settings' },
};

export const AMENITY_TYPE_CONFIG: Record<AmenityType, { label: string; icon: string }> = {
  gym: { label: 'Gym', icon: 'Dumbbell' },
  meeting_room: { label: 'Meeting Room', icon: 'Users' },
  rooftop: { label: 'Rooftop Terrace', icon: 'Sun' },
  bbq: { label: 'BBQ Area', icon: 'Flame' },
  ev_charger: { label: 'EV Charger', icon: 'BatteryCharging' },
  parking: { label: 'Parking', icon: 'Car' },
  bike_storage: { label: 'Bike Storage', icon: 'Bike' },
  cinema: { label: 'Cinema Room', icon: 'Film' },
  pool: { label: 'Swimming Pool', icon: 'Waves' },
  co_working: { label: 'Co-Working Space', icon: 'Laptop' },
  laundry: { label: 'Laundry', icon: 'Shirt' },
  other: { label: 'Other', icon: 'MoreHorizontal' },
};

export const UNIT_STATUS_CONFIG: Record<UnitStatus, { label: string; color: string; bgColor: string; dotColor: string }> = {
  available: { label: 'Available', color: '#6B7280', bgColor: '#F9FAFB', dotColor: '#9CA3AF' },
  occupied: { label: 'Occupied', color: '#059669', bgColor: '#ECFDF5', dotColor: '#10B981' },
  vacant: { label: 'Vacant', color: '#6B7280', bgColor: '#F9FAFB', dotColor: '#9CA3AF' },
  void: { label: 'Void', color: '#D97706', bgColor: '#FFFBEB', dotColor: '#F59E0B' },
  maintenance: { label: 'Maintenance', color: '#DC2626', bgColor: '#FEF2F2', dotColor: '#EF4444' },
};
