/**
 * Regression guard for Issue 1.4 / Chrome ISSUE-008.
 *
 * Within the same session the agent answered "BER (4/12)" then
 * "BER (11/12)" for the same portfolio. The numbers were drawn from
 * different definitions: 4/12 = `ber.ok` from the compliance loader
 * (cert number on file OR ber_cert doc uploaded) vs. 11/12 = "not
 * expired" inferred by the model from the COMPLIANCE ATTENTION block.
 *
 * Two contracts under test:
 *   1. `getLettingsCompliance` returns the SAME `ber.ok` flag on
 *      consecutive calls with the same data — no caching, no clock
 *      coupling, no randomness.
 *   2. The `ber.ok` definition is exactly `berCertNumber set OR
 *      ber_cert doc uploaded` — the canonical one — and does not
 *      consult `ber_expiry_date`.
 *
 * Hermetic — stubbed Supabase, no network.
 */

import { getLettingsCompliance } from '../../lib/agent-intelligence/context';

type Row = Record<string, any>;

function buildSupabaseStub(byTable: Record<string, Row[]>) {
  const make = (rows: Row[]) => {
    const builder: any = {
      _rows: rows,
      _filters: [] as Array<(r: Row) => boolean>,
      select() { return builder; },
      eq(col: string, val: any) { builder._filters.push((r: Row) => r[col] === val); return builder; },
      then(resolve: (v: any) => any) {
        const filtered = builder._rows.filter((r: Row) => builder._filters.every((f: any) => f(r)));
        return Promise.resolve({ data: filtered, error: null }).then(resolve);
      },
    };
    return builder;
  };
  return {
    from(name: string) {
      return make(byTable[name] || []);
    },
  } as any;
}

const AGENT_ID = '0f9210e0-342d-4f98-9be1-95decb6f507a';

// 12 properties of which 4 have ber_cert_number on file. None have
// ber_cert in lettings_documents. Mirrors the production data shape
// that produced "4/12" vs "11/12" in the bug report.
const PROPERTIES: Row[] = Array.from({ length: 12 }).map((_, i) => ({
  id: `prop-${i + 1}`,
  agent_id: AGENT_ID,
  address: `${i + 1} Demo Street`,
  city: 'Dublin',
  status: 'let',
  ber_cert_number: i < 4 ? `B${100000 + i}` : null,
  ber_expiry_date: i < 11 ? '2027-01-01' : '2024-01-01',
}));

const TENANCIES: Row[] = PROPERTIES.map((p, i) => ({
  id: `t-${i + 1}`,
  letting_property_id: p.id,
  tenant_name: `Tenant ${i + 1}`,
  agent_id: AGENT_ID,
  status: 'active',
  rtb_registration_number: i % 3 === 0 ? `RTB-${i}` : null,
  rtb_registered: i % 3 === 0,
}));

const DOCUMENTS: Row[] = []; // No ber_cert docs uploaded.

describe('getLettingsCompliance ber.ok determinism (Issue 1.4)', () => {
  it('returns the same ber.ok per-property across two consecutive calls', async () => {
    const supabase = buildSupabaseStub({
      agent_letting_properties: PROPERTIES,
      agent_tenancies: TENANCIES,
      lettings_documents: DOCUMENTS,
    });
    const first = await getLettingsCompliance(supabase, AGENT_ID);
    const second = await getLettingsCompliance(supabase, AGENT_ID);
    expect(first.length).toBe(second.length);
    for (let i = 0; i < first.length; i++) {
      expect(second[i].propertyId).toBe(first[i].propertyId);
      expect(second[i].ber.ok).toBe(first[i].ber.ok);
    }
  });

  it('counts ber.ok as cert-on-file (4 of 12), NOT not-expired (11 of 12)', async () => {
    const supabase = buildSupabaseStub({
      agent_letting_properties: PROPERTIES,
      agent_tenancies: TENANCIES,
      lettings_documents: DOCUMENTS,
    });
    const records = await getLettingsCompliance(supabase, AGENT_ID);
    const okCount = records.filter((r) => r.ber.ok).length;
    expect(okCount).toBe(4); // matches the canonical definition
    expect(okCount).not.toBe(11); // would be wrong (uses ber_expiry_date)
  });

  it('does not consult ber_expiry_date when computing ber.ok', async () => {
    // A property with a fresh expiry date but NO cert number and NO uploaded
    // doc is still ber.ok=false. (And vice versa — cert number set but
    // expired stays ber.ok=true; expiry is a separate dimension.)
    const props: Row[] = [
      { id: 'p1', agent_id: AGENT_ID, address: '1 Demo', city: 'Dublin', status: 'let', ber_cert_number: null, ber_expiry_date: '2099-01-01' },
      { id: 'p2', agent_id: AGENT_ID, address: '2 Demo', city: 'Dublin', status: 'let', ber_cert_number: 'B999', ber_expiry_date: '2000-01-01' },
    ];
    const tens: Row[] = [
      { id: 't1', letting_property_id: 'p1', tenant_name: 'A', agent_id: AGENT_ID, status: 'active', rtb_registration_number: null },
      { id: 't2', letting_property_id: 'p2', tenant_name: 'B', agent_id: AGENT_ID, status: 'active', rtb_registration_number: 'X' },
    ];
    const supabase = buildSupabaseStub({
      agent_letting_properties: props,
      agent_tenancies: tens,
      lettings_documents: [],
    });
    const records = await getLettingsCompliance(supabase, AGENT_ID);
    const byId = new Map(records.map((r) => [r.propertyId, r]));
    expect(byId.get('p1')!.ber.ok).toBe(false); // future expiry but no cert
    expect(byId.get('p2')!.ber.ok).toBe(true);  // cert on file even if expired
  });
});
