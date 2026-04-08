# RLS Phase 1B — Execution Report

**Date:** 2026-04-08  
**Project:** OpenHouse Database V2 (`mddxbilpjukwskeefakz`, eu-west-1)  
**Branch:** `claude/supabase-rls-fixes-y1X9A`  
**Method:** Applied live via Supabase MCP (`apply_migration`), confirmed individually.

---

## 1. Schema Inspection Results

Tables and referenced tables inspected before any policy was written.

### broadcasts
| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| tenant_id | uuid | NO |
| created_by | uuid | NO |
| **development_id** | uuid | NO |
| target_type | text | NO |
| target_filter | jsonb | YES |
| target_unit_ids | ARRAY | YES |
| title / body / category / status | text | NO |
| scheduled_for / sent_at | timestamptz | YES |
| recipients_count / delivered_count / read_count | integer | YES |
| created_at / updated_at | timestamptz | YES |

`development_id` ✓ | `user_developments(user_id, development_id)` ✓ — user read policy applies.

### intelligence_actions
| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| **developer_id** | uuid | NO |
| conversation_id | uuid | YES |
| message_id | uuid | YES |
| development_id | uuid | YES |
| action_type / action_status / description | text | NO |
| metadata | jsonb | YES |
| created_at | timestamptz | NO |

**No `agent_id` column.** Has `developer_id` instead.  
User-scoped read policy **SKIPPED** — see §3.

### intelligence_messages
| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| **conversation_id** | uuid | NO |
| role / message_type | text | NO |
| content | text | YES |
| structured_data | jsonb | YES |
| created_at | timestamptz | NO |

`conversation_id` ✓ | `intelligence_conversations(id, agent_id)` ✓ | `agent_profiles(id, user_id)` ✓ — subquery chain valid.

### intelligence_conversations (referenced table)
| Column | Type |
|---|---|
| id | uuid |
| **agent_id** | uuid |
| tenant_id | uuid |
| session_id | text |
| role / content | text |
| entities_mentioned | jsonb |
| created_at | timestamptz |

### agent_profiles (referenced table)
Has `user_id uuid NOT NULL` ✓

### organisations
| Column | Type |
|---|---|
| id | uuid |
| name | text |
| created_at | timestamptz |

No tenant/user scoping columns — service_role only.

### organizations
Identical structure to `organisations` — service_role only.

### snag_items
| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| tenant_id | uuid | YES |
| development_id | uuid | NO |
| **unit_id** | uuid | NO |
| description / status | text | NO |
| photo_url / reported_by | text | YES |
| resolved_at | timestamptz | YES |
| created_at / updated_at | timestamptz | NO |

`unit_id` ✓ | `units(id, user_id)` — `units.user_id` is nullable uuid ✓ — user read policy applies.

---

## 2. Policies Applied (all confirmed success=true)

### broadcasts — 2 policies

```sql
-- Applied via migration: rls_p1b_broadcasts_service_role
CREATE POLICY "broadcasts_service_role" ON public.broadcasts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Applied via migration: rls_p1b_broadcasts_user_read
CREATE POLICY "Users can view broadcasts in their development"
  ON public.broadcasts FOR SELECT TO authenticated
  USING (
    development_id IN (
      SELECT development_id FROM public.user_developments
      WHERE user_id = auth.uid()
    )
  );
```

### intelligence_actions — 1 policy

```sql
-- Applied via migration: rls_p1b_intelligence_actions_service_role
CREATE POLICY "intelligence_actions_service_role" ON public.intelligence_actions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### intelligence_messages — 2 policies

```sql
-- Applied via migration: rls_p1b_intelligence_messages_service_role
CREATE POLICY "intelligence_messages_service_role" ON public.intelligence_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Applied via migration: rls_p1b_intelligence_messages_user_read
CREATE POLICY "Agents can view own intelligence messages" ON public.intelligence_messages
  FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM public.intelligence_conversations
      WHERE agent_id IN (
        SELECT id FROM public.agent_profiles WHERE user_id = auth.uid()
      )
    )
  );
```

### organisations — 1 policy

```sql
-- Applied via migration: rls_p1b_organisations_service_role
CREATE POLICY "organisations_service_role" ON public.organisations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### organizations — 1 policy

```sql
-- Applied via migration: rls_p1b_organizations_service_role
CREATE POLICY "organizations_service_role" ON public.organizations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### snag_items — 2 policies

```sql
-- Applied via migration: rls_p1b_snag_items_service_role
CREATE POLICY "snag_items_service_role" ON public.snag_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Applied via migration: rls_p1b_snag_items_user_read
CREATE POLICY "Users can view snag items for their unit" ON public.snag_items
  FOR SELECT TO authenticated
  USING (
    unit_id IN (
      SELECT id FROM public.units WHERE user_id = auth.uid()
    )
  );
```

---

## 3. Skipped Policy — intelligence_actions user read

**Policy from spec:**
```sql
CREATE POLICY "Agents can view own intelligence actions" ON public.intelligence_actions
  FOR SELECT TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM public.agent_profiles WHERE user_id = auth.uid()
    )
  );
```

**Why skipped:** `intelligence_actions` has no `agent_id` column. The actual owner
column is `developer_id` (uuid NOT NULL).

**Recommended alternative** (apply once the correct FK relationship is confirmed):
```sql
-- Option A: if developer_id references admins/auth.users directly
CREATE POLICY "Developers can view own intelligence actions" ON public.intelligence_actions
  FOR SELECT TO authenticated
  USING (developer_id = auth.uid());

-- Option B: if developer_id references agent_profiles.id
CREATE POLICY "Agents can view own intelligence actions" ON public.intelligence_actions
  FOR SELECT TO authenticated
  USING (
    developer_id IN (
      SELECT id FROM public.agent_profiles WHERE user_id = auth.uid()
    )
  );
```

Confirm which table `developer_id` references, then apply the appropriate option.

---

## 4. Verification Query Result

```sql
SELECT tablename, count(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'broadcasts','intelligence_actions','intelligence_messages',
    'organisations','organizations','snag_items'
  )
GROUP BY tablename
ORDER BY tablename;
```

### Result (live, 2026-04-08)

| tablename | policy_count |
|---|---|
| broadcasts | **2** ✓ |
| intelligence_actions | **1** ✓ |
| intelligence_messages | **2** ✓ |
| organisations | **1** ✓ |
| organizations | **1** ✓ |
| snag_items | **2** ✓ |

All 6 tables have `policy_count >= 1`. ✓

---

## 5. Summary

| Table | RLS already enabled | service_role bypass | User-scoped read | Notes |
|---|---|---|---|---|
| broadcasts | pre-existing | ✓ applied | ✓ applied | Scoped via user_developments |
| intelligence_actions | pre-existing | ✓ applied | **SKIPPED** | No agent_id — see §3 |
| intelligence_messages | pre-existing | ✓ applied | ✓ applied | Chain: conversation → agent_profiles |
| organisations | pre-existing | ✓ applied | n/a | No scoping columns |
| organizations | pre-existing | ✓ applied | n/a | No scoping columns |
| snag_items | pre-existing | ✓ applied | ✓ applied | Scoped via units.user_id |

**Total policies created:** 9 (of 10 spec'd — 1 skipped, column mismatch)
