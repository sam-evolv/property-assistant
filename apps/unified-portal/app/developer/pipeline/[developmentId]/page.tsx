'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';

const tokens = {
  gold: '#D4AF37',
  goldLight: '#F5D874',
  goldDark: '#B8934C',
  dark: '#1a1a1a',
  success: '#22c55e',
  danger: '#ef4444',
  amber: '#f59e0b',
};

interface PipelineRow {
  id: string;
  unit_id: string;
  unit_name: string | null;
  unit_number: string | null;
  block: string | null;
  purchaser_name: string | null;
  purchaser_email: string | null;
  purchaser_phone: string | null;
  solicitor_firm: string | null;
  release_date: string | null;
  sale_agreed_date: string | null;
  deposit_date: string | null;
  contracts_issued_date: string | null;
  signed_contracts_date: string | null;
  counter_signed_date: string | null;
  kitchen_date: string | null;
  snag_date: string | null;
  desnag_date: string | null;
  drawdown_date: string | null;
  handover_date: string | null;
  mortgage_expiry_date: string | null;
  trafficLights: {
    contracts: 'green' | 'amber' | 'red' | null;
    kitchen: 'green' | 'amber' | 'red' | null;
    snag: 'green' | 'amber' | 'red' | null;
    desnag: 'green' | 'amber' | 'red' | null;
  };
}

interface PipelineStats {
  total: number;
  released: number;
  saleAgreed: number;
  deposited: number;
  contractsIssued: number;
  contractsSigned: number;
  counterSigned: number;
  kitchenDone: number;
  snagged: number;
  desnagged: number;
  drawndown: number;
  handedOver: number;
  redCount: number;
  amberCount: number;
}

const COLUMNS = [
  { key: 'unit', label: 'Unit', width: '90px', editable: false },
  { key: 'purchaser', label: 'Purchaser', width: '130px', editable: false },
  { key: 'release_date', label: 'Release', width: '80px', editable: true, type: 'date' },
  { key: 'sale_agreed_date', label: 'Sale Agr', width: '80px', editable: true, type: 'date' },
  { key: 'deposit_date', label: 'Deposit', width: '80px', editable: true, type: 'date' },
  { key: 'contracts_issued_date', label: 'Contr Out', width: '80px', editable: true, type: 'date' },
  { key: 'signed_contracts_date', label: 'Contr In', width: '80px', editable: true, type: 'date', traffic: 'contracts' },
  { key: 'counter_signed_date', label: 'Counter', width: '80px', editable: true, type: 'date' },
  { key: 'kitchen_date', label: 'Kitchen', width: '80px', editable: true, type: 'date', traffic: 'kitchen' },
  { key: 'snag_date', label: 'Snag', width: '80px', editable: true, type: 'date', traffic: 'snag' },
  { key: 'desnag_date', label: 'De-snag', width: '80px', editable: true, type: 'date', traffic: 'desnag' },
  { key: 'drawdown_date', label: 'Drawdown', width: '80px', editable: true, type: 'date' },
  { key: 'handover_date', label: 'Handover', width: '80px', editable: true, type: 'date' },
  { key: 'queries', label: 'Q', width: '40px', editable: false },
];

const ArrowLeftIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const FileTextIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = date.toLocaleString('en-GB', { month: 'short' });
  return `${day} ${month}`;
}

function getTrafficBg(light: 'green' | 'amber' | 'red' | null): string {
  switch (light) {
    case 'green': return 'bg-green-50';
    case 'amber': return 'bg-amber-50';
    case 'red': return 'bg-red-50';
    default: return '';
  }
}

function getTrafficBorder(light: 'green' | 'amber' | 'red' | null): string {
  switch (light) {
    case 'green': return 'border-green-300';
    case 'amber': return 'border-amber-300';
    case 'red': return 'border-red-300';
    default: return 'border-transparent';
  }
}

