'use client';

import { useEffect, useState } from 'react';
import {
  Plug,
  Check,
  ExternalLink,
  RefreshCw,
  Settings,
  Globe,
  Mail,
  HardDrive,
  Database,
  Zap,
  Link2,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { useAgentDashboard } from '../layout-provider';

export const dynamic = 'force-dynamic';

interface Integration {
  id: string;
  name: string;
  type: string;
  status: string;
  last_sync_at: string;
  config: any;
}

const AVAILABLE_INTEGRATIONS = [
  { name: 'Daft.ie', desc: 'Enquiry syncing', icon: Globe, category: 'listings' },
  { name: 'MyHome.ie', desc: 'Property listings', icon: Globe, category: 'listings' },
  { name: 'Microsoft Outlook', desc: 'Email & calendar', icon: Mail, category: 'productivity' },
  { name: 'Google Drive', desc: 'Document storage', icon: HardDrive, category: 'storage' },
  { name: 'Salesforce', desc: 'CRM sync', icon: Database, category: 'crm' },
  { name: 'Property Register', desc: 'Sales verification', icon: Database, category: 'data' },
  { name: 'Zapier', desc: 'Workflow automation', icon: Zap, category: 'automation' },
  { name: 'OpenHouse MCP', desc: 'AI tool integration', icon: Link2, category: 'ai' },
];

export default function AgentDashboardDataIntegrationsPage() {
  const { profile } = useAgentDashboard();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      // Integrations would come from API
      setLoading(false);
    }
    fetchData();
  }, []);

  const connectedNames = integrations.map(i => i.name);
  const lastSync = integrations.length > 0
    ? integrations.reduce((latest, i) => i.last_sync_at > latest ? i.last_sync_at : latest, '')
    : null;

  const formatTime = (d: string) => {
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Quick Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 32px', background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase' as const, marginRight: 8 }}>QUICK ACTIONS</span>
        <button style={{ height: 30, padding: '0 14px', background: '#c8960a', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Plug size={13} /> Connect Integration
        </button>
      </div>

      <div style={{ padding: '28px 32px' }}>
        <h1 style={{ color: '#111', fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', margin: '0 0 8px' }}>Data & Integrations</h1>

        {/* Status bar */}
        <div style={{
          background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)',
          padding: '10px 18px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <span style={{ fontSize: 12.5, color: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Plug size={13} color="rgba(0,0,0,0.35)" /> {integrations.length} integrations connected
          </span>
          <span style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.08)' }} />
          <span style={{ fontSize: 12.5, color: '#15803d', display: 'flex', alignItems: 'center', gap: 5 }}>
            <CheckCircle size={13} /> All syncing normally
          </span>
          {lastSync && (
            <>
              <span style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.08)' }} />
              <span style={{ fontSize: 12.5, color: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock size={13} color="rgba(0,0,0,0.35)" /> Last sync {formatTime(lastSync)}
              </span>
            </>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
          {/* Left: Integration list */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: 0, letterSpacing: '-0.02em' }}>Available Integrations</h3>
            </div>
            {AVAILABLE_INTEGRATIONS.map((integ, i) => {
              const Icon = integ.icon;
              const isConnected = connectedNames.includes(integ.name);
              const liveData = integrations.find(x => x.name === integ.name);
              return (
                <div
                  key={integ.name}
                  onClick={() => setSelectedIntegration(integ.name)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 18px',
                    borderBottom: i < AVAILABLE_INTEGRATIONS.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                    cursor: 'pointer', transition: 'background 0.1s',
                    background: selectedIntegration === integ.name ? '#faf9f7' : 'transparent',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#faf9f7'}
                  onMouseLeave={e => { if (selectedIntegration !== integ.name) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={18} color="#6b7280" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#111', margin: 0 }}>{integ.name}</p>
                    <p style={{ fontSize: 11, color: 'rgba(0,0,0,0.38)', margin: '1px 0 0' }}>{integ.desc}</p>
                  </div>
                  {isConnected ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#15803d', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Check size={12} /> Connected
                      </span>
                      {liveData?.last_sync_at && (
                        <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.35)' }}>{formatTime(liveData.last_sync_at)}</span>
                      )}
                    </div>
                  ) : (
                    <button style={{ height: 28, padding: '0 12px', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 7, color: '#374151', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Connect
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Integration detail */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: 0, letterSpacing: '-0.02em' }}>
                  {selectedIntegration || 'Select an integration'}
                </h3>
              </div>
              <div style={{ padding: '20px 18px', textAlign: 'center' }}>
                {selectedIntegration ? (
                  <div>
                    <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)', margin: '0 0 12px' }}>
                      {connectedNames.includes(selectedIntegration) ? 'This integration is connected and syncing.' : 'Connect this integration to start syncing data.'}
                    </p>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button style={{ height: 30, padding: '0 14px', background: connectedNames.includes(selectedIntegration) ? '#fff' : '#c8960a', border: connectedNames.includes(selectedIntegration) ? '1px solid rgba(0,0,0,0.12)' : 'none', borderRadius: 7, color: connectedNames.includes(selectedIntegration) ? '#374151' : '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {connectedNames.includes(selectedIntegration) ? 'Configure' : 'Connect'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.35)' }}>Click an integration to view details</p>
                )}
              </div>
            </div>

            {/* API Access */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: 0, letterSpacing: '-0.02em' }}>API Access</h3>
              </div>
              {[
                { name: 'REST API', desc: 'Programmatic access' },
                { name: 'Webhooks', desc: 'Event notifications' },
                { name: 'OpenHouse MCP', desc: 'AI tool integration' },
              ].map((api, i) => (
                <div key={api.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderBottom: i < 2 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 500, color: '#111', margin: 0 }}>{api.name}</p>
                    <p style={{ fontSize: 11, color: 'rgba(0,0,0,0.38)', margin: '1px 0 0' }}>{api.desc}</p>
                  </div>
                  <button style={{ height: 26, padding: '0 10px', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, color: '#374151', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Configure</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
