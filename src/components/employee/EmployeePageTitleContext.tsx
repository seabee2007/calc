import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

const ROUTE_TITLES: Record<string, string> = {
  '/employee/dashboard': 'Dashboard',
  '/employee/planner': 'Planner',
  '/employee/tasks': 'Tasks',
  '/employee/uploads': 'Upload',
  '/employee/schedule': 'Schedule',
  '/employee/rfi': 'RFI',
  '/employee/far': 'FAR',
  '/employee/qc': 'QC',
  '/employee/documents': 'Documents',
  '/employee/projects': 'Projects',
  '/employee/messages': 'Messages',
  '/employee/profile': 'Profile',
  '/employee/more': 'More',
  '/employee/calculator': 'Calculator',
  '/employee/safety-meeting': 'Safety Meeting',
  '/employee/draft-change-order': 'Draft Change Order',
};

function resolveRouteTitle(pathname: string): string {
  if (pathname.startsWith('/employee/tasks/')) return 'Task Details';
  if (pathname.startsWith('/employee/rfi/')) return 'RFI Details';
  if (pathname.startsWith('/employee/far/')) return 'FAR Details';
  if (pathname.startsWith('/employee/qc/')) return 'QC Details';
  if (pathname.startsWith('/employee/documents/')) return 'Document';
  if (pathname.startsWith('/employee/planner/bucket/')) return 'Planner';
  return ROUTE_TITLES[pathname] ?? 'Field portal';
}

interface EmployeePageTitleContextValue {
  title: string;
  setTitle: (title: string | null) => void;
}

const EmployeePageTitleContext = createContext<EmployeePageTitleContextValue | null>(null);

export function EmployeePageTitleProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [overrideTitle, setOverrideTitle] = useState<string | null>(null);

  useEffect(() => {
    setOverrideTitle(null);
  }, [location.pathname]);

  const title = overrideTitle ?? resolveRouteTitle(location.pathname);

  const value = useMemo(
    () => ({
      title,
      setTitle: setOverrideTitle,
    }),
    [title],
  );

  return (
    <EmployeePageTitleContext.Provider value={value}>{children}</EmployeePageTitleContext.Provider>
  );
}

export function useEmployeePageTitle(pageTitle?: string) {
  const context = useContext(EmployeePageTitleContext);

  useEffect(() => {
    if (!context || pageTitle == null) return;
    context.setTitle(pageTitle);
    return () => context.setTitle(null);
  }, [context, pageTitle]);

  return context;
}

export function useEmployeePageTitleValue() {
  const context = useContext(EmployeePageTitleContext);
  if (!context) {
    throw new Error('useEmployeePageTitleValue must be used within EmployeePageTitleProvider');
  }
  return context.title;
}
