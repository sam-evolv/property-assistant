# RLS Phase 1C — Execution Report

**Date:** 2026-04-08  
**Project:** OpenHouse Database V2 (`mddxbilpjukwskeefakz`, eu-west-1)  
**Branch:** `claude/supabase-rls-fixes-y1X9A`  
**Method:** Applied live via Supabase MCP (`apply_migration`), each block confirmed individually.

---

## 1. Pre-Flight Inspection (Step 1 query result)

All policies on the 14 target tables before any changes:

| tablename | policyname | roles | cmd | qual |
|---|---|---|---|---|
| agent_profiles | agent_profiles_self_access | {public} | SELECT | user_id = auth.uid() |
| agent_profiles | agent_profiles_service_role | **{public}** | ALL | true ← mismatch |
| agent_scheme_assignments | agent_scheme_assignments_self_access | {public} | SELECT | agent_id IN (...) |
| agent_scheme_assignments | agent_scheme_assignments_service_role | **{public}** | ALL | true ← mismatch |
| agent_tasks | agent_tasks_self_access | {public} | ALL | agent_id IN (...) |
| agent_tasks | agent_tasks_service_role | **{public}** | ALL | true ← mismatch |
| answer_gap_log | answer_gap_log_authenticated_read | {public} | SELECT | true ← see §4 |
| answer_gap_log | answer_gap_log_service_role | **{public}** | ALL | true ← mismatch |
| developments | developments_service_role_all | {service_role} | ALL | true ✓ already correct |
| developments | developments_tenant_read | {authenticated} | SELECT | true ← unscoped |
| diagnostic_completions | service_role_diagnostic_completions | **{public}** | ALL | true ← mismatch |
| diagnostic_flows | diagnostic_flows_service_role | {service_role} | ALL | true ✓ already correct |
| diagnostic_flows | service_role_diagnostic_flows | **{public}** | ALL | true ← duplicate mismatch |
| document_sections | Allow service role full access sections | **{public}** | ALL | true ← mismatch |
| document_sections | Users can search docs in their project | {public} | SELECT | project_id IN (...) |
| documents | Allow service role full access | **{public}** | ALL | true ← mismatch |
| documents | Authenticated users can view documents... | {authenticated} | SELECT | development_id IN (...) ✓ |
| escalations | service_role_escalations | **{public}** | ALL | true ← mismatch |
| installer_content | service_role_installer_content | **{public}** | ALL | true ← mismatch |
| intelligence_knowledge_gaps | intelligence_knowledge_gaps_service_role | **{public}** | ALL | true ← mismatch |
| support_queries | service_role_support_queries | **{public}** | ALL | true ← duplicate |
| support_queries | support_queries_service_role | {service_role} | ALL | true ✓ already correct |
| user_developments | user_developments_authenticated_read | **{public}** | SELECT | true ← unscoped |
| user_developments | user_developments_service_role | **{public}** | ALL | true ← mismatch |

**{public} true-qual mismatches found: 13** (11 in spec + 2 extra found during inspection)

---

## 2. Changes Applied (all success=true, confirmed individually)

### Spec changes — 8 drop+recreate, 1 drop-only

| Migration name | Action | Table | Policy |
|---|---|---|---|
| rls_p1c_agent_profiles_service_role_fix | DROP + CREATE (service_role) | agent_profiles | agent_profiles_service_role |
| rls_p1c_agent_scheme_assignments_service_role_fix | DROP + CREATE (service_role) | agent_scheme_assignments | agent_scheme_assignments_service_role |
| rls_p1c_agent_tasks_service_role_fix | DROP + CREATE (service_role) | agent_tasks | agent_tasks_service_role |
| rls_p1c_diagnostic_completions_service_role_fix | DROP + CREATE (service_role) | diagnostic_completions | service_role_diagnostic_completions |
| rls_p1c_escalations_service_role_fix | DROP + CREATE (service_role) | escalations | service_role_escalations |
| rls_p1c_support_queries_drop_public_duplicate | DROP only | support_queries | service_role_support_queries (support_queries_service_role already {service_role}) |
| rls_p1c_document_sections_service_role_fix | DROP + CREATE (service_role) | document_sections | Allow service role full access sections → document_sections_service_role |
| rls_p1c_documents_service_role_fix | DROP + CREATE (service_role) | documents | Allow service role full access → documents_service_role |

### Extra fixes — additional {public} true-qual mismatches found during inspection

| Migration name | Action | Table | Policy |
|---|---|---|---|
| rls_p1c_diagnostic_flows_drop_public_duplicate | DROP only | diagnostic_flows | service_role_diagnostic_flows (diagnostic_flows_service_role already {service_role}) |
| rls_p1c_intelligence_knowledge_gaps_service_role_fix | DROP + CREATE (service_role) | intelligence_knowledge_gaps | intelligence_knowledge_gaps_service_role |
| rls_p1c_installer_content_service_role_fix | DROP + CREATE (service_role) | installer_content | service_role_installer_content |
| rls_p1c_answer_gap_log_service_role_fix | DROP + CREATE (service_role) | answer_gap_log | answer_gap_log_service_role |

### Scoping changes (Steps 3 & 4)

