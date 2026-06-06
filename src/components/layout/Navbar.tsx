import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  FolderPlus,
  LayoutDashboard,
  LayoutGrid,
  LogIn,
  Menu,
  Settings,
  User,
  UserPlus,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToolsModalStore } from '../../store/toolsModalStore';
import FieldNotificationsBell from '../field/FieldNotificationsBell';
import HelpButton from '../../features/help/HelpButton';
import ThemeToggle from './ThemeToggle';
import Button from '../ui/Button';
import { APP_NAV_HEADER, APP_NAV_MOBILE_MENU, appNavIconButtonClass } from './appNavStyles';

function sectionLabelForPath(pathname: string, search = ''): string {
  if (pathname === '/') return 'Operations';
  if (pathname.startsWith('/projects')) return 'Projects';
  if (pathname.startsWith('/planner')) return 'Field Planner';
  if (pathname.startsWith('/settings')) return 'Settings';
  if (pathname.startsWith('/resources')) return 'Resources';
  if (pathname.startsWith('/employees')) return 'Team';
  if (pathname.startsWith('/owner/review')) return 'Review Queue';
  if (pathname.startsWith('/proposal')) return 'Proposals';
  if (pathname.startsWith('/pour-planner')) return 'Pour Planner';
  if (pathname.startsWith('/mix-design')) return 'Mix Design';
  if (pathname.startsWith('/calculator')) {
    const inWorkflow = new URLSearchParams(search).get('flow') === '1';
    return inWorkflow ? 'Estimates' : 'Calculators';
  }
  if (pathname.startsWith('/employee')) return 'Employee Portal';
  return 'Concrete Calc';
}

