'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAgent } from '@/lib/agent/AgentContext';
import AgentShell from '../_components/AgentShell';
import { ChevronDown, Plus, X, Upload, Check } from 'lucide-react';

/* Demo doc data */
interface Doc {
  id: string;
  name: string;
  type: 'ber' | 'brochure' | 'form' | 'price_list';
  schemeName: string;
  schemeId: string;
  updatedAt: string;
  size: string;
}

// Documents will be loaded from the database once document management is implemented.
// For now, start with an empty array (no fake data).
const INITIAL_DOCS: Doc[] = [];

const DOC_ICON_CONFIG: Record<string, { bg: string; border: string; color: string }> = {
  ber: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', color: '#10B981' },
  brochure: { bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.2)', color: '#7C3AED' },
  form: { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', color: '#3B82F6' },
  price_list: { bg: 'rgba(212,175,55,0.08)', border: 'rgba(212,175,55,0.2)', color: '#C49B2A' },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  ber: 'BER Certificate',
  brochure: 'Brochure / Floorplan',
  form: 'Form / Agreement',
  price_list: 'Price List',
};

export default function DocsPage() {
  const { agent, alerts, developments } = useAgent();
  const searchParams = useSearchParams();
  // Session 6C: landings from the scheme summary page or unit detail pass
  // ?scheme=<developmentId> so the Docs shelf opens pre-filtered. Falls
  // back to 'all' when the param is absent (home tile, sidebar).
  const [activeScheme, setActiveScheme] = useState<string>(
    searchParams?.get('scheme') || 'all',
  );
  const [docs, setDocs] = useState<Doc[]>(INITIAL_DOCS);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Keep the filter in sync if the query param changes while the component
  // stays mounted (back/forward navigation between different scheme links).
  useEffect(() => {
    const paramScheme = searchParams?.get('scheme');
    if (paramScheme && paramScheme !== activeScheme) {
      setActiveScheme(paramScheme);
    }
  }, [searchParams, activeScheme]);

  // Upload form state
  const [uploadName, setUploadName] = useState('');
  const [uploadType, setUploadType] = useState<string>('form');
  const [uploadScheme, setUploadScheme] = useState('');

  // Build unique scheme list from docs
  const schemeList = Array.from(new Set(docs.map(d => d.schemeId))).map(id => ({
    id,
    name: docs.find(d => d.schemeId === id)?.schemeName || id,
  }));

  const filteredDocs =
    activeScheme === 'all'
      ? docs
      : docs.filter((d) => d.schemeId === activeScheme);

  const handleUpload = () => {
    if (!uploadName.trim()) return;
    const scheme = schemeList.find(s => s.id === uploadScheme) || schemeList[0];
    const newDoc: Doc = {
      id: `new-${Date.now()}`,
      name: uploadName.trim(),
      type: uploadType as Doc['type'],
      schemeName: scheme?.name || 'Unknown',
      schemeId: scheme?.id || 'unknown',
      updatedAt: new Date().toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }),
      size: 'Uploading...',
    };
    setDocs(prev => [newDoc, ...prev]);
    setShowUpload(false);
    setUploadName('');
    setUploadType('form');
    setUploadScheme('');
    setUploadSuccess(true);
    setTimeout(() => setUploadSuccess(false), 3000);
  };

  return (
    <AgentShell agentName={agent?.displayName?.split(' ')[0] || 'Sam'} urgentCount={alerts.length}>
      <div style={{ padding: '8px 24px 100px' }}>
        {/* Header row with title + add button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '-0.05em',
              color: '#0D0D12',
              margin: 0,
            }}
          >
            Documents
          </h1>
          <button
            onClick={() => setShowUpload(true)}
            className="agent-tappable"
            style={{
              width: 36, height: 36, borderRadius: 12,
              background: '#0D0D12', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            <Plus size={18} color="#fff" />
          </button>
        </div>

        {/* Scheme dropdown filter */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <select
            value={activeScheme}
            onChange={(e) => setActiveScheme(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 40px 12px 14px',
              borderRadius: 14,
              border: '1px solid rgba(0,0,0,0.08)',
              background: '#fff',
              fontSize: 14,
              fontWeight: 500,
              color: '#0D0D12',
              fontFamily: 'inherit',
              appearance: 'none',
              outline: 'none',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <option value="all">All Schemes</option>
            {schemeList.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <ChevronDown size={16} color="#A0A8B0" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>

        {/* Document rows */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 18,
            overflow: 'hidden',
            boxShadow:
              '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
          }}
        >
          {filteredDocs.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#A0A8B0', fontSize: 13, padding: '32px 0' }}>
              No documents for this scheme
            </div>
          ) : (
            filteredDocs.map((doc, i) => {
              const iconCfg = DOC_ICON_CONFIG[doc.type] || DOC_ICON_CONFIG.form;
              return (
                <div
                  key={doc.id}
                  className="agent-tappable"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 18px',
                    borderBottom:
                      i < filteredDocs.length - 1
                        ? '1px solid rgba(0,0,0,0.04)'
                        : 'none',
                  }}
                >
                  {/* Icon box */}
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      background: iconCfg.bg,
                      border: `1px solid ${iconCfg.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <DocIcon type={doc.type} color={iconCfg.color} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 500,
                        color: '#0D0D12',
                        letterSpacing: '-0.01em',
                        marginBottom: 2,
                      }}
                    >
                      {doc.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: '#A0A8B0',
                      }}
                    >
                      {doc.schemeName} &middot; {doc.updatedAt} &middot; {doc.size}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <ActionButton icon="share" />
                    <ActionButton icon="download" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── Upload Document Sheet ─── */}
      {showUpload && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 200,
            display: 'flex', alignItems: 'flex-end',
          }}
          onClick={() => setShowUpload(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', background: '#fff',
              borderRadius: '24px 24px 0 0',
              paddingBottom: 0,
              boxShadow: '0 -4px 32px rgba(0,0,0,0.12)',
              animation: 'slideUp 300ms cubic-bezier(.2,.8,.2,1)',
              maxHeight: '90dvh',
              overflowY: 'auto',
            }}
          >
            {/* Handle */}
            <div style={{ width: 40, height: 4, background: '#E0E0DC', borderRadius: 2, margin: '14px auto 16px' }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px 16px' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0D0D12', margin: 0, letterSpacing: '-0.03em' }}>
                Add Document
              </h2>
              <button
                onClick={() => setShowUpload(false)}
                style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: '#F5F5F3', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={16} color="#6B7280" />
              </button>
            </div>

            {/* Upload area */}
            <div style={{ padding: '0 24px' }}>
              <div
                style={{
                  border: '2px dashed rgba(0,0,0,0.08)',
                  borderRadius: 16, padding: '24px 16px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 8, marginBottom: 18, cursor: 'pointer',
                  background: '#FAFAF8',
                }}
              >
                <Upload size={24} color="#C49B2A" />
                <span style={{ fontSize: 13, fontWeight: 500, color: '#6B7280' }}>Tap to select file from phone</span>
                <span style={{ fontSize: 11, color: '#A0A8B0' }}>PDF, JPG, PNG up to 25MB</span>
              </div>

              <FormField label="Document name" required>
                <input
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="e.g. BER Certificate Pack"
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Document type">
                <div style={{ position: 'relative' }}>
                  <select
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value)}
                    style={{ ...inputStyle, appearance: 'none', paddingRight: 36 }}
                  >
                    {Object.entries(DOC_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} color="#A0A8B0" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              </FormField>

              <FormField label="Scheme">
                <div style={{ position: 'relative' }}>
                  <select
                    value={uploadScheme}
                    onChange={(e) => setUploadScheme(e.target.value)}
                    style={{ ...inputStyle, appearance: 'none', paddingRight: 36 }}
                  >
                    <option value="">Select scheme...</option>
                    {schemeList.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} color="#A0A8B0" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              </FormField>

              <button
                onClick={handleUpload}
                disabled={!uploadName.trim()}
                style={{
                  width: '100%', padding: '14px', borderRadius: 14,
                  background: !uploadName.trim() ? '#E0E0E0' : '#0D0D12',
                  color: '#fff', fontSize: 14, fontWeight: 600,
                  border: 'none', cursor: !uploadName.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginTop: 8,
                  marginBottom: 120,
                }}
              >
                <Upload size={15} />
                Add Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {uploadSuccess && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#059669', color: '#fff', fontSize: 13, fontWeight: 600,
          padding: '10px 18px', borderRadius: 14, zIndex: 210,
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}>
          <Check size={15} />
          Document added
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </AgentShell>
  );
}

/* ─── Helpers ─── */

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid rgba(0,0,0,0.08)',
  fontSize: 14,
  color: '#0D0D12',
  background: '#FAFAF8',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

function FormField({ label, required, children }: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        fontSize: 12, fontWeight: 600, color: '#6B7280',
        letterSpacing: '0.01em', display: 'block', marginBottom: 6,
      }}>
        {label}{required && <span style={{ color: '#DC2626' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function DocIcon({ type, color }: { type: string; color: string }) {
  if (type === 'ber') {
    return (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14,2 14,8 20,8" />
        <path d="M9 15l2 2 4-4" />
      </svg>
    );
  }
  if (type === 'brochure') {
    return (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21,15 16,10 5,21" />
      </svg>
    );
  }
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function ActionButton({ icon }: { icon: 'share' | 'download' }) {
  return (
    <div
      className="agent-tappable"
      style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        background: '#F5F5F3',
        border: '0.5px solid rgba(0,0,0,0.07)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      {icon === 'share' ? (
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
          <polyline points="16,6 12,2 8,6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      ) : (
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7,10 12,15 17,10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}
    </div>
  );
}
