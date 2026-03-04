# Deploy Check

Run a full pre-deployment health check on the OpenHouse codebase.

## Steps
1. `cd apps/unified-portal && npm run build` — must pass clean
2. Check for any `console.log` left in API routes (shouldn't be in prod)
3. Check for any hardcoded credentials or API keys
4. Verify all new tables in recent migrations have RLS enabled
5. Check `git log --oneline -10` — summarise what's changed
6. Report findings clearly — pass/fail with details

## Report Format
```
✅ Build: passing
✅ No hardcoded credentials
✅ RLS: all tables covered
⚠️  3 console.logs found in: [files]
📦 Last 10 commits: [summary]
```
