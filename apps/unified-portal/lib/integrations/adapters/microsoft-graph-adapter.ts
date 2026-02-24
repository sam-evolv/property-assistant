/**
 * Microsoft Graph Spreadsheet Adapter
 *
 * Reads/writes Excel files on OneDrive/SharePoint via Microsoft Graph API.
 */

import type { SpreadsheetAdapter, OAuthTokens } from './base-adapter';

const GRAPH_API = 'https://graph.microsoft.com/v1.0';

export interface CellUpdate {
  row: number;
  col: number;
  value: string | number;
}

export class MicrosoftGraphAdapter implements SpreadsheetAdapter {
  private accessToken: string | null = null;

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  // --- Authentication ---

  getAuthUrl(state: string): string {
    const clientId = process.env.MICROSOFT_CLIENT_ID!;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/microsoft/callback`;

    const url = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', 'Files.ReadWrite.All Sites.ReadWrite.All offline_access');
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/microsoft/callback`,
        grant_type: 'authorization_code',
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description || 'Token exchange failed');

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description || 'Token refresh failed');

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  // --- Spreadsheet Operations ---

  async listSpreadsheets(): Promise<Array<{ id: string; name: string; url: string }>> {
    const response = await this.graphRequest(
      "/me/drive/root/search(q='.xlsx')?$select=id,name,webUrl&$top=50"
    );
    return (response.value || []).map((file: any) => ({
      id: file.id,
      name: file.name,
      url: file.webUrl,
    }));
  }

  async getHeaders(fileId: string, sheetName?: string): Promise<string[]> {
    const sheet = sheetName || 'Sheet1';
    const response = await this.graphRequest(
      `/me/drive/items/${fileId}/workbook/worksheets/${encodeURIComponent(sheet)}/range(address='1:1')`
    );
    const values = response.values?.[0] || [];
    // Filter out empty trailing cells
    const lastNonEmpty = values.reduce((last: number, v: any, i: number) => (v ? i : last), -1);
    return values.slice(0, lastNonEmpty + 1).map((v: any) => String(v || ''));
  }

  async getRows(fileId: string, sheetName?: string): Promise<Record<string, any>[]> {
    const sheet = sheetName || 'Sheet1';
    const response = await this.graphRequest(
      `/me/drive/items/${fileId}/workbook/worksheets/${encodeURIComponent(sheet)}/usedRange`
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

  async getSampleData(fileId: string, sheetName?: string, rows: number = 5): Promise<string[][]> {
    const sheet = sheetName || 'Sheet1';
    const response = await this.graphRequest(
      `/me/drive/items/${fileId}/workbook/worksheets/${encodeURIComponent(sheet)}/range(address='A1:Z${rows + 1}')`
    );
    return (response.values || []).map((row: any[]) => row.map(v => String(v ?? '')));
  }

  async updateCell(fileId: string, sheetName: string, row: number, column: string, value: any): Promise<void> {
    const cellRef = `${column}${row}`;
    await this.graphRequest(
      `/me/drive/items/${fileId}/workbook/worksheets/${encodeURIComponent(sheetName)}/range(address='${cellRef}')`,
      {
        method: 'PATCH',
        body: JSON.stringify({ values: [[value]] }),
      }
    );
  }

  async addColumn(fileId: string, sheetName: string, headerName: string): Promise<void> {
    // Find the first empty column in row 1
    const headers = await this.getHeaders(fileId, sheetName);
    const colIndex = headers.length; // 0-based
    const colLetter = this.columnIndexToLetter(colIndex);
    const cellRef = `${colLetter}1`;

    await this.graphRequest(
      `/me/drive/items/${fileId}/workbook/worksheets/${encodeURIComponent(sheetName)}/range(address='${cellRef}')`,
      {
        method: 'PATCH',
        body: JSON.stringify({ values: [[headerName]] }),
      }
    );
  }

  async getChangedRows(fileId: string, sheetName?: string): Promise<Record<string, any>[]> {
    // Microsoft Graph doesn't provide per-row change tracking, so return all rows.
    // Callers compare with last known state to detect changes.
    return this.getRows(fileId, sheetName);
  }

  async registerSubscription(fileId: string, callbackUrl: string): Promise<string> {
    const expiry = new Date(Date.now() + 4230 * 60 * 1000); // Max ~3 days

    const response = await this.graphRequest('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        changeType: 'updated',
        notificationUrl: callbackUrl,
        resource: `/me/drive/items/${fileId}`,
        expirationDateTime: expiry.toISOString(),
        clientState: 'openhouse_webhook',
      }),
    });

    return response.id;
  }

  async renewSubscription(subscriptionId: string): Promise<void> {
    const expiry = new Date(Date.now() + 4230 * 60 * 1000);

    await this.graphRequest(`/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        expirationDateTime: expiry.toISOString(),
      }),
    });
  }

  // --- Batch Update (for enrichment columns) ---

  async batchUpdate(fileId: string, sheetName: string, updates: CellUpdate[]): Promise<void> {
    if (updates.length === 0) return;

    // Group updates by row for efficiency
    const rowMap = new Map<number, Map<number, string | number>>();
    for (const u of updates) {
      if (!rowMap.has(u.row)) rowMap.set(u.row, new Map());
      rowMap.get(u.row)!.set(u.col, u.value);
    }

    // Use batch API for multiple updates
    for (const [row, cols] of rowMap) {
      const sortedCols = [...cols.entries()].sort((a, b) => a[0] - b[0]);
      const minCol = sortedCols[0][0];
      const maxCol = sortedCols[sortedCols.length - 1][0];

      // Build a sparse row of values
      const values: (string | number | null)[] = new Array(maxCol - minCol + 1).fill(null);
      for (const [col, val] of sortedCols) {
        values[col - minCol] = val;
      }

      const startCol = this.columnIndexToLetter(minCol);
      const endCol = this.columnIndexToLetter(maxCol);
      const rangeAddress = `${startCol}${row + 1}:${endCol}${row + 1}`;

      await this.graphRequest(
        `/me/drive/items/${fileId}/workbook/worksheets/${encodeURIComponent(sheetName)}/range(address='${rangeAddress}')`,
        {
          method: 'PATCH',
          body: JSON.stringify({ values: [values] }),
        }
      );
    }
  }

  // --- Internal Helpers ---

  private async graphRequest(
    path: string,
    options?: { method?: string; body?: string }
  ): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Microsoft Graph adapter: No access token set.');
    }

    const url = path.startsWith('http') ? path : `${GRAPH_API}${path}`;
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
      throw new Error(err?.error?.message || `Graph API error: ${response.status}`);
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
