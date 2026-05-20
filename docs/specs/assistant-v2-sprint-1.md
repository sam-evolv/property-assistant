# OpenHouse Assistant V2 — Sprint 1 Build Spec

**Path in repo:** `docs/specs/assistant-v2-sprint-1.md`
**Status:** Ready for implementation
**Scope:** Foundation only. Schema, storage, upload UI, placeholder analysis service. No real model calls.
**Next sprint (1b):** Wire up real multimodal analysis using the reasoning prompt and decision engine.

---

## 1. Why this scope

The full Assistant V2 vision is in the north-star document. This sprint builds the foundation that everything else sits on. Specifically:

1. The data schema for media, structured analysis, issue reports, and event history.
2. Tenant-scoped storage paths and signed URL handling.
3. The chat input upgrade so homeowners can attach images.
4. A placeholder analysis service that returns a safe stub response, so the UI and data flow can be tested end to end before the real model is wired in.

Real multimodal analysis is deliberately deferred to Sprint 1b. The reasoning prompt deserves its own iteration cycle and should not be improvised inside a Claude Code session.

The text-only assistant flow must remain unchanged. Media handling is additive and gated behind a feature flag.

---

## 2. Feature flags

Add to environment configuration:

```env
FEATURE_ASSISTANT_IMAGE_UPLOAD=false
```

Default off in production. Enable for the developer (Longview Estates) tenant and the Solas Renewables demo tenant only during initial testing.

No other flags introduced this sprint. Video, voice, pattern detection, contractor intelligence all stay dormant.

---

## 3. Database schema

All migrations split into separate `apply_migration` calls in the order DDL → RLS → DML. Batching causes ordering failures per established workflow.

### 3.1 Migration 1 of 3 — DDL

```sql
-- Migration: assistant_v2_media_ddl
-- Creates the core tables for media, structured analysis, issue reports, and event history.

create table if not exists assistant_media (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  development_id uuid not null,
  unit_id uuid,
  user_id uuid,
  conversation_id uuid,
  message_id uuid,
  media_type text not null check (media_type in ('image', 'video', 'audio')),
  storage_path text not null,
  thumbnail_path text,
  mime_type text not null,
  file_size_bytes bigint,
  width integer,
  height integer,
  duration_seconds numeric,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists assistant_media_tenant_idx on assistant_media (tenant_id);
create index if not exists assistant_media_unit_idx on assistant_media (unit_id);
create index if not exists assistant_media_conversation_idx on assistant_media (conversation_id);
create index if not exists assistant_media_message_idx on assistant_media (message_id);

create table if not exists assistant_media_analysis (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  development_id uuid not null,
  unit_id uuid,
  user_id uuid,
  conversation_id uuid,
  message_id uuid,
  analysis_scope text not null default 'single_message',
  input_media_ids uuid[] not null,
  issue_type text,
  issue_category text,
  room text,
  visible_features jsonb,
  severity_score integer,
  severity_label text,
  confidence_score numeric,
  safety_risk boolean,
  safety_risk_type text,
  likely_trade text,
  likely_system text,
  potential_causes jsonb,
  recommended_action text,
  resident_guidance text,
  needs_more_info boolean,
  more_info_requested jsonb,
  should_create_issue boolean,
  should_escalate boolean,
  escalation_level text,
  requires_human_review boolean,
  warranty_relevant boolean,
  similar_issue_check_required boolean,
  developer_summary text,
  raw_model_output jsonb not null default '{}'::jsonb,
  model_provider text not null default 'placeholder',
  model_name text not null default 'placeholder',
  model_version text,
  prompt_version text,
  processing_time_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists assistant_media_analysis_tenant_idx on assistant_media_analysis (tenant_id);
create index if not exists assistant_media_analysis_unit_idx on assistant_media_analysis (unit_id);
create index if not exists assistant_media_analysis_conversation_idx on assistant_media_analysis (conversation_id);

create table if not exists issue_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  development_id uuid not null,
  unit_id uuid not null,
  user_id uuid,
  conversation_id uuid,
  contractor_id uuid,
  title text not null,
  description text,
  resident_message text,
  voice_transcript text,
  issue_type text,
  issue_category text,
  room text,
  severity_score integer,
  severity_label text,
  confidence_score numeric,
  status text not null default 'open',
  priority text not null default 'normal',
  safety_risk boolean default false,
  likely_trade text,
  likely_system text,
  linked_analysis_id uuid,
  escalated boolean default false,
  escalated_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  resolved boolean default false,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists issue_reports_tenant_idx on issue_reports (tenant_id);
create index if not exists issue_reports_unit_idx on issue_reports (unit_id);
create index if not exists issue_reports_status_idx on issue_reports (status);
create index if not exists issue_reports_priority_idx on issue_reports (priority);
create index if not exists issue_reports_contractor_idx on issue_reports (contractor_id);

create table if not exists issue_report_media (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  issue_report_id uuid not null references issue_reports(id) on delete cascade,
  media_id uuid not null references assistant_media(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists issue_report_media_report_idx on issue_report_media (issue_report_id);
create index if not exists issue_report_media_media_idx on issue_report_media (media_id);

create table if not exists issue_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  issue_report_id uuid not null references issue_reports(id) on delete cascade,
  event_type text not null,
  actor_type text,
  actor_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists issue_events_report_idx on issue_events (issue_report_id);
create index if not exists issue_events_type_idx on issue_events (event_type);
```

