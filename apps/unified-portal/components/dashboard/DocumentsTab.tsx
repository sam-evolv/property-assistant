'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, RefreshCw, Upload, ExternalLink, CheckCircle, XCircle, Clock } from 'lucide-react';

const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';

interface Document {
  id: string;
  title: string;
  file_name: string;
  file_url: string | null;
  status: string;
  created_at: string;
  chunk_count?: number;
}

export function DocumentsTab() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    console.log('🔥 FETCHING DOCS FOR:', PROJECT_ID);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/archive/documents/list?project_id=${PROJECT_ID}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch documents');
      }

      console.log('✅ FOUND:', data.documents?.length || 0);
      setDocuments(data.documents || []);
    } catch (err) {
      console.error('[DocumentsTab] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'indexed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-gold-500" />
          <span className="ml-2 text-gray-400">Loading documents...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Documents</h2>
        <button
          onClick={fetchDocuments}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {documents.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
            <Upload className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No documents yet</h3>
          <p className="text-gray-400 max-w-sm mx-auto">
            Upload documents to train the AI assistant. Go to the Archive section to upload files.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <h4 className="font-medium text-white">{doc.title || doc.file_name}</h4>
                  <p className="text-sm text-gray-400">
                    {doc.chunk_count ? `${doc.chunk_count} chunks` : 'Processing...'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {getStatusIcon(doc.status || 'indexed')}
                {doc.file_url && (
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DocumentsTab;
