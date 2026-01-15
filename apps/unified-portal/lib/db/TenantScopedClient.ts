/**
 * TenantScopedClient - Backend Guardrail for Tenant-Scoped Database Operations
 * 
 * SECURITY GUARANTEES:
 * 1. All tenant-scoped writes REQUIRE tenant_id - fails closed if missing
 * 2. All mutations are logged to audit_events table
 * 3. Service role key never exposed to client
 * 
 * USAGE:
 *   const client = new TenantScopedClient(tenantId, { actor: 'user-123' });
 *   await client.insert('messages', { content: 'Hello' });
 * 
 * ENV VARS REQUIRED:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Tables that require tenant_id for all operations
const TENANT_SCOPED_TABLES = [
  'messages',
  'units',
  'developments',
  'documents',
  'house_types',
  'noticeboard_posts',
  'analytics_events',
  'archive_folders',
] as const;

type TenantScopedTable = typeof TENANT_SCOPED_TABLES[number];

interface AuditContext {
  actor: string;
  actorType?: 'service_role' | 'admin' | 'user' | 'system' | 'automation';
  requestId?: string;
}

interface TenantScopedClientOptions {
  actor?: string;
  actorType?: AuditContext['actorType'];
  requestId?: string;
}

export class TenantScopedClient {
  private supabase: SupabaseClient;
  private tenantId: string;
  private auditContext: AuditContext;

  constructor(tenantId: string, options: TenantScopedClientOptions = {}) {
    // FAIL CLOSED: tenant_id is required
    if (!tenantId) {
      throw new Error('SECURITY: TenantScopedClient requires tenant_id. Refusing to proceed.');
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      throw new Error('SECURITY: tenant_id must be a valid UUID. Refusing to proceed.');
    }

    this.tenantId = tenantId;
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    this.auditContext = {
      actor: options.actor || 'system',
      actorType: options.actorType || 'service_role',
      requestId: options.requestId,
    };
  }

  /**
   * Check if a table is tenant-scoped
   */
  private isTenantScoped(table: string): boolean {
    return TENANT_SCOPED_TABLES.includes(table as TenantScopedTable);
  }

  /**
   * Log an audit event for the operation
   */
  private async logAudit(
    table: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    recordId: string,
    beforeState?: Record<string, any>,
    afterState?: Record<string, any>
  ): Promise<void> {
    try {
      await this.supabase.from('audit_events').insert({
        actor: this.auditContext.actor,
        actor_type: this.auditContext.actorType,
        tenant_id: this.tenantId,
        table_name: table,
        operation,
        record_id: recordId,
        before_state: beforeState || null,
        after_state: afterState || null,
        request_id: this.auditContext.requestId || null,
      });
    } catch (error) {
      // Log to console but don't fail the operation
      console.error('[AUDIT] Failed to log audit event:', error);
    }
  }

  /**
   * INSERT with tenant_id enforcement and audit logging
   */
  async insert<T extends Record<string, any>>(
    table: string,
    data: T | T[]
  ): Promise<{ data: any; error: any }> {
    const records = Array.isArray(data) ? data : [data];
    
    // FAIL CLOSED: Ensure tenant_id is set on all records for tenant-scoped tables
    if (this.isTenantScoped(table)) {
      for (const record of records) {
        const rec = record as Record<string, any>;
        if (rec.tenant_id && rec.tenant_id !== this.tenantId) {
          throw new Error(
            `SECURITY: Attempted to insert record with different tenant_id (${rec.tenant_id}) than client (${this.tenantId}). Refusing.`
          );
        }
        rec.tenant_id = this.tenantId;
      }
    }

    const result = await this.supabase.from(table).insert(records).select();

    // Log audit events for successful inserts
    if (result.data && !result.error) {
      for (const inserted of result.data) {
        await this.logAudit(table, 'INSERT', inserted.id?.toString() || 'unknown', undefined, inserted);
      }
    }

    return result;
  }

  /**
   * UPDATE with tenant_id enforcement and audit logging
   */
  async update<T extends Record<string, any>>(
    table: string,
    id: string,
    data: Partial<T>
  ): Promise<{ data: any; error: any }> {
    // Prevent changing tenant_id
    if ('tenant_id' in data && data.tenant_id !== this.tenantId) {
      throw new Error('SECURITY: Cannot change tenant_id of existing record. Refusing.');
    }

    // Fetch before state for audit
    let beforeState: any = null;
    if (this.isTenantScoped(table)) {
      const { data: existing } = await this.supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .eq('tenant_id', this.tenantId)
        .single();
      
      if (!existing) {
        return { data: null, error: { message: 'Record not found or access denied' } };
      }
      beforeState = existing;
    }

    // Perform update with tenant_id filter
    const query = this.supabase.from(table).update(data).eq('id', id);
    
    if (this.isTenantScoped(table)) {
      query.eq('tenant_id', this.tenantId);
    }

    const result = await query.select().single();

    // Log audit event
    if (result.data && !result.error) {
      await this.logAudit(table, 'UPDATE', id, beforeState, result.data);
    }

    return result;
  }

  /**
   * DELETE with tenant_id enforcement and audit logging
   */
  async delete(table: string, id: string): Promise<{ data: any; error: any }> {
    // Fetch before state for audit
    let beforeState: any = null;
    if (this.isTenantScoped(table)) {
      const { data: existing } = await this.supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .eq('tenant_id', this.tenantId)
        .single();
      
      if (!existing) {
        return { data: null, error: { message: 'Record not found or access denied' } };
      }
      beforeState = existing;
    }

    // Perform delete with tenant_id filter
    const query = this.supabase.from(table).delete().eq('id', id);
    
    if (this.isTenantScoped(table)) {
      query.eq('tenant_id', this.tenantId);
    }

    const result = await query.select().single();

    // Log audit event
    if (!result.error) {
      await this.logAudit(table, 'DELETE', id, beforeState, undefined);
    }

    return result;
  }

  /**
   * SELECT with automatic tenant_id filtering
   */
  async select(
    table: string,
    columns: string = '*',
    filters?: Record<string, any>
  ): Promise<{ data: any; error: any }> {
    let query = this.supabase.from(table).select(columns);

    // Auto-filter by tenant_id for tenant-scoped tables
    if (this.isTenantScoped(table)) {
      query = query.eq('tenant_id', this.tenantId);
    }

    // Apply additional filters
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }
    }

    return query;
  }

  /**
   * Get the raw Supabase client for complex queries
   * WARNING: Use with caution - bypasses tenant scoping
   */
  getRawClient(): SupabaseClient {
    console.warn('[SECURITY] getRawClient() bypasses tenant scoping. Use responsibly.');
    return this.supabase;
  }

  /**
   * Get the tenant ID this client is scoped to
   */
  getTenantId(): string {
    return this.tenantId;
  }
}

/**
 * Factory function for creating a TenantScopedClient
 */
export function createTenantScopedClient(
  tenantId: string,
  options?: TenantScopedClientOptions
): TenantScopedClient {
  return new TenantScopedClient(tenantId, options);
}

/**
 * Guard function that throws if tenant_id is missing
 * Use at API route entry points
 */
export function requireTenantId(tenantId: string | null | undefined): asserts tenantId is string {
  if (!tenantId) {
    throw new Error('SECURITY: tenant_id is required for this operation. Refusing to proceed.');
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tenantId)) {
    throw new Error('SECURITY: tenant_id must be a valid UUID. Refusing to proceed.');
  }
}