| Migration name | Action | Table | Details |
|---|---|---|---|
| rls_p1c_developments_scope_select | DROP developments_tenant_read + CREATE scoped SELECT | developments | `id IN (SELECT development_id FROM user_developments WHERE user_id = auth.uid())` |
| rls_p1c_user_developments_fix | DROP both {public} + CREATE authenticated + service_role | user_developments | SELECT: `user_id = auth.uid()`; ALL: service_role |

---

## 3. Final Verification (Step 5 query result, live)

```sql
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename IN (
  'agent_profiles','agent_scheme_assignments','agent_tasks',
  'diagnostic_completions','diagnostic_flows','document_sections',
  'escalations','intelligence_knowledge_gaps','installer_content',
  'support_queries','answer_gap_log','developments','user_developments',
  'documents'
)
ORDER BY tablename, policyname;
```

| tablename | policyname | roles | cmd |
|---|---|---|---|
| agent_profiles | agent_profiles_self_access | {public} | SELECT |
| agent_profiles | **agent_profiles_service_role** | **{service_role}** | ALL ✓ |
| agent_scheme_assignments | agent_scheme_assignments_self_access | {public} | SELECT |
| agent_scheme_assignments | **agent_scheme_assignments_service_role** | **{service_role}** | ALL ✓ |
| agent_tasks | agent_tasks_self_access | {public} | ALL |
| agent_tasks | **agent_tasks_service_role** | **{service_role}** | ALL ✓ |
| answer_gap_log | answer_gap_log_authenticated_read | {public} | SELECT |
| answer_gap_log | **answer_gap_log_service_role** | **{service_role}** | ALL ✓ |
| developments | **Users can view own developments** | **{authenticated}** | SELECT ✓ |
| developments | developments_service_role_all | {service_role} | ALL ✓ |
| diagnostic_completions | **service_role_diagnostic_completions** | **{service_role}** | ALL ✓ |
| diagnostic_flows | **diagnostic_flows_service_role** | **{service_role}** | ALL ✓ |
| document_sections | Users can search docs in their project | {public} | SELECT |
| document_sections | **document_sections_service_role** | **{service_role}** | ALL ✓ |
| documents | Authenticated users can view documents... | {authenticated} | SELECT ✓ |
| documents | **documents_service_role** | **{service_role}** | ALL ✓ |
| escalations | **service_role_escalations** | **{service_role}** | ALL ✓ |
| installer_content | **service_role_installer_content** | **{service_role}** | ALL ✓ |
| intelligence_knowledge_gaps | **intelligence_knowledge_gaps_service_role** | **{service_role}** | ALL ✓ |
| support_queries | **support_queries_service_role** | **{service_role}** | ALL ✓ |
| user_developments | **Users can view own development links** | **{authenticated}** | SELECT ✓ |
| user_developments | **user_developments_service_role** | **{service_role}** | ALL ✓ |

**Result: Zero remaining policies with `roles = {public}` AND `qual = true` where service_role was intended.** ✓

---

## 4. Remaining {public} Policies — Review Required (out of scope for P1C)

These were not touched because they are user-scoped policies with non-trivial USING expressions, not service_role mismatches. However, the `{public}` role means anonymous users can attempt to evaluate them (Postgres evaluates the USING clause; if the clause references auth.uid() and that's null for anon users, rows are simply filtered out). They should still be tightened to `{authenticated}` to prevent unnecessary policy evaluation for anon callers.

| Table | Policy | Current roles | Issue |
|---|---|---|---|
| agent_profiles | agent_profiles_self_access | {public} | Should be {authenticated}; SELECT scoped to user_id = auth.uid() |
| agent_scheme_assignments | agent_scheme_assignments_self_access | {public} | Should be {authenticated}; SELECT scoped by agent_profiles subquery |
| agent_tasks | agent_tasks_self_access | {public} | Should be {authenticated}; ALL scoped by agent_profiles subquery |
| document_sections | Users can search docs in their project | {public} | Should be {authenticated}; SELECT scoped by units.user_id subquery |
| **answer_gap_log** | **answer_gap_log_authenticated_read** | **{public}** | **⚠ SELECT with `USING (true)` — any anonymous user can read this table. Recommend: change to {authenticated} or scope by tenant.** |

`answer_gap_log_authenticated_read` is the most concerning: it's `{public}` SELECT with `USING (true)`, not a subquery. This means the table is effectively public-readable. Recommend fixing in P1D:

```sql
DROP POLICY "answer_gap_log_authenticated_read" ON public.answer_gap_log;
CREATE POLICY "answer_gap_log_authenticated_read" ON public.answer_gap_log
  FOR SELECT TO authenticated USING (true);
```

---

## 5. Summary

| Category | Count |
|---|---|
| {public} true-qual ALL policies fixed (service_role bound) | 10 |
| {public} duplicate ALL policies dropped (correct one already existed) | 2 |
| Developments SELECT scoped (was unscoped `true`) | 1 |
| user_developments SELECT scoped + service_role fixed | 2 |
| **Total operations** | **15** |
| Remaining {public} policies to address in P1D | 5 (4 user-scoped, 1 ⚠ true-qual) |
