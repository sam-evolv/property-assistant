'use client';

import { useState } from 'react';
import { Upload, FileText, Check, X, Edit2, Loader2, AlertTriangle, Globe, Building2 } from 'lucide-react';

interface KnowledgeChunk {
  title: string;
  content: string;
  category: string;
  source_url?: string;
  selected: boolean;
}

interface BulkKnowledgeImportProps {
  developmentId: string;
  developmentName: string;
  onImportComplete: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  warranty: 'Warranty',
  maintenance: 'Maintenance',
  local_area: 'Local Area',
  property_info: 'Property Info',
  energy: 'Energy',
  safety: 'Safety',
  documents: 'Documents',
  general: 'General',
};

const CATEGORY_COLORS: Record<string, string> = {
  warranty: 'bg-purple-100 text-purple-800 border-purple-300',
  maintenance: 'bg-orange-100 text-orange-800 border-orange-300',
  local_area: 'bg-green-100 text-green-800 border-green-300',
  property_info: 'bg-blue-100 text-blue-800 border-blue-300',
  energy: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  safety: 'bg-red-100 text-red-800 border-red-300',
  documents: 'bg-gray-100 text-gray-800 border-gray-300',
  general: 'bg-slate-100 text-slate-800 border-slate-300',
};

export default function BulkKnowledgeImport({ 
  developmentId, 
  developmentName,
  onImportComplete 
}: BulkKnowledgeImportProps) {
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [processing, setProcessing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isPlatformWide, setIsPlatformWide] = useState(false);
  const [step, setStep] = useState<'input' | 'review' | 'complete'>('input');

  const processContent = async () => {
    if (content.trim().length < 50) {
      setError('Content must be at least 50 characters');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const res = await fetch('/api/super/assistant/process-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, source_url: sourceUrl || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to process content');
      }

      const data = await res.json();
      setChunks(data.chunks || []);
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process content');
    } finally {
      setProcessing(false);
    }
  };

  const toggleChunk = (index: number) => {
    setChunks(prev => prev.map((chunk, i) => 
      i === index ? { ...chunk, selected: !chunk.selected } : chunk
    ));
  };

  const updateChunk = (index: number, updates: Partial<KnowledgeChunk>) => {
    setChunks(prev => prev.map((chunk, i) => 
      i === index ? { ...chunk, ...updates } : chunk
    ));
    setEditingIndex(null);
  };

  const selectAll = () => {
    setChunks(prev => prev.map(chunk => ({ ...chunk, selected: true })));
  };

  const deselectAll = () => {
    setChunks(prev => prev.map(chunk => ({ ...chunk, selected: false })));
  };

  const importSelected = async () => {
    const selectedChunks = chunks.filter(c => c.selected);
    if (selectedChunks.length === 0) {
      setError('Select at least one chunk to import');
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const res = await fetch('/api/super/assistant/knowledge', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selectedChunks,
          development_id: developmentId,
          is_platform_wide: isPlatformWide,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to import');
      }

      const data = await res.json();
      setStep('complete');
      setTimeout(() => {
        onImportComplete();
        // Reset state
        setContent('');
        setSourceUrl('');
        setChunks([]);
        setStep('input');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import');
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = chunks.filter(c => c.selected).length;

  return (
    <div className="space-y-6">
      {step === 'input' && (
        <>
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-black text-sm">Bulk Knowledge Import</p>
                <p className="text-xs text-black mt-1">
                  Paste research, documentation, or guides. AI will automatically break it into discrete 
                  knowledge chunks that you can review and edit before importing.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-black mb-2">
                Content to Process
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-64 p-4 border-2 border-gray-300 rounded-xl text-black focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none resize-none"
                placeholder="Paste your content here... (warranty documents, maintenance guides, local area information, etc.)"
              />
              <p className="text-xs text-gray-500 mt-1">
                {content.length} characters {content.length < 50 && '(minimum 50)'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-black mb-2">
                Source URL (optional)
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 rounded-xl text-black focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
                placeholder="https://example.com/source-document"
              />
            </div>

            <div className="flex items-center gap-4 p-4 bg-gray-50 border-2 border-gray-200 rounded-xl">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="scope-dev"
                  name="scope"
                  checked={!isPlatformWide}
                  onChange={() => setIsPlatformWide(false)}
                  className="w-4 h-4 accent-amber-500"
                />
                <label htmlFor="scope-dev" className="flex items-center gap-2 text-sm font-bold text-black cursor-pointer">
                  <Building2 className="w-4 h-4" />
                  {developmentName} only
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="scope-platform"
                  name="scope"
                  checked={isPlatformWide}
                  onChange={() => setIsPlatformWide(true)}
                  className="w-4 h-4 accent-amber-500"
                />
                <label htmlFor="scope-platform" className="flex items-center gap-2 text-sm font-bold text-black cursor-pointer">
                  <Globe className="w-4 h-4" />
                  All developments (platform-wide)
                </label>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border-2 border-red-200 rounded-xl text-red-800 text-sm">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </div>
            )}

            <button
              onClick={processContent}
              disabled={processing || content.trim().length < 50}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing with AI...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Process Content
                </>
              )}
            </button>
          </div>
        </>
      )}

      {step === 'review' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-black text-lg">Review Knowledge Chunks</h3>
              <p className="text-sm text-gray-600">
                {selectedCount} of {chunks.length} chunks selected for import
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="px-3 py-1.5 text-sm border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-bold text-black"
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                className="px-3 py-1.5 text-sm border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-bold text-black"
              >
                Deselect All
              </button>
              <button
                onClick={() => { setStep('input'); setChunks([]); }}
                className="px-3 py-1.5 text-sm border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-bold text-black"
              >
                Start Over
              </button>
            </div>
          </div>

          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {chunks.map((chunk, index) => (
              <div
                key={index}
                className={`p-4 border-2 rounded-xl transition-colors ${
                  chunk.selected 
                    ? 'border-amber-400 bg-amber-50' 
                    : 'border-gray-200 bg-white opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleChunk(index)}
                    className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      chunk.selected 
                        ? 'bg-amber-500 border-amber-500 text-white' 
                        : 'border-gray-300'
                    }`}
                  >
                    {chunk.selected && <Check className="w-3 h-3" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    {editingIndex === index ? (
                      <EditChunkForm
                        chunk={chunk}
                        onSave={(updates) => updateChunk(index, updates)}
                        onCancel={() => setEditingIndex(null)}
                      />
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 text-xs font-bold rounded border ${CATEGORY_COLORS[chunk.category] || CATEGORY_COLORS.general}`}>
                            {CATEGORY_LABELS[chunk.category] || chunk.category}
                          </span>
                          <button
                            onClick={() => setEditingIndex(index)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <Edit2 className="w-3 h-3 text-gray-500" />
                          </button>
                        </div>
                        <h4 className="font-bold text-black text-sm mb-1">{chunk.title}</h4>
                        <p className="text-sm text-gray-700 line-clamp-3">{chunk.content}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border-2 border-red-200 rounded-xl text-red-800 text-sm">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-4 p-4 bg-gray-50 border-2 border-gray-200 rounded-xl">
            <div className="flex items-center gap-2">
              {isPlatformWide ? (
                <Globe className="w-5 h-5 text-blue-600" />
              ) : (
                <Building2 className="w-5 h-5 text-amber-600" />
              )}
              <span className="text-sm font-bold text-black">
                Importing to: {isPlatformWide ? 'All developments' : developmentName}
              </span>
            </div>
          </div>

          <button
            onClick={importSelected}
            disabled={importing || selectedCount === 0}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {importing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Importing {selectedCount} chunks...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Import {selectedCount} Chunks
              </>
            )}
          </button>
        </>
      )}

      {step === 'complete' && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="font-bold text-black text-lg">Import Complete!</h3>
          <p className="text-gray-600 mt-1">
            {selectedCount} knowledge chunks have been added.
          </p>
        </div>
      )}
    </div>
  );
}

interface EditChunkFormProps {
  chunk: KnowledgeChunk;
  onSave: (updates: Partial<KnowledgeChunk>) => void;
  onCancel: () => void;
}

function EditChunkForm({ chunk, onSave, onCancel }: EditChunkFormProps) {
  const [title, setTitle] = useState(chunk.title);
  const [content, setContent] = useState(chunk.content);
  const [category, setCategory] = useState(chunk.category);

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full p-2 border-2 border-gray-300 rounded-lg text-sm font-bold text-black"
        placeholder="Title"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full p-2 border-2 border-gray-300 rounded-lg text-sm text-black h-24 resize-none"
        placeholder="Content"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="w-full p-2 border-2 border-gray-300 rounded-lg text-sm text-black"
      >
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          onClick={() => onSave({ title, content, category })}
          className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 border-2 border-gray-300 rounded-lg text-sm font-bold text-black hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
