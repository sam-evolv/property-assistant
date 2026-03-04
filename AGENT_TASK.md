# Agent Task: 4 High-Impact Care Production Fixes

## CHANGE 1: Fix dead Documents tab in ProfileScreen

File: `apps/unified-portal/app/care/[installationId]/screens/ProfileScreen.tsx`

Replace the entire `activeSection === 'documents'` block with a professional "pending" state — keep the same outer structure but replace the list of clickable buttons with a visually identical but clearly "pending" list. Each document row should show with 50% opacity and a "Pending" badge instead of being a clickable button. Add a heading message explaining documents will appear once uploaded by the installer. Keep the FileText icon and styling consistent with the rest of the screen.

The documents to show as pending:
- Installation Certificate
- BER Certificate  
- SEAI Grant Confirmation
- System Commissioning Report
- Panel Warranty Certificate
- Inverter Warranty Certificate

---

## CHANGE 2: Make Guides screen items route to AI assistant

File: `apps/unified-portal/app/care/[installationId]/screens/GuidesScreen.tsx`

1. Add `setActiveTab` to the useCareApp destructure at the top.
2. Update `GuideItem` component to accept an optional `onClick?: () => void` prop and wire it to the button's onClick.
3. All guide items (video guides, documents, troubleshooting) should call `setActiveTab('assistant')` when tapped.
4. The "Can't find what you need?" banner at the bottom should also call `setActiveTab('assistant')` when tapped — make it a button with a cursor-pointer.

---

## CHANGE 3: Real data in Care Dashboard

File: `apps/unified-portal/app/care-dashboard/page.tsx`

Convert to a **server component** (remove 'use client'). Fetch real stats from Supabase using the service role key:

Query the `installations` table for:
- Total count of active installations (is_active = true)
- Sum of system_size_kwp → display as MWp if >= 1000, else kWp
- Count of health_status = 'healthy' vs total → avg health %
- Count of health_status = 'fault' → open faults
- 5 most recent installations (by created_at desc) for the activity feed

Replace all hardcoded stats with these real values. Add a "New Installation" button in the header linking to `/care-dashboard/installations/new`. The activity feed should show real installation records (customer_name, system_type, city, job_reference, created_at) instead of fake activity strings.

Keep the same visual layout/styling — just swap mock data for real data.

---

## CHANGE 4: Installer onboarding flow

### 4a. Create `apps/unified-portal/app/care-dashboard/installations/page.tsx`

Server component. Fetches all active installations from Supabase and displays them in a clean table with columns: Customer (name + address), System (type + size + job ref), Access Code (monospace font, highlighted), Health (colored badge). Each row links to a detail page (which doesn't need to exist yet — just use the href). Include a "New Installation" button that links to `/care-dashboard/installations/new`. If no installations exist, show an empty state with a CTA.

### 4b. Create `apps/unified-portal/app/care-dashboard/installations/new/page.tsx`

Client component. A form with two steps:

**Step 1 — Form:**
Sections:
- Customer Details: full name (required), email, phone, address (required), city (required), county (dropdown of Irish counties)
- System Details: system type dropdown (Solar PV / Heat Pump / EV Charger), system size in kWp (number), inverter model, panel model, panel count, install date, job reference (required)

On submit, POST to `/api/care/installations` with the form data. The API already exists and accepts these fields.

**Step 2 — Success:**
Show the created installation's access code prominently (large monospace font). Include a copy button. Show a "Preview Homeowner Portal" button that opens `/care/${installation.id}` in a new tab. Show a "Back to Installations" button.

Use the same gold (#D4AF37) brand color for primary buttons. Clean, professional styling consistent with the rest of the dashboard.

---

## After all changes:

1. Run `npm run typecheck` from `apps/unified-portal/` and fix any TypeScript errors.
2. Commit: `git add -A && git commit -m 'feat: care UX polish - fix dead docs tab, functional guides, real dashboard stats, installer onboarding flow'`
3. Run: `openclaw system event --text "Done: Care changes 1-4 complete - docs tab fixed, guides functional, real dashboard data, installer onboarding live" --mode now`
