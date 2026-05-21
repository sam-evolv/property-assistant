# OpenHouse Assistant V2 - Sprint 2 Build Spec

**Path in repo:** `docs/specs/assistant-v2-sprint-2.md`
**Status:** Ready for implementation
**Scope:** Builder-side snagging surface. Phone-first capture for internal site teams and external snagging contractors. Online only. Background AI enrichment.
**Prerequisite:** Sprint 1 merged. Schema, storage, server routes, and feature flag infrastructure already exist. OpenHouse Assistant V2 - Sprint 2 Build Spec
Path in repo: `docs/specs/assistant-v2-sprint-2.md` Status: Ready for implementation Scope: Builder-side snagging surface. Phone-first capture for internal site teams and external snagging contractors. Online only. Background AI enrichment. Prerequisite: Sprint 1 merged. Schema, storage, server routes, and feature flag infrastructure already exist.
1. Why this scope
Sprint 1 gave the homeowner the ability to upload photos to the assistant. Sprint 2 gives the developer's own team - and external snagging contractors they invite - the ability to log snags directly into the same pipeline.
This is the commercial wedge. A developer pays for operational visibility on their snag workload. A homeowner-facing AI assistant is a nice-to-have on top. Both surfaces write to the same `issue_reports` and `assistant_media` tables, so the developer dashboard (Sprint 3) shows snags from both sources in one view.
The key architectural insight: the source of a snag report does not change the downstream pipeline. Whether the photo came from a homeowner asking "is this normal?" or from a snagger ticking off a punch list, the resulting `issue_reports` row, the AI enrichment, the contractor attribution, and the pattern detection all work the same way.
The model runs in the background. Snaggers do not see AI output in V1. This decouples the snagging app from the reasoning prompt - Sprint 2 ships without waiting for Sprint 1b. Quality of AI enrichment can improve over time without changing the snagger's experience.
Offline support is deferred. V1 is online only. The validation goal of this sprint is whether the workflow itself is right; offline is a known follow-up tracked as a future sprint.
2. Who uses this
Two user types in V1:
Internal site team: developer staff, site managers, sales. Authenticated with the existing Supabase auth, scoped to the developer's tenant. Role is `site_team` or similar.
External snagging contractors: independent inspection companies the developer brings in for pre-handover sweeps. They do not have ongoing access to the developer's full system. They are invited by a developer admin to a specific development for a time-bounded window.
Subcontractors who fix snags (plumber, electrician) are explicitly out of scope for Sprint 2. They land in a later sprint along with assignment workflows.
3. Feature flag

```env
FEATURE_BUILDER_SNAG_APP=false

```

Default off in production. Enable for the Longview Estates tenant and Solas Renewables demo tenant during initial testing.
When off, the snagging route does not render and the API routes return 404.
4. Database schema
Sprint 1 already created `issue_reports`, `assistant_media`, `assistant_media_analysis`, `issue_report_media`, `issue_events`. Sprint 2 reuses all of these. New tables are about identity and access for builder-side users.
4.1 Migration 1 of 3 - DDL

```sql
-- Migration: assistant_v2_snag_users_ddl
-- Adds tables for site team membership and external snagger invitations.

create table if not exists site_team_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('admin', 'site_team', 'snagger_external')),
  development_ids uuid[],
  active boolean not null default true,
  invited_by uuid,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists site_team_members_tenant_idx on site_team_members (tenant_id);
create index if not exists site_team_members_user_idx on site_team_members (user_id);
create index if not exists site_team_members_role_idx on site_team_members (role);

create table if not exists snagger_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  development_id uuid not null,
  email text not null,
  invited_by uuid not null,
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by_user_id uuid,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists snagger_invitations_token_idx on snagger_invitations (token);
create index if not exists snagger_invitations_tenant_idx on snagger_invitations (tenant_id);
create index if not exists snagger_invitations_email_idx on snagger_invitations (email);

-- Extend issue_reports to record who logged the snag and from which surface.
alter table issue_reports
  add column if not exists logged_by_user_id uuid,
  add column if not exists logged_by_role text,
  add column if not exists source text not null default 'homeowner_assistant';

create index if not exists issue_reports_source_idx on issue_reports (source);
create index if not exists issue_reports_logged_by_idx on issue_reports (logged_by_user_id);

```

`source` values used in this sprint: `homeowner_assistant` (existing path), `site_team_snag` (internal team), `snagger_external` (invited contractor). The Sprint 1 multimodal route writes `homeowner_assistant` going forward.
`logged_by_role` is denormalised from `site_team_members.role` at write time so historical reports retain the role even if membership changes later.
4.2 Migration 2 of 3 - RLS

