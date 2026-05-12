import type { Metadata, Viewport } from 'next';
import { CareAppProvider } from './care-app-provider';
import { SWRegister } from '../sw-register';
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

// Columns the homeowner Care app actually surfaces to the client. Listing them
// explicitly does two things at once:
//
//   1. Performance. The previous `select('*')` pulled every column on
//      `installations`, including large JSONB blobs the layout does not need.
//      That made every RSC navigation slower than it had to be, and is the
//      most plausible root cause of the gateway-level 503 the audit caught
//      on `/care/[id]?_rsc=...` requests under cold-start conditions.
//
//   2. Security. `telemetry_api_key` is intentionally NOT in this list. It
//      is plaintext on the row today (tracked separately in the security
//      audit) and has no business being serialised into a client provider.
//      Dropping `*` makes it impossible to leak by accident.
//
// Keep this list in sync with InstallationData in care-app-provider.tsx.
const INSTALLATION_COLUMNS = [
  'id',
  'tenant_id',
  'job_reference',
  'customer_name',
  'customer_email',
  'customer_phone',
  'address_line_1',
  'city',
  'county',
  'system_type',
  'system_category',
  'system_size_kwp',
  'inverter_model',
  'panel_model',
  'panel_count',
  'install_date',
  'warranty_expiry',
  'health_status',
  'portal_status',
  'system_specs',
  'heat_pump_model',
  'heat_pump_serial',
  'heat_pump_cop',
  'flow_temp_current',
  'zones_total',
  'zones_active',
  'hot_water_cylinder_model',
  'hot_water_temp_current',
  'controls_model',
  'controls_issue',
  'last_service_date',
  'next_service_due',
  'warranty_years',
  'annual_service_required',
  'seai_grant_amount',
  'seai_grant_status',
  'seai_grant_ref',
  'seai_application_date',
  'ber_rating',
  'active_safety_alerts',
  'indoor_temp_current',
  'indoor_temp_target',
  'daily_running_cost_cents',
  'co2_saved_today_grams',
  'monthly_running_cost_cents',
  'monthly_budget_cents',
].join(', ') + ', tenants(name, contact, logo_url)';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ installationId: string }>;
}): Promise<Metadata> {
  const { installationId } = await params;

  // Resolve the tenant logo so iOS "Add to Home Screen" picks it up via the
  // apple-touch-icon link (Android Chrome uses the manifest icons separately).
  let tenantLogo: string | null = null;
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('installations')
      .select('tenants(logo_url)')
      .eq('id', installationId)
      .maybeSingle();
    tenantLogo = (data as any)?.tenants?.logo_url ?? null;
  } catch (err) {
    // Non-fatal. The page renders fine with the default icon. Log so we can
    // grep for a regression without needing another full audit.
    console.warn(
      '[care.layout.metadata_fetch_error] installation_id=%s error=%s',
      installationId,
      err instanceof Error ? err.message : String(err),
    );
  }

  return {
    title: 'OpenHouse Care',
    description: 'Your home system care portal',
    manifest: `/api/care/manifest/${installationId}`,
    icons: tenantLogo
      ? { icon: [{ url: tenantLogo }], apple: [{ url: tenantLogo }] }
      : undefined,
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: 'OpenHouse Care',
    },
  };
}

export default async function CareAppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ installationId: string }>;
}) {
  const { installationId } = await params;

  let installation: Record<string, unknown> | null = null;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('installations')
      .select(INSTALLATION_COLUMNS)
      .eq('id', installationId)
      .maybeSingle();

    if (error) {
      // Surface the database error path with a grep-able tag. Without this
      // log, an upstream Supabase issue is invisible: the layout either
      // 503s at the gateway (cold start + slow query) or silently 404s
      // (notFound below) and we cannot tell the two apart.
      console.error(
        '[care.layout.installation_fetch_error] installation_id=%s code=%s message=%s',
        installationId,
        error.code,
        error.message,
      );
    }

    installation = data as Record<string, unknown> | null;
  } catch (err) {
    // createClient itself can throw if SUPABASE_SERVICE_ROLE_KEY is missing
    // or malformed. The centralised getSupabaseAdmin in lib/supabase-server
    // throws a descriptive error in that case; without this catch, the
    // throw becomes an opaque 5xx from the function gateway.
    console.error(
      '[care.layout.supabase_client_error] installation_id=%s error=%s',
      installationId,
      err instanceof Error ? err.message : String(err),
    );
  }

  if (!installation) {
    notFound();
  }

  const tenants = (installation as any).tenants ?? null;
  const installerName = tenants?.name || 'Your Installer';

  const installationData = {
    ...installation,
    installer_name: installerName,
    installer_contact: tenants?.contact || {},
  };

  return (
    <CareAppProvider installationId={installationId} installation={installationData as any}>
      <SWRegister />
      {children}
    </CareAppProvider>
  );
}