### 3.2 Migration 2 of 3 — RLS

The established pattern across the codebase is RLS enabled with a `service_role_bypass` policy, and tenant gating enforced in application code (server routes verify `tenant_id` before reading or writing). This matches the homeowner QR-code architecture where there is no `auth.uid()` available for residents.

Do not introduce a new RLS pattern in this sprint. The new tables follow the same convention as `care_conversations`, `care_messages`, `maintenance_requests`, `messages`, and similar operational tables.

```sql
-- Migration: assistant_v2_media_rls
-- Enables RLS with service-role bypass. Tenant gating is enforced in application
-- code, consistent with the established pattern across the codebase.

alter table assistant_media enable row level security;
alter table assistant_media_analysis enable row level security;
alter table issue_reports enable row level security;
alter table issue_report_media enable row level security;
alter table issue_events enable row level security;

create policy "service_role_bypass"
  on assistant_media for all
  using (true)
  with check (true);

create policy "service_role_bypass"
  on assistant_media_analysis for all
  using (true)
  with check (true);

create policy "service_role_bypass"
  on issue_reports for all
  using (true)
  with check (true);

create policy "service_role_bypass"
  on issue_report_media for all
  using (true)
  with check (true);

create policy "service_role_bypass"
  on issue_events for all
  using (true)
  with check (true);
```

Application-level tenant gating requirements for the server routes in section 5:

- Every read of these tables must include an explicit `where tenant_id = ?` clause derived from the verified tenant context of the caller.
- Every write must set `tenant_id` from the verified tenant context, never from a client-supplied value.
- The care-session pattern (`requireCareSession` helper) is the reference for homeowner-side tenant verification.
- Installer and developer routes use the existing auth verification pattern.
- Cross-tenant access attempts must return 403 from the route, not rely on RLS to block.

This is the same posture as the rest of the codebase. RLS is the second line of defence; the route is the first.

### 3.3 Migration 3 of 3 — Storage bucket

Run via Supabase Storage API or dashboard, not SQL. Bucket configuration:

```
name: assistant-media
public: false
file size limit: 25 MB
allowed mime types: image/jpeg, image/png, image/webp, image/heic
```

Bucket policies enforce path-based tenant isolation. Upload paths must follow the structure in section 4. Access only via signed URLs generated server-side.

---

## 4. Storage path structure

All uploaded media stored in the `assistant-media` bucket using the following path pattern:

```
{tenant_id}/{development_id}/{unit_id}/{conversation_id}/{media_id}.{ext}
```

Example:

```
4cee69c6-be4b-486e-9c33-2b5a7d30e287/57dc3919-2725-4575-8046-9179075ac88e/{unit_id}/{conversation_id}/{media_id}.jpg
```

Thumbnails generated server-side after upload, stored at:

```
{tenant_id}/{development_id}/{unit_id}/{conversation_id}/thumbnails/{media_id}.jpg
```

Thumbnail spec: max 800px on the longest edge, JPEG quality 80, stripped of EXIF.

Never expose raw storage URLs to the client. All media reads use signed URLs with a one-hour expiry, generated by a server route that verifies the caller has access to the tenant.

Do not rename storage objects via SQL UPDATE on `storage.objects.name` — this does not move the underlying blob. If a media object needs to move, re-upload via the Storage API.

---

## 5. Server routes

Three new routes, all under `apps/unified-portal/app/api/assistant/`.

### 5.1 `POST /api/assistant/media/upload`

Accepts `multipart/form-data` with one or more image files plus form fields:
- `conversation_id` (uuid)
- `message_id` (uuid, optional — generated server-side if absent)
- `unit_id` (uuid, optional but required for homeowner uploads)

Behaviour:
1. Verify caller's tenant context. For homeowner side, use existing care-session pattern. For installer/developer side, use existing auth.
2. Validate each file: mime type in allowed set, size under 25 MB, dimensions readable.
3. Generate a `media_id` (uuid v4) per file.
4. Upload original to `{tenant_id}/{development_id}/{unit_id}/{conversation_id}/{media_id}.{ext}`.
5. Generate thumbnail and upload to thumbnails subpath.
6. Insert `assistant_media` row per file.
7. Return array of `{ media_id, signed_url, thumbnail_url, width, height }`.

Rate limits: 6 files per request, 20 uploads per user per hour.

Errors:
- 400 if mime type rejected or file too large. Specific message per failure.
- 403 if tenant verification fails.
- 500 if storage upload fails (log raw error server-side, return generic message client-side).

### 5.2 `POST /api/assistant/media/signed-url`

Accepts `{ media_id: uuid }`. Returns `{ signed_url, thumbnail_url, expires_at }`. One-hour expiry.

Used by the developer dashboard to render media in the report drawer. Verifies caller has access to the tenant that owns the media before signing.

### 5.3 `POST /api/assistant/chat/multimodal`

This is the new entry point for chat messages that include media. Existing text-only chat route is untouched.

Accepts:
```json
{
  "conversation_id": "uuid",
  "message_text": "string",
  "media_ids": ["uuid"],
  "unit_id": "uuid"
}
```

Behaviour:
1. Verify tenant access.
2. Load media records, confirm all belong to same tenant.
3. Call `mediaAnalysisService.analyse(input)` — placeholder this sprint.
4. Persist `assistant_media_analysis` row.
5. Apply decision engine — placeholder this sprint, always returns `answer_only`.
6. Return `{ message: string, analysis_id: uuid, action: string }`.

This route does not yet create issue reports or escalate. That logic lives in the decision engine, wired in Sprint 1b.

---

## 6. Placeholder analysis service

Location: `apps/unified-portal/lib/assistant/mediaAnalysisService.ts`

Interface:

