/**
 * Seed realistic installation data for Cork region
 * Run: npx ts-node scripts/seed-care-installations.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface InstallationSeed {
  system_type: 'solar' | 'heat_pump' | 'hvac' | 'ev_charger';
  system_model: string;
  capacity: string;
  serial_number: string;
  installation_date: string;
  warranty_expiry: string;
  homeowner_email: string;
  component_specs: Record<string, any>;
  performance_baseline: Record<string, any>;
  telemetry_source: string;
}

const CORK_INSTALLATIONS: InstallationSeed[] = [
  {
    system_type: 'solar',
    system_model: 'SolarEdge SE6000H',
    capacity: '6.6 kWp',
    serial_number: 'SE7E234567A',
    installation_date: '2024-03-15',
    warranty_expiry: '2034-03-15',
    homeowner_email: 'margaret.oconnor@example.ie',
    component_specs: {
      inverter: 'SolarEdge SE6000H',
      panels: '16x 415W Jinko Eagle',
      panelCount: 16,
      stringConfiguration: '2 strings of 8',
      dcConnectorType: 'MC4',
      acOutputPhase: 'single',
    },
    performance_baseline: {
      daily_avg_kwh: 22,
      monthly_avg_kwh: 660,
      annual_kwh: 7920,
      co2_saved_annual_tonnes: 3.2,
    },
    telemetry_source: 'mock', // Will use realistic mock data
  },
  {
    system_type: 'solar',
    system_model: 'Fronius Symo 8.0-3-M',
    capacity: '8.0 kWp',
    serial_number: 'FRO123456789',
    installation_date: '2024-02-10',
    warranty_expiry: '2034-02-10',
    homeowner_email: 'sean.murphy@example.ie',
    component_specs: {
      inverter: 'Fronius Symo 8.0-3-M',
      panels: '20x 400W Trina Solar',
      panelCount: 20,
      stringConfiguration: '2 strings of 10',
      acOutputPhase: 'three',
      monitoring: 'Fronius Smart Meter',
    },
    performance_baseline: {
      daily_avg_kwh: 26,
      monthly_avg_kwh: 780,
      annual_kwh: 9360,
      co2_saved_annual_tonnes: 3.8,
    },
    telemetry_source: 'mock',
  },
  {
    system_type: 'solar',
    system_model: 'SolarEdge SE3680H',
    capacity: '3.68 kWp',
    serial_number: 'SE7E987654B',
    installation_date: '2024-01-20',
    warranty_expiry: '2034-01-20',
    homeowner_email: 'aoife.ryan@example.ie',
    component_specs: {
      inverter: 'SolarEdge SE3680H (compact)',
      panels: '8x 460W LG Solar',
      panelCount: 8,
      stringConfiguration: '1 string of 8',
      installation_location: 'Cork City apartment building',
    },
    performance_baseline: {
      daily_avg_kwh: 11,
      monthly_avg_kwh: 330,
      annual_kwh: 3960,
      co2_saved_annual_tonnes: 1.6,
    },
    telemetry_source: 'mock',
  },
  {
    system_type: 'heat_pump',
    system_model: 'Nibe F2120 15kW',
    capacity: '15 kW',
    serial_number: 'NIBE123456789',
    installation_date: '2024-04-01',
    warranty_expiry: '2029-04-01',
    homeowner_email: 'michael.ohara@example.ie',
    component_specs: {
      type: 'Air-to-Water heat pump',
      model: 'Nibe F2120',
      capacity_heating: '15 kW',
      capacity_hot_water: '10 kW',
      sound_level: '47 dB',
      refrigerant: 'R32 (low-GWP)',
      controlModule: 'Nibe SmartHomeCommand',
    },
    performance_baseline: {
      annual_heating_kwh: 8000,
      annual_hot_water_kwh: 2500,
      average_cop: 3.8,
      seasonal_cop: 3.5,
    },
    telemetry_source: 'mock',
  },
  {
    system_type: 'heat_pump',
    system_model: 'Samsung ClimateStudio 12kW',
    capacity: '12 kW',
    serial_number: 'SAM123ABC456',
    installation_date: '2024-05-15',
    warranty_expiry: '2029-05-15',
    homeowner_email: 'emma.kelly@example.ie',
    component_specs: {
      type: 'Air-to-Water heat pump',
      model: 'Samsung ClimateStudio',
      capacity: '12 kW',
      quietness_rating: 'Level 1 (Quiet)',
      smart_control: 'SmartThings app',
      installation_note: 'Underfloor heating system',
    },
    performance_baseline: {
      annual_heating_kwh: 6500,
      annual_hot_water_kwh: 1800,
      average_cop: 4.2,
      seasonal_cop: 3.9,
    },
    telemetry_source: 'mock',
  },
  {
    system_type: 'ev_charger',
    system_model: 'Wallbox Pulsar Plus 11kW',
    capacity: '11 kW',
    serial_number: 'WB123DEF456',
    installation_date: '2024-03-01',
    warranty_expiry: '2026-03-01',
    homeowner_email: 'david.sullivan@example.ie',
    component_specs: {
      type: 'Wall-mounted EV charger',
      model: 'Wallbox Pulsar Plus',
      power: '11 kW',
      charging_speed: 'up to 48km range per hour',
      connectorType: 'Type 2 (EU standard)',
      smartControl: 'WiFi enabled',
    },
    performance_baseline: {
      average_charge_sessions_per_week: 1.5,
      average_energy_per_session: 15,
      annual_energy_kwh: 1170,
    },
    telemetry_source: 'mock',
  },
];

async function seedInstallations() {
  try {
    console.log('🌱 Seeding Cork installations...');

    // Get SE Systems tenant (use first available for demo)
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id')
      .limit(1);

    if (!tenants || tenants.length === 0) {
      console.error('❌ No tenants found. Create a tenant first.');
      process.exit(1);
    }

    const tenantId = tenants[0].id;
    console.log(`✓ Using tenant: ${tenantId}`);

    // Insert installations
    for (const install of CORK_INSTALLATIONS) {
      const qrCode = generateQRCode();

      const { data, error } = await supabase
        .from('installations')
        .insert({
          tenant_id: tenantId,
          system_type: install.system_type,
          system_model: install.system_model,
          capacity: install.capacity,
          serial_number: install.serial_number,
          installation_date: install.installation_date,
          warranty_expiry: install.warranty_expiry,
          homeowner_email: install.homeowner_email,
          component_specs: install.component_specs,
          performance_baseline: install.performance_baseline,
          telemetry_source: install.telemetry_source,
          qr_code: qrCode,
          handover_date: new Date(install.installation_date).toISOString(),
          adoption_status: 'pending',
        })
        .select();

      if (error) {
        console.error(`❌ Failed to insert ${install.system_model}:`, error);
      } else {
        console.log(`✓ Seeded: ${install.system_model} (${install.capacity}) - QR: ${qrCode}`);

        // Also insert some sample telemetry
        await insertSampleTelemetry(data[0].id, install.system_type);
      }
    }

    console.log('\n✅ Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

function generateQRCode(): string {
  // In production, this would generate actual QR code data
  // For now, just a unique identifier
  return `CARE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
}

async function insertSampleTelemetry(installationId: string, systemType: string) {
  const now = new Date();
  const telemetryPoints = [];

  // Insert 24 hours of sample data (hourly)
  for (let i = 0; i < 24; i++) {
    const timestamp = new Date(now.getTime() - (24 - i) * 3600 * 1000);

    if (systemType === 'solar') {
      // Solar: peak at noon
      const hour = timestamp.getHours();
      const generation = Math.max(0, 20 * Math.sin(((hour - 6) * Math.PI) / 12) * (0.8 + Math.random() * 0.4));

      telemetryPoints.push({
        installation_id: installationId,
        generation_kwh: parseFloat(generation.toFixed(2)),
        self_consumption_pct: 65 + Math.random() * 20,
        inverter_status: 'OK',
        weather_status: Math.random() > 0.3 ? 'sunny' : 'cloudy',
        outdoor_temp_c: 12 + Math.random() * 8,
        recorded_at: timestamp.toISOString(),
      });
    } else if (systemType === 'heat_pump') {
      telemetryPoints.push({
        installation_id: installationId,
        consumption_kwh: 2 + Math.random() * 3,
        cop: 3.5 + Math.random() * 1,
        flow_temp_c: 45 + Math.random() * 5,
        return_temp_c: 38 + Math.random() * 4,
        outdoor_temp_c: 8 + Math.random() * 8,
        recorded_at: timestamp.toISOString(),
      });
    }
  }

  if (telemetryPoints.length > 0) {
    const { error } = await supabase
      .from('installation_telemetry')
      .insert(telemetryPoints);

    if (error) {
      console.warn(`  ⚠️  Sample telemetry insert failed:`, error);
    }
  }
}

seedInstallations();