```sql
-- Migration: assistant_v2_snag_users_rls
-- Service role bypass, matching the established pattern. Tenant gating in routes.

alter table site_team_members enable row level security;
alter table snagger_invitations enable row level security;

create policy "service_role_bypass"
  on site_team_members for all
  using (true)
  with check (true);

create policy "service_role_bypass"
  on snagger_invitations for all
  using (true)
  with check (true);

```

No new RLS on `issue_reports` - the existing service-role bypass policy continues to apply to the new columns.
4.3 Migration 3 of 3 - Storage
No new storage bucket. Builder-side snags use the existing `assistant-media` bucket with the same path structure as Sprint 1.
5. Server routes
Five new routes under `apps/unified-portal/app/api/snag/`.
5.1 `POST /api/snag/invite`
Admin-only. Creates a `snagger_invitations` row for an external snagger and returns a one-time signup link.
Accepts:

```json
{
  "email": "string",
  "development_id": "uuid",
  "expires_in_days": "number"
}

```

Behaviour:

1. Verify caller has `admin` role in `site_team_members` for the tenant that owns `development_id`.
2. Generate a token (uuid v4 string, stored in `token`).
3. Insert `snagger_invitations` row with `expires_at = now() + expires_in_days days`.
4. Return `{ invite_url: "https://portal.openhouseai.ie/snag/accept?token=..." }`.
Email sending is out of scope for V1. The admin copies the link and sends it themselves via whatever channel they already use (WhatsApp, email).
5.2 `POST /api/snag/accept`
Public route (no auth required to call). Accepts an invitation token and an authenticated Supabase session.
Accepts:

```json
{
  "token": "string"
}

```

Behaviour:

1. Verify the caller has an active Supabase session. If not, return 401 with a message indicating they need to sign in first.
2. Load the `snagger_invitations` row by token. If not found, expired, or already revoked, return 404 or 410.
3. Check that the authenticated user's email matches the invitation's email. If not, return 403.
4. Insert a `site_team_members` row with `role = 'snagger_external'`, `tenant_id` and `development_ids` from the invitation, and `expires_at` matching the invitation's expiry.
5. Update the invitation row with `accepted_at` and `accepted_by_user_id`.
6. Return `{ success: true, tenant_id, development_ids }`.
5.3 `POST /api/snag/create`
The main route. A site team member or external snagger logs a snag.
Accepts:

```json
{
  "development_id": "uuid",
  "unit_id": "uuid",
  "title": "string",
  "description": "string",
  "room": "string",
  "media_ids": ["uuid"]
}

```

Behaviour:

1. Verify caller's `site_team_members` row is active and `tenant_id` matches the development's tenant.
2. If caller is `snagger_external`, also verify `development_id` is in their `development_ids` array and `expires_at` has not passed.
3. Verify all `media_ids` exist and belong to the same tenant.
4. Insert `issue_reports` with:
   * `source = 'site_team_snag'` or `'snagger_external'` based on role
   * `logged_by_user_id = caller.user_id`
   * `logged_by_role = caller.role`
   * `title`, `description`, `room`, `unit_id`, `development_id`, `tenant_id`
   * `status = 'open'`, `priority = 'normal'`
   * `severity_label` left null until AI enrichment runs
5. Insert `issue_report_media` rows linking the issue to each media.
6. Insert an `issue_events` row with `event_type = 'snag_logged'`, `actor_type = caller.role`.
7. Trigger background AI enrichment (see section 6).
8. Return `{ issue_report_id }`.
5.4 `GET /api/snag/list`
Returns snags for the caller's accessible developments.
Query params: `development_id` (optional), `status` (optional), `limit`, `offset`.
Behaviour:

1. Verify caller. Determine accessible developments from `site_team_members.development_ids` (snagger_external) or all developments in the tenant (admin, site_team).
2. Return paginated `issue_reports` rows filtered to accessible developments and matching the optional filters.
3. Include media count per report. Do not include full media records.
This route serves the snagger's own "what have I logged" view. The developer dashboard (Sprint 3) will have its own list route with richer filtering.
5.5 `GET /api/snag/[id]`
Returns a single snag with all linked media (with signed URLs) and events.
Behaviour:

