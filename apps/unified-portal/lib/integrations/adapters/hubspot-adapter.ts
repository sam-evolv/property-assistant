/**
 * HubSpot CRM Adapter
 *
 * Uses OAuth 2.0 and HubSpot API v3.
 * Key objects: contacts, deals, companies
 */

import type { CRMAdapter, OAuthTokens, CRMObject, CRMField, CRMRecord, QueryFilter } from './base-adapter';

const HUBSPOT_API_BASE = 'https://api.hubapi.com';
const HUBSPOT_SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.deals.read',
  'crm.objects.deals.write',
  'crm.objects.companies.read',
  'crm.objects.companies.write',
  'crm.schemas.custom.read',
].join(' ');

const STANDARD_OBJECTS: Array<{ name: string; label: string; plural_label: string }> = [
  { name: 'contacts', label: 'Contact', plural_label: 'Contacts' },
  { name: 'deals', label: 'Deal', plural_label: 'Deals' },
  { name: 'companies', label: 'Company', plural_label: 'Companies' },
  { name: 'tickets', label: 'Ticket', plural_label: 'Tickets' },
];

export interface HubSpotConfig {
  clientId?: string;
  clientSecret?: string;
}

export class HubSpotAdapter implements CRMAdapter {
  private config: HubSpotConfig;
  private accessToken: string | null = null;

  constructor(config: HubSpotConfig = {}) {
    this.config = config;
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  // --- Authentication ---

  getAuthUrl(state: string): string {
    const clientId = this.config.clientId || process.env.HUBSPOT_CLIENT_ID!;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/hubspot/callback`;

    const url = new URL('https://app.hubspot.com/oauth/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', HUBSPOT_SCOPES);
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const clientId = this.config.clientId || process.env.HUBSPOT_CLIENT_ID!;
    const clientSecret = this.config.clientSecret || process.env.HUBSPOT_CLIENT_SECRET!;

    const response = await fetch(`${HUBSPOT_API_BASE}/oauth/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/hubspot/callback`,
        code,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'HubSpot token exchange failed');
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const clientId = this.config.clientId || process.env.HUBSPOT_CLIENT_ID!;
    const clientSecret = this.config.clientSecret || process.env.HUBSPOT_CLIENT_SECRET!;

    const response = await fetch(`${HUBSPOT_API_BASE}/oauth/v1/token`, {
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
      throw new Error(data.message || 'HubSpot token refresh failed');
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  // --- Discovery ---

  async getAvailableObjects(): Promise<CRMObject[]> {
    const objects = [...STANDARD_OBJECTS];

    // Also check for custom objects
    try {
      const response = await this.apiRequest('/crm/v3/schemas');
      for (const schema of response.results || []) {
        objects.push({
          name: schema.objectTypeId || schema.name,
          label: schema.labels?.singular || schema.name,
          plural_label: schema.labels?.plural || schema.name,
        });
      }
    } catch {
      // Custom objects may not be accessible — that's fine
    }

    return objects;
  }

  async getObjectFields(objectType: string): Promise<CRMField[]> {
    const response = await this.apiRequest(`/crm/v3/properties/${objectType}`);

    return (response.results || []).map((prop: any) => ({
      name: prop.name,
      label: prop.label,
      type: prop.type,
      required: prop.fieldType === 'text' && prop.name === 'email', // HubSpot doesn't expose required clearly
      picklist_values: prop.options?.map((o: any) => o.label).filter(Boolean),
    }));
  }

  // --- Data Operations ---

  async query(objectType: string, filters?: QueryFilter[]): Promise<CRMRecord[]> {
    const body: any = {
      limit: 100,
      properties: [],
    };

    // Get properties for the object to return richer results
    try {
      const props = await this.getObjectFields(objectType);
      body.properties = props.slice(0, 30).map(p => p.name);
    } catch {
      // Fall back to default properties
    }

    if (filters?.length) {
      body.filterGroups = [{
        filters: filters.map(f => ({
          propertyName: f.field,
          operator: this.mapOperator(f.operator),
          value: f.value,
        })),
      }];
    }

    const response = await this.apiRequest(`/crm/v3/objects/${objectType}/search`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return (response.results || []).map((record: any) => ({
      id: record.id,
      ...record.properties,
    }));
  }

  async getRecord(objectType: string, id: string): Promise<CRMRecord> {
    const response = await this.apiRequest(`/crm/v3/objects/${objectType}/${id}`);
    return {
      id: response.id,
      ...response.properties,
    };
  }

  async createRecord(objectType: string, data: Record<string, any>): Promise<string> {
    const response = await this.apiRequest(`/crm/v3/objects/${objectType}`, {
      method: 'POST',
      body: JSON.stringify({ properties: data }),
    });
    return response.id;
  }

  async updateRecord(objectType: string, id: string, data: Record<string, any>): Promise<void> {
    await this.apiRequest(`/crm/v3/objects/${objectType}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties: data }),
    });
  }

  async getChangedRecords(objectType: string, since: Date): Promise<CRMRecord[]> {
    const timestamp = since.getTime();

    const body = {
      filterGroups: [{
        filters: [{
          propertyName: 'hs_lastmodifieddate',
          operator: 'GTE',
          value: String(timestamp),
        }],
      }],
      sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'ASCENDING' }],
      limit: 100,
    };

    const response = await this.apiRequest(`/crm/v3/objects/${objectType}/search`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return (response.results || []).map((record: any) => ({
      id: record.id,
      ...record.properties,
    }));
  }

  // --- Internal Helpers ---

  private async apiRequest(
    path: string,
    options?: { method?: string; body?: string }
  ): Promise<any> {
    if (!this.accessToken) {
      throw new Error('HubSpot adapter: No access token set. Call setAccessToken() first.');
    }

    const url = `${HUBSPOT_API_BASE}${path}`;
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
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `HubSpot API error: ${response.status}`);
    }

    if (response.status === 204) return {};

    return response.json();
  }

  private mapOperator(op: string): string {
    const map: Record<string, string> = {
      '=': 'EQ',
      '!=': 'NEQ',
      '>': 'GT',
      '>=': 'GTE',
      '<': 'LT',
      '<=': 'LTE',
      'contains': 'CONTAINS_TOKEN',
      'like': 'CONTAINS_TOKEN',
    };
    return map[op] || 'EQ';
  }
}