```typescript
export interface MediaAnalysisInput {
  tenantId: string;
  developmentId: string;
  unitId: string | null;
  conversationId: string;
  messageId: string;
  userId: string | null;
  userMessage: string;
  mediaIds: string[];
}

export interface MediaAnalysisResult {
  analysisId: string;
  residentMessage: string;
  developerSummary: string;
  structured: StructuredAnalysis;
  action: 'answer_only' | 'ask_for_more_info' | 'log_issue_memory' | 'create_issue_report' | 'escalate_issue' | 'flag_for_human_review';
}

export interface StructuredAnalysis {
  issue_type: string | null;
  issue_category: string | null;
  room: string | null;
  visible_features: string[];
  severity_score: number | null;
  severity_label: 'low' | 'medium' | 'high' | 'urgent' | null;
  confidence_score: number | null;
  safety_risk: boolean;
  safety_risk_type: string | null;
  likely_trade: string | null;
  likely_system: string | null;
  potential_causes: string[];
  recommended_action: string | null;
  resident_guidance: string | null;
  needs_more_info: boolean;
  more_info_requested: string[];
  should_create_issue: boolean;
  should_escalate: boolean;
  escalation_level: 'none' | 'developer_notify' | 'urgent' | null;
  requires_human_review: boolean;
  warranty_relevant: boolean;
  similar_issue_check_required: boolean;
  developer_summary: string;
}

export async function analyse(input: MediaAnalysisInput): Promise<MediaAnalysisResult>;
```

Placeholder implementation:

```typescript
export async function analyse(input: MediaAnalysisInput): Promise<MediaAnalysisResult> {
  const structured: StructuredAnalysis = {
    issue_type: null,
    issue_category: null,
    room: null,
    visible_features: [],
    severity_score: null,
    severity_label: null,
    confidence_score: null,
    safety_risk: false,
    safety_risk_type: null,
    likely_trade: null,
    likely_system: null,
    potential_causes: [],
    recommended_action: 'placeholder',
    resident_guidance: null,
    needs_more_info: false,
    more_info_requested: [],
    should_create_issue: false,
    should_escalate: false,
    escalation_level: 'none',
    requires_human_review: false,
    warranty_relevant: false,
    similar_issue_check_required: false,
    developer_summary: 'Placeholder analysis. Real model wiring pending Sprint 1b.',
  };

  // Persist analysis row
  const analysisRow = await insertAnalysis({
    tenant_id: input.tenantId,
    development_id: input.developmentId,
    unit_id: input.unitId,
    user_id: input.userId,
    conversation_id: input.conversationId,
    message_id: input.messageId,
    input_media_ids: input.mediaIds,
    raw_model_output: { placeholder: true },
    model_provider: 'placeholder',
    model_name: 'placeholder-v1',
    prompt_version: 'placeholder-v1',
    ...flattenStructured(structured),
  });

  return {
    analysisId: analysisRow.id,
    residentMessage: "Thanks for the photo. I've saved it against your home. Full analysis isn't enabled yet, but a member of the team can review it if needed.",
    developerSummary: structured.developer_summary,
    structured,
    action: 'answer_only',
  };
}
```

This stub gives the UI something real to render and the data pipeline something real to persist. When Sprint 1b lands, only the internals of `analyse` change. The interface, the persistence, the routes, the UI all stay stable.

---

## 7. Chat UI changes

Location: existing assistant chat component in `apps/unified-portal`. Changes are additive, gated on `FEATURE_ASSISTANT_IMAGE_UPLOAD`.

### 7.1 Input bar

Add an attachment button to the left of the text input, using the design system pattern.

```tsx
import { Paperclip } from 'lucide-react';

// Inside the input bar layout
<button
  type="button"
  onClick={openAttachmentSheet}
  className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-500 active:scale-[0.98] transition-all duration-150"
  aria-label="Attach photo"
>
  <Paperclip className="w-4 h-4" />
</button>
```

Clicking opens the native file picker scoped to images only. On mobile (Capacitor wrapper), the picker offers camera or library via Capacitor Camera plugin if available; otherwise falls back to standard HTML `<input type="file" accept="image/*">`.

### 7.2 Selected media preview

When files are selected but not yet sent, render thumbnails above the input bar.

```tsx
<div className="flex gap-2 flex-wrap px-4 pb-2">
  {selectedFiles.map((file) => (
    <div key={file.id} className="relative group">
      <img
        src={file.previewUrl}
        alt=""
        className="w-16 h-16 rounded-lg object-cover border border-neutral-200"
      />
      <button
        type="button"
        onClick={() => removeFile(file.id)}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center hover:bg-neutral-800 transition-all duration-150"
        aria-label="Remove attachment"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  ))}
</div>
```

