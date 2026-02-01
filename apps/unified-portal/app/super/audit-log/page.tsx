import { requireRole } from '@/lib/supabase-server';
import { AuditLogClient } from './audit-log-client';

export default async function AuditLogPage() {
  await requireRole(['super_admin']);

  return <AuditLogClient />;
}
