# RLS Phase 1A — Execution Report

**Date:** 2026-04-08  
**Branch:** `claude/supabase-rls-fixes-y1X9A`  
**Migration file:** `migrations/0007_rls_phase1a.sql`  
**Executor note:** No direct Supabase DB connection available in this environment.  
SQL was validated against `packages/db/schema.ts` and all migration files.  
Run `migrations/0007_rls_phase1a.sql` in the Supabase SQL Editor to apply.

---

## 1. Schema Inspection Results

All 22 tables were inspected against `packages/db/schema.ts` and `migrations/`.

| Table | Exists in Schema | tenant_id | unit_id | user_id | tenancy_id |
|---|---|---|---|---|---|
| amenity_bookings | YES | — | — | — | YES |
| analytics_events | YES | YES | — | — | — |
| btr_amenities | YES | — | — | — | — |
| btr_tenancies | YES | YES (→ tenants) | YES | — | — |
| compliance_document_types | YES | YES | — | — | — |
| compliance_schedule | YES | — | YES | — | — |
| custom_qa | **NOT FOUND** | — | — | — | — |
| data_access_log | YES | YES (nullable) | — | — | — |
| house_types | YES | YES | — | — | — |
| kitchen_selection_options | YES | YES | — | — | — |
| kitchen_selections | YES | YES | YES | — | — |
| knowledge_base | YES | YES | — | — | — |
| maintenance_requests | YES | — | YES | — | YES |
| notice_audit_log | YES | YES | — | — | — |
| noticeboard_posts | YES | YES | YES | — | — |
| platform_insights | **NOT FOUND** | — | — | — | — |
| poi_cache | YES | — | — | — | — |
| question_analytics | **NOT FOUND** | — | — | — | — |
| scheme_profile | YES | — | — | — | — |
| unit_room_dimensions | YES | YES | YES | — | — |
| video_resources | YES | YES | — | — | — |
| welcome_sequences | YES | — | — | — | — |

**Key finding:** Zero tables contain a `user_id` column.

### knowledge_base — note
`knowledge_base` is not defined in `packages/db/schema.ts` but _is_ referenced in
migrations/0001_assistant_os_schema.sql (as `knowledge_base` / `kb_entries`).
The `ALTER TABLE` and `service_role_bypass` are included unconditionally because
the table is confirmed to exist via migrations. If your Supabase project is on a
fresh deploy without that migration, the statement will error — rerun after
running migration 0001.

---

## 2. Step 1 — ALTER TABLE … ENABLE ROW LEVEL SECURITY

### Tables expected to succeed (19)
```
amenity_bookings        ✓
analytics_events        ✓
btr_amenities           ✓
btr_tenancies           ✓
compliance_document_types ✓
compliance_schedule     ✓
data_access_log         ✓
house_types             ✓
kitchen_selection_options ✓
kitchen_selections      ✓
knowledge_base          ✓  (via migration 0001)
maintenance_requests    ✓
notice_audit_log        ✓
noticeboard_posts       ✓
poi_cache               ✓
scheme_profile          ✓
unit_room_dimensions    ✓
video_resources         ✓
welcome_sequences       ✓
```

### Tables wrapped in defensive DO $$ block (3)
```
custom_qa          — NOT in schema or migrations → will emit NOTICE, not error
platform_insights  — NOT in schema or migrations → will emit NOTICE, not error
question_analytics — NOT in schema or migrations → will emit NOTICE, not error
```

**If these tables do exist in your Supabase project** (created outside version-
controlled migrations), the DO $$ block will still enable RLS on them. A schema
migration should be added to bring them under version control.

---

## 3. Step 2 — service_role_bypass Policies

Same 19 tables receive unconditional policies. The 3 missing tables use the same
defensive DO $$ guard.

