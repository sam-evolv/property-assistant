'use client';
import { useState } from 'react';
import { T, STATUS } from '@/lib/agent/tokens';
import { useAgentData } from '@/hooks/agent/useAgentData';
import { AgentBuyer, AgentUnit } from '@/lib/agent/types';
import { Toggle } from '@/components/agent/ui/Toggle';
import { SectionLabel } from '@/components/agent/ui/SectionLabel';
import { Avatar } from '@/components/agent/ui/Avatar';
import { Badge } from '@/components/agent/ui/Badge';
import { Card } from '@/components/agent/ui/Card';
import { BuyerCard } from '@/components/agent/pipeline/BuyerCard';
import { BuyerSheet } from '@/components/agent/pipeline/BuyerSheet';
import { UnitRow } from '@/components/agent/pipeline/UnitRow';
import { BottomSheet } from '@/components/agent/ui/BottomSheet';
import { DataRow } from '@/components/agent/ui/DataRow';
import { GhostButton } from '@/components/agent/ui/GhostButton';
import { PrimaryButton } from '@/components/agent/ui/PrimaryButton';
import { Phone, Zap } from 'lucide-react';

type View = 'buyers' | 'stages' | 'schemes';

const STAGE_DEFS = [
  { key: 'deposit', label: 'Deposit Paid', color: T.info },
  { key: 'contracts_issued', label: 'Contracts Issued', color: T.gold },
  { key: 'contracts_signed', label: 'Contracts Signed', color: T.vio },
  { key: 'closed', label: 'Closed', color: T.go },
];

