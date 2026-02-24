/**
 * CRM Adapter Base Interface
 *
 * Each CRM (Dynamics 365, Salesforce, HubSpot) implements this interface.
 * The sync engine uses this abstraction to interact with external systems.
 */

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: string;
  token_type?: string;
  scope?: string;
}

export interface CRMObject {
  name: string;
  label: string;
  plural_label: string;
}

export interface CRMField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  picklist_values?: string[];
}

export interface CRMRecord {
  id: string;
  [key: string]: any;
}

export interface QueryFilter {
  field: string;
  operator: string;
  value: string;
}

export interface CRMAdapter {
  // Authentication
  getAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<OAuthTokens>;
  refreshToken(refreshToken: string): Promise<OAuthTokens>;

  // Discovery
  getAvailableObjects(): Promise<CRMObject[]>;
  getObjectFields(objectName: string): Promise<CRMField[]>;

  // Data operations
  query(objectName: string, filters?: QueryFilter[]): Promise<CRMRecord[]>;
  getRecord(objectName: string, id: string): Promise<CRMRecord>;
  createRecord(objectName: string, data: Record<string, any>): Promise<string>;
  updateRecord(objectName: string, id: string, data: Record<string, any>): Promise<void>;

  // Sync
  getChangedRecords(objectName: string, since: Date): Promise<CRMRecord[]>;

  // Webhooks (if supported by CRM)
  registerWebhook?(events: string[], callbackUrl: string): Promise<string>;
}

/**
 * Spreadsheet adapter interface — simpler than CRM.
 */
export interface SpreadsheetAdapter {
  // Authentication
  getAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<OAuthTokens>;
  refreshToken(refreshToken: string): Promise<OAuthTokens>;

  // Spreadsheet operations
  listSpreadsheets(): Promise<Array<{ id: string; name: string; url: string }>>;
  getHeaders(spreadsheetId: string, sheetName?: string): Promise<string[]>;
  getRows(spreadsheetId: string, sheetName?: string): Promise<Record<string, any>[]>;
  getSampleData(spreadsheetId: string, sheetName?: string, rows?: number): Promise<string[][]>;
  updateCell(spreadsheetId: string, row: number, column: string, value: any): Promise<void>;
  addColumn(spreadsheetId: string, header: string): Promise<void>;

  // Change tracking
  getChangedRows(spreadsheetId: string, since?: Date): Promise<Record<string, any>[]>;

  // Webhooks / subscriptions
  registerSubscription?(spreadsheetId: string, callbackUrl: string): Promise<string>;
  renewSubscription?(subscriptionId: string): Promise<void>;
}
