'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Link2, RefreshCw, Key, Webhook, Shield, AlertTriangle,
  CheckCircle, XCircle, Clock, Plus, Trash2, ExternalLink,
  FileSpreadsheet, Database, Activity, ChevronRight, Copy,
  Eye, EyeOff, Settings, Zap, Pause, Play, ChevronDown, ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Integration {
  id: string;
  type: string;
  name: string;
  status: string;
  sync_direction: string;
  sync_frequency: string;
  external_ref: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
}

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

interface Conflict {
  id: string;
  oh_table: string;
  oh_field: string;
  local_value: string;
  remote_value: string;
  created_at: string;
  integrations?: { name: string; type: string };
}

interface AuditLog {
  id: string;
  action: string;
  actor_type: string;
  metadata: any;
  created_at: string;
}

interface WebhookRecord {
  id: string;
  url: string;
  events: string[];
  development_ids: string[] | null;
  is_active: boolean;
  consecutive_failures: number;
  max_failures: number;
  last_triggered_at: string | null;
  last_failure_reason: string | null;
  created_at: string;
}

interface SyncLogEntry {
  id: string;
  sync_type: string;
  direction: string;
  status: string;
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_skipped: number;
  records_errored: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
}

interface WebhookDelivery {
  id: string;
  event_type: string;
  status: string;
  http_status: number | null;
  attempt_number: number;
  created_at: string;
}

const WEBHOOK_EVENTS = [
  'unit.created', 'unit.updated',
  'pipeline.stage_changed',
  'purchaser.registered', 'purchaser.question_asked',
  'document.uploaded', 'document.accessed',
  'compliance.status_changed',
  'message.received',
];

const STATUS_COLORS: Record<string, string> = {
  connected: 'bg-green-100 text-green-700',
  syncing: 'bg-blue-100 text-blue-700',
  error: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  paused: 'bg-gray-100 text-gray-600',
  disconnected: 'bg-gray-100 text-gray-500',
};

