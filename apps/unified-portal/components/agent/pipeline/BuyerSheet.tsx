'use client';
import { T } from '@/lib/agent/tokens';
import { AgentBuyer } from '@/lib/agent/types';
import { BottomSheet } from '../ui/BottomSheet';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { DataRow } from '../ui/DataRow';
import { GhostButton } from '../ui/GhostButton';
import { PrimaryButton } from '../ui/PrimaryButton';
import { SectionLabel } from '../ui/SectionLabel';
import { Phone, Mail, Zap } from 'lucide-react';

interface Props {
  buyer: AgentBuyer | null;
  open: boolean;
  onClose: () => void;
}

const SALE_STAGES = [
  { key: 'deposit', label: 'Deposit Paid', color: '#1756A8' },
  { key: 'contracts', label: 'Contracts Issued', color: '#C4A44A' },
  { key: 'signed', label: 'Contracts Signed', color: '#5B30AC' },
  { key: 'closing', label: 'Closing', color: '#0A7855' },
];

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
  } catch {
    return d;
  }
}

export function BuyerSheet({ buyer, open, onClose }: Props) {
  if (!buyer) return null;

  const scoreColor = buyer.ai_score > 80 ? T.go : buyer.ai_score > 60 ? T.warn : T.flag;
  const dates = [buyer.deposit_date, buyer.contracts_date, buyer.contracts_signed_date, buyer.closing_date];

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <Avatar initials={buyer.initials || buyer.name.charAt(0)} size={52} gold />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 21, fontWeight: 700, color: T.t1 }}>{buyer.name}</div>
          <div style={{ fontSize: 12, color: T.t3 }}>
            {buyer.unit_ref}{buyer.scheme_name ? ` · ${buyer.scheme_name}` : ''}
          </div>
          <div style={{ marginTop: 6 }}><Badge status={buyer.status} /></div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: scoreColor }}>{buyer.ai_score}</div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: T.t4, textTransform: 'uppercase' }}>Score</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <GhostButton style={{ flex: 1 }}><Phone size={14} /> Call</GhostButton>
        <GhostButton style={{ flex: 1 }}><Mail size={14} /> Email</GhostButton>
        <PrimaryButton style={{ flex: 1 }}><Zap size={14} /> AI Draft</PrimaryButton>
      </div>

      <div style={{ background: T.s1, borderRadius: 14, padding: '16px 18px', marginBottom: 18 }}>
        <SectionLabel>Sale Timeline</SectionLabel>
        {SALE_STAGES.map((stage, i) => {
          const hasDate = !!dates[i];
          return (
            <div key={stage.key} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
              borderBottom: i < 3 ? `1px solid ${T.line}` : 'none',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: hasDate ? stage.color : T.s3,
              }} />
              <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: hasDate ? T.t2 : T.t4 }}>
                {stage.label}
              </span>
              <span style={{ fontSize: 12, fontWeight: 500, color: hasDate ? T.t1 : T.t4 }}>
                {dates[i] ? formatDate(dates[i]!) : '—'}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ marginBottom: 18 }}>
        {buyer.phone && <DataRow label="Phone" value={buyer.phone} />}
        {buyer.email && <DataRow label="Email" value={buyer.email} />}
        <DataRow label="Budget" value={buyer.budget || '—'} />
        <DataRow label="AIP">
          <span style={{ fontSize: 13, fontWeight: 600, color: buyer.aip_approved ? T.go : T.flag }}>
            {buyer.aip_approved ? 'Approved ✓' : 'Not approved'}
          </span>
        </DataRow>
        <DataRow label="Timeline" value={buyer.timeline || '—'} />
      </div>

      {buyer.notes && (
        <div style={{ background: T.s1, borderRadius: 12, padding: '14px 16px' }}>
          <SectionLabel style={{ marginBottom: 6 }}>Notes</SectionLabel>
          <p style={{ fontSize: 13, color: T.t2, lineHeight: 1.6, margin: 0 }}>{buyer.notes}</p>
        </div>
      )}
    </BottomSheet>
  );
}
