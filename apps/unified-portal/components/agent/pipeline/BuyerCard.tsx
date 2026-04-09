'use client';
import { T } from '@/lib/agent/tokens';
import { AgentBuyer } from '@/lib/agent/types';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Pill } from '../ui/Pill';
import { TimelineTrack } from './TimelineTrack';

interface Props {
  buyer: AgentBuyer;
  onTap: () => void;
}

export function BuyerCard({ buyer, onTap }: Props) {
  const isUrgent = buyer.is_urgent;
  return (
    <div onClick={onTap} style={{
      background: T.card, borderRadius: 16, padding: '16px 18px', marginBottom: 10,
      border: `1px solid ${isUrgent ? T.flagM : T.line}`,
      boxShadow: isUrgent ? '0 2px 10px rgba(191,55,40,.07)' : '0 1px 4px rgba(0,0,0,0.04)',
      cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
        <Avatar initials={buyer.initials || buyer.name.charAt(0)} size={44} gold />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: isUrgent ? T.flag : T.t1 }}>{buyer.name}</div>
          <div style={{ fontSize: 12, color: T.t3 }}>
            {buyer.unit_ref}{buyer.scheme_name ? ` · ${buyer.scheme_name}` : ''}
          </div>
        </div>
        <Badge status={buyer.status} />
      </div>

      <TimelineTrack
        depositDate={buyer.deposit_date}
        contractsDate={buyer.contracts_date}
        contractsSignedDate={buyer.contracts_signed_date}
        closingDate={buyer.closing_date}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {buyer.budget && <Pill>{buyer.budget}</Pill>}
        <Pill color={buyer.aip_approved ? T.go : T.flag} bg={buyer.aip_approved ? T.goL : T.flagL}>
          {buyer.aip_approved ? 'AIP ✓' : 'No AIP'}
        </Pill>
        {buyer.source && <Pill>{buyer.source}</Pill>}
        {buyer.last_contact && <Pill>{buyer.last_contact}</Pill>}
      </div>
    </div>
  );
}