const TYPE_LABELS: Record<string, string> = {
  excel_onedrive: 'Excel (OneDrive)',
  excel_sharepoint: 'Excel (SharePoint)',
  google_sheets: 'Google Sheets',
  dynamics_365: 'Dynamics 365',
  salesforce: 'Salesforce',
  hubspot: 'HubSpot',
  custom: 'Custom',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[status] || 'bg-gray-100 text-gray-600')}>
      {status === 'connected' && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
      {status === 'syncing' && <RefreshCw className="w-3 h-3 animate-spin" />}
      {status === 'error' && <XCircle className="w-3 h-3" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function TimeAgo({ date }: { date: string | null }) {
  if (!date) return <span className="text-gray-400 text-xs">Never</span>;
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return <span className="text-xs text-gray-500">Just now</span>;
  if (mins < 60) return <span className="text-xs text-gray-500">{mins}m ago</span>;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return <span className="text-xs text-gray-500">{hours}h ago</span>;
  const days = Math.floor(hours / 24);
  return <span className="text-xs text-gray-500">{days}d ago</span>;
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Webhook state
  const [webhooksList, setWebhooksList] = useState<WebhookRecord[]>([]);
  const [showCreateWebhook, setShowCreateWebhook] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([]);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [expandedWebhook, setExpandedWebhook] = useState<string | null>(null);
  const [webhookDeliveries, setWebhookDeliveries] = useState<Record<string, WebhookDelivery[]>>({});

  // Sync analytics state
  const [expandedSync, setExpandedSync] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<Record<string, SyncLogEntry[]>>({});

  // API key creation state
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read']);
  const [newKeyResult, setNewKeyResult] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [integrationsRes, apiKeysRes, conflictsRes, webhooksRes] = await Promise.all([
        fetch('/api/integrations'),
        fetch('/api/integrations/api-keys'),
        fetch('/api/integrations/conflicts'),
        fetch('/api/integrations/webhooks'),
      ]);

      if (integrationsRes.ok) {
        const data = await integrationsRes.json();
        setIntegrations(data.integrations || []);
        setAuditLogs(data.recent_audit_logs || []);
      }

      if (apiKeysRes.ok) {
        const data = await apiKeysRes.json();
        setApiKeys(data.api_keys || []);
      }

      if (conflictsRes.ok) {
        const data = await conflictsRes.json();
        setConflicts(data.conflicts || []);
      }

      if (webhooksRes.ok) {
        const data = await webhooksRes.json();
        setWebhooksList(data.webhooks || []);
      }
    } catch (err) {
      setError('Failed to load integration data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);

    try {
      const response = await fetch('/api/integrations/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName, scopes: newKeyScopes }),
      });

      if (response.ok) {
        const data = await response.json();
        setNewKeyResult(data.key);
        setShowNewKey(true);
        setNewKeyName('');
        fetchData();
      }
    } catch {
      setError('Failed to create API key');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) return;

    try {
      await fetch(`/api/integrations/api-keys?id=${keyId}`, { method: 'DELETE' });
      fetchData();
    } catch {
      setError('Failed to revoke API key');
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!confirm('Disconnect this integration? Sync will stop immediately.')) return;

    try {
      await fetch(`/api/integrations?id=${integrationId}`, { method: 'DELETE' });
      fetchData();
    } catch {
      setError('Failed to disconnect integration');
    }
  };

  const handleResolveConflict = async (conflictId: string, resolution: string) => {
    try {
      await fetch('/api/integrations/conflicts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conflict_id: conflictId, resolution }),
      });
      fetchData();
    } catch {
      setError('Failed to resolve conflict');
    }
  };

  const handleConnectSpreadsheet = async (provider: 'microsoft' | 'google') => {
    try {
      const endpoint = provider === 'microsoft'
        ? '/api/integrations/oauth/microsoft'
        : '/api/integrations/oauth/google';

      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        window.location.href = data.auth_url;
      }
    } catch {
      setError('Failed to initiate connection');
    }
  };

  const handleConnectCRM = async (provider: 'dynamics_365' | 'salesforce' | 'hubspot') => {
    try {
      let endpoint: string;
      if (provider === 'dynamics_365') {
        endpoint = '/api/integrations/oauth/microsoft?type=dynamics_365';
      } else if (provider === 'salesforce') {
        endpoint = '/api/integrations/oauth/salesforce';
      } else {
        endpoint = '/api/integrations/oauth/hubspot';
      }

      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        window.location.href = data.auth_url;
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to initiate CRM connection');
      }
    } catch {
      setError('Failed to initiate CRM connection');
    }
  };

  const handleCreateWebhook = async () => {
    if (!newWebhookUrl.trim() || !newWebhookEvents.length) return;
    setCreatingWebhook(true);

    try {
      const response = await fetch('/api/integrations/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newWebhookUrl, events: newWebhookEvents }),
      });

      if (response.ok) {
        const data = await response.json();
        setNewWebhookSecret(data.webhook.secret);
        setNewWebhookUrl('');
        setNewWebhookEvents([]);
        fetchData();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create webhook');
      }
    } catch {
      setError('Failed to create webhook');
    } finally {
      setCreatingWebhook(false);
    }
  };

  const handleToggleWebhook = async (webhookId: string, isActive: boolean) => {
    try {
      await fetch(`/api/integrations/webhooks/${webhookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      });
      fetchData();
    } catch {
      setError('Failed to update webhook');
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm('Delete this webhook? It will stop receiving events.')) return;
    try {
      await fetch(`/api/integrations/webhooks/${webhookId}`, { method: 'DELETE' });
      fetchData();
    } catch {
      setError('Failed to delete webhook');
    }
  };

  const fetchDeliveries = async (webhookId: string) => {
    try {
      const response = await fetch(`/api/integrations/webhooks/${webhookId}/deliveries?limit=10`);
      if (response.ok) {
        const data = await response.json();
        setWebhookDeliveries(prev => ({ ...prev, [webhookId]: data.deliveries || [] }));
      }
    } catch { /* silent */ }
  };

  const fetchSyncLogs = async (integrationId: string) => {
    try {
      const response = await fetch(`/api/integrations/sync-log?integration_id=${integrationId}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setSyncLogs(prev => ({ ...prev, [integrationId]: data.sync_logs || [] }));
      }
    } catch { /* silent */ }
  };

  const toggleSyncExpand = (integrationId: string) => {
    if (expandedSync === integrationId) {
      setExpandedSync(null);
    } else {
      setExpandedSync(integrationId);
      if (!syncLogs[integrationId]) {
        fetchSyncLogs(integrationId);
      }
    }
  };

  const toggleWebhookExpand = (webhookId: string) => {
    if (expandedWebhook === webhookId) {
      setExpandedWebhook(null);
    } else {
      setExpandedWebhook(webhookId);
      if (!webhookDeliveries[webhookId]) {
        fetchDeliveries(webhookId);
      }
    }
  };

  const activeIntegrations = integrations.filter(i => i.status !== 'disconnected');
  const spreadsheetIntegrations = activeIntegrations.filter(i => ['excel_onedrive', 'excel_sharepoint', 'google_sheets'].includes(i.type));
  const crmIntegrations = activeIntegrations.filter(i => ['dynamics_365', 'salesforce', 'hubspot'].includes(i.type));

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 p-6 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
              <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
              <div className="h-4 w-64 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-6 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
              <p className="text-sm text-gray-500 mt-1">
                Connect your spreadsheets, CRMs, and external systems
              </p>
            </div>
            <button
              onClick={() => fetchData()}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
            </div>
          )}

          {/* Spreadsheet Integrations */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">Excel / Google Sheets</h2>
            </div>

            {spreadsheetIntegrations.length > 0 ? (
              <div className="space-y-3">
                {spreadsheetIntegrations.map(integration => (
                  <div key={integration.id} className="bg-gray-50 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-medium text-gray-900 truncate">{integration.name}</p>
                          <StatusBadge status={integration.status} />
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-gray-500">{TYPE_LABELS[integration.type] || integration.type}</span>
                          <span className="text-xs text-gray-400">Last sync: <TimeAgo date={integration.last_sync_at} /></span>
                          <span className="text-xs text-gray-400">{integration.sync_direction}</span>
                        </div>
                        {integration.last_error && (
                          <p className="text-xs text-red-500 mt-1">{integration.last_error}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => toggleSyncExpand(integration.id)}
                          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                        >
                          {expandedSync === integration.id ? 'Hide History' : 'Sync History'}
                        </button>
                        <button className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">
                          Sync Now
                        </button>
                        <button
                          onClick={() => handleDisconnect(integration.id)}
                          className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>

                    {expandedSync === integration.id && (
                      <div className="border-t border-gray-200 p-4 bg-white">
                        <p className="text-xs font-medium text-gray-600 mb-2">Recent Sync History</p>
                        {(syncLogs[integration.id] || []).length > 0 ? (
                          <div className="space-y-1.5">
                            {syncLogs[integration.id].map(log => (
                              <div key={log.id} className="flex items-center gap-3 text-xs">
                                <span className={cn(
                                  'w-1.5 h-1.5 rounded-full flex-shrink-0',
                                  log.status === 'completed' ? 'bg-green-500' : log.status === 'failed' ? 'bg-red-500' : log.status === 'partial' ? 'bg-amber-500' : 'bg-blue-500'
                                )} />
                                <span className="text-gray-500 w-12 flex-shrink-0">
                                  {new Date(log.started_at).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="text-gray-600 capitalize">{log.sync_type} {log.direction}</span>
                                <span className="text-gray-400">
                                  {log.records_processed} processed
                                  {log.records_updated > 0 && ` · ${log.records_updated} updated`}
                                  {log.records_errored > 0 && ` · ${log.records_errored} errors`}
                                </span>
                                <span className={cn(
                                  'ml-auto',
                                  log.status === 'completed' ? 'text-green-600' : log.status === 'failed' ? 'text-red-600' : 'text-amber-600'
                                )}>
                                  {log.status === 'completed' ? '✓' : log.status === 'failed' ? '✗' : '⚠'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">No sync history available</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4">No spreadsheets connected</p>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => handleConnectSpreadsheet('microsoft')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Connect Excel (OneDrive/SharePoint)
              </button>
              <button
                onClick={() => handleConnectSpreadsheet('google')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Connect Google Sheets
              </button>
            </div>
          </div>

          {/* CRM Connections */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">CRM Connections</h2>
            </div>

            {crmIntegrations.length > 0 ? (
              <div className="space-y-3">
                {crmIntegrations.map(integration => (
                  <div key={integration.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-medium text-gray-900">{integration.name}</p>
                        <StatusBadge status={integration.status} />
                      </div>
                      <span className="text-xs text-gray-500">{TYPE_LABELS[integration.type]}</span>
                    </div>
                    <button
                      onClick={() => handleDisconnect(integration.id)}
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                    >
                      Disconnect
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4">No CRM connected</p>
            )}

            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={() => handleConnectCRM('dynamics_365')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Connect Dynamics 365
              </button>
              <button
                onClick={() => handleConnectCRM('salesforce')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Connect Salesforce
              </button>
              <button
                onClick={() => handleConnectCRM('hubspot')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Connect HubSpot
              </button>
            </div>
          </div>

          {/* API Keys */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-600" />
                <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
              </div>
              <button
                onClick={() => setShowCreateKey(!showCreateKey)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Generate API Key
              </button>
            </div>

            {showCreateKey && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Key Name</label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={e => setNewKeyName(e.target.value)}
                      placeholder="e.g., Accounting Export"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Scopes</label>
                    <div className="flex gap-3">
                      {['read', 'write', 'admin'].map(scope => (
                        <label key={scope} className="flex items-center gap-1.5 text-sm text-gray-600">
                          <input
                            type="checkbox"
                            checked={newKeyScopes.includes(scope)}
                            onChange={e => {
                              if (e.target.checked) {
                                setNewKeyScopes([...newKeyScopes, scope]);
                              } else {
                                setNewKeyScopes(newKeyScopes.filter(s => s !== scope));
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          {scope}
                        </label>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleCreateApiKey}
                    disabled={creatingKey || !newKeyName.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-gold-500 rounded-lg hover:bg-gold-600 disabled:opacity-50 transition-colors"
                  >
                    {creatingKey ? 'Creating...' : 'Create Key'}
                  </button>
                </div>
              </div>
            )}

            {newKeyResult && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800 mb-2">API Key Created</p>
                <p className="text-xs text-green-700 mb-2">Copy this key now. It will not be shown again.</p>
                <div className="flex items-center gap-2">
                  <code className={cn(
                    'flex-1 px-3 py-2 bg-white border border-green-300 rounded text-xs font-mono',
                    showNewKey ? '' : 'text-transparent select-none'
                  )}
                    style={!showNewKey ? { textShadow: '0 0 8px rgba(0,0,0,0.5)' } : undefined}
                  >
                    {newKeyResult}
                  </code>
                  <button
                    onClick={() => setShowNewKey(!showNewKey)}
                    className="p-2 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100"
                    title={showNewKey ? 'Hide' : 'Show'}
                  >
                    {showNewKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => { navigator.clipboard.writeText(newKeyResult); }}
                    className="p-2 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100"
                    title="Copy"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => { setNewKeyResult(null); setShowNewKey(false); }}
                  className="mt-2 text-xs text-green-700 underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {apiKeys.length > 0 ? (
              <div className="space-y-2">
                {apiKeys.map(key => (
                  <div key={key.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{key.name}</p>
                        {!key.is_active && (
                          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full">Revoked</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <code className="text-xs text-gray-500 font-mono">{key.key_prefix}...</code>
                        <span className="text-xs text-gray-400">
                          Scopes: {key.scopes.join(', ')}
                        </span>
                        <span className="text-xs text-gray-400">
                          Last used: <TimeAgo date={key.last_used_at} />
                        </span>
                      </div>
                    </div>
                    {key.is_active && (
                      <button
                        onClick={() => handleRevokeKey(key.id)}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No API keys created</p>
            )}
          </div>

          {/* Webhooks */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-gray-900">Webhooks</h2>
              </div>
              <button
                onClick={() => { setShowCreateWebhook(!showCreateWebhook); setNewWebhookSecret(null); }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Webhook
              </button>
            </div>

            {showCreateWebhook && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint URL</label>
                    <input
                      type="url"
                      value={newWebhookUrl}
                      onChange={e => setNewWebhookUrl(e.target.value)}
                      placeholder="https://your-server.com/webhooks/openhouse"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Events</label>
                    <div className="flex flex-wrap gap-2">
                      {WEBHOOK_EVENTS.map(event => (
                        <label key={event} className="flex items-center gap-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded px-2 py-1 cursor-pointer hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={newWebhookEvents.includes(event)}
                            onChange={e => {
                              if (e.target.checked) {
                                setNewWebhookEvents([...newWebhookEvents, event]);
                              } else {
                                setNewWebhookEvents(newWebhookEvents.filter(ev => ev !== event));
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          {event}
                        </label>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleCreateWebhook}
                    disabled={creatingWebhook || !newWebhookUrl.trim() || !newWebhookEvents.length}
                    className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {creatingWebhook ? 'Creating...' : 'Create Webhook'}
                  </button>
                </div>
              </div>
            )}

            {newWebhookSecret && (
              <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm font-medium text-purple-800 mb-2">Webhook Created</p>
                <p className="text-xs text-purple-700 mb-2">Copy this signing secret now. It will not be shown again.</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-white border border-purple-300 rounded text-xs font-mono break-all">
                    {newWebhookSecret}
                  </code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(newWebhookSecret); }}
                    className="p-2 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100"
                    title="Copy"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => { setNewWebhookSecret(null); setShowCreateWebhook(false); }}
                  className="mt-2 text-xs text-purple-700 underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {webhooksList.length > 0 ? (
              <div className="space-y-2">
                {webhooksList.map(wh => (
                  <div key={wh.id} className="border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'w-2 h-2 rounded-full flex-shrink-0',
                            !wh.is_active ? 'bg-gray-400' : wh.consecutive_failures >= 8 ? 'bg-red-500' : wh.consecutive_failures >= 3 ? 'bg-amber-500' : 'bg-green-500'
                          )} />
                          <p className="text-sm font-medium text-gray-900 truncate">{wh.url}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {wh.events.slice(0, 3).map(ev => (
                            <span key={ev} className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded">{ev}</span>
                          ))}
                          {wh.events.length > 3 && (
                            <span className="text-[10px] text-gray-400">+{wh.events.length - 3} more</span>
                          )}
                          <span className="text-xs text-gray-400">Last: <TimeAgo date={wh.last_triggered_at} /></span>
                        </div>
                        {wh.last_failure_reason && (
                          <p className="text-xs text-red-500 mt-1 truncate">{wh.last_failure_reason}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => toggleWebhookExpand(wh.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                          title="View deliveries"
                        >
                          {expandedWebhook === wh.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleToggleWebhook(wh.id, wh.is_active)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                          title={wh.is_active ? 'Pause' : 'Resume'}
                        >
                          {wh.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteWebhook(wh.id)}
                          className="p-1.5 text-red-400 hover:text-red-600 rounded hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {expandedWebhook === wh.id && (
                      <div className="border-t border-gray-100 p-3 bg-gray-50">
                        <p className="text-xs font-medium text-gray-600 mb-2">Recent Deliveries</p>
                        {(webhookDeliveries[wh.id] || []).length > 0 ? (
                          <div className="space-y-1">
                            {webhookDeliveries[wh.id].map(d => (
                              <div key={d.id} className="flex items-center gap-2 text-xs">
                                <span className={cn(
                                  'w-1.5 h-1.5 rounded-full',
                                  d.status === 'delivered' ? 'bg-green-500' : d.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                                )} />
                                <span className="text-gray-600">{d.event_type}</span>
                                {d.http_status && <span className="text-gray-400">HTTP {d.http_status}</span>}
                                <span className="text-gray-400 ml-auto"><TimeAgo date={d.created_at} /></span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">No deliveries yet</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No webhooks configured</p>
            )}
          </div>

          {/* Audit Log */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Audit Log</h2>
              </div>
            </div>

            {auditLogs.length > 0 ? (
              <div className="space-y-2">
                {auditLogs.map(log => (
                  <div key={log.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                    <Activity className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">
                        {log.action.replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      <TimeAgo date={log.created_at} />
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No audit events recorded yet</p>
            )}
          </div>

          {/* Conflicts */}
          {conflicts.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Conflicts ({conflicts.length} pending)
                </h2>
              </div>

              <div className="space-y-3">
                {conflicts.map(conflict => (
                  <div key={conflict.id} className="p-4 bg-amber-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900 mb-2">
                      {conflict.oh_table}.{conflict.oh_field}
                    </p>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Spreadsheet Value</p>
                        <p className="text-sm text-gray-800 font-mono bg-white px-2 py-1 rounded border">
                          {conflict.remote_value || '(empty)'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">OpenHouse Value</p>
                        <p className="text-sm text-gray-800 font-mono bg-white px-2 py-1 rounded border">
                          {conflict.local_value || '(empty)'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResolveConflict(conflict.id, 'resolved_remote')}
                        className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200 transition-colors"
                      >
                        Use Spreadsheet
                      </button>
                      <button
                        onClick={() => handleResolveConflict(conflict.id, 'resolved_local')}
                        className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded hover:bg-green-200 transition-colors"
                      >
                        Use OpenHouse
                      </button>
                      <button
                        onClick={() => handleResolveConflict(conflict.id, 'ignored')}
                        className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                      >
                        Ignore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
