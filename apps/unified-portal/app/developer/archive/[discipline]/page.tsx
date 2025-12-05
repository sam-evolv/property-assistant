'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, FolderOpen, RefreshCw } from 'lucide-react';
import { DocumentGrid } from '@/components/archive';
import { useSafeCurrentContext } from '@/contexts/CurrentContext';
import { DISCIPLINES, getDisciplineDisplayName } from '@/lib/archive';
import type { ArchiveDocument, DisciplineType } from '@/lib/archive';

export default function DisciplineDetailPage() {
  const params = useParams();
  const discipline = params.discipline as string;
  const { tenantId, developmentId, isHydrated } = useSafeCurrentContext();
  
  const [documents, setDocuments] = useState<ArchiveDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const displayName = getDisciplineDisplayName(discipline);
  const disciplineInfo = DISCIPLINES[discipline as DisciplineType];

  useEffect(() => {
    if (!isHydrated || !tenantId) return;

    const currentTenantId = tenantId;
    const currentDevId = developmentId;

    async function loadDocuments() {
      setIsLoading(true);
      try {
        const urlParams = new URLSearchParams();
        urlParams.set('tenantId', currentTenantId);
        urlParams.set('discipline', discipline);
        urlParams.set('page', page.toString());
        urlParams.set('pageSize', '20');
        if (currentDevId) {
          urlParams.set('developmentId', currentDevId);
        }
        
        const response = await fetch(`/api/archive/documents?${urlParams}`);
        if (response.ok) {
          const data = await response.json();
          setDocuments(data.documents || []);
          setTotalPages(data.totalPages || 1);
          setTotalCount(data.totalCount || 0);
        }
      } catch (error) {
        console.error('[Archive] Failed to load documents:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadDocuments();
  }, [tenantId, developmentId, discipline, page, isHydrated]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800 bg-black/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                <Link 
                  href="/developer/archive" 
                  className="hover:text-white transition-colors flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Smart Archive
                </Link>
                <span>/</span>
                <span className="text-white">{displayName}</span>
              </div>
              
              {/* Title */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center">
                  <FolderOpen className="w-6 h-6 text-gold-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{displayName}</h1>
                  {disciplineInfo && (
                    <p className="text-gray-400 mt-0.5">{disciplineInfo.description}</p>
                  )}
                </div>
              </div>
            </div>
            
            <button
              onClick={() => window.location.reload()}
              className="p-2.5 rounded-xl bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {!developmentId ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-10 h-10 text-gray-600" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Select a Development</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              Choose a development from the sidebar to view documents.
            </p>
          </div>
        ) : (
          <DocumentGrid
            documents={documents}
            isLoading={isLoading}
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </div>
  );
}
