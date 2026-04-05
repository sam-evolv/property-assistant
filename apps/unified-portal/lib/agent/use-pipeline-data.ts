'use client';

import { useState, useEffect } from 'react';
import { SCHEMES, BUYERS, AGENT_STATS, type Buyer as DemoBuyer, type Scheme as DemoScheme } from './demo-data';

/**
 * Pipeline data returned by the API or adapted from demo data.
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
  isLive: boolean; // true if data came from Supabase
}

/**
 * Adapt demo data to the same shape as the API response.
 */
function adaptDemoData(): { schemes: PipelineScheme[]; buyers: PipelineBuyer[] } {
  const schemes: PipelineScheme[] = SCHEMES.map((s) => {
    const schemeBuyers = BUYERS.filter((b) => b.scheme === s.name);
    const pct = s.total > 0 ? Math.round((s.sold / s.total) * 100) : 0;
    return {
      id: s.id,
      name: s.name,
      totalUnits: s.total,
      sold: s.sold,
      contractsSigned: s.contractsSigned,
      contractsOut: s.contractsOut,
      reserved: s.reserved,
      available: s.available,
      percentSold: pct,
      activeBuyers: schemeBuyers.filter((b) => b.status !== 'sold').length,
      urgentCount: schemeBuyers.filter((b) => b.urgent).length,
      revenue: s.revenue,
    };
  });

  const buyers: PipelineBuyer[] = BUYERS.map((b) => {
    const scheme = SCHEMES.find((s) => s.name === b.scheme);
    return {
      id: String(b.id),
      name: b.name,
      initials: b.initials,
      unit: b.unit,
      scheme: b.scheme,
      schemeId: scheme?.id || '',
      type: b.type,
      beds: b.beds,
      bathrooms: 0,
      eircode: null,
      price: b.price,
      status: b.status,
      daysOverdue: b.daysSinceIssued ?? 0,
      isUrgent: b.urgent,
      phone: '',
      email: '',
      address: '',
      saleAgreedDate: b.saleAgreedDate,
      depositDate: b.depositDate,
      contractsIssuedDate: b.contractsIssuedDate,
      contractsSignedDate: b.contractsSignedDate,
      snagDate: b.snagDate,
      estimatedCloseDate: b.estimatedCloseDate,
      handoverDate: b.handoverDate,
      kitchenSelected: b.kitchenSelected ?? false,
      kitchenDate: null,
      drawdownDate: null,
      mortgageExpiry: b.mortgageExpiry,
      comments: null,
      recentComms: [],
    };
  });

  return { schemes, buyers };
}

/**
 * Hook to fetch pipeline data. Tries the API first, falls back to demo data.
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
      // If no tenant ID, use demo data immediately
      if (!tenantId) {
        const demo = adaptDemoData();
        if (!cancelled) {
          setData({ ...demo, loading: false, error: null, isLive: false });
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
        // Fallback to demo data
        console.warn('[usePipelineData] API failed, using demo data:', err.message);
        const demo = adaptDemoData();
        if (!cancelled) {
          setData({ ...demo, loading: false, error: err.message, isLive: false });
        }
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [tenantId]);

  return data;
}
