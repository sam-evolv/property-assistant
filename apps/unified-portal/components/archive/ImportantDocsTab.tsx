'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, AlertTriangle, GripVertical, Trash2, ExternalLink, Upload, Check, Loader2, Star } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSafeCurrentContext } from '@/contexts/CurrentContext';

interface Document {
  id: string;
  title: string;
  original_file_name: string;
  mime_type: string;
  size_kb: number;
  file_url: string;
  version: number;
  is_important: boolean;
  important_rank: number | null;
  created_at: string;
}

interface ImportantDocsTabProps {
  onRefresh?: () => void;
}

export function ImportantDocsTab({ onRefresh }: ImportantDocsTabProps) {
  const { tenantId, developmentId } = useSafeCurrentContext();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [importantDocs, setImportantDocs] = useState<Document[]>([]);
  const [availableDocs, setAvailableDocs] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState(1);

  const loadDocuments = useCallback(async () => {
    if (!tenantId || !developmentId) return;
    
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('tenantId', tenantId);
      params.set('developmentId', developmentId);
      
      const response = await fetch(`/api/documents?${params}`);
      if (response.ok) {
        const data = await response.json();
        const docs = data.documents || [];
        setDocuments(docs);
        
        const important = docs.filter((d: Document) => d.is_important)
          .sort((a: Document, b: Document) => (a.important_rank || 99) - (b.important_rank || 99));
        const available = docs.filter((d: Document) => !d.is_important);
        
        setImportantDocs(important);
        setAvailableDocs(available);
      }

      const devResponse = await fetch(`/api/developments/${developmentId}?tenantId=${tenantId}`);
      if (devResponse.ok) {
        const devData = await devResponse.json();
        setCurrentVersion(devData.development?.important_docs_version || 1);
      }
    } catch (error) {
      console.error('[ImportantDocs] Failed to load:', error);
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, developmentId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const toggleImportance = async (docId: string, isCurrentlyImportant: boolean) => {
    if (updatingId || !tenantId || !developmentId) return;
    
    if (!isCurrentlyImportant && importantDocs.length >= 10) {
      toast.error('Maximum 10 important documents allowed');
      return;
    }
    
    setUpdatingId(docId);
    try {
      const newRank = isCurrentlyImportant ? null : importantDocs.length + 1;
      
      const response = await fetch(`/api/documents/${docId}/important`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          developmentId,
          is_important: !isCurrentlyImportant,
          important_rank: newRank,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update');
      }

      toast.success(isCurrentlyImportant ? 'Removed from must-read list' : 'Added to must-read list');
      loadDocuments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update document');
    } finally {
      setUpdatingId(null);
    }
  };

  const updateRank = async (docId: string, newRank: number) => {
    if (!tenantId || !developmentId) return;
    
    setUpdatingId(docId);
    try {
      const response = await fetch(`/api/documents/${docId}/important`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          developmentId,
          is_important: true,
          important_rank: newRank,
        }),
      });

      if (!response.ok) throw new Error('Failed to update rank');
      loadDocuments();
    } catch (error) {
      toast.error('Failed to update order');
    } finally {
      setUpdatingId(null);
    }
  };

  const publishImportantDocs = async () => {
    if (!tenantId || !developmentId || importantDocs.length === 0) return;
    
    setIsPublishing(true);
    try {
      const response = await fetch(`/api/developments/${developmentId}/publish-important-docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });

      if (!response.ok) throw new Error('Failed to publish');
      
      const data = await response.json();
      toast.success(`Published version ${data.new_version}! All purchasers will need to re-acknowledge.`);
      setCurrentVersion(data.new_version);
      onRefresh?.();
    } catch (error) {
      toast.error('Failed to publish important documents');
    } finally {
      setIsPublishing(false);
    }
  };

  const formatFileSize = (kb: number) => {
    if (kb < 1024) return `${kb} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  if (!developmentId) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4">
          <Star className="w-10 h-10 text-gray-600" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Select a Development</h3>
        <p className="text-gray-400 max-w-md mx-auto">
          Choose a development from the sidebar to manage must-read documents.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-gold-900/30 to-amber-800/20 border border-gold-500/30 rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gold-500/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-gold-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Must-Read Documents</h3>
              <p className="text-gray-400 text-sm mt-1">
                {importantDocs.length} of 10 slots used • Current version: {currentVersion}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                Purchasers must acknowledge these documents before accessing the app.
              </p>
            </div>
          </div>
          {importantDocs.length > 0 && (
            <button
              onClick={publishImportantDocs}
              disabled={isPublishing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-black font-semibold hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg shadow-gold-500/20 disabled:opacity-50"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>Publish v{currentVersion + 1}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 bg-gray-900/80">
            <h4 className="text-white font-semibold flex items-center gap-2">
              <Star className="w-4 h-4 text-gold-500" />
              Must-Read List ({importantDocs.length})
            </h4>
            <p className="text-gray-500 text-xs mt-1">Drag to reorder • Purchasers see these in order</p>
          </div>
          
          {importantDocs.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">No must-read documents yet</p>
              <p className="text-gray-600 text-sm mt-1">Add documents from the available list</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {importantDocs.map((doc, index) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition group"
                >
                  <div className="flex items-center gap-2 text-gray-600">
                    <GripVertical className="w-4 h-4" />
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={doc.important_rank || index + 1}
                      onChange={(e) => updateRank(doc.id, parseInt(e.target.value) || 1)}
                      disabled={updatingId === doc.id}
                      className="w-10 px-1 py-0.5 text-xs text-center bg-gray-800 border border-gray-700 rounded text-white focus:border-gold-500 focus:outline-none disabled:opacity-50"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{doc.title}</p>
                    <p className="text-gray-500 text-xs truncate">{doc.original_file_name}</p>
                  </div>
                  
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition"
                      title="View document"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => toggleImportance(doc.id, true)}
                      disabled={updatingId === doc.id}
                      className="p-1.5 rounded-lg hover:bg-red-900/30 text-gray-400 hover:text-red-400 transition disabled:opacity-50"
                      title="Remove from must-read"
                    >
                      {updatingId === doc.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 bg-gray-900/80">
            <h4 className="text-white font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              Available Documents ({availableDocs.length})
            </h4>
            <p className="text-gray-500 text-xs mt-1">Click the star to add to must-read list</p>
          </div>
          
          {availableDocs.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">No available documents</p>
              <p className="text-gray-600 text-sm mt-1">Upload documents in the Archive tab</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800 max-h-[400px] overflow-y-auto">
              {availableDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition group"
                >
                  <button
                    onClick={() => toggleImportance(doc.id, false)}
                    disabled={updatingId === doc.id || importantDocs.length >= 10}
                    className="p-1.5 rounded-lg hover:bg-gold-900/30 text-gray-600 hover:text-gold-400 transition disabled:opacity-50"
                    title={importantDocs.length >= 10 ? 'Maximum 10 documents' : 'Add to must-read'}
                  >
                    {updatingId === doc.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Star className="w-4 h-4" />
                    )}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{doc.title}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{doc.original_file_name}</span>
                      <span>•</span>
                      <span>{formatFileSize(doc.size_kb)}</span>
                      <span>•</span>
                      <span>v{doc.version}</span>
                    </div>
                  </div>
                  
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition opacity-0 group-hover:opacity-100"
                    title="View document"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
        <h5 className="text-white font-medium mb-2">How Must-Read Documents Work</h5>
        <ul className="text-gray-400 text-sm space-y-1">
          <li>• Purchasers must acknowledge all must-read documents before using the app</li>
          <li>• Publishing a new version resets all acknowledgements</li>
          <li>• Documents are shown to purchasers in the order you specify</li>
          <li>• Maximum 10 must-read documents per development</li>
        </ul>
      </div>
    </div>
  );
}
