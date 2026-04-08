# RLS Phase 1D — Execution Report

**Date:** 2026-04-08  
**Project:** OpenHouse Database V2 (`mddxbilpjukwskeefakz`, eu-west-1)  
**Branch:** `claude/supabase-rls-fixes-y1X9A`  
**Method:** Applied live via Supabase MCP (`apply_migration`), each fix confirmed individually.

---

## Changes Applied

All 5 fixes applied in order. Each confirmed `success: true` before proceeding.

| # | Migration name | Table | Policy | Change |
|---|---|---|---|---|
| 1 | rls_p1d_agent_profiles_self_access_fix | agent_profiles | agent_profiles_self_access | `{public}` → `{authenticated}` |
| 2 | rls_p1d_agent_scheme_assignments_self_access_fix | agent_scheme_assignments | agent_scheme_assignments_self_access | `{public}` → `{authenticated}` |
| 3 | rls_p1d_agent_tasks_self_access_fix | agent_tasks | agent_tasks_self_access | `{public}` → `{authenticated}`, added WITH CHECK |
| 4 | rls_p1d_document_sections_search_fix | document_sections | Users can search docs in their project | `{public}` → `{authenticated}`; USING clause updated from `units.project_id` to `user_developments.development_id` |
| 5 | rls_p1d_answer_gap_log_anon_read_fix | answer_gap_log | answer_gap_log_authenticated_read | `{public}` SELECT `true` → `{authenticated}` SELECT `true` |

### Note on Fix 4 — document_sections USING clause change

The previous policy used:
```sql
USING (project_id IN (SELECT units.project_id FROM units WHERE units.user_id = auth.uid()))
```

The new policy uses:
```sql
USING (project_id IN (SELECT development_id FROM user_developments WHERE user_id = auth.uid()))
```

This aligns doc section access with the `user_developments` join table (the same pattern used for `documents` and `developments`), replacing the indirect `units` path.

---

## Final Verification (live query result)

```sql
SELECT tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE tablename IN (
  'agent_profiles','agent_scheme_assignments',
  'agent_tasks','document_sections','answer_gap_log'
)
ORDER BY tablename, policyname;
```

| tablename | policyname | roles | cmd | USING |
|---|---|---|---|---|
| agent_profiles | agent_profiles_self_access | **{authenticated}** ✓ | SELECT | `user_id = auth.uid()` |
| agent_profiles | agent_profiles_service_role | {service_role} ✓ | ALL | `true` |
| agent_scheme_assignments | agent_scheme_assignments_self_access | **{authenticated}** ✓ | SELECT | `agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid())` |
| agent_scheme_assignments | agent_scheme_assignments_service_role | {service_role} ✓ | ALL | `true` |
| agent_tasks | agent_tasks_self_access | **{authenticated}** ✓ | ALL | `agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid())` |
| agent_tasks | agent_tasks_service_role | {service_role} ✓ | ALL | `true` |
| answer_gap_log | answer_gap_log_authenticated_read | **{authenticated}** ✓ | SELECT | `true` |
| answer_gap_log | answer_gap_log_service_role | {service_role} ✓ | ALL | `true` |
| document_sections | Users can search docs in their project | **{authenticated}** ✓ | SELECT | `project_id IN (SELECT development_id FROM user_developments WHERE user_id = auth.uid())` |
| document_sections | document_sections_service_role | {service_role} ✓ | ALL | `true` |

**Zero policies with `roles = {public}` on these 5 tables.** ✓

---

## Phase Summary (P1A–P1D)

| Phase | Scope | Status |
|---|---|---|
| P1A | Enable RLS on 22 tables, service_role bypass, lookup read policies | Migration file created; apply in SQL Editor |
| P1B | 6 zero-policy locked-out tables secured | ✓ Applied live |
| P1C | 13 `{public}` true-qual service_role mismatches fixed; developments + user_developments scoped | ✓ Applied live |
| P1D | 5 remaining `{public}` user-scoped policies tightened to `{authenticated}` | ✓ Applied live |

All known `{public}` policy mismatches on the inspected tables are resolved.
