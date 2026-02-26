'use client';
import { GOLD } from '@/lib/dev-app/design-system';
interface BadgeProps { text: string; color?: string; }
export default function Badge({ text, color = GOLD }: BadgeProps) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
      borderRadius: 8, fontSize: 11, fontWeight: 600, color,
      background: `${color}0d`, letterSpacing: '0.01em', whiteSpace: 'nowrap',
    }}>{text}</span>
  );
}