1. Verify caller can access the report's `development_id`.
2. Return the full issue_reports row, linked media with one-hour signed URLs, and the event timeline.
6. Background AI enrichment
Snag creation must not block on the model call. Two implementation options:
Option A: Synchronous enrichment after the issue is persisted. The route waits for the model call, writes the analysis row, then returns. Risks: route latency, timeouts, failures cascade.
Option B: Fire-and-forget background call. The route returns immediately after creating the issue. A separate process (a Vercel function call without awaiting, or a cron-triggered enrichment route) writes the analysis row asynchronously.
V1 uses Option B with the simplest possible mechanism: a non-awaited `fetch()` to an internal enrichment route. Acceptable for V1 because the analysis is not user-facing yet. When Sprint 1b lands the reasoning prompt, we can upgrade to a proper job queue if needed.
The enrichment route is `POST /api/snag/enrich/[issue_report_id]` and is callable only by the service role (header check). It loads the issue, calls `mediaAnalysisService.analyse()` (still the Sprint 1 placeholder until 1b lands), and writes the `assistant_media_analysis` row linked back to the issue.
When the placeholder analysis is replaced by the real model in Sprint 1b, this route is where the model call goes for builder-side snags. Homeowner snags go through `/api/assistant/chat/multimodal` which already has its own analysis hook.
7. UI - Phone-first snag capture
New route at `/snag` in `apps/unified-portal`. Authenticated. Phone-first. Desktop renders the same screen but doesn't get a special layout.
7.1 Entry screen
When a site team member opens `/snag` on their phone:

```tsx
<div className="min-h-screen bg-neutral-50 flex flex-col">
  <header className="px-4 py-3 bg-white border-b border-neutral-200 flex items-center justify-between">
    <h1 className="text-heading-md text-neutral-900">Log a snag</h1>
    <button onClick={openDevelopmentSwitcher} className="text-body-sm text-neutral-600">
      {currentDevelopmentName}
    </button>
  </header>

  <main className="flex-1 px-4 py-6 space-y-4">
    {/* Unit selector - see 7.2 */}
    {/* Photo capture - see 7.3 */}
    {/* Description - see 7.4 */}
    {/* Submit - see 7.5 */}
  </main>
</div>

```

The development switcher is a dropdown showing developments the user has access to. Most users only have one, in which case it's display-only.
7.2 Unit selector
A large tap target showing the currently selected unit, opening a unit picker on tap.

```tsx
<button
  type="button"
  onClick={openUnitPicker}
  className="w-full px-4 py-4 bg-white border border-neutral-200 rounded-lg text-left flex items-center justify-between"
>
  <div>
    <div className="text-caption text-neutral-500">Unit</div>
    <div className="text-body text-neutral-900">{selectedUnit?.display_name || 'Tap to select'}</div>
  </div>
  <ChevronRight className="w-5 h-5 text-neutral-400" />
</button>

```

The unit picker is a full-screen sheet on mobile with a search input at the top and a list of units in the current development. Group by phase if the development has phases.
7.3 Photo capture
Large camera button as the primary action. Same `attachments.ts` pipeline as Sprint 1, including the client-side compression we shipped.

```tsx
<div className="space-y-3">
  <div className="text-caption text-neutral-500">Photos</div>

  {selectedFiles.length === 0 ? (
    <button
      type="button"
      onClick={openCameraOrPicker}
      className="w-full aspect-video bg-white border-2 border-dashed border-neutral-300 rounded-lg flex flex-col items-center justify-center gap-2 active:bg-neutral-50"
    >
      <Camera className="w-8 h-8 text-neutral-400" />
      <span className="text-body-sm text-neutral-600">Take a photo</span>
    </button>
  ) : (
    <>
      <div className="grid grid-cols-3 gap-2">
        {selectedFiles.map((file) => (
          <div key={file.id} className="relative aspect-square">
            <img src={file.previewUrl} alt="" className="w-full h-full rounded-md object-cover border border-neutral-200" />
            <button
              type="button"
              onClick={() => removeFile(file.id)}
              className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center"
              aria-label="Remove photo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {selectedFiles.length < 6 && (
          <button
            type="button"
            onClick={openCameraOrPicker}
            className="aspect-square bg-white border-2 border-dashed border-neutral-300 rounded-md flex items-center justify-center active:bg-neutral-50"
            aria-label="Add another photo"
          >
            <Plus className="w-6 h-6 text-neutral-400" />
          </button>
        )}
      </div>
    </>
  )}
</div>

```

Camera button defaults to the system camera on mobile via `<input type="file" accept="image/*" capture="environment">`. On Capacitor native, prefer `Camera.getPhoto()` directly without showing the library picker.
7.4 Description
Two fields: a one-line title (required) and an optional longer description. Plus a room picker.