const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut, isOwner, isEmployee } = useAuth();
  const openTools = useToolsModalStore((s) => s.open);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const dashboardHref = isEmployee && !isOwner ? '/employee/dashboard' : '/';
  const sectionLabel = useMemo(
    () => sectionLabelForPath(location.pathname, location.search),
    [location.pathname],
  );
  const mobileSectionLabel = location.pathname === '/' ? 'Dashboard' : sectionLabel;

  const startProject = () => {
    setMobileOpen(false);
    navigate('/projects', { state: { openCreate: true } });
  };

  const handleTools = () => {
    setMobileOpen(false);
    openTools();
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const mobileLinkClass = (active: boolean) =>
    [
      'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium',
      active
        ? 'bg-white/10 text-white'
        : 'text-slate-300 hover:bg-white/10 hover:text-white',
    ].join(' ');

  return (
    <>
    <nav
      className={`${APP_NAV_HEADER} fixed left-0 right-0 top-0 z-50 w-full`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
        {user && (
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="rounded p-1.5 hover:bg-white/10 md:hidden"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        )}

        {user ? (
          <Link
            to={dashboardHref}
            className="hidden shrink-0 items-center gap-1.5 rounded px-2 py-1.5 text-sm font-semibold text-white hover:bg-white/10 md:inline-flex"
            onClick={() => setMobileOpen(false)}
          >
            <LayoutDashboard className="h-4 w-4 text-cyan-400" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
        ) : (
          <Link
            to="/"
            className="inline-flex shrink-0 items-center gap-1.5 rounded px-2 py-1.5 text-sm font-semibold text-white hover:bg-white/10"
          >
            <span>Concrete</span>
            <span className="hidden sm:inline">Calc</span>
          </Link>
        )}

        {user && (
          <>
            <span className="hidden text-slate-600 sm:inline">|</span>
            <span className="truncate text-sm text-slate-300 md:hidden">{mobileSectionLabel}</span>
            <span className="hidden truncate text-sm text-slate-300 md:inline">{sectionLabel}</span>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {user && isOwner && (
          <>
            <Link
              to="/planner/hub"
              className={`hidden md:inline-flex ${appNavIconButtonClass(isActive('/planner'))}`}
              aria-label="Planner Hub"
              title="Planner Hub"
            >
              <LayoutGrid className="h-5 w-5" />
            </Link>
            <button
              type="button"
              onClick={startProject}
              className={`hidden md:inline-flex ${appNavIconButtonClass()}`}
              aria-label="Start new project"
              title="Start new project"
            >
              <FolderPlus className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleTools}
              className={`hidden md:inline-flex ${appNavIconButtonClass()}`}
              aria-label="Tools"
              title="Tools"
            >
              <Wrench className="h-5 w-5" />
            </button>
          </>
        )}

        {user && isOwner && (
          <div className="flex shrink-0 items-center gap-0.5 md:hidden">
            <Link
              to="/planner/hub"
              className={appNavIconButtonClass(isActive('/planner'))}
              aria-label="Open Planner Hub"
              title="Planner Hub"
              onClick={() => setMobileOpen(false)}
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
              onClick={handleTools}
              className={appNavIconButtonClass()}
              aria-label="Tools"
              title="Tools"
            >
              <Wrench className="h-5 w-5" />
            </button>
          </div>
        )}

        {user && isEmployee && !isOwner && (
          <Link
            to="/employee/tasks"
            className={`hidden md:inline-flex ${appNavIconButtonClass(isActive('/employee/tasks'))}`}
            aria-label="My tasks"
            title="My tasks"
          >
            <LayoutGrid className="h-5 w-5" />
          </Link>
        )}

        {user && <HelpButton className={appNavIconButtonClass()} showLabel={false} />}

        {user && (
          <Link
            to="/settings"
            className={`hidden md:inline-flex ${appNavIconButtonClass(isActive('/settings'))}`}
            aria-label="Settings"
            title="Settings"
          >
            <Settings className="h-5 w-5" />
          </Link>
        )}

        <div className="[&_button]:!min-h-0 [&_button]:!p-2 [&_button]:!text-slate-300 [&_button]:hover:!bg-white/10 [&_button]:hover:!text-white">
          <ThemeToggle />
        </div>

        {user && isOwner && (
          <span className="hidden md:inline-flex">
            <FieldNotificationsBell />
          </span>
        )}

        {user ? (
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
                    {profile?.displayName ?? user.email}
                  </p>
                  {isOwner && (
                    <Link
                      to="/employees"
                      className="block w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                      onClick={() => setProfileOpen(false)}
                    >
                      Team & employees
                    </Link>
                  )}
                  <Link
                    to="/projects"
                    className="block w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                    onClick={() => setProfileOpen(false)}
                  >
                    Projects
                  </Link>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
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
        ) : (
          <div className="flex items-center gap-1">
            <Link
              to="/login"
              className={appNavIconButtonClass()}
              aria-label="Sign in"
              title="Sign in"
            >
              <LogIn className="h-5 w-5" />
            </Link>
            <Button
              variant="accent"
              size="sm"
              className="!h-8 !px-2 !py-1 !text-xs"
              onClick={() => navigate('/signup')}
              icon={<UserPlus className="h-3.5 w-3.5" />}
            >
              <span className="hidden sm:inline">Sign up</span>
            </Button>
          </div>
        )}
      </div>
    </nav>

      <AnimatePresence>
        {mobileOpen && user && (
          <motion.div
            className={APP_NAV_MOBILE_MENU}
            style={{
              top: 'calc(3rem + env(safe-area-inset-top))',
              maxHeight: 'calc(100vh - 3rem - env(safe-area-inset-top))',
              overflow: 'auto',
            }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div className="space-y-1 p-2">
              <Link
                to={dashboardHref}
                className={mobileLinkClass(isActive(dashboardHref))}
                onClick={() => setMobileOpen(false)}
              >
                <LayoutDashboard className="h-5 w-5 text-cyan-400" />
                Dashboard
              </Link>

              {isOwner && (
                <>
                  <Link
                    to="/planner/hub"
                    className={mobileLinkClass(isActive('/planner'))}
                    onClick={() => setMobileOpen(false)}
                  >
                    <LayoutGrid className="h-5 w-5" />
                    Planner Hub
                  </Link>
                  <button type="button" onClick={startProject} className={mobileLinkClass(false)}>
                    <FolderPlus className="h-5 w-5" />
                    Start new project
                  </button>
                  <button type="button" onClick={handleTools} className={mobileLinkClass(false)}>
                    <Wrench className="h-5 w-5" />
                    Tools
                  </button>
                  <Link
                    to="/resources"
                    className={mobileLinkClass(isActive('/resources'))}
                    onClick={() => setMobileOpen(false)}
                  >
                    <BookOpen className="h-5 w-5" />
                    Resources
                  </Link>
                  <Link
                    to="/employees"
                    className={mobileLinkClass(isActive('/employees'))}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Users className="h-5 w-5" />
                    Team
                  </Link>
                </>
              )}

              {isEmployee && !isOwner && (
                <Link
                  to="/employee/tasks"
                  className={mobileLinkClass(isActive('/employee/tasks'))}
                  onClick={() => setMobileOpen(false)}
                >
                  <LayoutGrid className="h-5 w-5" />
                  My tasks
                </Link>
              )}

              <Link
                to="/settings"
                className={mobileLinkClass(isActive('/settings'))}
                onClick={() => setMobileOpen(false)}
              >
                <Settings className="h-5 w-5" />
                Settings
              </Link>

              <div className="px-3 py-2">
                <ThemeToggle />
              </div>

              <button
                type="button"
                className={`${mobileLinkClass(false)} text-red-300`}
                onClick={() => {
                  setMobileOpen(false);
                  void signOut().then(() => navigate('/login'));
                }}
              >
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
