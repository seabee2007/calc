import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FolderKanban,
  LayoutGrid,
  Calendar,
  Plus,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { fetchAssignedProjects } from '../../services/employeeService';
import { resolveProjectWorkflow } from '../../utils/projectWorkflow';
import { plannerProjectSwitchHref } from '../../utils/plannerRoutes';

interface SidebarProject {
  id: string;
  name: string;
  isClosed: boolean;
}

interface PlannerSidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function PlannerSidebar({ mobileOpen, onMobileClose }: PlannerSidebarProps) {
  const location = useLocation();
  const { user, isOwner, isEmployee } = useAuth();
  const [projects, setProjects] = useState<SidebarProject[]>([]);
  const [activeOpen, setActiveOpen] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      if (isEmployee) {
        const rows = await fetchAssignedProjects(user.id);
        setProjects(
          rows.map((p) => ({
            id: p.id as string,
            name: p.name as string,
            isClosed: false,
          })),
        );
        return;
      }

      const { data } = await supabase
        .from('projects')
        .select('id, name, pour_date, placement_order')
        .eq('user_id', user.id)
        .order('name');

      setProjects(
        (data ?? []).map((row) => {
          const workflow = resolveProjectWorkflow(row as Parameters<typeof resolveProjectWorkflow>[0]);
          return {
            id: row.id as string,
            name: row.name as string,
            isClosed: workflow.stage === 'closed',
          };
        }),
      );
    })();
  }, [user, isOwner, isEmployee]);

  const activeProjects = useMemo(
    () => projects.filter((p) => !p.isClosed),
    [projects],
  );
  const completedProjects = useMemo(
    () => projects.filter((p) => p.isClosed),
    [projects],
  );

  const navClass = (active: boolean) =>
    [
      'flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors',
      active
        ? 'bg-slate-800 text-white'
        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white',
    ].join(' ');

  const content = (
    <nav className="flex h-full flex-col gap-1 p-2 text-slate-300">
      {isOwner && (
        <Link
          to="/projects"
          state={{ openCreate: true }}
          onClick={onMobileClose}
          className={navClass(location.pathname === '/projects')}
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className="truncate">New Project Plan</span>
        </Link>
      )}

      <Link
        to="/planner/hub"
        onClick={onMobileClose}
        className={navClass(location.pathname === '/planner/hub')}
      >
        <LayoutGrid className="h-4 w-4 shrink-0" />
        <span className="truncate">Planner Hub</span>
      </Link>

      <Link
        to="/planner/schedule"
        onClick={onMobileClose}
        className={navClass(location.pathname === '/planner/schedule')}
      >
        <Calendar className="h-4 w-4 shrink-0" />
        <span className="truncate">Schedule</span>
      </Link>

      <Link
        to={isOwner ? '/owner/review' : '/employee/tasks'}
        onClick={onMobileClose}
        className={navClass(
          isOwner
            ? location.pathname.startsWith('/owner/review')
            : location.pathname.startsWith('/employee/tasks'),
        )}
      >
        <ClipboardList className="h-4 w-4 shrink-0" />
        <span className="truncate">My Tasks</span>
      </Link>

      {isOwner && (
        <>
          <button
            type="button"
            onClick={() => setActiveOpen((o) => !o)}
            className="mt-2 flex w-full items-center gap-1 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-300"
          >
            {activeOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Active Projects
          </button>
          {activeOpen &&
            activeProjects.map((p) => (
              <Link
                key={p.id}
                to={plannerProjectSwitchHref(p.id, location)}
                onClick={onMobileClose}
                className={navClass(location.pathname.includes(`/projects/${p.id}/planner`))}
              >
                <FolderKanban className="h-4 w-4 shrink-0" />
                <span className="truncate">{p.name}</span>
              </Link>
            ))}

          <button
            type="button"
            onClick={() => setCompletedOpen((o) => !o)}
            className="mt-2 flex w-full items-center gap-1 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-300"
          >
            {completedOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Completed Projects
          </button>
          {completedOpen &&
            completedProjects.map((p) => (
              <Link
                key={p.id}
                to={plannerProjectSwitchHref(p.id, location)}
                onClick={onMobileClose}
                className={navClass(location.pathname.includes(`/projects/${p.id}/planner`))}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{p.name}</span>
              </Link>
            ))}
        </>
      )}

      {isEmployee && !isOwner && projects.length > 0 && (
        <>
          <p className="mt-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            My Projects
          </p>
          {projects.map((p) => (
            <Link
              key={p.id}
              to={plannerProjectSwitchHref(p.id, location)}
              onClick={onMobileClose}
              className={navClass(location.pathname.includes(`/projects/${p.id}/planner`))}
            >
              <FolderKanban className="h-4 w-4 shrink-0" />
              <span className="truncate">{p.name}</span>
            </Link>
          ))}
        </>
      )}
    </nav>
  );

  return (
    <>
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-slate-800 bg-slate-900 lg:flex">
        {content}
      </aside>

      {mobileOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-50 bg-black/50 lg:hidden"
            aria-label="Close menu"
            onClick={onMobileClose}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-[220px] flex-col border-r border-slate-800 bg-slate-900 pt-12 lg:hidden">
            {content}
          </aside>
        </>
      )}
    </>
  );
}
