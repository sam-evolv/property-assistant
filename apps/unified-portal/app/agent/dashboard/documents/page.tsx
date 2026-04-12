'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderArchive,
  FileText,
  Image as ImageIcon,
  File,
  Upload,
  AlertTriangle,
  Zap,
  Search,
  Eye,
  Download,
  Clock,
} from 'lucide-react';
import { useAgentDashboard } from '../layout-provider';

export const dynamic = 'force-dynamic';

interface Document {
  id: string;
  name: string;
  document_type: string;
  file_url: string;
  development_id: string;
  created_at: string;
  updated_at: string;
}

const TYPE_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  brochure: { icon: ImageIcon, color: '#1d4ed8', bg: '#eff6ff' },
  legal: { icon: FileText, color: '#5b21b6', bg: '#f5f3ff' },
  cert: { icon: File, color: '#15803d', bg: '#f0fdf4' },
  floorplan: { icon: ImageIcon, color: '#92400e', bg: '#fffbeb' },
  contract: { icon: FileText, color: '#b91c1c', bg: '#fef2f2' },
  default: { icon: File, color: '#6b7280', bg: '#f3f4f6' },
};

export default function AgentDashboardDocumentsPage() {
  const router = useRouter();
  const { developments, selectedSchemeId } = useAgentDashboard();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [schemeFilter, setSchemeFilter] = useState<string | null>(null);

  useEffect(() => {
    if (selectedSchemeId) setSchemeFilter(selectedSchemeId);
  }, [selectedSchemeId]);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/agent/pipeline-data');
        if (res.ok) {
          const data = await res.json();
          // Documents may come from a separate endpoint; for now show pipeline-derived docs
          setDocuments([]);
        }
      } catch { /* silent */ }
      setLoading(false);
    }
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    let list = documents;
    if (schemeFilter) list = list.filter(d => d.development_id === schemeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(d => d.name.toLowerCase().includes(q) || d.document_type?.toLowerCase().includes(q));
    }
    return list;
  }, [documents, schemeFilter, search]);

  const getTypeInfo = (type: string) => TYPE_ICONS[type] || TYPE_ICONS.default;
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Quick Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 32px', background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase' as const, marginRight: 8 }}>QUICK ACTIONS</span>
        <button style={{ height: 30, padding: '0 14px', background: '#c8960a', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Upload size={13} /> Upload Document
        </button>
      </div>

      <div style={{ padding: '28px 32px' }}>
        <h1 style={{ color: '#111', fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', margin: '0 0 20px' }}>Documents</h1>

        {/* Scheme filter pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <button onClick={() => setSchemeFilter(null)} style={{ padding: '5px 12px', borderRadius: 20, background: !schemeFilter ? 'rgba(200,150,10,0.1)' : '#fff', border: !schemeFilter ? '1px solid rgba(200,150,10,0.2)' : '1px solid rgba(0,0,0,0.12)', color: !schemeFilter ? '#c8960a' : 'rgba(0,0,0,0.5)', fontSize: 12, fontWeight: !schemeFilter ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>All Schemes</button>
          {developments.map(d => (
            <button key={d.id} onClick={() => setSchemeFilter(d.id)} style={{ padding: '5px 12px', borderRadius: 20, background: schemeFilter === d.id ? 'rgba(200,150,10,0.1)' : '#fff', border: schemeFilter === d.id ? '1px solid rgba(200,150,10,0.2)' : '1px solid rgba(0,0,0,0.12)', color: schemeFilter === d.id ? '#c8960a' : 'rgba(0,0,0,0.5)', fontSize: 12, fontWeight: schemeFilter === d.id ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>{d.name}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
          {/* Documents table */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: 0, letterSpacing: '-0.02em' }}>All Documents</h3>
              <div style={{ position: 'relative' }}>
                <Search size={14} color="rgba(0,0,0,0.3)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 180, height: 30, paddingLeft: 30, paddingRight: 10, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: '48px 18px', textAlign: 'center' }}>
                <FolderArchive size={32} color="rgba(0,0,0,0.12)" style={{ marginBottom: 8 }} />
                <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: 13, margin: '0 0 4px' }}>No documents uploaded yet</p>
                <p style={{ color: 'rgba(0,0,0,0.25)', fontSize: 12, margin: 0 }}>Upload brochures, contracts, and specifications</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 100px 80px 80px', padding: '10px 18px', background: '#f9f8f5', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                {['', 'Document', 'Type', 'Updated', 'Actions'].map(h => (
                  <span key={h || 'icon'} style={{ color: 'rgba(0,0,0,0.35)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const }}>{h}</span>
                ))}
              </div>
            )}
            {filtered.map((doc, i) => {
              const typeInfo = getTypeInfo(doc.document_type);
              const Icon = typeInfo.icon;
              return (
                <div key={doc.id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 100px 80px 80px', padding: '10px 18px', borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', alignItems: 'center' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 7, background: typeInfo.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={14} color={typeInfo.color} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{doc.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: typeInfo.bg, color: typeInfo.color, display: 'inline-block', width: 'fit-content' }}>{doc.document_type}</span>
                  <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.38)' }}>{formatDate(doc.updated_at || doc.created_at)}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button style={{ width: 28, height: 28, borderRadius: 6, background: 'none', border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Eye size={12} color="rgba(0,0,0,0.4)" /></button>
                    <button style={{ width: 28, height: 28, borderRadius: 6, background: 'none', border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Download size={12} color="rgba(0,0,0,0.4)" /></button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Upload zone */}
            <div style={{ background: '#fff', borderRadius: 12, border: '2px dashed rgba(0,0,0,0.12)', padding: '32px 18px', textAlign: 'center' }}>
              <Upload size={28} color="rgba(0,0,0,0.2)" style={{ marginBottom: 8 }} />
              <p style={{ fontSize: 13, fontWeight: 500, color: '#111', margin: '0 0 4px' }}>Upload documents</p>
              <p style={{ fontSize: 11, color: 'rgba(0,0,0,0.38)', margin: 0 }}>Drag & drop or click to browse</p>
              <p style={{ fontSize: 10, color: 'rgba(0,0,0,0.25)', margin: '8px 0 0' }}>PDF, DOCX, XLSX, images</p>
            </div>

            {/* Pending signatures */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={14} color="#b91c1c" />
                <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: 0, letterSpacing: '-0.02em' }}>Pending Signatures</h3>
              </div>
              <div style={{ padding: '16px 18px', textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', margin: 0 }}>No pending signatures</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
