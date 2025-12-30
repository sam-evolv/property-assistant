# Login Redirect Verification Guide

This document outlines how to verify that post-login routing works correctly based on user roles.

## Role-Based Routing

| Role | Default Landing Page |
|------|---------------------|
| `super_admin` | `/super` |
| `developer` | `/developer` |
| `admin` | `/developer` |
| `tenant_admin` | `/developer` |
| No role / Not provisioned | `/access-pending` |

## Verification Steps

### 1. Developer Account Login

**Steps:**
1. Sign in at `/login` with a developer account
2. Do NOT specify a `redirectTo` parameter

**Expected Result:**
- User lands at `/developer`
- Developer dashboard is displayed

### 2. Super Admin Login

**Steps:**
1. Sign in at `/login` with a super admin account
2. Do NOT specify a `redirectTo` parameter

**Expected Result:**
- User lands at `/super`
- Super admin dashboard is displayed

### 3. Admin / Tenant Admin Login

**Steps:**
1. Sign in at `/login` with an admin or tenant_admin account
2. Do NOT specify a `redirectTo` parameter

**Expected Result:**
- User lands at `/developer`
- Developer dashboard is displayed

### 4. Unprovisioned Account Login

**Steps:**
1. Sign up with a new email at `/login`
2. Verify email and sign in

**Expected Result:**
- User lands at `/access-pending`
- Message explains that account is not yet provisioned

### 5. Cross-Dashboard Access Prevention

**Developer trying to access Super Admin:**
1. Sign in as a developer
2. Manually navigate to `/super`

**Expected Result:**
- User is redirected to `/developer`
- Cannot access super admin dashboard

**Developer trying to access Admin:**
1. Sign in as a developer
2. Manually navigate to `/admin`

**Expected Result:**
- User is redirected to `/developer`

### 6. Super Admin Cross-Access (Allowed)

**Steps:**
1. Sign in as super admin
2. Navigate to `/developer`

**Expected Result:**
- Access is allowed (super admins can access all dashboards)

## Implementation Details

### Canonical Route Resolver
Location: `lib/auth/resolvePostLoginRoute.ts`

This module provides:
- `resolvePostLoginRoute(role)` - Returns the default landing route for a role
- `isRoleAllowedForPath(role, pathname)` - Checks if a role can access a path
- `getRedirectForUnauthorizedAccess(role, path)` - Gets redirect for unauthorized access

### Middleware Enforcement
Location: `middleware.ts`

The middleware:
1. Allows public paths without authentication
2. Redirects unauthenticated users to `/login`
3. Enforces role-based access for protected paths
4. Redirects users to their correct dashboard if accessing wrong one

### Login Flow
Location: `app/login/page.tsx`

After successful authentication:
1. Fetches user data from `/api/auth/me`
2. If not provisioned, redirects to `/access-pending`
3. Uses `resolvePostLoginRoute()` to determine landing page
4. Respects explicit `redirectTo` parameter if provided
