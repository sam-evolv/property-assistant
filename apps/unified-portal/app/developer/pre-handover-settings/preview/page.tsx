'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PreHandoverPortal } from '@/components/pre-handover';
import { useCurrentContext } from '@/contexts/CurrentContext';
import { ArrowLeft, X } from 'lucide-react';

interface PreviewData {
  developmentName: string;
  developmentLogoUrl: string | null;
  config: {
    milestones: Array<{ id: string; label: string; enabled: boolean }>;
    faqs: Array<{ id: string; question: string; answer: string }>;
    contacts: {
      salesPhone: string;
      salesEmail: string;
      showHouseAddress: string;
    };
    estHandover: string;
    snaggingLead: string;
  };
}

export default function PreHandoverPreviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { developmentId: contextDevId } = useCurrentContext();
  const developmentId = searchParams.get('developmentId') || contextDevId;
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!developmentId) {
      setLoading(false);
      return;
    }

    const fetchPreviewData = async () => {
      try {
        const [configRes, devRes] = await Promise.all([
          fetch(`/api/developments/${developmentId}/prehandover-config`),
          fetch(`/api/developments/${developmentId}`)
        ]);

        const config = configRes.ok ? await configRes.json() : null;
        const dev = devRes.ok ? await devRes.json() : null;

        setPreviewData({
          developmentName: dev?.name || 'Sample Development',
          developmentLogoUrl: dev?.logo_url || null,
          config: config || {
            milestones: [],
            faqs: [],
            contacts: { salesPhone: '', salesEmail: '', showHouseAddress: '' },
            estHandover: '2026-03',
            snaggingLead: '14'
          }
        });
      } catch (err) {
        console.error('Failed to load preview data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPreviewData();
  }, [developmentId]);

  if (!developmentId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-500">Please select a development first</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse text-gray-400">Loading preview...</div>
      </div>
    );
  }

  const enabledMilestones = previewData?.config.milestones
    .filter(m => m.enabled)
    .map(m => m.id) || ['sale_agreed', 'contracts_signed', 'snagging', 'handover'];

  const sampleMilestoneDates: Record<string, string> = {};
  const today = new Date();
  enabledMilestones.forEach((milestone, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (enabledMilestones.length - 1 - index) * 30);
    if (index < enabledMilestones.length - 2) {
      sampleMilestoneDates[milestone] = date.toISOString().split('T')[0];
    }
  });

  const estHandoverDate = previewData?.config.estHandover 
    ? `${previewData.config.estHandover}-15` 
    : null;

  const snaggingDays = parseInt(previewData?.config.snaggingLead || '14', 10);
  const estSnaggingDate = estHandoverDate 
    ? new Date(new Date(estHandoverDate).getTime() - snaggingDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    : null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="bg-[#D4AF37] text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Preview Mode</span>
          <span className="text-xs opacity-75">This is how purchasers will see your Pre-Handover Portal</span>
        </div>
        <button
          onClick={() => window.close()}
          className="flex items-center gap-1.5 text-sm hover:opacity-80 transition-opacity"
        >
          <X className="w-4 h-4" />
          Close Preview
        </button>
      </div>
      
      <div className="flex-1">
        <PreHandoverPortal
          unitId="preview"
          propertyName="Unit 42, Rathard Park"
          propertyType="Apartment"
          houseType="3 Bed"
          purchaserName="Showhouse"
          developmentName={previewData?.developmentName || 'Sample Development'}
          developmentLogoUrl={previewData?.developmentLogoUrl}
          handoverComplete={false}
          currentMilestone={enabledMilestones[Math.min(1, enabledMilestones.length - 1)]}
          milestoneDates={sampleMilestoneDates}
          estSnaggingDate={estSnaggingDate}
          estHandoverDate={estHandoverDate}
          documents={[
            { id: '1', name: 'Welcome Pack', url: '#', type: 'other', size: '1 MB' },
            { id: '2', name: 'Floor Plan', url: '#', type: 'floor_plan', size: '2 MB' }
          ]}
          contacts={previewData?.config.contacts || {}}
          faqs={previewData?.config.faqs || []}
        />
      </div>
    </div>
  );
}
