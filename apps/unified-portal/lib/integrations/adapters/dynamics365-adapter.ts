/**
 * Microsoft Dynamics 365 CRM Adapter
 *
 * Uses Azure AD OAuth 2.0 and the Dataverse Web API (OData v4)
 * to read/write CRM records.
 *
 * Key entities: contacts (purchasers), opportunities (pipeline), incidents (service cases)
 */

import type { CRMAdapter, OAuthTokens, CRMObject, CRMField, CRMRecord, QueryFilter } from './base-adapter';

export interface Dynamics365Config {
  orgUrl: string; // e.g. https://myorg.crm.dynamics.com
  clientId?: string;
  clientSecret?: string;
}

export class Dynamics365Adapter implements CRMAdapter {
  private config: Dynamics365Config;
  private accessToken: string | null = null;

  constructor(config: Dynamics365Config) {
    this.config = config;
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  // --- Authentication ---

  getAuthUrl(state: string): string {
    const clientId = this.config.clientId || process.env.DYNAMICS_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID!;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/microsoft/callback`;

    const url = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', `${this.config.orgUrl}/user_impersonation offline_access`);
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const clientId = this.config.clientId || process.env.DYNAMICS_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID!;
    const clientSecret = this.config.clientSecret || process.env.DYNAMICS_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET!;

    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/microsoft/callback`,
        grant_type: 'authorization_code',
        scope: `${this.config.orgUrl}/user_impersonation offline_access`,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error_description || 'Dynamics 365 token exchange failed');
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      token_type: data.token_type,
      scope: data.scope,
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const clientId = this.config.clientId || process.env.DYNAMICS_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID!;
    const clientSecret = this.config.clientSecret || process.env.DYNAMICS_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET!;

    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error_description || 'Dynamics 365 token refresh failed');
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  // --- Discovery ---

  async getAvailableObjects(): Promise<CRMObject[]> {
    const response = await this.apiRequest(
      '/EntityDefinitions?$select=LogicalName,DisplayName,DisplayCollectionName,IsCustomizable&$filter=IsCustomizable/Value eq true'
    );

    return (response.value || []).map((entity: any) => ({
      name: entity.LogicalName,
      label: entity.DisplayName?.UserLocalizedLabel?.Label || entity.LogicalName,
      plural_label: entity.DisplayCollectionName?.UserLocalizedLabel?.Label || entity.LogicalName,
    }));
  }

  async getObjectFields(entityName: string): Promise<CRMField[]> {
    const response = await this.apiRequest(
      `/EntityDefinitions(LogicalName='${entityName}')/Attributes?$select=LogicalName,DisplayName,AttributeType,RequiredLevel,OptionSet`
    );

    return (response.value || []).map((attr: any) => ({
      name: attr.LogicalName,
      label: attr.DisplayName?.UserLocalizedLabel?.Label || attr.LogicalName,
      type: attr.AttributeType || 'String',
      required: attr.RequiredLevel?.Value === 'ApplicationRequired' || attr.RequiredLevel?.Value === 'SystemRequired',
      picklist_values: attr.OptionSet?.Options?.map((o: any) => o.Label?.UserLocalizedLabel?.Label).filter(Boolean),
    }));
  }

  // --- Data Operations ---

  async query(entitySet: string, filters?: QueryFilter[]): Promise<CRMRecord[]> {
    let url = `/${entitySet}`;
    const params: string[] = [];

    if (filters?.length) {
      const filterClauses = filters.map(f => {
        const op = this.mapOperator(f.operator);
        return `${f.field} ${op} '${f.value}'`;
      });
      params.push(`$filter=${filterClauses.join(' and ')}`);
    }

    params.push('$top=5000');

    if (params.length) {
      url += '?' + params.join('&');
    }

    const response = await this.apiRequest(url);
    return (response.value || []).map((record: any) => this.normalizeRecord(record));
  }

  async getRecord(entitySet: string, id: string): Promise<CRMRecord> {
    const response = await this.apiRequest(`/${entitySet}(${id})`);
    return this.normalizeRecord(response);
  }

  async createRecord(entitySet: string, data: Record<string, any>): Promise<string> {
    const response = await this.apiRequest(`/${entitySet}`, {
      method: 'POST',
      body: JSON.stringify(data),
      returnHeaders: true,
    });

    // Dataverse returns the new record ID in the OData-EntityId header
    const entityIdHeader = response.headers?.get('OData-EntityId') || '';
    const idMatch = entityIdHeader.match(/\(([^)]+)\)/);
    return idMatch ? idMatch[1] : '';
  }

  async updateRecord(entitySet: string, id: string, data: Record<string, any>): Promise<void> {
    await this.apiRequest(`/${entitySet}(${id})`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getChangedRecords(entitySet: string, since: Date): Promise<CRMRecord[]> {
    const response = await this.apiRequest(
      `/${entitySet}?$filter=modifiedon gt ${since.toISOString()}&$orderby=modifiedon asc&$top=5000`
    );
    return (response.value || []).map((record: any) => this.normalizeRecord(record));
  }

  // --- Service Case Creation ---

  async createServiceCase(
    question: string,
    unitId: string,
    contactId?: string
  ): Promise<string> {
    const caseData: Record<string, any> = {
      title: `OpenHouse AI: ${question.substring(0, 100)}`,
      description: question,
      caseorigincode: 3, // Web
      oh_unit_id: unitId,
      oh_source: 'openhouse_ai_assistant',
    };

    if (contactId) {
      caseData['customerid_contact@odata.bind'] = `/contacts(${contactId})`;
    }

    return this.createRecord('incidents', caseData);
  }

  // --- Internal Helpers ---

  private async apiRequest(
    path: string,
    options?: { method?: string; body?: string; returnHeaders?: boolean }
  ): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Dynamics 365 adapter: No access token set. Call setAccessToken() first.');
    }

    const url = `${this.config.orgUrl}/api/data/v9.2${path}`;
    const method = options?.method || 'GET';

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      'Prefer': 'odata.include-annotations="*"',
    };

    if (options?.body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: options?.body,
    });

    if (options?.returnHeaders) {
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Dynamics 365 API error: ${response.status}`);
      }
      return { headers: response.headers };
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Dynamics 365 API error: ${response.status}`);
    }

    // 204 No Content (common for PATCH/DELETE)
    if (response.status === 204) return {};

    return response.json();
  }

  private normalizeRecord(record: any): CRMRecord {
    const normalized: CRMRecord = { id: '' };

    for (const [key, value] of Object.entries(record)) {
      // Skip OData metadata keys
      if (key.startsWith('@odata') || key.startsWith('_') && key.endsWith('_value')) continue;

      // Extract the Dataverse GUID primary key
      if (key.endsWith('id') && typeof value === 'string' && !normalized.id) {
        normalized.id = value;
      }

      normalized[key] = value;
    }

    return normalized;
  }

  private mapOperator(op: string): string {
    const map: Record<string, string> = {
      '=': 'eq',
      '!=': 'ne',
      '>': 'gt',
      '>=': 'ge',
      '<': 'lt',
      '<=': 'le',
      'contains': 'contains',
      'like': 'contains',
    };
    return map[op] || 'eq';
  }
}
