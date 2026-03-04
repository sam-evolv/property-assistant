# New Feature

You are building a new feature for the OpenHouse platform.

## Steps
1. Read CLAUDE.md for codebase context
2. Understand what to build: $ARGUMENTS
3. Plan before coding — identify files to create/modify
4. Check existing patterns (auth, RLS, API routes) and match them exactly
5. Build it — database migration if needed, API routes, UI
6. Run `npm run build` in `apps/unified-portal/` — zero TypeScript errors
7. Commit: `git add -A && git commit -m "feat: [description]"`
8. Push: `git push origin main`
9. Notify: `openclaw system event --text "Done: Built [feature]" --mode now`

## Checklist
- [ ] New tables have RLS enabled with `(auth.jwt()->>'tenant_id')::uuid`
- [ ] Auth via `requireRole()` on all API routes
- [ ] Credentials encrypted if storing OAuth tokens
- [ ] No file content stored (metadata only)
- [ ] Build passes
