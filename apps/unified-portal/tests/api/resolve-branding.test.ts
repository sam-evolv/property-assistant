/**
 * Database-level tests for branding resolution logic
 * Tests that development data is properly linked for branding display
 */

import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';

describe('Branding Resolution - Database Integrity', () => {
  it('should have developments with names defined', async () => {
    const { rows: developments } = await db.execute(sql`
      SELECT id, name, logo_url, tenant_id FROM developments
    `);

    expect(developments.length).toBeGreaterThan(0);

    for (const dev of developments as { id: string; name: string; logo_url: string | null; tenant_id: string | null }[]) {
      expect(dev.name).toBeDefined();
      expect(dev.name).not.toBeNull();
      expect(dev.name.length).toBeGreaterThan(0);
      expect(dev.name).not.toBe('Your Development');
    }
  });

  it('should have unique development names', async () => {
    const { rows: developments } = await db.execute(sql`
      SELECT LOWER(name) as name_lower, COUNT(*) as cnt
      FROM developments
      GROUP BY LOWER(name)
      HAVING COUNT(*) > 1
    `);

    expect(developments.length).toBe(0);
  });

  it('should count units with and without development_id', async () => {
    const { rows: stats } = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(development_id) as with_dev_id,
        COUNT(*) - COUNT(development_id) as without_dev_id
      FROM units
    `);

    const stat = stats[0] as { total: string; with_dev_id: string; without_dev_id: string };
    console.log(`Units: ${stat.total} total, ${stat.with_dev_id} with development_id, ${stat.without_dev_id} without`);
    
    expect(parseInt(stat.total)).toBeGreaterThan(0);
  });

  it('should have units with development_id correctly linked to developments', async () => {
    const { rows: unlinkedUnits } = await db.execute(sql`
      SELECT u.id, u.development_id
      FROM units u
      LEFT JOIN developments d ON u.development_id = d.id
      WHERE u.development_id IS NOT NULL AND d.id IS NULL
    `);

    expect(unlinkedUnits.length).toBe(0);
  });

  it('should have expected developments for known estates', async () => {
    const expectedDevelopments = ['Longview Park', 'Rathard Park'];
    
    for (const devName of expectedDevelopments) {
      const { rows } = await db.execute(sql`
        SELECT id, name FROM developments WHERE LOWER(name) = LOWER(${devName}) LIMIT 1
      `);
      
      expect(rows.length).toBe(1);
      console.log(`Found development: ${(rows[0] as any).name}`);
    }
  });

  it('should never have development name as "Your Development" placeholder', async () => {
    const { rows } = await db.execute(sql`
      SELECT id, name FROM developments WHERE name = 'Your Development'
    `);

    expect(rows.length).toBe(0);
  });
});

describe('Branding Resolution - Drizzle Incomplete Detection', () => {
  it('should identify units needing Supabase fallback (no development_id OR no dev_name)', async () => {
    const { rows: incompleteUnits } = await db.execute(sql`
      SELECT u.id, u.development_id, d.name as dev_name
      FROM units u
      LEFT JOIN developments d ON u.development_id = d.id
      WHERE u.development_id IS NULL OR d.name IS NULL
      LIMIT 10
    `);

    console.log(`Found ${incompleteUnits.length} units that would trigger Supabase fallback`);
    
    for (const unit of incompleteUnits as any[]) {
      const reason = !unit.development_id ? 'no development_id' : 'no dev_name';
      console.log(`  Unit ${unit.id}: ${reason}`);
    }
  });

  it('should identify units with complete branding data', async () => {
    const { rows: completeUnits } = await db.execute(sql`
      SELECT u.id, u.development_id, d.name as dev_name, d.logo_url
      FROM units u
      JOIN developments d ON u.development_id = d.id
      WHERE d.name IS NOT NULL
      LIMIT 5
    `);

    console.log(`Found ${completeUnits.length} units with complete branding data`);
    
    for (const unit of completeUnits as any[]) {
      expect(unit.dev_name).toBeDefined();
      expect(unit.dev_name).not.toBeNull();
      expect(unit.dev_name).not.toBe('Your Development');
    }
  });
});
