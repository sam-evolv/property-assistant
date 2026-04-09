'use client';
import { T } from '@/lib/agent/tokens';
import { useAgentData } from '@/hooks/agent/useAgentData';
import { Avatar } from '@/components/agent/ui/Avatar';
import { Card } from '@/components/agent/ui/Card';
import { SectionLabel } from '@/components/agent/ui/SectionLabel';
import {
  Check, Plus, ChevronRight, Bell, Monitor, HelpCircle, Star, LogOut,
} from 'lucide-react';

const CONNECTED = [
  { name: 'Daft.ie', live: true },
  { name: 'MyHome.ie', live: true },
  { name: 'Gmail', live: true },
  { name: 'Google Drive', live: true },
  { name: 'WhatsApp Business', live: true },
];

const NOT_CONNECTED = [
  { name: 'DocuSign' },
  { name: 'Outlook' },
];

const SETTINGS = [
  { label: 'Notification preferences', icon: Bell },
  { label: 'Display & accessibility', icon: Monitor },
  { label: 'Help & support', icon: HelpCircle },
  { label: 'Rate OpenHouse Agent', icon: Star },
];

export default function ProfilePage() {
  const { profile, schemes, buyers } = useAgentData();
  const totalSold = schemes.reduce((s, sc) => s + (sc.stages?.closed || 0), 0);
  const totalActive = buyers.filter(b => b.status !== 'enquiry').length;
  const totalSchemes = schemes.length;

  return (
    <div style={{ padding: '52px 16px 32px', background: T.bg, minHeight: '100%' }}>
      {/* Agent card */}
      <Card style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <Avatar initials={profile.avatar_initials || 'SC'} size={56} gold />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.t1 }}>{profile.name}</div>
            <div style={{ fontSize: 12, color: T.t3 }}>{profile.firm}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.gold, marginTop: 2 }}>{profile.title}</div>
          </div>
        </div>

        {/* Stats */}
        <div style={{
          display: 'flex', borderTop: `1px solid ${T.line}`, paddingTop: 14,
        }}>
          {[
            { n: totalSold, label: 'Sold' },
            { n: totalActive, label: 'Active' },
            { n: totalSchemes, label: 'Portfolio' },
          ].map((s, i) => (
            <div key={s.label} style={{
              flex: 1, textAlign: 'center',
              borderRight: i < 2 ? `1px solid ${T.line}` : 'none',
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.goldD }}>{s.n}</div>
              <div style={{ fontSize: 10, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Integrations */}
      <SectionLabel style={{ marginTop: 20 }}>Integrations</SectionLabel>
      <Card style={{ padding: '4px 16px', marginBottom: 16 }}>
        {CONNECTED.map(item => (
          <div key={item.name} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 0', borderBottom: `1px solid ${T.line}`,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: T.goL,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Check size={16} color={T.go} />
            </div>
            <span style={{ flex: 1, fontSize: 13, color: T.t1 }}>{item.name}</span>
            <span style={{
              padding: '3px 8px', borderRadius: 10,
              background: T.goL, fontSize: 10, fontWeight: 600, color: T.go,
            }}>
              Live
            </span>
          </div>
        ))}
        {NOT_CONNECTED.map(item => (
          <div key={item.name} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 0', borderBottom: `1px solid ${T.line}`,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: T.s1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Plus size={16} color={T.t3} />
            </div>
            <span style={{ flex: 1, fontSize: 13, color: T.t1 }}>{item.name}</span>
            <span style={{
              padding: '3px 8px', borderRadius: 10,
              background: T.infoL, fontSize: 10, fontWeight: 600, color: T.info,
              cursor: 'pointer',
            }}>
              Connect
            </span>
          </div>
        ))}
      </Card>

      {/* Settings */}
      <SectionLabel style={{ marginTop: 20 }}>Settings</SectionLabel>
      <Card style={{ padding: '4px 16px', marginBottom: 16 }}>
        {SETTINGS.map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 0', borderBottom: `1px solid ${T.line}`,
              cursor: 'pointer',
            }}>
              <Icon size={18} color={T.t3} />
              <span style={{ flex: 1, fontSize: 13, color: T.t1 }}>{item.label}</span>
              <ChevronRight size={16} color={T.t4} />
            </div>
          );
        })}
      </Card>

      {/* Sign out */}
      <button style={{
        width: '100%', padding: '14px 0', borderRadius: 14,
        background: 'transparent', border: `1px solid ${T.line}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontSize: 14, fontWeight: 600, color: T.flag, cursor: 'pointer',
        marginTop: 8,
      }}>
        <LogOut size={16} /> Sign Out
      </button>
    </div>
  );
}
