'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export interface SystemSpecs {
  battery: string | null;
  optimizer_count: number;
  roof_orientation: string;
  panel_warranty_years: number;
  inverter_warranty_years: number;
  workmanship_warranty_years: number;
  [key: string]: unknown;
}

export interface InstallationData {
  id: string;
  job_reference: string;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  address_line_1: string;
  city: string;
  county: string | null;
  system_type: string;
  system_category?: string; // 'solar' | 'heat_pump' | 'underfloor_heating' | 'hybrid'
  system_size_kwp: number;
  inverter_model: string;
  panel_model: string;
  panel_count: number;
  install_date: string;
  warranty_expiry: string;
  health_status: string;
  portal_status: string;
  system_specs: SystemSpecs;
  installer_name: string;
  installer_contact?: Record<string, unknown>;
  // Heat pump fields
  heat_pump_model?: string | null;
  heat_pump_serial?: string | null;
  heat_pump_cop?: number | null;
  flow_temp_current?: number | null;
  zones_total?: number | null;
  zones_active?: number | null;
  hot_water_cylinder_model?: string | null;
  hot_water_temp_current?: number | null;
  controls_model?: string | null;
  controls_issue?: string | null;
  last_service_date?: string | null;
  next_service_due?: string | null;
  warranty_years?: number | null;
  annual_service_required?: boolean;
  seai_grant_amount?: number | null;
  seai_grant_status?: string | null;
  seai_grant_ref?: string | null;
  seai_application_date?: string | null;
  ber_rating?: string | null;
  active_safety_alerts?: Array<{ id: string; title: string; body: string; severity: string; action_label?: string }>;
  indoor_temp_current?: number | null;
  indoor_temp_target?: number | null;
  daily_running_cost_cents?: number | null;
  co2_saved_today_grams?: number | null;
  monthly_running_cost_cents?: number | null;
  monthly_budget_cents?: number | null;
}

export interface CareAppContextType {
  installationId: string;
  installation: InstallationData;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const CareAppContext = createContext<CareAppContextType | null>(null);

export function useCareApp() {
  const ctx = useContext(CareAppContext);
  if (!ctx) throw new Error('useCareApp must be used within CareAppProvider');
  return ctx;
}

// Demo data for Mary Murphy (SE-2026-0312) as the default installation
const DEMO_INSTALLATION: InstallationData = {
  id: 'demo-installation',
  job_reference: 'SE-2026-0312',
  customer_name: 'Mary Murphy',
  address_line_1: '12 Meadow Drive, Ballincollig',
  city: 'Cork',
  county: 'Cork',
  system_type: 'solar_pv',
  system_size_kwp: 3.69,
  inverter_model: 'SolarEdge SE3680H',
  panel_model: 'JA Solar 410W',
  panel_count: 9,
  install_date: '2026-01-14',
  warranty_expiry: '2036-01-14',
  health_status: 'healthy',
  portal_status: 'active',
  system_specs: {
    battery: 'SolarEdge Home Battery 4.6kWh',
    optimizer_count: 9,
    roof_orientation: 'south',
    panel_warranty_years: 25,
    inverter_warranty_years: 12,
    workmanship_warranty_years: 10,
  },
  installer_name: 'Horizon Renewables',
};

export function CareAppProvider({
  installationId,
  installation: installationProp,
  children,
}: {
  installationId: string;
  installation?: InstallationData;
  children: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <CareAppContext.Provider
      value={{
        installationId,
        installation: installationProp || DEMO_INSTALLATION,
        activeTab,
        setActiveTab,
      }}
    >
      {children}
    </CareAppContext.Provider>
  );
}
