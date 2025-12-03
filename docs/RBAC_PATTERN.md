# RBAC Implementation Pattern

## Overview
This guide shows how to apply Role-Based Access Control (RBAC) to existing API routes using the `rbac-middleware` system.

## Quick Start

### 1. Import the RBAC Middleware
```typescript
import { requireDocumentManagement } from '@openhouse/api/rbac-middleware';
import { logDocumentUpload } from '@openhouse/api/audit-logger';
```

### 2. Wrap Your Route Handler
```typescript
// Before (no RBAC)
export async function POST(request: NextRequest) {
  // Handler logic
}

// After (with RBAC)
async function handleDocumentUpload(request: NextRequest, tenancyContext: TenancyContext) {
  // Handler logic - tenancyContext is now available
}

export const POST = requireDocumentManagement(handleDocumentUpload);
```

### 3. Add Audit Logging (Optional but Recommended)
```typescript
await logDocumentUpload(
  request,
  tenancyContext.email || 'unknown',
  tenancyContext.userId || '',
  tenancyContext.role,
  tenant.id,
  result.documentId,
  file.name
);
```

## Available RBAC Helpers

### Pre-built Permission Helpers
- `requireDocumentManagement(handler)` - Requires `manage_documents` permission
- `requireDevelopmentManagement(handler)` - Requires `manage_developments` permission
- `requireTenantManagement(handler)` - Requires `manage_tenants` permission (super_admin only)
- `requireViewAnalytics(handler)` - Requires `view_analytics` permission
- `requireAdminPermissions(handler)` - Requires both `view_analytics` and `view_system_logs`

### Custom RBAC Wrapper
```typescript
import { withRBAC } from '@openhouse/api/rbac-middleware';

export const GET = withRBAC(handler, {
  requiredPermission: 'view_chat_history',
  allowSuperAdminBypass: true,
});
```

### Multiple Permissions
```typescript
export const POST = withRBAC(handler, {
  requiredPermissions: ['manage_units', 'manage_homeowners'],
});
```

## Permission Matrix

| Role | Permissions |
|------|------------|
| **homeowner** | view_documents, view_chat_history |
| **developer** | view_analytics, view_developments, view_units, view_homeowners, view_documents, view_chat_history, manage_developments, manage_units, manage_homeowners, manage_documents, manage_training |
| **admin** | All developer permissions + view_system_logs, manage_chat, manage_admins |
| **super_admin** | All admin permissions + manage_tenants, impersonate_users, cross_tenant_access |

## Complete Example: Securing Document Upload

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireDocumentManagement } from '@openhouse/api/rbac-middleware';
import { logDocumentUpload } from '@openhouse/api/audit-logger';
import { db } from '@openhouse/db/client';

async function handleDocumentUpload(request: NextRequest, tenancyContext: any) {
  // Extract file from request
  const formData = await request.formData();
  const file = formData.get('file') as File;
  
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // Process upload
  const result = await processDocumentUpload({
    tenantId: tenancyContext.tenantId,
    file,
  });

  // Audit log the operation
  await logDocumentUpload(
    request,
    tenancyContext.email || 'unknown',
    tenancyContext.userId || '',
    tenancyContext.role,
    tenancyContext.tenantId,
    result.documentId || '',
    file.name
  );

  return NextResponse.json({ success: true, documentId: result.documentId });
}

// Apply RBAC wrapper - only users with manage_documents permission can call this
export const POST = requireDocumentManagement(handleDocumentUpload);
```

## Audit Logging Functions

### Document Operations
- `logDocumentUpload(request, actorEmail, actorId, actorRole, tenantId, documentId, documentName)`
- `logDocumentDelete(request, actorEmail, actorId, actorRole, tenantId, documentId, documentName)`

### Authentication
- `logAdminLogin(request, adminEmail, adminId, adminRole, tenantId)`
- `logLoginFailure(request, email, reason, attemptedTenantId?)`
- `logHomeownerImpersonation(request, adminEmail, adminId, adminRole, homeownerEmail, homeownerId, tenantId)`

### Admin Operations
- `logDeveloperRoleUpdate(request, actorEmail, actorId, tenantId, targetEmail, targetId, oldRole, newRole)`
- `logDataExport(request, actorEmail, actorId, actorRole, tenantId, exportType, recordCount)`

### Security Events
- `logRateLimitTrigger(request, actorId, tenantId, resource, remaining)`
- `logUnauthorizedTenantAccess(request, actorEmail, actorId, actorRole, attemptedTenantId, actualTenantId)`

## Migration Checklist for Existing Routes

1. ✅ Identify sensitive operations (document management, analytics, tenant management)
2. ✅ Choose appropriate RBAC helper or create custom permission check
3. ✅ Refactor route handler to accept `tenancyContext` parameter
4. ✅ Apply RBAC wrapper: `export const POST = requireXXX(handler)`
5. ✅ Add audit logging for the operation
6. ✅ Test with different user roles to ensure permissions work correctly
7. ✅ Verify 403 Forbidden responses for unauthorized users

## Error Responses

The RBAC middleware automatically returns standardized error responses:

- **401 Unauthorized**: No valid session found
- **403 Forbidden**: User lacks required permissions
  ```json
  {
    "error": "Forbidden - Insufficient permissions",
    "required": "manage_documents",
    "userRole": "homeowner"
  }
  ```
- **404 Not Found**: Tenant not found or invalid
- **500 Internal Server Error**: Unexpected error

## Best Practices

1. **Always use RBAC for sensitive operations** - Document management, analytics, tenant/developer management
2. **Audit log all state-changing operations** - Creates, updates, deletes, exports
3. **Use pre-built helpers when possible** - More consistent and maintainable
4. **Test with all user roles** - Ensure homeowners can't access admin endpoints
5. **Fail closed** - If RBAC check fails, deny access rather than allowing

## Next Routes to Secure

### High Priority (Critical Operations)
- [ ] `/api/documents/delete` - Require `manage_documents`
- [ ] `/api/analytics/*` - Require `view_analytics`
- [ ] `/api/tenants/*` - Require `manage_tenants`
- [ ] `/api/developers/*` - Require `manage_admins`
- [ ] `/api/train/*` - Require `manage_training`

### Medium Priority (Data Access)
- [ ] `/api/import/*` - Require appropriate manage permissions
- [ ] `/api/developments/*` - Require `manage_developments`
- [ ] `/api/admin/*` - Require admin permissions

### Low Priority (Read-Only)
- [ ] `/api/documents` (GET) - Require `view_documents`
- [ ] `/api/chat/history` - Require `view_chat_history`
