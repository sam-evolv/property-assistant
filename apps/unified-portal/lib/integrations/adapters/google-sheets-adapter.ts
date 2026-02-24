/**
 * Google Sheets Spreadsheet Adapter
 *
 * Reads/writes Google Sheets via Sheets API v4 and Drive API v3.
 */

import type { SpreadsheetAdapter, OAuthTokens } from './base-adapter';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';

export interface CellUpdate {
  row: number;
  col: number;
  value: string | number;
}

export class GoogleSheetsAdapter implements SpreadsheetAdapter {
  private accessToken: string | null = null;

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  // --- Authentication ---

  getAuthUrl(state: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/google/callback`;

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description || 'Google token exchange failed');

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description || 'Google token refresh failed');

    return {
      access_token: data.access_token,
      refresh_token: refreshToken, // Google doesn't always return a new refresh token
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  // --- Spreadsheet Operations ---

  async listSpreadsheets(): Promise<Array<{ id: string; name: string; url: string }>> {
    const response = await this.driveRequest(
      `/files?q=${encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet'")}&fields=files(id,name,webViewLink)&pageSize=50`
    );

    return (response.files || []).map((file: any) => ({
      id: file.id,
      name: file.name,
      url: file.webViewLink,
    }));
  }

  async getHeaders(spreadsheetId: string, sheetName?: string): Promise<string[]> {
    const range = `${sheetName || 'Sheet1'}!1:1`;
    const response = await this.sheetsRequest(
      `/${spreadsheetId}/values/${encodeURIComponent(range)}`
    );
    const values = response.values?.[0] || [];
    return values.map((v: any) => String(v || ''));
  }

  async getRows(spreadsheetId: string, sheetName?: string): Promise<Record<string, any>[]> {
    const sheet = sheetName || 'Sheet1';
    const response = await this.sheetsRequest(
      `/${spreadsheetId}/values/${encodeURIComponent(sheet)}`
    );

    const allRows = response.values || [];
    if (allRows.length < 2) return [];

    const headers = allRows[0] as string[];
    return allRows.slice(1).map((row: any[]) => {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => {
        if (h) obj[h] = row[i] ?? null;
      });
      return obj;
    });
  }

  async getSampleData(spreadsheetId: string, sheetName?: string, rows: number = 5): Promise<string[][]> {
    const range = `${sheetName || 'Sheet1'}!A1:Z${rows + 1}`;
    const response = await this.sheetsRequest(
      `/${spreadsheetId}/values/${encodeURIComponent(range)}`
    );
    return (response.values || []).map((row: any[]) => row.map(v => String(v ?? '')));
  }

  async updateCell(spreadsheetId: string, sheetName: string, row: number, column: string, value: any): Promise<void> {
    const range = `${sheetName}!${column}${row}`;
    await this.sheetsRequest(
      `/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        body: JSON.stringify({ values: [[value]] }),
      }
    );
  }

  async addColumn(spreadsheetId: string, sheetName: string, headerName: string): Promise<void> {
    const headers = await this.getHeaders(spreadsheetId, sheetName);
    const colIndex = headers.length;
    const colLetter = this.columnIndexToLetter(colIndex);
    const range = `${sheetName}!${colLetter}1`;

    await this.sheetsRequest(
      `/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        body: JSON.stringify({ values: [[headerName]] }),
      }
    );
  }

  async getChangedRows(spreadsheetId: string, sheetName?: string): Promise<Record<string, any>[]> {
    // Google Sheets API doesn't have per-row change tracking.
    // Return all rows; callers compare with last known state.
    return this.getRows(spreadsheetId, sheetName);
  }

  async registerSubscription(spreadsheetId: string, callbackUrl: string): Promise<string> {
    // Use Drive API to watch for changes to the file
    const { randomUUID } = await import('crypto');
    const channelId = randomUUID();

    const response = await this.driveRequest(`/files/${spreadsheetId}/watch`, {
      method: 'POST',
      body: JSON.stringify({
        id: channelId,
        type: 'web_hook',
        address: callbackUrl,
        expiration: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days max
      }),
    });

    return response.id || channelId;
  }

  async renewSubscription(subscriptionId: string): Promise<void> {
    // Google Drive watch channels can't be renewed — they must be stopped and recreated.
    // Caller should stop the old channel and register a new subscription.
    console.warn('[Google Sheets] Channel renewal not supported — create a new subscription instead');
  }

  // --- Batch Update (for enrichment columns) ---

  async batchUpdate(spreadsheetId: string, sheetName: string, updates: CellUpdate[]): Promise<void> {
    if (updates.length === 0) return;

    const data = updates.map(u => ({
      range: `${sheetName}!${this.columnIndexToLetter(u.col)}${u.row + 1}`,
      values: [[u.value]],
    }));

    await this.sheetsRequest(
      `/${spreadsheetId}/values:batchUpdate`,
      {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data,
        }),
      }
    );
  }

  // --- Internal Helpers ---

  private async sheetsRequest(
    path: string,
    options?: { method?: string; body?: string }
  ): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Google Sheets adapter: No access token set.');
    }

    const url = `${SHEETS_API}${path}`;
    const method = options?.method || 'GET';

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: 'application/json',
    };

    if (options?.body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, { method, headers, body: options?.body });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Sheets API error: ${response.status}`);
    }

    if (response.status === 204) return {};
    return response.json();
  }

  private async driveRequest(
    path: string,
    options?: { method?: string; body?: string }
  ): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Google Sheets adapter: No access token set.');
    }

    const url = `${DRIVE_API}${path}`;
    const method = options?.method || 'GET';

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: 'application/json',
    };

    if (options?.body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, { method, headers, body: options?.body });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Drive API error: ${response.status}`);
    }

    if (response.status === 204) return {};
    return response.json();
  }

  private columnIndexToLetter(index: number): string {
    let letter = '';
    let n = index;
    while (n >= 0) {
      letter = String.fromCharCode(65 + (n % 26)) + letter;
      n = Math.floor(n / 26) - 1;
    }
    return letter;
  }
}
