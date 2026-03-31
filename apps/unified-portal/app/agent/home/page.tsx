'use client';
import { useRouter } from 'next/navigation';
import { T } from '@/lib/agent/tokens';
import { useAgentData } from '@/hooks/agent/useAgentData';
import { SchemeCard } from '@/components/agent/home/SchemeCard';
import { UrgentRow } from '@/components/agent/home/UrgentRow';
import { Badge } from '@/components/agent/ui/Badge';
import { SectionLabel } from '@/components/agent/ui/SectionLabel';
import { Card } from '@/components/agent/ui/Card';
import { Zap, ChevronRight } from 'lucide-react';

export default function AgentHomePage() {
  const router = useRouter();
  const { profile, schemes, buyers, viewings } = useAgentData();

  const urgentBuyers = buyers.filter(b => b.is_urgent);
  const todayViewings = viewings.filter(v => v.viewing_date === 'Today');
  const totalSold = schemes.reduce((s, sc) => s + (sc.stages?.closed || 0), 0);
  const totalActive = schemes.reduce((s, sc) => s + (sc.stages ? sc.stages.deposit + sc.stages.contracts_issued + sc.stages.contracts_signed : 0), 0);

  return (
    <div style={{ paddingTop: 56, paddingLeft: 16, paddingRight: 16, paddingBottom: 32 }}>
      {/* Greeting */}
      <div style={{ marginBottom: 22 }}>
        <p style={{ fontSize: 11, color: T.t4, margin: '0 0 4px' }}>Thursday, 26 March 2025</p>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: T.t1, letterSpacing: '-0.03em', margin: '0 0 4px' }}>
          Good morning, {profile.name.split(' ')[0]}.
        </h1>
        <p style={{ fontSize: 13, color: T.t3, margin: 0 }}>
          {profile.firm} · {schemes.length} schemes active
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
        {[
          { n: totalSold, label: 'Sold', color: T.goldD },
          { n: totalActive, label: 'Active', color: T.info },
          { n: urgentBuyers.length, label: 'Urgent', color: T.flag },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, background: T.card, borderRadius: 14, border: `1px solid ${T.line}`,
            padding: '14px 10px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.n}</div>
            <div style={{ fontSize: 10, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Intelligence CTA */}
      <Card
        onClick={() => router.push('/agent/intelligence')}
        style={{ display: 'flex', alignItems: 'center', padding: '16px 18px', marginBottom: 22, cursor: 'pointer' }}
      >
        <div style={{
          width: 42, height: 42, borderRadius: 12, background: T.t1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0,
        }}>
          <Zap size={18} color={T.gold} fill={T.gold} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.t1 }}>OpenHouse Intelligence</div>
          <div style={{ fontSize: 12, color: T.t3 }}>What do you need done today?</div>
        </div>
        <ChevronRight size={18} color={T.t4} />
      </Card>

      {/* Requires Action */}
      {urgentBuyers.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <SectionLabel>Requires Action</SectionLabel>
          <Card style={{ padding: '4px 16px' }}>
            {urgentBuyers.map(b => (
              <UrgentRow key={b.id} buyer={b} onTap={() => router.push('/agent/intelligence')} />
            ))}
          </Card>
        </div>
      )}

      {/* Today's Viewings */}
      {todayViewings.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <SectionLabel>Today&apos;s Viewings</SectionLabel>
          <Card style={{ padding: '4px 16px' }}>
            {todayViewings.map(v => (
              <div key={v.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 0', borderBottom: `1px solid ${T.line}`,
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 10, background: T.s1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: T.t2,
                }}>
                  {v.viewing_time}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.t1 }}>{v.buyer_name}</div>
                  <div style={{ fontSize: 11, color: T.t3 }}>{v.unit_ref}</div>
                </div>
                <Badge status={v.status} />
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Schemes */}
      <div>
        <SectionLabel>Schemes</SectionLabel>
        {schemes.map(s => (
          <SchemeCard key={s.id} scheme={s} onTap={() => router.push('/agent/pipeline')} />
        ))}
      </div>
    </div>
  );
}