export default function PipelinePage() {
  const { buyers, schemes } = useAgentData();
  const [view, setView] = useState<View>('buyers');
  const [selectedBuyer, setSelectedBuyer] = useState<AgentBuyer | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<AgentUnit | null>(null);

  const urgentBuyers = buyers.filter(b => b.is_urgent);
  const normalBuyers = buyers.filter(b => !b.is_urgent);

  return (
    <div style={{ background: T.bg, minHeight: '100%' }}>
      {/* Header */}
      <div style={{ background: T.card, paddingTop: 52, paddingBottom: 14, paddingLeft: 16, paddingRight: 16 }}>
        <SectionLabel>Pipeline</SectionLabel>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.t1, margin: '0 0 14px', letterSpacing: '-0.02em' }}>
          Sales Pipeline
        </h1>
        <Toggle
          options={[
            { label: 'By Buyer', value: 'buyers' as View },
            { label: 'By Stage', value: 'stages' as View },
            { label: 'By Scheme', value: 'schemes' as View },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      <div style={{ padding: 16 }}>
        {/* BY BUYER */}
        {view === 'buyers' && (
          <>
            {urgentBuyers.length > 0 && (
              <>
                <SectionLabel style={{ color: T.flag }}>Needs Attention</SectionLabel>
                {urgentBuyers.map(b => (
                  <BuyerCard key={b.id} buyer={b} onTap={() => setSelectedBuyer(b)} />
                ))}
              </>
            )}
            <SectionLabel style={{ marginTop: 16 }}>All Buyers</SectionLabel>
            {normalBuyers.map(b => (
              <BuyerCard key={b.id} buyer={b} onTap={() => setSelectedBuyer(b)} />
            ))}
          </>
        )}

        {/* BY STAGE */}
        {view === 'stages' && (
          <>
            {STAGE_DEFS.map(stage => {
              const stageBuyers = buyers.filter(b => {
                if (stage.key === 'deposit') return b.deposit_date && !b.contracts_date;
                if (stage.key === 'contracts_issued') return b.contracts_date && !b.contracts_signed_date;
                if (stage.key === 'contracts_signed') return b.contracts_signed_date && !b.closing_date;
                if (stage.key === 'closed') return !!b.closing_date;
                return false;
              });
              return (
                <div key={stage.key} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.t2 }}>{stage.label}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 10, background: T.s1,
                      fontSize: 11, fontWeight: 600, color: T.t3,
                    }}>
                      {stageBuyers.length}
                    </span>
                  </div>
                  {stageBuyers.length > 0 && (
                    <Card style={{ padding: '4px 16px' }}>
                      {stageBuyers.map(b => (
                        <div key={b.id} onClick={() => setSelectedBuyer(b)} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 0', borderBottom: `1px solid ${T.line}`,
                          cursor: 'pointer',
                        }}>
                          <Avatar initials={b.initials || b.name.charAt(0)} size={36} gold />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: T.t1 }}>{b.name}</div>
                            <div style={{ fontSize: 11, color: T.t3 }}>{b.unit_ref}</div>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: T.t2 }}>{b.budget}</span>
                        </div>
                      ))}
                    </Card>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* BY SCHEME */}
        {view === 'schemes' && (
          <>
            {schemes.map(scheme => {
              const stages = scheme.stages;
              const total = stages ? stages.deposit + stages.contracts_issued + stages.contracts_signed + stages.closed : 0;
              const soldPct = scheme.total_units > 0 ? Math.round(((stages?.closed || 0) / scheme.total_units) * 100) : 0;
              const unitsWithBuyers = (scheme.units || []).filter(u => u.buyer_name);

              return (
                <div key={scheme.id} style={{ marginBottom: 20 }}>
                  <Card style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.t1 }}>{scheme.name}</div>
                        <div style={{ fontSize: 11, color: T.t3 }}>{scheme.developer_name}</div>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: T.goldD }}>{soldPct}%</div>
                    </div>

                    {/* Stage bar */}
                    {stages && total > 0 && (
                      <div style={{ display: 'flex', gap: 2, height: 4, marginBottom: 10 }}>
                        {STAGE_DEFS.map(sd => {
                          const count = stages[sd.key as keyof typeof stages] as number;
                          if (!count) return null;
                          return (
                            <div key={sd.key} style={{
                              flex: count, height: 4, borderRadius: 2, background: sd.color,
                            }} />
                          );
                        })}
                      </div>
                    )}

                    {/* Stage legend */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                      {STAGE_DEFS.map(sd => (
                        <div key={sd.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: 3, background: sd.color }} />
                          <span style={{ fontSize: 10, color: T.t3 }}>
                            {sd.label.split(' ')[0]} {stages ? stages[sd.key as keyof typeof stages] : 0}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Unit rows */}
                    {unitsWithBuyers.slice(0, 4).map(u => (
                      <UnitRow key={u.id} unit={u} onTap={() => setSelectedUnit(u)} />
                    ))}
                  </Card>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Buyer sheet */}
      <BuyerSheet buyer={selectedBuyer} open={!!selectedBuyer} onClose={() => setSelectedBuyer(null)} />

      {/* Unit sheet */}
      <BottomSheet open={!!selectedUnit} onClose={() => setSelectedUnit(null)}>
        {selectedUnit && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 21, fontWeight: 700, color: T.t1, margin: 0 }}>{selectedUnit.unit_ref}</h2>
                <p style={{ fontSize: 12, color: T.t3, margin: '2px 0 0' }}>
                  {selectedUnit.unit_type}{selectedUnit.sqm ? ` · ${selectedUnit.sqm}m²` : ''}
                </p>
              </div>
              <Badge status={selectedUnit.status} />
            </div>
            {selectedUnit.price && (
              <p style={{ fontSize: 22, fontWeight: 700, color: T.t1, margin: '0 0 16px' }}>
                €{selectedUnit.price.toLocaleString()}
              </p>
            )}
            <div style={{ marginBottom: 16 }}>
              <DataRow label="Buyer" value={selectedUnit.buyer_name || '—'} />
              <DataRow label="Solicitor" value={selectedUnit.solicitor_name || '—'} />
              <DataRow label="AIP">
                <span style={{ fontSize: 13, fontWeight: 600, color: selectedUnit.aip_approved ? T.go : T.flag }}>
                  {selectedUnit.aip_approved ? 'Approved ✓' : 'Not approved'}
                </span>
              </DataRow>
              <DataRow label="Contracts" value={selectedUnit.contracts_status || '—'} />
              {selectedUnit.deposit_date && <DataRow label="Deposit" value={selectedUnit.deposit_date} />}
              {selectedUnit.contracts_date && <DataRow label="Contracts Date" value={selectedUnit.contracts_date} />}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <GhostButton style={{ flex: 1 }}><Phone size={14} /> Call</GhostButton>
              <PrimaryButton style={{ flex: 1 }}><Zap size={14} /> AI Draft</PrimaryButton>
            </div>
          </>
        )}
      </BottomSheet>
    </div>
  );
}
