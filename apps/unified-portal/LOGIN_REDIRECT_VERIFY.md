# Login Redirect Verification Guide

This document outlines how to verify that post-login routing works correctly based on user roles with multi-role support.

## Two Concepts: Landing vs Authorization

**Landing** = Where the user goes after login (uses precedence, developer-first)
**Authorization** = What paths the user can access (checks ALL roles)

| Concept | Logic | Example |
|---------|-------|---------|
| Landing | Developer-first precedence | super_admin + developer → lands on `/developer` |
| Authorization | Any role grants access | super_admin + developer → CAN access `/super` |

## Role Precedence for Landing (Developer First)

When a user has **multiple roles**, the system applies precedence to determine the **landing page**:

| Priority | Role | Default Landing |
|----------|------|-----------------|
| 1 (Highest) | `developer` | `/developer` |
| 2 | `tenant_admin` | `/developer` |
| 3 | `admin` | `/developer` |
| 4 | `super_admin` | `/super` |
| - | No role / Not provisioned | `/access-pending` |

**Key Principle**: Developer role determines the landing page, but users retain ALL their role privileges.

## Authorization (Access Control)

Authorization checks ALL roles the user has. If ANY role grants access to a path, access is allowed.

| Path | Required Role (any of) |
|------|------------------------|
| `/super` | `super_admin` |
| `/developer` | `developer`, `admin`, `tenant_admin`, `super_admin` |
| `/portal` | `developer`, `admin`, `tenant_admin`, `super_admin` |
| `/admin` | `super_admin` |

## Multi-Role Examples

| User Roles | Landing Page | Can Access `/super`? | Can Access `/developer`? |
|------------|--------------|----------------------|--------------------------|
| `['developer', 'admin']` | `/developer` | No | Yes |
| `['super_admin', 'developer']` | `/developer` | **Yes** | Yes |
| `['super_admin']` only | `/super` | Yes | Yes |
| `['admin']` only | `/developer` | No | Yes |
| `[]` empty | `/access-pending` | No | No |

## Verification Steps

### 1. Multi-Role User Login (Sam's Account)

**Steps:**
1. Sign in at `/login` with `sam@evolvai.ie` (has both developer + enterprise admin)
2. Do NOT specify a `redirectTo` parameter

**Expected Result:**
- User lands at `/developer` (NOT `/admin`)
- Developer dashboard is displayed
- User CAN manually navigate to other authorized paths

### 2. Super Admin with Developer Access

**Steps:**
1. Sign in with an account that has both `super_admin` + `developer` roles
2. Do NOT specify a `redirectTo` parameter

**Expected Result:**
- User lands at `/developer` (developer takes precedence for landing)
- User CAN still manually navigate to `/super` (authorized via super_admin role)

### 3. Pure Developer Login

**Steps:**
1. Sign in with an account that only has `developer` role

**Expected Result:**
- User lands at `/developer`
- User CANNOT access `/super` (no super_admin role)

### 4. Super Admin Only Login

**Steps:**
1. Sign in with an account that only has `super_admin` role

**Expected Result:**
- User lands at `/super` (no developer role to take precedence)
- User CAN access `/developer` (super_admin has access everywhere)

### 5. Admin-Only Login

**Steps:**
1. Sign in with an account that only has `admin` role

**Expected Result:**
- User lands at `/developer`
- User CANNOT access `/super`

### 6. Cross-Dashboard Navigation (Super Admin + Developer)

**Steps:**
1. Sign in with super_admin + developer account
2. Land on `/developer` (expected)
3. Manually navigate to `/super`

**Expected Result:**
- Navigation to `/super` succeeds (super_admin role grants access)
- No redirect back to `/developer`

### 7. Unprovisioned Account Login

**Steps:**
1. Sign up with a new email at `/login`
2. Verify email and sign in

**Expected Result:**
- User lands at `/access-pending`

## Implementation Details

### Session Structure
```typescript
interface AdminSession {
  id: string;
  email: string;
  role: AdminRole;      // Effective role for landing
  roles: AdminRole[];   // ALL roles for authorization
  tenantId: string;
}
```

### Canonical Route Resolver
Location: `lib/auth/resolvePostLoginRoute.ts`

- `getEffectiveRole(roles[])` - Applies precedence for landing page
- `resolvePostLoginRoute(roles)` - Returns landing route
- `isAnyRoleAllowedForPath(roles[], pathname)` - Checks ALL roles for authorization

### Middleware Authorization
Location: `middleware.ts`

Uses `isAnyRoleAllowedForPath()` which:
1. Checks if ANY role in the array grants access
2. Super admin in roles = access to everything
3. Developer/admin/tenant_admin = access to `/developer`, `/portal`

### Precedence Logic (Landing Only)
```typescript
const ROLE_PRECEDENCE: Record<AdminRole, number> = {
  'developer': 1,      // Highest priority for landing
  'tenant_admin': 2,
  'admin': 3,
  'super_admin': 4,    // Lowest priority for landing (not authorization!)
};
```

## Troubleshooting

**User lands on wrong dashboard:**
1. Check the `admins` table for all entries for that email
2. Verify which roles are assigned
3. Developer role should cause landing on `/developer`

**Super admin can't access /super:**
1. Verify `super_admin` role exists in their roles array
2. Check middleware logs for role detection
3. Authorization should check ALL roles, not just effective role

**Console Debug:**
Look for these log patterns:
- `[Middleware] Multiple roles detected: [...] -> landing role: developer`
- `[AUTH] Admin found in Drizzle DB: email roles: [...] effective: developer`