Max 6 files per message. If user attempts to add more, disable the attachment button and show inline helper text in `text-body-sm text-neutral-500`.

### 7.3 Send flow

When the send button is pressed with attached media:

1. Show a processing state in the input area. Replace the input with a status strip:

```tsx
<div className="px-4 py-3 bg-neutral-50 rounded-lg flex items-center gap-3 mx-4 mb-3">
  <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
  <p className="text-body-sm text-neutral-700">{statusMessage}</p>
</div>
```

Status messages rotate through:
- "Preparing photos"
- "Uploading photos"
- "Reviewing your home information"
- "Preparing the response"

Each step transitions when its phase actually starts. Do not show fake progress.

"Preparing photos" covers the client-side compression step. iPhone photos
are typically 10 to 15 MB and Vercel's serverless body cap is roughly
4.5 MB, so the client resizes each photo to at most 2000 pixels on the
longest edge and re-encodes as JPEG at quality 0.85 before the upload
network call begins. Files already below 1.5 MB skip the step entirely.
The longer-term plan is direct-to-Supabase signed upload URLs, which
removes the need for the client-side step.

2. Call `POST /api/assistant/media/upload` to upload all files. Collect returned media IDs.
3. Call `POST /api/assistant/chat/multimodal` with the message text and media IDs.
4. On response, render the user's message (with thumbnails) and the assistant's response in the chat thread.
5. On error, show an inline error using the design system error state: `bg-red-50 text-red-700 border border-red-200 rounded-lg p-3 text-body-sm`. Provide a retry button.

### 7.4 Rendering media in the chat history

User messages with media render with thumbnails inline above the text:

```tsx
<div className="space-y-2">
  {message.media.length > 0 && (
    <div className="grid grid-cols-3 gap-1.5 max-w-xs">
      {message.media.map((m) => (
        <button
          key={m.id}
          onClick={() => openLightbox(m.id)}
          className="aspect-square rounded-md overflow-hidden border border-neutral-200 hover:border-neutral-300 transition-all duration-150"
        >
          <img src={m.thumbnail_url} alt="" className="w-full h-full object-cover" />
        </button>
      ))}
    </div>
  )}
  {message.text && <p className="text-body">{message.text}</p>}
</div>
```

Lightbox is a simple full-screen overlay with the signed full-resolution URL. Build it as a separate component using the design system overlay pattern.

### 7.5 Copy

All resident-facing copy in this sprint:

- Attachment button label (aria): "Attach photo"
- Remove attachment label (aria): "Remove attachment"
- Too many files: "You can attach up to 6 photos per message."
- File too large: "That photo is too large. Try one under 25 MB."
- Unsupported type: "That file type isn't supported. Try a JPG, PNG, or HEIC."
- Upload failed: "Couldn't upload that photo. Try again or come back to it later."
- Placeholder analysis response (from server): "Thanks for the photo. I've saved it against your home. Full analysis isn't enabled yet, but a member of the team can review it if needed."

No em dashes. No emoji. No AI language. Tone is calm, plain, peer-to-peer.

---

## 8. What is explicitly out of scope this sprint

Listed so it's clear what comes next, not now.

- Real multimodal model call. Sprint 1b.
- Reasoning prompt finalisation. Drafted separately, refined offline with real test images, committed before Sprint 1b begins.
- Decision engine rules and safety overrides. Sprint 1b.
- Issue report creation logic. Sprint 1b.
- Developer dashboard report list and drawer. Sprint 2.
- Issue memory and historical comparison. Sprint 3.
- Contractor scorecards and pattern detection. Sprints 5 and 6.
- Video upload and processing. Deferred indefinitely.
- Voice notes. Deferred indefinitely.
- Embeddings and similarity search. Sprint 3.

