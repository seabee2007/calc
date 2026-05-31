import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import PlannerAppBar from '../planner/PlannerAppBar';
import PlannerSidebar from '../planner/PlannerSidebar';
import ToolsModal from '../workflow/ToolsModal';
import SiteBackground from './SiteBackground';
import { COLOR_CANVAS_DARK, COLOR_CANVAS_LIGHT } from '../../theme/appTheme';

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
    const setThemeColors = () => {
      const isDark = document.documentElement.classList.contains('dark');
      const bg = isDark ? COLOR_CANVAS_DARK : COLOR_CANVAS_LIGHT;
      document.documentElement.style.backgroundColor = bg;
      document.body.style.backgroundColor = bg;
    };

    setThemeColors();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setThemeColors();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="relative flex min-h-screen min-h-[100dvh] flex-col bg-slate-50 text-gray-900 dark:bg-slate-950 dark:text-slate-100"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <SiteBackground />
      <div className="relative z-10 flex min-h-0 min-h-[100dvh] flex-1 flex-col">
        <PlannerWorkspaceMain />
        {user && isOwner && !isEmployee && <ToolsModal />}
      </div>
    </div>
  );
};

export default PlannerWorkspaceLayout;
