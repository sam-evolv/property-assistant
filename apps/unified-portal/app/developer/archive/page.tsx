'use client';

import { useState, useEffect, useCallback } from 'react';
import { FolderArchive, Plus, RefreshCw } from 'lucide-react';
import { DisciplineGrid, UploadModal } from '@/components/archive';
import { useSafeCurrentContext } from '@/contexts/CurrentContext';
import type { DisciplineSummary } from '@/lib/archive';

interface HouseType {
  id: string;
  house_type_code: string;
  name: string | null;
}

export default function SmartArchivePage() {
  const { tenantId, developmentId, isHydrated } = useSafeCurrentContext();
  const [disciplines, setDisciplines] = useState<DisciplineSummary[]>([]);
  const [houseTypes, setHouseTypes] = useState<HouseType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const loadDisciplines = useCallback(async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('tenantId', tenantId);
      if (developmentId) {
        params.set('developmentId', developmentId);
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
  }, [tenantId, developmentId]);

  const loadHouseTypes = useCallback(async () => {
    if (!tenantId || !developmentId) return;
    
    try {
      const response = await fetch(`/api/developments/${developmentId}/houses`);
      if (response.ok) {
        const data = await response.json();
        setHouseTypes(data.houseTypes || []);
      }
    } catch (error) {
      console.error('[Archive] Failed to load house types:', error);
    }
  }, [tenantId, developmentId]);

  useEffect(() => {
    if (!isHydrated || !tenantId) return;
    loadDisciplines();
    loadHouseTypes();
  }, [tenantId, developmentId, isHydrated, loadDisciplines, loadHouseTypes]);

  const handleUploadComplete = () => {
    loadDisciplines();
    setShowUploadModal(false);
  };

  const handleRefresh = () => {
    loadDisciplines();
    loadHouseTypes();
  };

  const totalDocuments = disciplines.reduce((sum, d) => sum + d.fileCount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950">
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
                onClick={handleRefresh}
                disabled={isLoading}
                className="p-2.5 rounded-xl bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              {developmentId && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-black font-semibold hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg shadow-gold-500/20"
                >
                  <Plus className="w-5 h-5" />
                  <span>Upload</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

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

      {tenantId && developmentId && (
        <UploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUploadComplete={handleUploadComplete}
          tenantId={tenantId}
          developmentId={developmentId}
          houseTypes={houseTypes}
        />
      )}
    </div>
  );
}