---

## 9. Acceptance criteria

The sprint is done when all of the following pass:

1. Text-only assistant flow is identical to current production behaviour. No regression. Confirmed by running the existing `agent-test@test.ie` flow end to end.
2. Behind the feature flag, a homeowner can attach 1 to 6 images, see thumbnails, send the message, and receive the placeholder response.
3. Uploaded media appears in `assistant_media` with correct tenant, development, unit, conversation, and message IDs.
4. A row appears in `assistant_media_analysis` linked to the same conversation and message, with `model_provider = 'placeholder'`.
5. Thumbnails are generated and stored at the correct path.
6. Signed URLs work and expire after one hour.
7. Cross-tenant access attempts return 403. Verified by attempting to fetch a signed URL for a media ID owned by another tenant.
8. The feature flag default-off path works: with `FEATURE_ASSISTANT_IMAGE_UPLOAD=false`, the attachment button does not render and the multimodal route returns 404.
9. All code passes the existing CI checks.
10. No em dashes in any committed code, copy, or commit message.

---

## 10. Pre-flight checks before merge

Per established workflow:

1. Run migrations in three separate `apply_migration` calls in order.
2. After DDL, verify tables exist with `execute_sql` against `information_schema.tables`.
3. After RLS, verify policies exist with `execute_sql` against `pg_policies`.
4. Confirm storage bucket exists and policies are applied via Supabase dashboard.
5. Deploy to Vercel preview, verify the `/api/health` version field reflects the branch commit before testing.
6. Run the acceptance flow end to end on the preview deployment.
7. Confirm cross-tenant block with a second test account on a different tenant.

---

## 11. Claude Code session plan

This sprint splits into four Claude Code sessions, one component each, commit-and-stop, independent branches.

### Session 1 — Schema and storage

Branch: `assistant-v2/schema`

Prompt to Claude Code:

> Apply the three migrations from `docs/specs/assistant-v2-sprint-1.md` section 3 in order (DDL, RLS, storage bucket). Use the Supabase MCP `apply_migration` tool for the SQL migrations as three separate calls. After each call, run a verification query via `execute_sql` confirming the migration applied. Commit and stop.

### Session 2 — Server routes and placeholder analysis service

Branch: `assistant-v2/server`

Prompt to Claude Code:

> Implement the three server routes in `apps/unified-portal/app/api/assistant/` per section 5, and the placeholder `mediaAnalysisService` per section 6, of `docs/specs/assistant-v2-sprint-1.md`. Do not modify any existing route. All new behaviour gated on `FEATURE_ASSISTANT_IMAGE_UPLOAD`. Commit and stop.

### Session 3 — Chat UI

Branch: `assistant-v2/ui`

Prompt to Claude Code:

> Implement the chat UI changes per section 7 of `docs/specs/assistant-v2-sprint-1.md`. Follow the openhouse-design-system skill exactly. No new dependencies. No em dashes. Gated on `FEATURE_ASSISTANT_IMAGE_UPLOAD`. Commit and stop.

### Session 4 — End-to-end verification and feature flag enablement

Branch: `assistant-v2/verify`

Prompt to Claude Code:

> Run the full acceptance criteria from section 9 of `docs/specs/assistant-v2-sprint-1.md` against the Vercel preview deployment of the merged feature branches. Document each pass/fail. Do not enable the feature flag in production. Commit a verification report and stop.

---

## 12. After Sprint 1

Sprint 1b is wiring the real analysis service. The interface defined in section 6 stays stable; only the body of `analyse` changes. The model choice, the prompt, and the decision engine all land together in that sprint.

The reasoning prompt is drafted in parallel to this sprint as a separate artefact at `docs/prompts/housing-reasoning-v1.md`. It is not committed to runtime until Sprint 1b begins.

After Sprint 1b, the order is: developer dashboard report list and drawer, then issue memory and historical comparison, then contractor attribution UI, then pattern detection.
