'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PreHandoverPortal } from '@/components/pre-handover';
import { useCurrentContext } from '@/contexts/CurrentContext';
import { ArrowLeft } from 'lucide-react';

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
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md mb-6 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </button>
        <span className="text-white/50 text-sm">Preview Mode</span>
      </div>
      
      <div className="w-[320px] h-[640px] bg-black rounded-[3rem] p-3 shadow-2xl">
        <div className="w-full h-full bg-white rounded-[2.25rem] overflow-hidden relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-b-2xl z-50" />
          
          <div className="h-full overflow-y-auto">
            <PreHandoverPortal
              unitId="preview"
              propertyName="Unit 42, Rathard Park"
              propertyType="Apartment"
              houseType="2 Bed Apartment"
              purchaserName="Sarah"
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
      </div>
      
      <p className="text-white/40 text-sm mt-6 text-center max-w-sm">
        This is a preview of how purchasers will see your Pre-Handover Portal with the current settings.
      </p>
    </div>
  );
}
