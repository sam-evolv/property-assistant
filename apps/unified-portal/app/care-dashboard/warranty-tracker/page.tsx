import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { WarrantyTrackerClient } from './warranty-tracker-client';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false }, db: { schema: 'public' } }
  );
}

function computeWarrantyStatus(daysRemaining: number): 'Active' | 'Expiring Soon' | 'Expired' {
  if (daysRemaining < 0) return 'Expired';
  if (daysRemaining <= 90) return 'Expiring Soon';
  return 'Active';
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function WarrantyTrackerPage() {
  let session;
  try {
    session = await requireRole(['installer', 'installer_admin', 'super_admin']);
  } catch {
    return <WarrantyTrackerClient warrantyItems={[]} error="You do not have permission to view this page." />;
  }

  const tenantId = session.tenantId;
  const supabase = getSupabaseAdmin();

  try {
    const { data, error: fetchError } = await supabase
      .from('installations')
      .select('id, customer_name, address_line_1, city, inverter_model, panel_model, install_date, warranty_expiry, system_specs')
      .eq('tenant_id', tenantId)
      .not('warranty_expiry', 'is', null)
      .order('warranty_expiry', { ascending: true });

    if (fetchError) {
      console.error('[WarrantyTracker] Fetch error:', fetchError);
      return <WarrantyTrackerClient warrantyItems={[]} error="Failed to load warranty data." />;
    }

    const today = new Date().toISOString().split('T')[0];
    const warrantyItems: Array<{
      id: number;
      customer: string;
      address: string;
      product: string;
      warrantyStart: string;
      warrantyExpiry: string;
      daysRemaining: number;
      status: 'Active' | 'Expiring Soon' | 'Expired';
      category: 'Solar Panels' | 'Inverters' | 'Workmanship' | 'Batteries';
    }> = [];

    let idCounter = 1;

    (data || []).forEach((inst: any) => {
      const customerName = inst.customer_name || 'Unknown';
      const address = `${inst.address_line_1 || ''}${inst.city ? ', ' + inst.city : ''}`;
      const installDate = inst.install_date;
      const specs = inst.system_specs || {};

      // Panel warranty
      if (inst.panel_model) {
        const panelYears = specs.panel_warranty_years || 25;
        const panelExpiry = addYears(installDate, panelYears);
        const daysLeft = daysBetween(today, panelExpiry);
        warrantyItems.push({
          id: idCounter++,
          customer: customerName,
          address,
          product: inst.panel_model + (specs.panel_count ? ` (x${specs.panel_count || inst.panel_count || ''})` : ''),
          warrantyStart: installDate,
          warrantyExpiry: panelExpiry,
          daysRemaining: daysLeft,
          status: computeWarrantyStatus(daysLeft),
          category: 'Solar Panels',
        });
      }

      // Inverter warranty
      if (inst.inverter_model) {
        const inverterYears = specs.inverter_warranty_years || 10;
        const inverterExpiry = addYears(installDate, inverterYears);
        const daysLeft = daysBetween(today, inverterExpiry);
        warrantyItems.push({
          id: idCounter++,
          customer: customerName,
          address,
          product: inst.inverter_model,
          warrantyStart: installDate,
          warrantyExpiry: inverterExpiry,
          daysRemaining: daysLeft,
          status: computeWarrantyStatus(daysLeft),
          category: 'Inverters',
        });
      }

      // Workmanship warranty
      const workmanshipYears = specs.workmanship_warranty_years || 10;
      const workExpiry = addYears(installDate, workmanshipYears);
      const workDaysLeft = daysBetween(today, workExpiry);
      warrantyItems.push({
        id: idCounter++,
        customer: customerName,
        address,
        product: 'Workmanship Guarantee',
        warrantyStart: installDate,
        warrantyExpiry: workExpiry,
        daysRemaining: workDaysLeft,
        status: computeWarrantyStatus(workDaysLeft),
        category: 'Workmanship',
      });

      // Battery warranty (if battery exists)
      const battery = specs.battery;
      if (battery && battery !== 'none') {
        const batteryYears = specs.battery_warranty_years || 10;
        const batteryExpiry = addYears(installDate, batteryYears);
        const daysLeft = daysBetween(today, batteryExpiry);
        warrantyItems.push({
          id: idCounter++,
          customer: customerName,
          address,
          product: battery,
          warrantyStart: installDate,
          warrantyExpiry: batteryExpiry,
          daysRemaining: daysLeft,
          status: computeWarrantyStatus(daysLeft),
          category: 'Batteries',
        });
      }
    });

    return <WarrantyTrackerClient warrantyItems={warrantyItems} />;
  } catch (err: any) {
    console.error('[WarrantyTracker] Error:', err);
    return <WarrantyTrackerClient warrantyItems={[]} error="Failed to load warranty data. Please refresh the page." />;
  }
}

function addYears(dateStr: string, years: number): string {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split('T')[0];
}
