'use client';

import { useState, useEffect } from 'react';
import { FolderArchive, Plus, RefreshCw } from 'lucide-react';
import { DisciplineGrid } from '@/components/archive';
import { useSafeCurrentContext } from '@/contexts/CurrentContext';
import type { DisciplineSummary } from '@/lib/archive';

export default function SmartArchivePage() {
  const { tenantId, developmentId, isHydrated } = useSafeCurrentContext();
  const [disciplines, setDisciplines] = useState<DisciplineSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    if (!isHydrated || !tenantId) return;

    const currentTenantId = tenantId;
    const currentDevId = developmentId;

    async function loadDisciplines() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('tenantId', currentTenantId);
        if (currentDevId) {
          params.set('developmentId', currentDevId);
        }
        
        const response = await fetch(`/api/archive/disciplines?${params}`);
        if (response.ok) {
          const data = await response.json();
          setDisciplines(data.disciplines || []);
        }
      } catch (error) {
        console.error('[Archive] Failed to load disciplines:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadDisciplines();
  }, [tenantId, developmentId, isHydrated]);

  const totalDocuments = disciplines.reduce((sum, d) => sum + d.fileCount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800 bg-black/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center">
                <FolderArchive className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Smart Archive</h1>
                <p className="text-gray-400 mt-0.5">
                  {developmentId 
                    ? `${totalDocuments} documents organized by discipline`
                    : 'Select a development to view documents'
                  }
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="p-2.5 rounded-xl bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold-500 text-white font-medium hover:bg-gold-600 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>Upload</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {!developmentId ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <FolderArchive className="w-10 h-10 text-gray-600" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Select a Development</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              Choose a development from the sidebar to view its document archive.
            </p>
          </div>
        ) : (
          <DisciplineGrid disciplines={disciplines} isLoading={isLoading} />
        )}
      </div>

      {/* Upload Modal (Placeholder) */}
      {showUploadModal && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowUploadModal(false)}
        >
          <div 
            className="bg-gray-900 rounded-2xl p-8 max-w-md w-full border border-gray-700 text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-2xl bg-gold-500/10 flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-gold-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Upload Documents</h3>
            <p className="text-gray-400 mb-6">
              Upload functionality coming soon. Documents can currently be uploaded via the Documents page.
            </p>
            <button
              onClick={() => setShowUploadModal(false)}
              className="px-6 py-2.5 rounded-xl bg-gray-700 text-white hover:bg-gray-600 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
