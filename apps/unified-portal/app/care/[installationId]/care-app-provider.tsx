'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export interface InstallationData {
  id: string;
  job_reference: string;
  customer_name: string;
  address_line_1: string;
  city: string;
  county: string;
  system_type: string;
  system_size_kwp: number;
  inverter_model: string;
  panel_model: string;
  panel_count: number;
  install_date: string;
  warranty_expiry: string;
  health_status: string;
  portal_status: string;
  system_specs: Record<string, any>;
  installer_name: string;
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
  installer_name: 'SE Systems',
};

export function CareAppProvider({
  installationId,
  children,
}: {
  installationId: string;
  children: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <CareAppContext.Provider
      value={{
        installationId,
        installation: DEMO_INSTALLATION,
        activeTab,
        setActiveTab,
      }}
    >
      {children}
    </CareAppContext.Provider>
  );
}
