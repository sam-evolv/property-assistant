'use client';

import { useState, useEffect } from 'react';
import { FileCheck, Calendar, User, Home, Clock, ChevronRight, Download, RefreshCw } from 'lucide-react';

interface Agreement {
  id: string;
  unit_id: string;
  purchaser_name: string | null;
  purchaser_email: string | null;
  agreed_at: string;
  ip_address: string | null;
  important_docs_acknowledged: { id: string; title: string }[];
  unit_code: string;
  house_type: string;
  unit_purchaser_name: string | null;
}

export default function AgreementsPage() {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAgreements();
  }, []);

  const fetchAgreements = async () => {
    try {
      setLoading(true);
      const res = await fetch('/developer/api/agreements');
      if (res.ok) {
        const data = await res.json();
        setAgreements(data.agreements || []);
      } else {
        setError('Failed to load agreements');
      }
    } catch (err) {
      setError('Failed to load agreements');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const exportCSV = () => {
    const headers = ['Unit Code', 'House Type', 'Purchaser Name', 'Agreed At', 'IP Address', 'Documents Acknowledged'];
    const rows = agreements.map(a => [
      a.unit_code,
      a.house_type,
      a.purchaser_name || a.unit_purchaser_name || 'Unknown',
      formatDate(a.agreed_at),
      a.ip_address || 'Unknown',
      a.important_docs_acknowledged?.map(d => d.title).join('; ') || '',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `purchaser-agreements-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-gray-500">Loading agreements...</div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-gold-100 to-gold-200 rounded-xl">
              <FileCheck className="w-7 h-7 text-gold-700" />
            </div>
            Purchaser Document Agreements
          </h1>
          <p className="text-gray-600 mt-2">
            Track which purchasers have acknowledged important documents
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchAgreements}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            disabled={agreements.length === 0}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-gold-500 to-gold-600 text-white font-medium hover:from-gold-600 hover:to-gold-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gold-50 to-white">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-900">
              {agreements.length} Agreement{agreements.length !== 1 ? 's' : ''} Recorded
            </span>
            <span className="text-sm text-gray-500">
              Sorted by most recent
            </span>
          </div>
        </div>

        {agreements.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <FileCheck className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Agreements Yet</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              When purchasers acknowledge important documents, their agreements will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {agreements.map((agreement) => (
              <div key={agreement.id} className="p-5 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
                      <FileCheck className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">
                          {agreement.unit_code}
                        </span>
                        <span className="text-sm text-gray-500">
                          ({agreement.house_type})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                        <User className="w-4 h-4" />
                        <span>{agreement.purchaser_name || agreement.unit_purchaser_name || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:items-end gap-1">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(agreement.agreed_at)}</span>
                    </div>
                    {agreement.ip_address && (
                      <span className="text-xs text-gray-400">
                        IP: {agreement.ip_address}
                      </span>
                    )}
                  </div>
                </div>

                {agreement.important_docs_acknowledged && agreement.important_docs_acknowledged.length > 0 && (
                  <div className="mt-4 pl-11">
                    <p className="text-xs font-medium text-gray-500 mb-2">Documents Acknowledged:</p>
                    <div className="flex flex-wrap gap-2">
                      {agreement.important_docs_acknowledged.map((doc, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-gold-50 text-gold-700 text-xs rounded-md border border-gold-200"
                        >
                          {doc.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
