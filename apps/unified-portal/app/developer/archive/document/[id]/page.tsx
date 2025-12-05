'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, FileText, Star, AlertCircle, Sparkles, Building2, Calendar,
  Download, RefreshCw, Save, Loader2, ExternalLink, Eye, Tag, X
} from 'lucide-react';
import Link from 'next/link';
import { useCurrentContext } from '@/contexts/CurrentContext';
import { DISCIPLINES, type DisciplineType } from '@/lib/archive';

interface DocumentDetail {
  id: string;
  title: string;
  file_name: string;
  discipline: string | null;
  house_type_code: string | null;
  house_type_id: string | null;
  is_important: boolean;
  must_read: boolean;
  ai_classified: boolean;
  tags: string[];
  development_id: string;
  development_name: string;
  file_url: string | null;
  storage_url: string | null;
  mime_type: string | null;
  size_kb: number | null;
  created_at: string;
  updated_at: string;
  processing_status: string;
  chunks_count: number;
}

interface ChunkPreview {
  id: string;
  content: string;
  chunk_index: number;
}

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { tenantId } = useCurrentContext();
  const documentId = params.id as string;

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [chunks, setChunks] = useState<ChunkPreview[]>([]);
  const [houseTypes, setHouseTypes] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [editedDiscipline, setEditedDiscipline] = useState<string>('');
  const [editedHouseType, setEditedHouseType] = useState<string>('');
  const [editedImportant, setEditedImportant] = useState(false);
  const [editedMustRead, setEditedMustRead] = useState(false);
  const [editedTags, setEditedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    async function fetchDocument() {
      if (!tenantId || !documentId) return;
      
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/documents/${documentId}?tenantId=${tenantId}`);
        if (!res.ok) {
          throw new Error('Document not found');
        }
        const data = await res.json();
        setDocument(data.document);
        setChunks(data.chunks || []);
        
        setEditedDiscipline(data.document.discipline || 'other');
        setEditedHouseType(data.document.house_type_code || '');
        setEditedImportant(data.document.is_important || false);
        setEditedMustRead(data.document.must_read || false);
        setEditedTags(data.document.tags || []);

        if (data.document.development_id) {
          const htRes = await fetch(`/api/house-types?tenantId=${tenantId}&developmentId=${data.document.development_id}`);
          if (htRes.ok) {
            const htData = await htRes.json();
            setHouseTypes(htData.houseTypes || []);
          }
        }
      } catch (err) {
        console.error('Failed to fetch document:', err);
        setError(err instanceof Error ? err.message : 'Failed to load document');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDocument();
  }, [tenantId, documentId]);

  const handleSave = async () => {
    if (!tenantId || !documentId) return;
    
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          discipline: editedDiscipline,
          house_type_code: editedHouseType || null,
          is_important: editedImportant,
          must_read: editedMustRead,
          tags: editedTags
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save changes');
      }

      setSuccessMessage('Changes saved successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReprocess = async () => {
    if (!tenantId || !documentId) return;
    
    setIsReprocessing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/developer/api/archive/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, tenantId })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Reprocess failed');
      }

      if (data.classification) {
        setEditedDiscipline(data.classification.discipline);
        setEditedTags(data.classification.suggestedTags || []);
      }

      setSuccessMessage(`Re-classified as "${data.classification?.discipline}" with ${Math.round(data.classification?.confidence * 100)}% confidence`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      console.error('Reprocess error:', err);
      setError(err instanceof Error ? err.message : 'Reprocess failed');
    } finally {
      setIsReprocessing(false);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !editedTags.includes(newTag.trim())) {
      setEditedTags([...editedTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setEditedTags(editedTags.filter(t => t !== tag));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto mb-3" />
          <p className="text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">Document not found</h2>
          <Link href="/developer/archive" className="text-amber-600 hover:text-amber-700">
            Back to Archive
          </Link>
        </div>
      </div>
    );
  }

  const discipline = DISCIPLINES[document.discipline as DisciplineType] || DISCIPLINES.other;
  const formattedDate = new Date(document.created_at).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/developer/archive"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Archive</span>
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-700">{successMessage}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start gap-4 mb-6">
                <div 
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: `${discipline.color}15` }}
                >
                  <FileText className="h-6 w-6" style={{ color: discipline.color }} />
                </div>
                <div className="flex-1">
                  <h1 className="text-xl font-bold text-gray-900">{document.title}</h1>
                  <p className="text-gray-500 text-sm mt-1">{document.file_name}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      {document.development_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formattedDate}
                    </span>
                  </div>
                </div>
              </div>

              {document.file_url && (
                <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
                  {document.mime_type?.includes('pdf') ? (
                    <iframe
                      src={document.file_url}
                      className="w-full h-[500px]"
                      title="Document Preview"
                    />
                  ) : (
                    <div className="p-8 text-center bg-gray-50">
                      <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">Preview not available for this file type</p>
                      <a
                        href={document.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
                      >
                        <Download className="h-4 w-4" />
                        Download File
                      </a>
                    </div>
                  )}
                </div>
              )}

              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Extracted Text Preview
                </h3>
                {chunks.length > 0 ? (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {chunks.slice(0, 10).map((chunk) => (
                      <div 
                        key={chunk.id}
                        className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 border border-gray-100"
                      >
                        <span className="text-xs text-gray-400 mb-1 block">
                          Chunk {chunk.chunk_index + 1}
                        </span>
                        {chunk.content.slice(0, 500)}
                        {chunk.content.length > 500 && '...'}
                      </div>
                    ))}
                    {chunks.length > 10 && (
                      <p className="text-sm text-gray-500 text-center py-2">
                        +{chunks.length - 10} more chunks
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No extracted text available</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-medium text-gray-900 mb-4">Document Metadata</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discipline
                  </label>
                  <select
                    value={editedDiscipline}
                    onChange={(e) => setEditedDiscipline(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    {Object.entries(DISCIPLINES).map(([key, { label }]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    House Type
                  </label>
                  <select
                    value={editedHouseType}
                    onChange={(e) => setEditedHouseType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="">None</option>
                    {houseTypes.map(ht => (
                      <option key={ht.id} value={ht.code}>{ht.code} - {ht.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {editedTags.map(tag => (
                      <span 
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 text-sm rounded"
                      >
                        {tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-blue-800">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      placeholder="Add tag..."
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                    <button
                      onClick={addTag}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      <Tag className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editedImportant}
                      onChange={(e) => setEditedImportant(e.target.checked)}
                      className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="flex items-center gap-2 text-sm text-gray-700">
                      <Star className="h-4 w-4 text-amber-500" />
                      Mark as Important
                    </span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editedMustRead}
                      onChange={(e) => setEditedMustRead(e.target.checked)}
                      className="rounded border-gray-300 text-red-500 focus:ring-red-500"
                    />
                    <span className="flex items-center gap-2 text-sm text-gray-700">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      Mark as Must Read
                    </span>
                  </label>
                </div>

                <div className="pt-4 space-y-2">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Changes
                  </button>

                  <button
                    onClick={handleReprocess}
                    disabled={isReprocessing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    {isReprocessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Re-run AI Classification
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-medium text-gray-900 mb-4">Embedding Info</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Chunks</span>
                  <span className="font-medium">{document.chunks_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Processing Status</span>
                  <span className={`font-medium ${
                    document.processing_status === 'complete' ? 'text-green-600' :
                    document.processing_status === 'error' ? 'text-red-600' :
                    'text-amber-600'
                  }`}>
                    {document.processing_status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">File Size</span>
                  <span className="font-medium">{document.size_kb ? `${document.size_kb} KB` : 'Unknown'}</span>
                </div>
                {document.ai_classified && (
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    <span className="text-purple-600 text-sm">AI Classified</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
