import { useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  LayoutGrid,
  Menu,
  SquareChartGantt,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToolsModalStore } from '../../store/toolsModalStore';
import FieldNotificationsBell from '../field/FieldNotificationsBell';
import AppProfileMenu from '../layout/AppProfileMenu';
import UserAvatarButton from '../layout/UserAvatarButton';
import { APP_NAV_HEADER, appNavIconButtonClass, isToolsPath } from '../layout/appNavStyles';

interface PlannerAppBarProps {
  onMenuClick: () => void;
  projectName?: string | null;
}

export default function PlannerAppBar({ onMenuClick, projectName }: PlannerAppBarProps) {
  const location = useLocation();
  const { user, profile, isOwner, isEmployee } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const openTools = useToolsModalStore((s) => s.open);
  const toolsModalOpen = useToolsModalStore((s) => s.isOpen);

  const dashboardHref = isEmployee && !isOwner ? '/employee/dashboard' : '/';
  const toolsActive = toolsModalOpen || isToolsPath(location.pathname);

  const sectionLabel = useMemo(() => {
    if (projectName) return projectName;
    if (location.pathname === '/planner/hub') return 'Planner Hub';
    if (location.pathname === '/planner/schedule') return 'Schedule';
    if (location.pathname === '/planner/rfis') return 'All RFIs';
    if (location.pathname === '/planner/fars') return 'All FARs';
    if (location.pathname === '/planner/change-orders') return 'All change orders';
    if (location.pathname.startsWith('/employee/tasks')) return 'My Tasks';
    return 'Field Planner';
  }, [location.pathname, projectName]);

  const isProjectsActive = location.pathname.startsWith('/projects');

  const ownerActions: ReactNode[] = isOwner
    ? [
        <Link
          key="planner-hub"
          to="/planner/hub"
          className={appNavIconButtonClass(location.pathname === '/planner/hub')}
          aria-label="Planner Hub"
          title="Planner Hub"
        >
          <LayoutGrid className="h-5 w-5" />
        </Link>,
        <Link
          key="projects"
          to="/projects"
          className={appNavIconButtonClass(isProjectsActive)}
          aria-label="Projects"
          title="Projects"
        >
          <SquareChartGantt className="h-5 w-5" />
        </Link>,
        <button
          key="tools"
          type="button"
          className={appNavIconButtonClass(toolsActive)}
          aria-label="Tools"
          title="Tools"
          onClick={() => openTools()}
        >
          <Wrench className="h-5 w-5" />
        </button>,
      ]
    : [];

  return (
    <header className={APP_NAV_HEADER}>
      <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded p-1.5 hover:bg-white/10 lg:hidden"
          aria-label="Open planner menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link
          to={dashboardHref}
          className="hidden shrink-0 items-center gap-1.5 rounded px-2 py-1.5 text-sm font-semibold text-white hover:bg-white/10 lg:inline-flex"
        >
          <LayoutDashboard className="h-4 w-4 text-cyan-400" />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>

        <Link
          to={dashboardHref}
          className="shrink-0 rounded px-1.5 py-1 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
        >
          Dashboard
        </Link>
        <span className="text-slate-600 lg:hidden">|</span>
        <span className="hidden text-slate-600 lg:inline">|</span>
        <span className="truncate text-sm font-medium text-slate-300 lg:hidden">Planner</span>
        <span className="hidden truncate text-sm text-slate-300 lg:inline">{sectionLabel}</span>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {ownerActions.length > 0 && (
          <div className="flex shrink-0 items-center gap-0.5">
            {ownerActions}
          </div>
        )}

        {isEmployee && !isOwner && (
          <>
            <Link
              to="/employee/tasks"
              className={appNavIconButtonClass(location.pathname.startsWith('/employee/tasks'))}
              aria-label="My tasks"
              title="My tasks"
            >
              <LayoutGrid className="h-5 w-5" />
            </Link>
            <Link
              to="/projects"
              className={appNavIconButtonClass(isProjectsActive)}
              aria-label="Projects"
              title="Projects"
            >
              <SquareChartGantt className="h-5 w-5" />
            </Link>
          </>
        )}

        {isOwner && (
          <FieldNotificationsBell buttonClassName={appNavIconButtonClass()} />
        )}

        <div className="relative">
          <UserAvatarButton
            user={user}
            profile={profile}
            active={profileOpen}
            onClick={() => setProfileOpen((o) => !o)}
          />
          {profileOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40"
                aria-label="Close profile menu"
                onClick={() => setProfileOpen(false)}
              />
              <AppProfileMenu onClose={() => setProfileOpen(false)} />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
