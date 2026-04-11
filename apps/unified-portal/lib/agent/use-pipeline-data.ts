'use client';

import { useState, useEffect } from 'react';

/**
 * Pipeline data returned by the API.
 */
export interface PipelineBuyer {
  id: string;
  unitId?: string;
  name: string;
  initials: string;
  unit: string;
  scheme: string;
  schemeId: string;
  type: string;
  beds: number;
  bathrooms: number;
  eircode: string | null;
  price: number;
  status: string;
  daysOverdue: number;
  isUrgent: boolean;
  phone: string;
  email: string;
  address: string;
  saleAgreedDate: string | null;
  depositDate: string | null;
  contractsIssuedDate: string | null;
  contractsSignedDate: string | null;
  snagDate: string | null;
  estimatedCloseDate: string | null;
  handoverDate: string | null;
  kitchenSelected: boolean;
  kitchenDate: string | null;
  drawdownDate: string | null;
  mortgageExpiry: string | null;
  comments: string | null;
  recentComms: Array<{
    date: string;
    type: string;
    direction: string;
    summary: string;
    actor: string;
  }>;
}

export interface PipelineScheme {
  id: string;
  name: string;
  address?: string;
  totalUnits: number;
  sold: number;
  contractsSigned: number;
  contractsOut: number;
  reserved: number;
  available: number;
  percentSold: number;
  activeBuyers: number;
  urgentCount: number;
  revenue: number;
}

export interface PipelineData {
  schemes: PipelineScheme[];
  buyers: PipelineBuyer[];
  loading: boolean;
  error: string | null;
  isLive: boolean;
}

/**
 * Hook to fetch pipeline data from the API.
 * No demo data fallback. Shows error state on failure.
 */
export function usePipelineData(tenantId?: string): PipelineData {
  const [data, setData] = useState<PipelineData>({
    schemes: [],
    buyers: [],
    loading: true,
    error: null,
    isLive: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      if (!tenantId) {
        if (!cancelled) {
          setData({ schemes: [], buyers: [], loading: false, error: 'No tenant ID provided', isLive: false });
        }
        return;
      }

      try {
        const res = await fetch(`/api/agent/pipeline?tenant_id=${tenantId}`);
        if (!res.ok) throw new Error(`API returned ${res.status}`);

        const json = await res.json();
        if (!cancelled) {
          setData({
            schemes: json.schemes || [],
            buyers: json.buyers || [],
            loading: false,
            error: null,
            isLive: true,
          });
        }
      } catch (err: any) {
        if (!cancelled) {
          setData({ schemes: [], buyers: [], loading: false, error: err.message, isLive: false });
        }
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [tenantId]);

  return data;
}
