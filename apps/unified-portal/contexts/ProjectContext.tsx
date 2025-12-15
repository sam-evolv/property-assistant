'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export interface Project {
  id: string;
  name: string;
  address: string | null;
  image_url: string | null;
}

export interface ProjectContextValue {
  projects: Project[];
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  selectedProject: Project | null;
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;
}

const DEFAULT_PROJECT_STATE: ProjectContextValue = {
  projects: [],
  selectedProjectId: null,
  setSelectedProjectId: () => {
    console.warn('[ProjectContext] setSelectedProjectId called before provider initialized');
  },
  selectedProject: null,
  isLoading: true,
  isHydrated: false,
  error: null,
};

const ProjectContext = createContext<ProjectContextValue>(DEFAULT_PROJECT_STATE);

export interface ProjectContextProviderProps {
  children: ReactNode;
}

export function ProjectContextProvider({ children }: ProjectContextProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProjects() {
      try {
        setIsLoading(true);
        console.log('[ProjectContext] Fetching projects...');
        const response = await fetch('/api/projects');
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[ProjectContext] API error:', response.status, errorData);
          throw new Error(errorData.error || 'Failed to fetch projects');
        }
        
        const data = await response.json();
        const projectList = data.projects || [];
        console.log('[ProjectContext] Loaded projects:', projectList.length);
        setProjects(projectList);
        
        const urlProjectId = searchParams.get('projectId');
        
        if (urlProjectId && projectList.find((p: Project) => p.id === urlProjectId)) {
          setSelectedProjectIdState(urlProjectId);
          console.log('[ProjectContext] Using projectId from URL:', urlProjectId);
        } else if (projectList.length > 0) {
          const firstProjectId = projectList[0].id;
          setSelectedProjectIdState(firstProjectId);
          console.log('[ProjectContext] Defaulting to first project:', firstProjectId);
          
          const params = new URLSearchParams(searchParams.toString());
          params.set('projectId', firstProjectId);
          router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }
        
        setError(null);
      } catch (err) {
        console.error('[ProjectContext] Error fetching projects:', err);
        setError(err instanceof Error ? err.message : 'Failed to load projects');
      } finally {
        setIsLoading(false);
        setIsHydrated(true);
      }
    }

    fetchProjects();
  }, []);

  const setSelectedProjectId = useCallback((id: string | null) => {
    console.log('[ProjectContext] Project changed:', { from: selectedProjectId, to: id });
    setSelectedProjectIdState(id);
    
    const params = new URLSearchParams(searchParams.toString());
    if (id) {
      params.set('projectId', id);
    } else {
      params.delete('projectId');
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams, selectedProjectId]);

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;

  const value: ProjectContextValue = {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    selectedProject,
    isLoading,
    isHydrated,
    error,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext(): ProjectContextValue {
  const context = useContext(ProjectContext);
  
  if (context === undefined) {
    throw new Error('useProjectContext must be used within a ProjectContextProvider');
  }
  
  return context;
}

export function useSafeProjectContext(): ProjectContextValue {
  const context = useContext(ProjectContext);
  
  if (!context || !context.isHydrated) {
    return DEFAULT_PROJECT_STATE;
  }
  
  return context;
}

export function useRequireProject(): ProjectContextValue & { selectedProjectId: string; selectedProject: Project } {
  const context = useProjectContext();
  
  if (!context.isHydrated) {
    throw new Error('Context not hydrated');
  }
  
  if (!context.selectedProjectId || !context.selectedProject) {
    throw new Error('Project selection required');
  }
  
  return context as ProjectContextValue & { selectedProjectId: string; selectedProject: Project };
}
