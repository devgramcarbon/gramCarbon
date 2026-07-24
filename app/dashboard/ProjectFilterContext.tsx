'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

export type ProjectFilter = 'all' | 'np' | 'mm';

const ProjectFilterContext = createContext<{
  project: ProjectFilter;
  setProject: (p: ProjectFilter) => void;
} | null>(null);

export function ProjectFilterProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<ProjectFilter>('all');
  return (
    <ProjectFilterContext.Provider value={{ project, setProject }}>
      {children}
    </ProjectFilterContext.Provider>
  );
}

export function useProjectFilter() {
  const ctx = useContext(ProjectFilterContext);
  if (!ctx) throw new Error('useProjectFilter must be used within ProjectFilterProvider');
  return ctx;
}
