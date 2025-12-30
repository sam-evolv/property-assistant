# Developer Login Flow

This document describes the authentication flow for the OpenHouse AI Developer Portal.

## Routes

| Route | Purpose |
|-------|---------|
| `/login` | Main login page with sign-in, sign-up, and forgot password functionality |
| `/reset-password` | Password reset page (accessed via email link) |
| `/access-pending` | Shown when a user is authenticated but not linked to a developer account |
| `/developer` | Developer dashboard (requires `developer`, `admin`, or `tenant_admin` role) |
| `/super` | Super admin dashboard (requires `super_admin` role) |

## Authentication Flow

### Sign In
1. User enters email and password on `/login`
2. System authenticates via Supabase Auth (`/api/auth/login`)
3. System checks if user has an admin record in the database (`/api/auth/me`)
4. If admin record exists:
   - `super_admin` role redirects to `/super`
   - `developer`, `admin`, or `tenant_admin` role redirects to `/developer`
5. If no admin record exists, user is redirected to `/access-pending`

### Sign Up
1. User clicks "Create one" on the login page
2. Enters email and password (min 8 characters)
3. Supabase sends confirmation email
4. After email confirmation, user can sign in
5. First sign-in redirects to `/access-pending` until an admin links them to a developer account

### Forgot Password
1. User clicks "Forgot password?" on login page
2. Enters email address
3. Supabase sends password reset email with link to `/reset-password`
4. User enters new password (min 8 characters)
5. Password is updated and user is redirected to login

## Security

### Role Protection
- **Developer Routes** (`/developer/*`): Require `developer`, `admin`, or `tenant_admin` role
- **Super Admin Routes** (`/super/*`): Require `super_admin` role only
- Self-signup creates users without admin records; they cannot access protected routes until an admin provisions them

### Role Provisioning
- New signups do NOT automatically get admin access
- Super admin must manually create an admin record linking the user email to:
  - A tenant (developer organization)
  - A role (`developer`, `admin`, `tenant_admin`, or `super_admin`)
- This prevents unauthorized access to developer dashboards

## Data Model

The `admins` table links Supabase Auth users to portal access:

```sql
CREATE TABLE admins (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Testing

### Test Sign In
1. Navigate to `/login`
2. Enter valid credentials for a provisioned admin
3. Should redirect to `/developer` or `/super` based on role

### Test Sign Up
1. Navigate to `/login`
2. Click "Create one"
3. Enter new email and password
4. Check email for confirmation link
5. After confirming, sign in
6. Should see `/access-pending` page

### Test Forgot Password
1. Navigate to `/login`
2. Click "Forgot password?"
3. Enter email
4. Check email for reset link
5. Click link and set new password
6. Should redirect to login page

### Test Access Pending
1. Sign in with an email that has no admin record
2. Should see access pending page with support contact

## Marketing Site Integration

Add this URL to the "Login" button on the marketing site:

```
https://portal.openhouseai.ie/login
```

Or for development:
```
https://[your-replit-url]/login
```

## Support Contact

Users who need access should contact: sam@openhouseai.ie
