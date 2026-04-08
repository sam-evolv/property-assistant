'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  FileText, Download, Upload, Search, Eye, Plus, X, FolderOpen,
} from 'lucide-react';
import { colors, EASE } from '@/components/select/builder/tokens';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProjectDocument {
  id: string;
  project_id: string;
  uploaded_by: string;
  name: string;
  category: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  visibility: 'builder' | 'homeowner' | 'both';
  notes: string | null;
  created_at: string;
}

interface DocumentsTabProps {
  projectId: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DOC_CATEGORIES = [
  { id: 'all', label: 'All Documents' },
  { id: 'planning', label: 'Planning' },
  { id: 'structural', label: 'Structural / BCAR' },
  { id: 'homebond', label: 'HomeBond' },
  { id: 'ber', label: 'BER Certificate' },
  { id: 'warranty', label: 'Warranties' },
  { id: 'contract', label: 'Contracts' },
  { id: 'drawing', label: 'Drawings & Specs' },
  { id: 'specification', label: 'Specifications' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'general', label: 'General' },
];

const UPLOAD_CATEGORIES = DOC_CATEGORIES.filter((c) => c.id !== 'all');

const ACCEPTED_TYPES = '.pdf,.png,.jpg,.doc,.docx,.dwg';

const VISIBILITY_OPTIONS = [
  { value: 'builder', label: 'Builder only' },
  { value: 'homeowner', label: 'Homeowner' },
  { value: 'both', label: 'Both' },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getCategoryLabel(categoryId: string): string {
  const cat = DOC_CATEGORIES.find((c) => c.id === categoryId);
  return cat ? cat.label : categoryId;
}

function visibilityLabel(v: string): string {
  if (v === 'builder') return 'Builder only';
  if (v === 'homeowner') return 'Homeowner';
  if (v === 'both') return 'Both';
  return v;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DocumentsTab({ projectId }: DocumentsTabProps) {
  const supabase = createClientComponentClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState('general');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadVisibility, setUploadVisibility] = useState<'builder' | 'homeowner' | 'both'>('builder');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // ─── Data fetching ─────────────────────────────────────────────────────────

  const fetchDocuments = useCallback(async () => {
    const { data, error } = await supabase
      .from('select_project_documents')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDocuments(data);
    }
    setLoading(false);
  }, [supabase, projectId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // ─── Filtering ─────────────────────────────────────────────────────────────

  const filteredDocuments = useMemo(() => {
    let docs = documents;

    // Category filter
    if (activeCategory !== 'all') {
      docs = docs.filter((d) => d.category === activeCategory);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      docs = docs.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q) ||
          getCategoryLabel(d.category).toLowerCase().includes(q) ||
          (d.notes && d.notes.toLowerCase().includes(q))
      );
    }

    return docs;
  }, [documents, activeCategory, searchQuery]);

  // ─── Share with homeowner ──────────────────────────────────────────────────

  async function handleShareWithHomeowner(docId: string) {
    const { error } = await supabase
      .from('select_project_documents')
      .update({ visibility: 'both' })
      .eq('id', docId);

    if (!error) {
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, visibility: 'both' } : d))
      );
    }
  }

  // ─── Download ──────────────────────────────────────────────────────────────

  function handleDownload(doc: ProjectDocument) {
    window.open(doc.file_url, '_blank');
  }

  // ─── Upload ────────────────────────────────────────────────────────────────

  function resetUploadForm() {
    setUploadFile(null);
    setUploadCategory('general');
    setUploadNotes('');
    setUploadVisibility('builder');
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function openUploadModal() {
    resetUploadForm();
    setShowUploadModal(true);
  }

  function closeUploadModal() {
    setShowUploadModal(false);
    resetUploadForm();
  }

  async function handleUploadSubmit() {
    if (!uploadFile) {
      setUploadError('Please select a file.');
      return;
    }

    setUploading(true);
    setUploadError('');

    try {
      const filePath = `${projectId}/${uploadFile.name}`;

      const { error: storageError } = await supabase.storage
        .from('project-documents')
        .upload(filePath, uploadFile, { upsert: true });

      if (storageError) {
        setUploadError(storageError.message);
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('project-documents')
        .getPublicUrl(filePath);

      const fileUrl = urlData.publicUrl;

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (!userId) {
        setUploadError('You must be logged in to upload documents.');
        setUploading(false);
        return;
      }

      const { error: insertError } = await supabase
        .from('select_project_documents')
        .insert({
          project_id: projectId,
          uploaded_by: userId,
          name: uploadFile.name,
          category: uploadCategory,
          file_url: fileUrl,
          file_size: uploadFile.size,
          file_type: uploadFile.type || null,
          visibility: uploadVisibility,
          notes: uploadNotes.trim() || null,
        });

      if (insertError) {
        setUploadError(insertError.message);
        setUploading(false);
        return;
      }

      setUploading(false);
      closeUploadModal();
      fetchDocuments();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed.';
      setUploadError(message);
      setUploading(false);
    }
  }

  // ─── Shared styles ────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    fontSize: 13,
    color: colors.textPrimary,
    background: colors.surface2,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    outline: 'none',
    fontFamily: 'inherit',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: colors.textSecondary,
    marginBottom: 6,
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ color: colors.textSecondary, fontSize: 14, padding: 40 }}>
        Loading documents...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900 }}>
      {/* ─── Header row ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: colors.gold,
        }}>
          Smart Archive
        </div>
        <button
          onClick={openUploadModal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            color: colors.bg,
            background: colors.gold,
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            transition: `opacity 200ms ${EASE}`,
            fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          <Plus size={14} />
          Upload Document
        </button>
      </div>

      {/* ─── Main layout: sidebar + content ─── */}
      <div style={{ display: 'flex', gap: 20 }}>
        {/* Desktop sidebar */}
        <nav style={{
          width: 200,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          {DOC_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            const count = cat.id === 'all'
              ? documents.length
              : documents.filter((d) => d.category === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? colors.gold : colors.textSecondary,
                  background: isActive ? colors.goldGlow : 'transparent',
                  border: 'none',
                  borderLeft: isActive
                    ? `3px solid ${colors.gold}`
                    : '3px solid transparent',
                  borderRadius: '0 8px 8px 0',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: `all 200ms ${EASE}`,
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = colors.textPrimary;
                    e.currentTarget.style.background = colors.surface2;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = colors.textSecondary;
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span>{cat.label}</span>
                {count > 0 && (
                  <span style={{
                    fontSize: 11,
                    color: isActive ? colors.gold : colors.textMuted,
                    minWidth: 20,
                    textAlign: 'right',
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right content area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Search input */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: colors.textMuted,
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                ...inputStyle,
                paddingLeft: 36,
              }}
            />
          </div>

          {/* Document list */}
          {filteredDocuments.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 20px',
              color: colors.textMuted,
              fontSize: 13,
              gap: 12,
            }}>
              <FolderOpen size={32} style={{ color: colors.border }} />
              <span>
                {searchQuery.trim()
                  ? 'No documents match your search.'
                  : activeCategory !== 'all'
                    ? `No ${getCategoryLabel(activeCategory).toLowerCase()} documents yet.`
                    : 'No documents uploaded yet.'}
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: 14,
                    background: colors.surface1,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 10,
                    transition: `border-color 200ms ${EASE}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = colors.borderHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = colors.border;
                  }}
                >
                  {/* File icon */}
                  <div style={{
                    flexShrink: 0,
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: colors.surface3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 2,
                  }}>
                    <FileText size={16} style={{ color: colors.gold }} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: colors.textPrimary,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {doc.name}
                    </div>

                    {doc.notes && (
                      <div style={{
                        fontSize: 12,
                        color: colors.textSecondary,
                        marginTop: 2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {doc.notes}
                      </div>
                    )}

                    <div style={{
                      fontSize: 11,
                      color: colors.textMuted,
                      marginTop: 4,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                      alignItems: 'center',
                    }}>
                      <span style={{
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: colors.surface3,
                        fontSize: 11,
                        color: colors.textSecondary,
                      }}>
                        {getCategoryLabel(doc.category)}
                      </span>
                      <span>Uploaded {formatDate(doc.created_at)}</span>
                      {doc.file_size && (
                        <>
                          <span style={{ color: colors.border }}>·</span>
                          <span>{formatFileSize(doc.file_size)}</span>
                        </>
                      )}
                    </div>

                    <div style={{
                      fontSize: 12,
                      color: colors.textMuted,
                      marginTop: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Eye size={11} />
                        Visible to: {visibilityLabel(doc.visibility)}
                      </span>
                      {doc.visibility === 'builder' && (
                        <button
                          onClick={() => handleShareWithHomeowner(doc.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            fontSize: 12,
                            color: colors.gold,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            textUnderlineOffset: 2,
                            fontFamily: 'inherit',
                            transition: `opacity 200ms ${EASE}`,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                        >
                          Share with homeowner
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Download button */}
                  <button
                    onClick={() => handleDownload(doc)}
                    title="Download"
                    style={{
                      flexShrink: 0,
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: 'transparent',
                      border: `1px solid ${colors.border}`,
                      color: colors.gold,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: `all 200ms ${EASE}`,
                      marginTop: 2,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = colors.surface3;
                      e.currentTarget.style.borderColor = colors.borderHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = colors.border;
                    }}
                  >
                    <Download size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Upload Modal ─── */}
      {showUploadModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeUploadModal();
          }}
        >
          <div style={{
            width: '100%',
            maxWidth: 480,
            background: colors.surface1,
            border: `1px solid ${colors.border}`,
            borderRadius: 14,
            padding: 28,
            position: 'relative',
          }}>
            {/* Close button */}
            <button
              onClick={closeUploadModal}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'none',
                border: 'none',
                color: colors.textMuted,
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = colors.textPrimary; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = colors.textMuted; }}
            >
              <X size={18} />
            </button>

            {/* Title */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 24,
            }}>
              <Upload size={18} style={{ color: colors.gold }} />
              <span style={{
                fontSize: 16,
                fontWeight: 700,
                color: colors.textPrimary,
              }}>
                Upload Document
              </span>
            </div>

            {/* File input */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>File</label>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setUploadFile(file);
                }}
                style={{
                  ...inputStyle,
                  padding: '8px 12px',
                  cursor: 'pointer',
                }}
              />
              <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
                Accepted: PDF, PNG, JPG, DOC, DOCX, DWG
              </div>
            </div>

            {/* Category */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Category</label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                style={{
                  ...inputStyle,
                  cursor: 'pointer',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23778199' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  paddingRight: 36,
                }}
              >
                {UPLOAD_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Notes (optional)</label>
              <textarea
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                placeholder="e.g. BER A2, 61 kWh/m2/yr"
                rows={3}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Visibility */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Visibility</label>
              <select
                value={uploadVisibility}
                onChange={(e) => setUploadVisibility(e.target.value as 'builder' | 'homeowner' | 'both')}
                style={{
                  ...inputStyle,
                  cursor: 'pointer',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23778199' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  paddingRight: 36,
                }}
              >
                {VISIBILITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Error */}
            {uploadError && (
              <div style={{
                fontSize: 13,
                color: colors.red,
                marginBottom: 16,
                padding: '8px 12px',
                background: 'rgba(239, 68, 68, 0.08)',
                borderRadius: 8,
              }}>
                {uploadError}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleUploadSubmit}
              disabled={uploading || !uploadFile}
              style={{
                width: '100%',
                padding: '12px 20px',
                fontSize: 14,
                fontWeight: 700,
                color: colors.bg,
                background: uploading || !uploadFile ? colors.textMuted : colors.gold,
                border: 'none',
                borderRadius: 8,
                cursor: uploading || !uploadFile ? 'not-allowed' : 'pointer',
                transition: `opacity 200ms ${EASE}`,
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
              onMouseEnter={(e) => {
                if (!uploading && uploadFile) e.currentTarget.style.opacity = '0.85';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              {uploading ? (
                'Uploading...'
              ) : (
                <>
                  <Upload size={15} />
                  Upload Document
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
