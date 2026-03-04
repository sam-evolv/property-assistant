# Fix Bug

You are fixing a bug in the OpenHouse platform.

## Steps
1. Read CLAUDE.md for codebase context
2. Understand the bug: $ARGUMENTS
3. Find the root cause — read relevant files before touching anything
4. Fix it with the minimal change needed
5. Check for similar issues elsewhere
6. Run `npm run build` in `apps/unified-portal/` — fix any TypeScript errors
7. Commit: `git add -A && git commit -m "fix: [description]"`
8. Push: `git push origin main`
9. Notify: `openclaw system event --text "Done: Fixed [bug description]" --mode now`
