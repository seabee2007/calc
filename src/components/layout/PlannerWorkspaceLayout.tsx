import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import PlannerAppBar from '../planner/PlannerAppBar';
import PlannerSidebar from '../planner/PlannerSidebar';
import ToolsModal from '../workflow/ToolsModal';

function PlannerWorkspaceMain() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const isProjectRoute = Boolean(projectId && location.pathname.includes('/planner'));
  const [projectName, setProjectName] = useState<string | null>(null);

  useEffect(() => {
    if (!isProjectRoute || !projectId) {
      setProjectName(null);
      return;
    }
    let cancelled = false;
    void supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.name) setProjectName(data.name as string);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, isProjectRoute]);

  return (
    <div className="flex min-h-0 flex-1">
      <PlannerSidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PlannerAppBar
          onMenuClick={() => setMobileNavOpen(true)}
          projectName={projectName}
        />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const PlannerWorkspaceLayout: React.FC = () => {
  const location = useLocation();
  const { user, isOwner, isEmployee } = useAuth();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    const bg = isDark ? '#020617' : '#f1f5f9';
    document.documentElement.style.backgroundColor = bg;
    document.body.style.backgroundColor = bg;
  }, []);

  return (
    <div
      className="flex min-h-screen min-h-[100dvh] flex-col bg-slate-100 text-gray-900 dark:bg-slate-950 dark:text-slate-100"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <PlannerWorkspaceMain />
      {user && isOwner && !isEmployee && <ToolsModal />}
    </div>
  );
};

export default PlannerWorkspaceLayout;
