import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  FolderPlus,
  LayoutDashboard,
  LayoutGrid,
  Menu,
  Settings,
  User,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToolsModalStore } from '../../store/toolsModalStore';
import FieldNotificationsBell from '../field/FieldNotificationsBell';
import ThemeToggle from '../layout/ThemeToggle';
import { APP_NAV_HEADER, appNavIconButtonClass } from '../layout/appNavStyles';

interface PlannerAppBarProps {
  onMenuClick: () => void;
  projectName?: string | null;
}

export default function PlannerAppBar({ onMenuClick, projectName }: PlannerAppBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut, isOwner, isEmployee } = useAuth();
  const openTools = useToolsModalStore((s) => s.open);
  const [profileOpen, setProfileOpen] = useState(false);

  const dashboardHref = isEmployee && !isOwner ? '/employee/dashboard' : '/';

  const sectionLabel = useMemo(() => {
    if (projectName) return projectName;
    if (location.pathname === '/planner/hub') return 'Planner Hub';
    if (location.pathname === '/planner/rfis') return 'All RFIs';
    if (location.pathname === '/planner/fars') return 'All FARs';
    if (location.pathname === '/planner/change-orders') return 'All change orders';
    if (location.pathname.startsWith('/employee/tasks')) return 'My Tasks';
    return 'Field Planner';
  }, [location.pathname, projectName]);

  const startProject = () => {
    navigate('/projects', { state: { openCreate: true } });
  };

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
          className="inline-flex shrink-0 items-center gap-1.5 rounded px-2 py-1.5 text-sm font-semibold text-white hover:bg-white/10"
        >
          <LayoutDashboard className="h-4 w-4 text-cyan-400" />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>

        <span className="hidden text-slate-600 sm:inline">|</span>
        <span className="truncate text-sm text-slate-300">{sectionLabel}</span>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {isOwner && (
          <>
            <Link
              to="/planner/hub"
              className={appNavIconButtonClass(location.pathname === '/planner/hub')}
              aria-label="Planner Hub"
              title="Planner Hub"
            >
              <LayoutGrid className="h-5 w-5" />
            </Link>
            <button
              type="button"
              onClick={startProject}
              className={appNavIconButtonClass()}
              aria-label="Start new project"
              title="Start new project"
            >
              <FolderPlus className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={openTools}
              className={appNavIconButtonClass()}
              aria-label="Tools"
              title="Tools"
            >
              <Wrench className="h-5 w-5" />
            </button>
            <Link
              to="/resources"
              className={appNavIconButtonClass(location.pathname.startsWith('/resources'))}
              aria-label="Resources"
              title="Resources"
            >
              <BookOpen className="h-5 w-5" />
            </Link>
          </>
        )}

        {isEmployee && !isOwner && (
          <Link
            to="/employee/tasks"
            className={appNavIconButtonClass(location.pathname.startsWith('/employee/tasks'))}
            aria-label="My tasks"
            title="My tasks"
          >
            <LayoutGrid className="h-5 w-5" />
          </Link>
        )}

        <Link
          to="/settings"
          className={appNavIconButtonClass(location.pathname === '/settings')}
          aria-label="Settings"
          title="Settings"
        >
          <Settings className="h-5 w-5" />
        </Link>

        <div className="[&_button]:!min-h-0 [&_button]:!p-2 [&_button]:!text-slate-300 [&_button]:hover:!bg-white/10 [&_button]:hover:!text-white">
          <ThemeToggle />
        </div>

        {isOwner && <FieldNotificationsBell />}

        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((o) => !o)}
            className={appNavIconButtonClass(profileOpen)}
            aria-label="Profile"
            title="Profile"
          >
            <User className="h-5 w-5" />
          </button>
          {profileOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40"
                aria-label="Close profile menu"
                onClick={() => setProfileOpen(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl">
                <p className="truncate px-3 py-2 text-xs text-slate-400">
                  {profile?.displayName ?? user?.email}
                </p>
                {!isOwner && (
                  <Link
                    to="/employee/dashboard"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-800"
                    onClick={() => setProfileOpen(false)}
                  >
                    Employee portal
                  </Link>
                )}
                <Link
                  to="/projects"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-800"
                  onClick={() => setProfileOpen(false)}
                >
                  Projects
                </Link>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-800"
                  onClick={() => {
                    setProfileOpen(false);
                    void signOut().then(() => navigate('/login'));
                  }}
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