export default function PipelineDetailPage() {
  const router = useRouter();
  const params = useParams();
  const developmentId = params.developmentId as string;
  
  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [developmentName, setDevelopmentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const [pendingSaves, setPendingSaves] = useState<Set<string>>(new Set());
  const [filterTraffic, setFilterTraffic] = useState<string>('all');
  const [notesPanel, setNotesPanel] = useState<{ pipelineId: string; unitName: string } | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState('');

  const fetchNotes = useCallback(async (pipelineId: string) => {
    setNotesLoading(true);
    try {
      const res = await fetch(`/api/developments/${developmentId}/pipeline/notes?pipelineId=${pipelineId}`);
      const data = await res.json();
      setNotes(data.notes || []);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  }, [developmentId]);

  const handleOpenNotes = useCallback((row: PipelineRow) => {
    const unitName = row.block ? `${row.block}-${row.unit_number || row.unit_name}` : (row.unit_number || row.unit_name || 'Unit');
    setNotesPanel({ pipelineId: row.id, unitName });
    fetchNotes(row.id);
  }, [fetchNotes]);

  const handleAddNote = useCallback(async () => {
    if (!notesPanel || !newNote.trim()) return;
    try {
      await fetch(`/api/developments/${developmentId}/pipeline/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineId: notesPanel.pipelineId, note: newNote.trim(), isQuery: true }),
      });
      setNewNote('');
      fetchNotes(notesPanel.pipelineId);
    } catch (err) {
      console.error('Failed to add note:', err);
    }
  }, [developmentId, notesPanel, newNote, fetchNotes]);

  const handleResolveNote = useCallback(async (noteId: string, resolve: boolean) => {
    if (!notesPanel) return;
    try {
      await fetch(`/api/developments/${developmentId}/pipeline/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId, resolve }),
      });
      fetchNotes(notesPanel.pipelineId);
    } catch (err) {
      console.error('Failed to resolve note:', err);
    }
  }, [developmentId, notesPanel, fetchNotes]);

  const fetchData = useCallback(async () => {
    if (!developmentId) return;
    try {
      const res = await fetch(`/api/developments/${developmentId}/pipeline`);
      const data = await res.json();
      if (data.rows) {
        setRows(data.rows);
        setStats(data.stats);
        setDevelopmentName(data.development?.name || '');
      }
    } catch (err) {
      console.error('Failed to fetch pipeline:', err);
    } finally {
      setLoading(false);
    }
  }, [developmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCellClick = useCallback((rowId: string, field: string, currentValue: string | null) => {
    const col = COLUMNS.find(c => c.key === field);
    if (!col?.editable) return;

    if (col.type === 'date' && !currentValue) {
      handleDateUpdate(rowId, field, new Date().toISOString());
    } else {
      setEditingCell({ rowId, field });
    }
  }, []);

  const handleDateUpdate = useCallback(async (rowId: string, field: string, value: string | null) => {
    const saveKey = `${rowId}-${field}`;
    setPendingSaves(prev => new Set(prev).add(saveKey));

    setRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, [field]: value } : row
    ));
    setEditingCell(null);

    try {
      await fetch(`/api/developments/${developmentId}/pipeline`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineId: rowId, field, value }),
      });
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setPendingSaves(prev => {
        const next = new Set(prev);
        next.delete(saveKey);
        return next;
      });
    }
  }, [developmentId]);

  const filteredRows = useMemo(() => {
    let result = rows;

    if (filterTraffic !== 'all') {
      result = result.filter(row => {
        const lights = Object.values(row.trafficLights);
        if (filterTraffic === 'red') return lights.includes('red');
        if (filterTraffic === 'amber') return lights.includes('amber') && !lights.includes('red');
        return true;
      });
    }

    return result;
  }, [rows, filterTraffic]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto"
            style={{ borderColor: tokens.gold, borderTopColor: 'transparent' }}
          />
          <p className="text-sm text-gray-500 mt-3">Loading pipeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="h-12 border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/developer/pipeline')}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeftIcon />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">{developmentName || 'Sales Pipeline'}</h1>
            <p className="text-xs text-gray-500">
              {stats ? `${stats.total} units · ${stats.handedOver} complete` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {stats && stats.redCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded">
              {stats.redCount} RED
            </span>
          )}
          {stats && stats.amberCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded">
              {stats.amberCount} AMBER
            </span>
          )}
          <select
            value={filterTraffic}
            onChange={(e) => setFilterTraffic(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
          >
            <option value="all">All</option>
            <option value="red">Red Only</option>
            <option value="amber">Amber Only</option>
          </select>
          <button
            onClick={() => router.push(`/developer/pipeline/${developmentId}/analysis`)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition flex items-center gap-1 text-xs text-gray-600"
            title="View Analytics"
          >
            <ChartIcon />
            <span className="hidden sm:inline">Analytics</span>
          </button>
          <button
            onClick={fetchData}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition"
            title="Refresh"
          >
            <RefreshIcon />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse" style={{ minWidth: '1100px' }}>
          <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className="px-1.5 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap border-r border-gray-100 last:border-r-0"
                  style={{ minWidth: col.width, fontSize: '10px' }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, idx) => (
              <tr
                key={row.id}
                className={`border-b border-gray-100 hover:bg-gray-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/20'}`}
                style={{ height: '36px' }}
              >
                <td className="px-1.5 py-0.5 font-medium text-gray-900 whitespace-nowrap border-r border-gray-100">
                  {row.block ? `${row.block}-` : ''}{row.unit_number || row.unit_name || 'Unit'}
                </td>
                <td className="px-1.5 py-0.5 text-gray-700 whitespace-nowrap truncate border-r border-gray-100" style={{ maxWidth: '130px' }} title={row.purchaser_name || ''}>
                  {row.purchaser_name || <span className="text-gray-300">—</span>}
                </td>
                {COLUMNS.slice(2, -1).map(col => {
                  const value = row[col.key as keyof PipelineRow] as string | null;
                  const isEditing = editingCell?.rowId === row.id && editingCell?.field === col.key;
                  const traffic = col.traffic ? row.trafficLights[col.traffic as keyof typeof row.trafficLights] : null;
                  const isPending = pendingSaves.has(`${row.id}-${col.key}`);

                  return (
                    <td
                      key={col.key}
                      className={`px-0.5 py-0.5 cursor-pointer transition border-r border-gray-100 last:border-r-0 ${getTrafficBg(traffic)} border ${getTrafficBorder(traffic)} ${!traffic ? 'hover:bg-gray-100' : ''}`}
                      onClick={() => !isEditing && handleCellClick(row.id, col.key, value)}
                    >
                      {isEditing ? (
                        <input
                          type="date"
                          defaultValue={value ? value.split('T')[0] : new Date().toISOString().split('T')[0]}
                          autoFocus
                          onBlur={(e) => {
                            const newVal = e.target.value ? new Date(e.target.value).toISOString() : null;
                            handleDateUpdate(row.id, col.key, newVal);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const newVal = e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : null;
                              handleDateUpdate(row.id, col.key, newVal);
                            }
                            if (e.key === 'Escape') {
                              setEditingCell(null);
                            }
                          }}
                          className="w-full text-xs px-1 py-0.5 border rounded focus:outline-none focus:ring-1"
                          style={{ borderColor: tokens.gold }}
                        />
                      ) : (
                        <span className={`block text-center ${isPending ? 'opacity-50' : ''} ${value ? 'text-gray-700' : 'text-gray-300'}`}>
                          {value ? formatDateShort(value) : '—'}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="px-0.5 py-0.5 text-center">
                  <button 
                    className="p-0.5 hover:bg-gray-200 rounded" 
                    title="View queries"
                    onClick={() => handleOpenNotes(row)}
                  >
                    <FileTextIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredRows.length === 0 && (
          <div className="py-16 text-center text-gray-500">
            <p className="text-sm">No pipeline data found</p>
            <p className="text-xs text-gray-400 mt-1">Units will appear here once added to the sales pipeline</p>
          </div>
        )}
      </div>

      <footer className="h-8 border-t border-gray-200 flex items-center justify-between px-4 bg-gray-50 text-xs text-gray-500 flex-shrink-0">
        <span>Click empty cell = today's date · Click date to edit · Esc to cancel</span>
        <span>{pendingSaves.size > 0 ? 'Saving...' : 'All saved'}</span>
      </footer>

      {notesPanel && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/20" onClick={() => setNotesPanel(null)} />
          <div className="w-96 bg-white border-l border-gray-200 flex flex-col shadow-xl">
            <div className="h-12 border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Queries - {notesPanel.unitName}</h2>
                <p className="text-xs text-gray-500">{notes.filter(n => !n.is_resolved).length} open</p>
              </div>
              <button
                onClick={() => setNotesPanel(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notesLoading ? (
                <div className="text-center py-8">
                  <div
                    className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin mx-auto"
                    style={{ borderColor: tokens.gold, borderTopColor: 'transparent' }}
                  />
                </div>
              ) : notes.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No queries yet
                </div>
              ) : (
                notes.map(note => (
                  <div
                    key={note.id}
                    className={`p-3 rounded-lg border ${note.is_resolved ? 'bg-gray-50 border-gray-200' : 'bg-amber-50 border-amber-200'}`}
                  >
                    <p className={`text-sm ${note.is_resolved ? 'text-gray-500' : 'text-gray-800'}`}>{note.note}</p>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-gray-400">
                        {note.created_by_name || 'Unknown'} · {new Date(note.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                      {note.is_query && (
                        <button
                          onClick={() => handleResolveNote(note.id, !note.is_resolved)}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition ${
                            note.is_resolved
                              ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {note.is_resolved ? 'Reopen' : 'Resolve'}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-gray-200 p-3 flex-shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a query..."
                  className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1"
                  style={{ borderColor: newNote ? tokens.gold : undefined }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                />
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="px-3 py-2 text-sm font-medium rounded-lg transition disabled:opacity-50"
                  style={{ backgroundColor: tokens.gold, color: tokens.dark }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
