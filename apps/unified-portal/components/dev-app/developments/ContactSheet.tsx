'use client';

import { HouseIcon, PhoneIcon, EmailSmallIcon, XIcon } from '@/components/dev-app/shared/Icons';
import Badge from '@/components/dev-app/shared/Badge';
import {
  TEXT_1, TEXT_2, TEXT_3, SURFACE_2, BORDER_LIGHT,
  GREEN, BLUE, type SectorUnit,
} from '@/lib/dev-app/design-system';

interface ContactSheetProps {
  unit: SectorUnit | null;
  onClose: () => void;
}

export default function ContactSheet({ unit, onClose }: ContactSheetProps) {
  if (!unit) return null;

  const detailRows: { label: string; value: string }[] = [
    { label: 'Solicitor', value: unit.solicitor },
    { label: 'Agent', value: unit.agent },
    { label: 'Deposit', value: unit.deposit },
    { label: 'Price', value: unit.price },
    { label: 'Move-in date', value: unit.moveIn },
  ];

  return (
    <>
      {/* Full-screen overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
        }}
      >
        {/* Backdrop */}
        <div
          onClick={onClose}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        />
      </div>

      {/* Sheet container */}
      <div
        className="da-anim-sheet"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: '#fff',
          borderRadius: '24px 24px 0 0',
          padding: 24,
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        {/* Close button */}
        <div
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: SURFACE_2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <XIcon />
        </div>

        {/* Unit header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HouseIcon />
          <span style={{ color: TEXT_1, fontSize: 18, fontWeight: 700 }}>
            {unit.unit}
          </span>
        </div>

        {/* Person name */}
        <div style={{ color: TEXT_2, fontSize: 14, marginTop: 6 }}>
          {unit.name}
        </div>

        {/* Stage badge */}
        <div style={{ marginTop: 8 }}>
          <Badge text={unit.stage} color={unit.stageColor} />
        </div>

        {/* Action buttons row */}
        <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
          {/* Call button */}
          <a
            href={`tel:${unit.phone}`}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 12,
              background: GREEN,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            <PhoneIcon />
            <span style={{ color: '#fff' }}>Call</span>
          </a>

          {/* Email button */}
          <a
            href={`mailto:${unit.email}`}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 12,
              background: BLUE,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            <EmailSmallIcon color="#fff" />
            <span style={{ color: '#fff' }}>Email</span>
          </a>
        </div>

        {/* Detail rows */}
        <div
          style={{
            marginTop: 20,
            borderTop: `1px solid ${BORDER_LIGHT}`,
            paddingTop: 16,
          }}
        >
          {detailRows.map((row, i) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: 10,
                paddingBottom: 10,
                borderBottom:
                  i < detailRows.length - 1
                    ? `1px solid ${BORDER_LIGHT}`
                    : 'none',
              }}
            >
              <span style={{ color: TEXT_3, fontSize: 13 }}>{row.label}</span>
              <span style={{ color: TEXT_1, fontSize: 13, fontWeight: 600 }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
