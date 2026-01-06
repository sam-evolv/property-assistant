# Invalid Hook Call Warning Investigation

## Observation

Browser console shows "Invalid hook call" warnings during development. However, these are accompanied by server-injected attributes (`data-new-gr-c-s-check-loaded`, `data-gr-ext-installed`) which are markers from browser extensions (Grammarly).

## Investigation Steps

### 1. Test in Extension-Free Environment

Open the app in an **incognito/private window** with extensions disabled:

**Chrome:**
1. Open incognito window (Ctrl+Shift+N / Cmd+Shift+N)
2. Navigate to the app URL
3. Open DevTools (F12) → Console tab
4. Look for "Invalid hook call" warnings

**Firefox:**
1. Open private window (Ctrl+Shift+P / Cmd+Shift+P)
2. Navigate to the app URL
3. Check console for warnings

### 2. Check for Duplicate React Copies

If warning persists in extension-free environment, check for duplicate React:

```bash
# Check npm dependencies
npm ls react react-dom

# Check for multiple React versions
grep -r "react" package-lock.json | grep "version" | sort | uniq

# Alternative with pnpm
pnpm why react
pnpm why react-dom
```

### 3. Expected Results

- **Warning disappears in incognito**: Issue is caused by browser extension (Grammarly) - **non-blocking for production**
- **Warning persists**: Investigate duplicate React bundles or misplaced hooks in server components

## Current Evidence

The console log shows:
```
"data-new-gr-c-s-check-loaded,data-gr-ext-installed"
```

These are Grammarly extension attributes, strongly suggesting the warning is extension-related noise.

## Recommendation

1. Verify in incognito mode
2. If confirmed as extension issue, document and ignore
3. Production builds should not be affected as extensions vary by user
