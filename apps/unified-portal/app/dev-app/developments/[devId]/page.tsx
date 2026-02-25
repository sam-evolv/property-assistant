'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import MobileShell from '@/components/dev-app/layout/MobileShell';
import SectorBadge from '@/components/dev-app/shared/SectorBadge';
import PipelineView from '@/components/dev-app/developments/PipelineView';
import ComplianceView from '@/components/dev-app/developments/ComplianceView';
import SnaggingView from '@/components/dev-app/developments/SnaggingView';
import SelectionsView from '@/components/dev-app/developments/SelectionsView';
import HomeownerList from '@/components/dev-app/developments/HomeownerList';
import ContactSheet from '@/components/dev-app/developments/ContactSheet';
import { useSectorTerms } from '@/hooks/useDevApp';
import type { Sector } from '@/lib/dev-app/constants';

export default function DevelopmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const devId = params.devId as string;

  const [development, setDevelopment] = useState<any>(null);
  const [sectionData, setSectionData] = useState<any>({});
  const [activeSection, setActiveSection] = useState('pipeline');
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState<any>(null);

  const sector = (development?.sector || 'bts') as Sector;
  const terms = useSectorTerms(sector);

  const fetchSection = useCallback(
    async (section: string) => {
      try {
        const res = await fetch(
          `/api/dev-app/developments/${devId}?section=${section}`
        );
        if (res.ok) {
          const data = await res.json();
          setDevelopment(data.development);
          setSectionData(data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    },
    [devId]
  );

  useEffect(() => {
    fetchSection(activeSection);
  }, [activeSection, fetchSection]);

  const sectionLabels = terms.sections;

  return (
    <MobileShell>
      {/* Header */}
      <header
        className="sticky top-0 z-30 border-b frosted-glass-light"
        style={{
          borderColor: '#f3f4f6',
          paddingTop:
            'calc(12px + var(--safe-top, env(safe-area-inset-top, 0px)))',
          paddingBottom: '12px',
        }}
      >
        <div className="flex items-center gap-3 px-4">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-[#f3f4f6] active:scale-95"
          >
            <ArrowLeft size={16} className="text-[#111827]" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[16px] font-bold text-[#111827] truncate">
                {development?.name || 'Loading...'}
              </h1>
              {development?.sector && (
                <SectorBadge sector={development.sector} />
              )}
            </div>
          </div>
        </div>

        {/* Section pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide mt-3 px-4 pb-1">
          {sectionLabels.map((label) => {
            const sectionKey = label.toLowerCase().replace(/[\s-]+/g, '_');
            const isActive = activeSection === sectionKey ||
              (activeSection === 'pipeline' && label === sectionLabels[0]);
            return (
              <button
                key={label}
                onClick={() => {
                  const key = label === sectionLabels[0] ? 'pipeline' : sectionKey;
                  setActiveSection(key);
                  setLoading(true);
                }}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all active:scale-95"
                style={{
                  backgroundColor: isActive ? '#111827' : '#f3f4f6',
                  color: isActive ? '#fff' : '#6b7280',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Section content */}
      <div className="py-3">
        {loading ? (
          <div className="px-4 py-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-[#f3f4f6] animate-pulse"
              />
            ))}
          </div>
        ) : (
          <>
            {(activeSection === 'pipeline' ||
              activeSection === 'leasing' ||
              activeSection === 'bookings') && (
              <PipelineView
                units={sectionData.pipeline || []}
                sector={sector}
                onUnitTap={(unit) => setSelectedUnit(unit)}
              />
            )}

            {activeSection === 'compliance' && sectionData.compliance && (
              <ComplianceView
                units={sectionData.compliance.units || []}
                overallPct={sectionData.compliance.overall_pct || 0}
                documentTypes={sectionData.compliance.document_types || []}
              />
            )}

            {activeSection === 'snagging' && (
              <SnaggingView snags={sectionData.snags || []} />
            )}

            {(activeSection === 'maintenance') && (
              <SnaggingView snags={sectionData.snags || []} />
            )}

            {(activeSection === 'selections' ||
              activeSection === 'fit_out' ||
              activeSection === 'room_setup') && (
              <SelectionsView
                selections={sectionData.selections || []}
              />
            )}

            {(activeSection === 'homeowners' ||
              activeSection === 'tenants' ||
              activeSection === 'students') && (
              <HomeownerList
                homeowners={sectionData.homeowners || []}
                occupantLabel={terms.occupant}
              />
            )}

            {activeSection === 'archive' && (
              <div className="px-4 py-8 text-center">
                <p className="text-[13px] text-[#9ca3af]">
                  Document archive — access via desktop dashboard
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Contact Sheet */}
      <ContactSheet
        unit={selectedUnit}
        onClose={() => setSelectedUnit(null)}
      />
    </MobileShell>
  );
}
