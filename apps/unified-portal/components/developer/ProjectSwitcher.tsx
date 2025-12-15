'use client';

import { useRef, useState, useEffect } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import { Building2, ChevronDown, Check, FolderOpen } from 'lucide-react';

export function ProjectSwitcher() {
  const { projects, selectedProjectId, setSelectedProjectId, selectedProject, isLoading, error } = useProjectContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    setSelectedProjectId(id);
    setIsOpen(false);
    console.log('[ProjectSwitcher] Selected project:', id);
  };

  if (isLoading) {
    return (
      <div className="px-4 py-3 border-b border-gold-900/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-grey-800 rounded-lg animate-pulse" />
          <div className="flex-1">
            <div className="h-3 w-20 bg-grey-800 rounded animate-pulse mb-1" />
            <div className="h-4 w-32 bg-grey-700 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-3 border-b border-gold-900/20">
        <div className="text-xs text-red-400">{error}</div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="px-4 py-3 border-b border-gold-900/20">
        <div className="text-xs text-gray-500">No projects available</div>
      </div>
    );
  }

  const displayName = selectedProject?.name || 'Select Project';

  return (
    <div ref={dropdownRef} className="relative px-4 py-3 border-b border-gold-900/20">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gold-500/10 transition-colors group"
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gold-500/20 text-gold-400">
          <FolderOpen className="w-4 h-4" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-[10px] font-medium text-grey-500 uppercase tracking-wider">
            Current Project
          </div>
          <div className="text-sm font-semibold text-white truncate">
            {displayName}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-grey-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-4 right-4 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 max-h-64 overflow-y-auto">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => handleSelect(project.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                selectedProjectId === project.id ? 'bg-gold-50' : ''
              }`}
            >
              <div className="w-6 h-6 rounded-md flex items-center justify-center bg-green-100 text-green-600">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-700 truncate">
                  {project.name}
                </div>
                {project.address && (
                  <div className="text-[10px] text-gray-400 truncate">
                    {project.address}
                  </div>
                )}
              </div>
              {selectedProjectId === project.id && (
                <Check className="w-4 h-4 text-gold-600 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
