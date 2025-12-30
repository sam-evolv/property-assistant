# Login Redirect Verification Guide

This document outlines how to verify that post-login routing works correctly based on user roles with multi-role support.

## Role Precedence (Developer First)

When a user has **multiple roles**, the system applies precedence to determine the landing page:

| Priority | Role | Default Landing |
|----------|------|-----------------|
| 1 (Highest) | `developer` | `/developer` |
| 2 | `tenant_admin` | `/developer` |
| 3 | `admin` | `/developer` |
| 4 | `super_admin` | `/super` |
| - | No role / Not provisioned | `/access-pending` |

**Key Principle**: Developer role always wins. If a user has both `developer` and `admin` roles, they land on `/developer`.

## Multi-Role Examples

| User Roles | Effective Role | Landing Page |
|------------|----------------|--------------|
| `['developer', 'admin']` | `developer` | `/developer` |
| `['admin', 'developer']` | `developer` | `/developer` |
| `['super_admin', 'developer']` | `developer` | `/developer` |
| `['admin']` only | `admin` | `/developer` |
| `['super_admin']` only | `super_admin` | `/super` |
| `[]` empty | None | `/access-pending` |

## Verification Steps

### 1. Multi-Role User Login (Sam's Account)

**Steps:**
1. Sign in at `/login` with `sam@evolvai.ie` (has both developer + enterprise admin)
2. Do NOT specify a `redirectTo` parameter

**Expected Result:**
- User lands at `/developer` (NOT `/admin`)
- Developer dashboard is displayed
- Console log shows: `[ROLE_PRECEDENCE] Multiple roles detected: [...] -> effective: developer`

### 2. Pure Developer Login

**Steps:**
1. Sign in with an account that only has `developer` role
2. Do NOT specify a `redirectTo` parameter

**Expected Result:**
- User lands at `/developer`

### 3. Admin-Only Login

**Steps:**
1. Sign in with an account that only has `admin` role
2. Do NOT specify a `redirectTo` parameter

**Expected Result:**
- User lands at `/developer` (admin defaults to developer dashboard)

### 4. Super Admin Only Login

**Steps:**
1. Sign in with an account that only has `super_admin` role
2. Do NOT specify a `redirectTo` parameter

**Expected Result:**
- User lands at `/super`
- Super admin dashboard is displayed

### 5. Super Admin with Developer Access

**Steps:**
1. Sign in with an account that has both `super_admin` + `developer` roles
2. Do NOT specify a `redirectTo` parameter

**Expected Result:**
- User lands at `/developer` (developer takes precedence)

### 6. Unprovisioned Account Login

**Steps:**
1. Sign up with a new email at `/login`
2. Verify email and sign in

**Expected Result:**
- User lands at `/access-pending`
- Message explains that account is not yet provisioned

### 7. Cross-Dashboard Access Prevention

**Developer trying to access Super Admin:**
1. Sign in as a user with developer role only
2. Manually navigate to `/super`

**Expected Result:**
- User is redirected to `/developer`

## Implementation Details

### Role Aggregation
- All admin records for a user's email are fetched
- Multiple roles are collected into an array
- Precedence is applied to select the effective role

### Canonical Route Resolver
Location: `lib/auth/resolvePostLoginRoute.ts`

This module provides:
- `getEffectiveRole(roles[])` - Applies precedence to select winning role
- `resolvePostLoginRoute(roleOrRoles)` - Returns route for single role or role array
- `isRoleAllowedForPath(role, pathname)` - Checks if a role can access a path

### Precedence Logic
```typescript
const ROLE_PRECEDENCE: Record<AdminRole, number> = {
  'developer': 1,      // Highest priority
  'tenant_admin': 2,
  'admin': 3,
  'super_admin': 4,    // Lowest priority (only wins if alone)
};
```

### Middleware Enforcement
Location: `middleware.ts`

The middleware:
1. Fetches ALL admin records for the user's email
2. Builds role array from all records
3. Applies precedence to determine effective role
4. Enforces role-based access for protected paths
5. Redirects users to their correct dashboard if accessing wrong one

### Session Structure
```typescript
interface AdminSession {
  id: string;
  email: string;
  role: AdminRole;      // Effective role after precedence
  roles: AdminRole[];   // All roles the user has
  tenantId: string;
}
```

## Troubleshooting

**User lands on wrong dashboard:**
1. Check the `admins` table for duplicate/multiple entries for that email
2. Verify which roles are assigned
3. Confirm precedence logic is applying correctly in logs

**User stuck on access-pending:**
1. Verify at least one row exists in `admins` table for that email
2. Check the `role` column has a valid value

**Console Debug:**
Look for these log patterns:
- `[ROLE_PRECEDENCE] Multiple roles detected: [...] -> effective: developer`
- `[AUTH] Admin found in Drizzle DB: email roles: [...] effective: developer`