All 19 confirmed-existing policies follow the pattern:
```sql
CREATE POLICY "service_role_bypass" ON public.<table>
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

This allows the Supabase service role (used by all server-side API routes and
Edge Functions) full unrestricted access while RLS blocks anonymous/authenticated
direct client calls unless a specific policy permits them.

---

## 4. Step 3 — User-Scoped Read/Write Policies

### SKIPPED — user_id = auth.uid() policies (5 policies from spec)

| Policy from spec | Table | Reason skipped |
|---|---|---|
| `Users can manage own kitchen selections` | kitchen_selections | No `user_id` column |
| `Users can manage own amenity bookings` | amenity_bookings | No `user_id` column |
| `Users can view own maintenance requests` (SELECT) | maintenance_requests | No `user_id` column |
| `Users can create maintenance requests` (INSERT) | maintenance_requests | No `user_id` column |
| noticeboard_posts write (scoped) | noticeboard_posts | No `user_id` column |

**Recommendation for each:**

- **kitchen_selections** — rows have `tenant_id`. If authenticated users should
  manage their own development's selections, scope by JWT claim:
  ```sql
  CREATE POLICY "Tenant-scoped kitchen_selections" ON public.kitchen_selections
    FOR ALL TO authenticated
    USING ((auth.jwt()->>'tenant_id')::uuid = tenant_id)
    WITH CHECK ((auth.jwt()->>'tenant_id')::uuid = tenant_id);
  ```

- **amenity_bookings** — rows link to `tenancy_id` (→ `btr_tenancies`). BTR
  tenants authenticate via `access_code`, not Supabase `auth.uid()`. Keep
  access exclusively through service_role API layer until a `user_id` is added.

- **maintenance_requests** — same as amenity_bookings. Access is mediated via
  `tenancy_id`. Add a `submitted_by uuid references auth.users(id)` column if
  direct authenticated access is required.

- **noticeboard_posts write** — no `user_id`; `author_id` references `admins`
  table, not `auth.users`. Write access should remain service_role-only until
  `author_id` is tied to `auth.uid()`.

### APPLIED — noticeboard_posts authenticated read (tenant-scoped)

```sql
CREATE POLICY "Authenticated read noticeboard_posts" ON public.noticeboard_posts
  FOR SELECT TO authenticated
  USING ((auth.jwt()->>'tenant_id')::uuid = tenant_id);
```

Allows authenticated users to read notices for their own tenant. Scoped via the
`tenant_id` JWT claim, consistent with the rest of the platform's RLS pattern.

---

## 5. Step 4 — Reference/Lookup Table Read Policies

| Table | Policy | Rationale |
|---|---|---|
| house_types | `Authenticated read house_types` | Reference data, no PII |
| poi_cache | `Authenticated read poi_cache` | Cached Google Places data, public |
| video_resources | `Authenticated read video_resources` | Scheme video links, read-only display |
| kitchen_selection_options | `Authenticated read kitchen_selection_options` | Options lists for UI dropdowns |

All four use `FOR SELECT TO authenticated USING (true)` — any logged-in user can
read these. Writes are restricted to service_role.

---

## 6. Step 5 — Verification Query (expected result)

Run in SQL Editor after applying the migration:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'amenity_bookings','analytics_events','btr_amenities','btr_tenancies',
    'compliance_document_types','compliance_schedule','custom_qa',
    'data_access_log','house_types','kitchen_selection_options',
    'kitchen_selections','knowledge_base','maintenance_requests',
    'notice_audit_log','noticeboard_posts','platform_insights','poi_cache',
    'question_analytics','scheme_profile','unit_room_dimensions',
    'video_resources','welcome_sequences'
  )
ORDER BY tablename;
```

### Expected output (19 confirmed-existing tables)

| tablename | rowsecurity |
|---|---|
| amenity_bookings | t |
| analytics_events | t |
| btr_amenities | t |
| btr_tenancies | t |
| compliance_document_types | t |
| compliance_schedule | t |
| data_access_log | t |
| house_types | t |
| kitchen_selection_options | t |
| kitchen_selections | t |
| knowledge_base | t |
| maintenance_requests | t |
| notice_audit_log | t |
| noticeboard_posts | t |
| poi_cache | t |
| scheme_profile | t |
| unit_room_dimensions | t |
| video_resources | t |
| welcome_sequences | t |

Tables `custom_qa`, `platform_insights`, `question_analytics` will be **absent**
from the result set if they do not exist in the Supabase project. That is expected
and not an error.

---

## 7. Summary

| Category | Count | Status |
|---|---|---|
| ALTER TABLE ENABLE RLS (confirmed tables) | 19 | Ready to apply |
| ALTER TABLE ENABLE RLS (missing tables) | 3 | Defensive DO $$, emits NOTICE |
| service_role_bypass policies | 19 + 3 defensive | Ready to apply |
| user_id-scoped policies | 5 | **SKIPPED** — no user_id column |
| noticeboard_posts authenticated read | 1 | Applied (tenant_id scoped) |
| Lookup-table read policies | 4 | Applied |

**Next steps:**
1. Run `migrations/0007_rls_phase1a.sql` in Supabase SQL Editor
2. Paste the verification query result back here to confirm `rowsecurity = t`
3. If `custom_qa`, `platform_insights`, or `question_analytics` exist in your
   Supabase project, add schema definitions to `packages/db/schema.ts`
4. For `amenity_bookings` and `maintenance_requests`: decide whether to add a
   `user_id uuid references auth.users(id)` column to support direct
   authenticated-user RLS policies
