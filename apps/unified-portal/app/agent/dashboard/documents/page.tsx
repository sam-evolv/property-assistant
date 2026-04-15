'use client';

import { useEffect, useState } from 'react';
import { FolderArchive, Upload, Search, Eye, Download, FileText, Image as ImageIcon, File, Clock } from 'lucide-react';
import { useAgentDashboard } from '../layout-provider';

export const dynamic = 'force-dynamic';
const tokens = { gold: '#D4AF37', goldDark: '#B8934C', cream: '#fafaf8', dark: '#1a1a1a' };

export default function AgentDashboardDocumentsPage() {
  const { developments, selectedSchemeId } = useAgentDashboard();
  const [loading, setLoading] = useState(true);
  const [schemeFilter, setSchemeFilter] = useState<string | null>(selectedSchemeId);
  const [search, setSearch] = useState('');

  useEffect(() => { if (selectedSchemeId) setSchemeFilter(selectedSchemeId); }, [selectedSchemeId]);
  useEffect(() => { setTimeout(() => setLoading(false), 500); }, []);

  return (
    <div className="min-h-full" style={{ backgroundColor: tokens.cream }}>
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Documents</h1>
        <p className="text-sm text-gray-500 mb-6">Manage brochures, contracts, and specifications</p>

        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <button onClick={() => setSchemeFilter(null)} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${!schemeFilter ? 'bg-gold-500 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>All Schemes</button>
          {developments.map(d => (
            <button key={d.id} onClick={() => setSchemeFilter(d.id)} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${schemeFilter === d.id ? 'bg-gold-500 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>{d.name}</button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">All Documents</h3>
              <div className="relative"><Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="h-9 pl-9 pr-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500 bg-white" /></div>
            </div>
            <div className="p-16 text-center">
              <FolderArchive className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-900">No documents uploaded yet</p>
              <p className="text-xs text-gray-500 mt-1">Upload brochures, contracts, and specifications for your schemes</p>
              <button className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white mx-auto transition-all hover:shadow-md" style={{ backgroundColor: tokens.gold }}><Upload className="w-4 h-4" /> Upload Document</button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center hover:border-gold-300 transition-colors cursor-pointer">
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">Upload documents</p>
              <p className="text-xs text-gray-500 mt-1">Drag & drop or click to browse</p>
              <p className="text-[10px] text-gray-400 mt-2">PDF, DOCX, XLSX, images</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2"><Clock className="w-4 h-4 text-red-500" /><h3 className="text-sm font-semibold text-gray-900">Pending Signatures</h3></div>
              <div className="p-5 text-center text-xs text-gray-500">No pending signatures</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
