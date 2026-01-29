'use client';

import { useState, useEffect } from 'react';
import { Copy, Plus, X, Check } from 'lucide-react';

interface DeveloperCode {
  id: string;
  code: string;
  tenant_id: string | null;
  tenant_name: string;
  created_by: string | null;
  used_by_email: string | null;
  used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

type CodeStatus = 'available' | 'used' | 'expired' | 'inactive';

function getCodeStatus(code: DeveloperCode): CodeStatus {
  if (!code.is_active) return 'inactive';
  if (code.used_at) return 'used';
  if (code.expires_at && new Date(code.expires_at) < new Date()) return 'expired';
  return 'available';
}

function StatusBadge({ status }: { status: CodeStatus }) {
  const styles = {
    available: 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30',
    used: 'bg-green-500/20 text-green-400 border-green-500/30',
    expired: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    inactive: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  
  const labels = {
    available: 'Available',
    used: 'Used',
    expired: 'Expired',
    inactive: 'Inactive',
  };
  
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function DeveloperCodesPage() {
  const [codes, setCodes] = useState<DeveloperCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    tenantName: '',
    expiresInDays: 30,
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchCodes = async () => {
    try {
      const res = await fetch('/api/super/developer-codes');
      const data = await res.json();
      setCodes(data.codes || []);
    } catch (error) {
      console.error('Failed to fetch codes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  const handleCopy = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tenantName.trim()) return;
    
    setSubmitting(true);
    try {
      const res = await fetch('/api/super/developer-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantName: formData.tenantName,
          expiresInDays: formData.expiresInDays,
          notes: formData.notes,
        }),
      });
      
      if (res.ok) {
        setShowModal(false);
        setFormData({ tenantName: '', expiresInDays: 30, notes: '' });
        fetchCodes();
      }
    } catch (error) {
      console.error('Failed to create code:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Developer Invitation Codes</h1>
          <p className="text-gray-400 mt-1">Generate and manage developer signup codes</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#D4AF37] hover:bg-[#C4A030] text-black font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Generate Code
        </button>
      </div>

      <div className="bg-[#1A1A1A] rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Code</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Developer</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Status</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Created</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Expires</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Used By</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-500">Loading...</td>
              </tr>
            ) : codes.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-500">No codes generated yet</td>
              </tr>
            ) : (
              codes.map((code) => (
                <tr key={code.id} className="border-b border-gray-800/50 hover:bg-white/5">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <code className="text-[#D4AF37] font-mono text-sm">{code.code}</code>
                      <button
                        onClick={() => handleCopy(code.code, code.id)}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                        title="Copy to clipboard"
                      >
                        {copiedId === code.id ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-white">{code.tenant_name}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={getCodeStatus(code)} />
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">{formatDate(code.created_at)}</td>
                  <td className="px-6 py-4 text-gray-400 text-sm">{formatDate(code.expires_at)}</td>
                  <td className="px-6 py-4 text-gray-400 text-sm">{code.used_by_email || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#1A1A1A] rounded-xl border border-gray-800 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Generate Invitation Code</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Developer Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.tenantName}
                  onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
                  placeholder="e.g., Cairn Homes"
                  className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Expires In (Days)
                </label>
                <input
                  type="number"
                  value={formData.expiresInDays}
                  onChange={(e) => setFormData({ ...formData, expiresInDays: parseInt(e.target.value) || 0 })}
                  min={0}
                  className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
                />
                <p className="text-xs text-gray-500 mt-1">Set to 0 for no expiry</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional notes about this code..."
                  rows={3}
                  className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] resize-none"
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-700 text-gray-300 rounded-lg hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !formData.tenantName.trim()}
                  className="flex-1 px-4 py-2 bg-[#D4AF37] hover:bg-[#C4A030] text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Generating...' : 'Generate Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
