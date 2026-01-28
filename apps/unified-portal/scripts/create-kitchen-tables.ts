import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';

async function createKitchenTables() {
  console.log('Creating kitchen_selections and kitchen_selection_options tables...');

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS kitchen_selections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        development_id UUID NOT NULL REFERENCES developments(id),
        unit_id UUID NOT NULL UNIQUE REFERENCES units(id),
        has_kitchen BOOLEAN NOT NULL DEFAULT false,
        counter_type TEXT,
        unit_finish TEXT,
        handle_style TEXT,
        has_wardrobe BOOLEAN NOT NULL DEFAULT false,
        wardrobe_style TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    console.log('Created kitchen_selections table');

    await db.execute(sql`CREATE INDEX IF NOT EXISTS kitchen_selections_tenant_idx ON kitchen_selections(tenant_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS kitchen_selections_development_idx ON kitchen_selections(development_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS kitchen_selections_unit_idx ON kitchen_selections(unit_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS kitchen_selections_tenant_dev_idx ON kitchen_selections(tenant_id, development_id)`);
    console.log('Created kitchen_selections indexes');

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS kitchen_selection_options (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        development_id UUID NOT NULL REFERENCES developments(id),
        counter_types JSONB NOT NULL DEFAULT '["Granite", "Quartz", "Marble", "Laminate"]'::jsonb,
        unit_finishes JSONB NOT NULL DEFAULT '["Matt White", "Gloss White", "Oak", "Walnut"]'::jsonb,
        handle_styles JSONB NOT NULL DEFAULT '["Bar", "Knob", "Integrated", "Cup"]'::jsonb,
        wardrobe_styles JSONB NOT NULL DEFAULT '["Sliding", "Hinged", "Walk-in"]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    console.log('Created kitchen_selection_options table');

    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS kitchen_selection_options_unique_idx ON kitchen_selection_options(tenant_id, development_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS kitchen_selection_options_tenant_idx ON kitchen_selection_options(tenant_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS kitchen_selection_options_development_idx ON kitchen_selection_options(development_id)`);
    console.log('Created kitchen_selection_options indexes');

    console.log('Kitchen tables created successfully!');
  } catch (error) {
    console.error('Error creating kitchen tables:', error);
    throw error;
  }
}

createKitchenTables()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
