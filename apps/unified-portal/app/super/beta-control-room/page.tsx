import { requireRole } from '@/lib/supabase-server';
import BetaControlRoomClient from './beta-control-room-client';

export const dynamic = 'force-dynamic';

export default async function BetaControlRoomPage() {
  await requireRole(['super_admin', 'admin']);

  return <BetaControlRoomClient />;
}
