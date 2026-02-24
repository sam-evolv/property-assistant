/**
 * Salesforce CRM Adapter
 *
 * Uses OAuth 2.0 Web Server Flow and Salesforce REST API v59.0.
 * Key objects: Contact, Opportunity, Account
 */

import type { CRMAdapter, OAuthTokens, CRMObject, CRMField, CRMRecord, QueryFilter } from './base-adapter';

export interface SalesforceConfig {
  instanceUrl?: string; // Set after OAuth — comes from token response
  clientId?: string;
  clientSecret?: string;
  apiVersion?: string;
}

const DEFAULT_API_VERSION = 'v59.0';

export class SalesforceAdapter implements CRMAdapter {
  private config: SalesforceConfig;
  private accessToken: string | null = null;
  private instanceUrl: string | null = null;

  constructor(config: SalesforceConfig = {}) {
    this.config = config;
    this.instanceUrl = config.instanceUrl || null;
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  setInstanceUrl(url: string) {
    this.instanceUrl = url;
  }

  // --- Authentication ---

  getAuthUrl(state: string): string {
    const clientId = this.config.clientId || process.env.SALESFORCE_CLIENT_ID!;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/salesforce/callback`;

    const url = new URL('https://login.salesforce.com/services/oauth2/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', 'api refresh_token offline_access');
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const clientId = this.config.clientId || process.env.SALESFORCE_CLIENT_ID!;
    const clientSecret = this.config.clientSecret || process.env.SALESFORCE_CLIENT_SECRET!;

    const response = await fetch('https://login.salesforce.com/services/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/salesforce/callback`,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error_description || 'Salesforce token exchange failed');
    }

    // Salesforce returns instance_url — store it for API calls
    this.instanceUrl = data.instance_url;

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      // Salesforce tokens expire in ~2 hours by default
      expires_at: new Date(Date.now() + 7200000).toISOString(),
      token_type: data.token_type,
      scope: data.scope,
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const clientId = this.config.clientId || process.env.SALESFORCE_CLIENT_ID!;
    const clientSecret = this.config.clientSecret || process.env.SALESFORCE_CLIENT_SECRET!;

    const response = await fetch('https://login.salesforce.com/services/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error_description || 'Salesforce token refresh failed');
    }

    if (data.instance_url) {
      this.instanceUrl = data.instance_url;
    }

    return {
      access_token: data.access_token,
      refresh_token: refreshToken, // Salesforce doesn't rotate refresh tokens
      expires_at: new Date(Date.now() + 7200000).toISOString(),
    };
  }

  // --- Discovery ---

  async getAvailableObjects(): Promise<CRMObject[]> {
    const response = await this.apiRequest('/sobjects/');

    return (response.sobjects || [])
      .filter((s: any) => s.queryable && s.createable)
      .map((sobject: any) => ({
        name: sobject.name,
        label: sobject.label,
        plural_label: sobject.labelPlural,
      }));
  }

  async getObjectFields(sobjectName: string): Promise<CRMField[]> {
    const response = await this.apiRequest(`/sobjects/${sobjectName}/describe/`);

    return (response.fields || []).map((field: any) => ({
      name: field.name,
      label: field.label,
      type: field.type,
      required: !field.nillable && !field.defaultedOnCreate,
      picklist_values: field.picklistValues?.map((p: any) => p.label).filter(Boolean),
    }));
  }

  // --- Data Operations ---

  async query(sobject: string, filters?: QueryFilter[]): Promise<CRMRecord[]> {
    // Build SOQL query
    let soql = `SELECT Id, Name FROM ${sobject}`;

    // Get all queryable fields for a richer result
    try {
      const describe = await this.apiRequest(`/sobjects/${sobject}/describe/`);
      const queryableFields = (describe.fields || [])
        .filter((f: any) => f.type !== 'address' && f.type !== 'location')
        .map((f: any) => f.name)
        .slice(0, 50); // Salesforce has a query field limit
      if (queryableFields.length > 0) {
        soql = `SELECT ${queryableFields.join(', ')} FROM ${sobject}`;
      }
    } catch {
      // Fall back to simple query
    }

    if (filters?.length) {
      const clauses = filters.map(f => {
        const op = this.mapOperator(f.operator);
        if (f.operator === 'contains' || f.operator === 'like') {
          return `${f.field} LIKE '%${this.escapeSoql(f.value)}%'`;
        }
        return `${f.field} ${op} '${this.escapeSoql(f.value)}'`;
      });
      soql += ` WHERE ${clauses.join(' AND ')}`;
    }

    soql += ' LIMIT 2000';

    const response = await this.apiRequest(`/query?q=${encodeURIComponent(soql)}`);

    return (response.records || []).map((record: any) => ({
      id: record.Id,
      ...record,
    }));
  }

  async getRecord(sobject: string, id: string): Promise<CRMRecord> {
    const response = await this.apiRequest(`/sobjects/${sobject}/${id}`);
    return { id: response.Id, ...response };
  }

  async createRecord(sobject: string, data: Record<string, any>): Promise<string> {
    const response = await this.apiRequest(`/sobjects/${sobject}/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.id;
  }

  async updateRecord(sobject: string, id: string, data: Record<string, any>): Promise<void> {
    await this.apiRequest(`/sobjects/${sobject}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getChangedRecords(sobject: string, since: Date): Promise<CRMRecord[]> {
    const soql = `SELECT Id, Name, LastModifiedDate FROM ${sobject} WHERE LastModifiedDate > ${since.toISOString()} ORDER BY LastModifiedDate ASC LIMIT 2000`;
    const response = await this.apiRequest(`/query?q=${encodeURIComponent(soql)}`);
    return (response.records || []).map((record: any) => ({
      id: record.Id,
      ...record,
    }));
  }

  // --- Internal Helpers ---

  private get apiBase(): string {
    if (!this.instanceUrl) {
      throw new Error('Salesforce adapter: No instance URL set. Complete OAuth flow first.');
    }
    const version = this.config.apiVersion || DEFAULT_API_VERSION;
    return `${this.instanceUrl}/services/data/${version}`;
  }

  private async apiRequest(
    path: string,
    options?: { method?: string; body?: string }
  ): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Salesforce adapter: No access token set. Call setAccessToken() first.');
    }

    const url = `${this.apiBase}${path}`;
    const method = options?.method || 'GET';

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: 'application/json',
    };

    if (options?.body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: options?.body,
    });

    if (!response.ok) {
      // Salesforce returns errors as an array
      const err = await response.json().catch(() => [{}]);
      const message = Array.isArray(err) ? err[0]?.message : err?.message;
      throw new Error(message || `Salesforce API error: ${response.status}`);
    }

    // 204 No Content (PATCH/DELETE)
    if (response.status === 204) return {};

    return response.json();
  }

  private mapOperator(op: string): string {
    const map: Record<string, string> = {
      '=': '=',
      '!=': '!=',
      '>': '>',
      '>=': '>=',
      '<': '<',
      '<=': '<=',
    };
    return map[op] || '=';
  }

  private escapeSoql(value: string): string {
    return value.replace(/'/g, "\\'");
  }
}