```tsx
<div className="space-y-3">
  <div>
    <label className="text-caption text-neutral-500 block mb-1">What is the snag</label>
    <input
      type="text"
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      placeholder="Hairline crack above door"
      maxLength={120}
      className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-lg text-body focus:outline-none focus:ring-2 focus:ring-brand-500"
    />
  </div>

  <div>
    <label className="text-caption text-neutral-500 block mb-1">Room</label>
    <button
      type="button"
      onClick={openRoomPicker}
      className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-lg text-left text-body text-neutral-900 flex items-center justify-between"
    >
      <span>{room || 'Tap to select'}</span>
      <ChevronRight className="w-5 h-5 text-neutral-400" />
    </button>
  </div>

  <div>
    <label className="text-caption text-neutral-500 block mb-1">Notes (optional)</label>
    <textarea
      value={description}
      onChange={(e) => setDescription(e.target.value)}
      rows={3}
      placeholder="Any extra detail"
      className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-lg text-body focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
    />
  </div>
</div>

```

Room picker is a sheet with common rooms (Kitchen, Bathroom, Living Room, Bedroom 1, Bedroom 2, Bedroom 3, Hall, Landing, Utility, Other). Selecting Other reveals a text input.
7.5 Submit
A sticky bottom button that's only enabled when title is filled and at least one photo is attached.

```tsx
<div className="sticky bottom-0 px-4 py-3 bg-white border-t border-neutral-200">
  <button
    type="button"
    onClick={submitSnag}
    disabled={!canSubmit || isSubmitting}
    className="w-full py-3 bg-brand-500 text-white rounded-lg font-medium disabled:bg-neutral-200 disabled:text-neutral-400 active:bg-brand-600"
  >
    {isSubmitting ? 'Logging snag...' : 'Log snag'}
  </button>
</div>

```

Submit flow:

1. Compress photos using existing `compressSelectionsForUpload`.
2. Upload via existing `POST /api/assistant/media/upload`.
3. Submit snag via `POST /api/snag/create`.
4. On success, show confirmation toast and reset the form (unit and development remain selected - site managers log many snags in the same unit in a row).
5. On error, show inline error with retry. Do not clear the form.
7.6 Confirmation
After successful submit, a brief toast: "Snag logged." Then the form clears the title, description, photos, and room, but keeps the unit and development selected. This is the workflow optimisation that matters most - snaggers log multiple snags in a row in the same unit.
7.7 Recent snags
Below the form, a small "Recent" section showing the last 5 snags this user has logged in this unit. Each row shows title, thumbnail count, and "logged 2 min ago" style timestamp. Tap a row to view detail (Sprint 3 territory, can be a stub in this sprint).
7.8 Copy
All builder-facing copy in this sprint:

* Page title: "Log a snag"
* Title placeholder: "Hairline crack above door"
* Description placeholder: "Any extra detail"
* Room picker placeholder: "Tap to select"
* Unit picker placeholder: "Tap to select"
* Photo button label: "Take a photo"
* Add another photo (aria): "Add another photo"
* Submit idle: "Log snag"
* Submit pending: "Logging snag..."
* Submit success toast: "Snag logged."
* Submit error: "Couldn't log that snag. Try again."
Same rules as Sprint 1: no em dashes, no emoji, no AI language, calm and direct.
8. Admin UI - Invite snaggers
Small addition to the existing developer admin area. Single page at `/developer/snaggers`.
Implementation note (Session 3, Sprint 2 UI): the original spec listed this path as `/admin/snaggers`. It moved to `/developer/snaggers` so the page lives inside the existing developer sidebar layout and the URL stays consistent with the rest of the developer area. Admins keep their nav when invited.
Shows:

* A list of current site_team_members for the tenant
* A list of pending and active invitations
* A button "Invite snagger" that opens a modal with email, development picker, and expiry days dropdown (7, 14, 30 days)
* On submit, calls `/api/snag/invite` and shows the resulting `invite_url` with a copy-to-clipboard button
This is a minimal admin surface. The developer copies the invite URL and sends it however they prefer. Polished invitation emails are a later sprint.
9. What is explicitly out of scope this sprint

* Subcontractor accounts and assignment workflows
* Offline support (deferred, tracked as a future sprint)
* Snag assignment to contractors
* Snag resolution workflows (the snagger logs; resolution comes later)
* Developer dashboard report list and drawer (Sprint 3)
* Pattern detection and contractor scorecards (Sprints 5 and 6)
* Email sending for invitations (link copy only in V1)
* Real AI enrichment (placeholder service runs; real model wires in via Sprint 1b)
* Snagger-facing display of AI analysis
10. Acceptance criteria
The sprint is done when all of the following pass on Vercel preview:

1. The Sprint 1 homeowner flow is unchanged. No regression. Existing test routes still work.
2. An admin can invite an external snagger via the admin UI and receive a working invite URL.
3. The invited snagger can sign in, accept the invitation, and land on `/snag` with the correct development pre-selected.
4. A site team member or accepted snagger can log a snag: select unit, take a photo, type a title, pick a room, submit.
5. The submitted snag appears in the `issue_reports` table with the correct `source`, `logged_by_user_id`, and `logged_by_role`.
6. The photo appears in `assistant_media` linked via `issue_report_media`.
7. A background `assistant_media_analysis` row is created with `model_provider = 'placeholder'`.
8. The "Recent" list updates after a successful submit.
9. The form resets correctly after submit, keeping unit and development selected.
10. Cross-tenant access attempts (snagger trying to access a development not in their `development_ids`) return 403.
11. Expired invitations cannot be accepted. Return 410.
12. The feature flag default-off path works: with `FEATURE_BUILDER_SNAG_APP=false`, `/snag` returns 404 and all `/api/snag/*` routes return 404.
13. Vercel build is green before the PR is marked complete.
14. No em dashes anywhere.
11. Claude Code session plan
This sprint splits into three Claude Code sessions, independent branches, commit-and-stop.
Session 1 - Schema and seed admin role
Branch: `assistant-v2/snag-schema`
Prompt:

```
Implement section 4 of docs/specs/assistant-v2-sprint-2.md.

Apply the three migrations in order via the Supabase MCP. After each
apply_migration call, verify via execute_sql:
- After DDL: confirm site_team_members and snagger_invitations exist
  and issue_reports has the new columns.
- After RLS: confirm both new tables have service_role_bypass policy.

Then seed a single admin row in site_team_members for the user
sam@evolvai.ie against the Longview Estates tenant
(4cee69c6-be4b-486e-9c33-2b5a7d30e287) so I can use the admin invite
UI from the start. Look up the auth user_id via execute_sql first.

No code changes. Commit and stop on branch assistant-v2/snag-schema
with a PR.

```

Session 2 - Server routes
Branch: `assistant-v2/snag-server`
Prompt:

```
Implement section 5 and section 6 of docs/specs/assistant-v2-sprint-2.md.

Add FEATURE_BUILDER_SNAG_APP=false to the env config. All routes 404
when the flag is off.

The five new routes go under apps/unified-portal/app/api/snag/:
- POST /invite (admin only)
- POST /accept (public, requires Supabase session)
- POST /create (site team or accepted snagger)
- GET /list
- GET /[id]

Plus the internal enrichment route POST /enrich/[issue_report_id]
callable only with the service role header.

Reuse the existing media-auth.ts pattern where it makes sense. Add a
new helper resolveSnagAuth for builder-side calls. Tenant gating in
all routes. Never trust client-supplied tenant_id or
logged_by_role - derive both from site_team_members.

Background enrichment uses fire-and-forget fetch to the internal
enrichment route. Do not await.

Do not modify the existing Sprint 1 routes. Do not modify the
text-only chat flow.

Verify Vercel build is READY before claiming done. Commit on branch
assistant-v2/snag-server with a PR.

```

Session 3 - UI
Branch: `assistant-v2/snag-ui`
Prompt:

```
Implement section 7 and section 8 of docs/specs/assistant-v2-sprint-2.md.

Two new routes in apps/unified-portal:
- /snag - the phone-first snag capture form for site team and snaggers
- /developer/snaggers - the admin invite UI (Session 3 moved from /admin/snaggers)

Reuse existing components where they overlap with Sprint 1:
- attachments.ts compression pipeline
- MediaPreviewRow patterns

Follow the openhouse-design-system skill exactly. Phone-first means
big touch targets, sticky bottom submit, full-screen sheets for
pickers. No desktop-specific layout in V1 - desktop renders the same
form and that's acceptable.

Lucide React icons only. No em dashes. Use the verbatim copy from
section 7.8.

Gated on FEATURE_BUILDER_SNAG_APP. When off, both routes 404.

Verify Vercel build is READY before claiming done. Commit on branch
assistant-v2/snag-ui with a PR.

```

12. After Sprint 2
Sprint 3 is the developer dashboard - the report list and detail drawer that surface both homeowner-side and builder-side snags in one operational view. The same UI patterns Sprint 1's spec section 22 sketched, now with real data.
Sprint 1b (real reasoning prompt and model wiring) can slot in before or after Sprint 3. My read: do Sprint 3 first because it makes the data visible to developers, which is what generates the first paying conversation. Then Sprint 1b makes the assistant intelligent, which is what makes the second conversation. Both surfaces (homeowner and builder) benefit from Sprint 1b without further work because the model wiring is in the shared analysis service.
