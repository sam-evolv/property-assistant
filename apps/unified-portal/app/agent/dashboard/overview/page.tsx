import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function AgentDashboardOverview() {
  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch agent profile
  const { data: profile } = await supabase
    .from('agent_profiles')
    .select('id, display_name, agency_name, agent_type')
    .eq('user_id', user!.id)
    .single();

  // Fetch assigned schemes
  const { data: assignments } = await supabase
    .from('agent_scheme_assignments')
    .select(`
      development_id,
      developments (
        id, name, address,
        units (count),
        unit_sales_pipeline (
          id, status, purchaser_name,
          contracts_issued_date, signed_contracts_date
        )
      )
    `)
    .eq('agent_id', profile!.id)
    .eq('is_active', true);

  // Compute stats
  const allPipeline = assignments?.flatMap(a =>
    (a.developments as any)?.unit_sales_pipeline ?? []
  ) ?? [];

  const totalSold = allPipeline.filter(p => p.status === 'sold').length;
  const totalActive = allPipeline.filter(p =>
    ['agreed', 'contracts_issued', 'signed'].includes(p.status)
  ).length;
  const overdue = allPipeline.filter(p =>
    p.contracts_issued_date && !p.signed_contracts_date &&
    new Date(p.contracts_issued_date) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ color: '#9CA3AF', fontSize: 14, margin: '0 0 4px' }}>
          {greeting},
        </p>
        <h1 style={{
          color: '#0D0D12', fontSize: 28,
          fontWeight: 700, letterSpacing: '-0.04em',
          margin: '0 0 4px',
        }}>
          {profile?.display_name?.split(' ')[0]}.
        </h1>
        <p style={{ color: '#A0A8B0', fontSize: 14, margin: 0 }}>
          {profile?.agency_name} · {assignments?.length ?? 0} schemes active
        </p>
      </div>

      {/* Stats grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
        marginBottom: 32,
      }}>
        {[
          {
            label: 'Units sold',
            value: totalSold,
            color: '#10B981',
            bg: 'rgba(16,185,129,0.08)',
            border: 'rgba(16,185,129,0.15)',
          },
          {
            label: 'Active buyers',
            value: totalActive,
            color: '#3B82F6',
            bg: 'rgba(59,130,246,0.08)',
            border: 'rgba(59,130,246,0.15)',
          },
          {
            label: 'Contracts overdue',
            value: overdue,
            color: overdue > 0 ? '#EF4444' : '#10B981',
            bg: overdue > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
            border: overdue > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
          },
        ].map(stat => (
          <div key={stat.label} style={{
            background: '#fff',
            borderRadius: 16,
            border: '0.5px solid rgba(0,0,0,0.07)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)',
            padding: '20px 24px',
          }}>
            <p style={{ color: '#6B7280', fontSize: 13, fontWeight: 500, margin: '0 0 8px' }}>
              {stat.label}
            </p>
            <p style={{
              color: stat.color,
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: '-0.05em',
              margin: 0,
              lineHeight: 1,
            }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Schemes table */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        border: '0.5px solid rgba(0,0,0,0.07)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)',
        overflow: 'hidden',
        marginBottom: 24,
      }}>
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{ color: '#0D0D12', fontSize: 15, fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>
            Active Schemes
          </h2>
          <a href="/agent/dashboard/pipeline" style={{
            color: '#C49B2A', fontSize: 13, fontWeight: 600,
            textDecoration: 'none', letterSpacing: '-0.01em',
          }}>
            View all →
          </a>
        </div>

        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
          padding: '10px 24px',
          background: '#FAFAF8',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
        }}>
          {['Scheme', 'Units', 'Sold', 'Active', 'Overdue'].map(h => (
            <span key={h} style={{
              color: '#9CA3AF', fontSize: 11, fontWeight: 600,
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              {h}
            </span>
          ))}
        </div>

        {/* Scheme rows */}
        {assignments?.map((a, i) => {
          const dev = a.developments as any;
          const pipeline = dev?.unit_sales_pipeline ?? [];
          const units = dev?.units ?? [];
          const sold = pipeline.filter((p: any) => p.status === 'sold').length;
          const active = pipeline.filter((p: any) =>
            ['agreed', 'contracts_issued', 'signed'].includes(p.status)
          ).length;
          const devOverdue = pipeline.filter((p: any) =>
            p.contracts_issued_date && !p.signed_contracts_date &&
            new Date(p.contracts_issued_date) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          ).length;

          return (
            <a
              key={dev?.id}
              href={`/agent/dashboard/pipeline?scheme=${dev?.id}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                padding: '14px 24px',
                borderBottom: i < (assignments.length - 1) ? '1px solid rgba(0,0,0,0.04)' : 'none',
                textDecoration: 'none',
              }}
            >
              <div>
                <p style={{ color: '#0D0D12', fontSize: 14, fontWeight: 600, margin: '0 0 2px', letterSpacing: '-0.01em' }}>
                  {dev?.name}
                </p>
                <p style={{ color: '#A0A8B0', fontSize: 12, margin: 0 }}>
                  {dev?.address}
                </p>
              </div>
              <span style={{ color: '#374151', fontSize: 14, fontWeight: 500, alignSelf: 'center' }}>
                {Array.isArray(units) ? units.length : (units as any)?.[0]?.count ?? '—'}
              </span>
              <span style={{ color: '#10B981', fontSize: 14, fontWeight: 600, alignSelf: 'center' }}>
                {sold}
              </span>
              <span style={{ color: '#3B82F6', fontSize: 14, fontWeight: 600, alignSelf: 'center' }}>
                {active}
              </span>
              <span style={{
                color: devOverdue > 0 ? '#EF4444' : '#A0A8B0',
                fontSize: 14, fontWeight: devOverdue > 0 ? 600 : 400,
                alignSelf: 'center',
              }}>
                {devOverdue > 0 ? devOverdue : '—'}
              </span>
            </a>
          );
        })}
      </div>

      {/* Switch to mobile app banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        background: '#0D0D12',
        borderRadius: 14,
        color: '#fff',
      }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 2px', letterSpacing: '-0.01em' }}>
            On the go?
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            Switch to the mobile app for viewings, pipeline updates and Intelligence on your phone
          </p>
        </div>
        <a href="/agent/home" style={{
          padding: '8px 16px',
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 10,
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          letterSpacing: '-0.01em',
        }}>
          Open mobile app →
        </a>
      </div>
    </div>
  );
}
