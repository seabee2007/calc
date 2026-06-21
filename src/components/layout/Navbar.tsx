import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  ClipboardList,
  LayoutDashboard,
  LayoutGrid,
  SquareChartGantt,
  LogIn,
  Menu,
  Share2,
  User,
  UserPlus,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToolsModalStore } from '../../store/toolsModalStore';
import FieldNotificationsBell from '../field/FieldNotificationsBell';
import ShareInviteModal from '../share/ShareInviteModal';
import PilotSurveyModal from '../survey/PilotSurveyModal';
import Button from '../ui/Button';
import AppProfileMenu from './AppProfileMenu';
import UserAvatarButton from './UserAvatarButton';
import { APP_NAV_HEADER, APP_NAV_MOBILE_MENU, appNavIconButtonClass, isToolsPath } from './appNavStyles';
import { isFieldOnlyRole } from '../../types/fieldPlanner';
import {
  BRAND_NAME,
  getAppLoginUrl,
  goToAppAuth,
  isMarketingHost,
} from '../../config/brand';

function sectionLabelForPath(pathname: string, search = ''): string {
  if (pathname === '/') return 'Operations';
  if (pathname.startsWith('/projects')) return 'Projects';
  if (pathname.startsWith('/planner')) return 'Field Planner';
  if (pathname.startsWith('/settings')) return 'Settings';
  if (pathname.startsWith('/resources')) return 'Resources';
  if (pathname.startsWith('/employees')) return 'Team';
  if (pathname.startsWith('/owner/review')) return 'Review Queue';
  if (pathname.startsWith('/proposal')) return 'Proposals';
  if (pathname.startsWith('/pour-planner')) return 'Placement Planner';
  if (pathname.startsWith('/mix-design')) return 'Mix Design';
  if (pathname.startsWith('/calculator')) {
    const inWorkflow = new URLSearchParams(search).get('flow') === '1';
    return inWorkflow ? 'Estimates' : 'Calculators';
  }
  if (pathname.startsWith('/employee')) return 'Employee Portal';
  return BRAND_NAME;
}

interface NavbarProps {
  showThemeToggle?: boolean;
  softHeader?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ showThemeToggle = true, softHeader = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isOwner, isEmployee, profile } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [shareInviteOpen, setShareInviteOpen] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const openTools = useToolsModalStore((s) => s.open);
  const toolsModalOpen = useToolsModalStore((s) => s.isOpen);

  const dashboardHref = isEmployee && !isOwner ? '/employee/dashboard' : '/dashboard';
  const toolsActive = toolsModalOpen || isToolsPath(location.pathname);
  const sectionLabel = useMemo(
    () => sectionLabelForPath(location.pathname, location.search),
    [location.pathname],
  );
  const mobileSectionLabel = location.pathname === '/' ? 'Dashboard' : sectionLabel;
  const isFieldOnly = isFieldOnlyRole(profile?.role);

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
      className={`${
        softHeader
          ? 'flex h-12 shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-black/80 px-2 text-white backdrop-blur-md sm:gap-3 sm:px-4'
          : APP_NAV_HEADER
      } fixed left-0 right-0 top-0 z-50 w-full`}
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
            {BRAND_NAME}
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

      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        {user && isOwner && (
          <Link
            to="/planner/hub"
            className={appNavIconButtonClass(isActive('/planner'))}
            aria-label="Planner Hub"
            title="Planner Hub"
            onClick={() => setMobileOpen(false)}
          >
            <LayoutGrid className="h-5 w-5" />
          </Link>
        )}

        {user && isEmployee && !isOwner && (
          <Link
            to="/employee/tasks"
            className={appNavIconButtonClass(isActive('/employee/tasks'))}
            aria-label="My tasks"
            title="My tasks"
          >
            <LayoutGrid className="h-5 w-5" />
          </Link>
        )}

        {user && (
          <Link
            to="/projects"
            className={appNavIconButtonClass(isActive('/projects'))}
            aria-label="Projects"
            title="Projects"
            onClick={() => setMobileOpen(false)}
          >
            <SquareChartGantt className="h-5 w-5" />
          </Link>
        )}

        {user && isOwner && (
          <button
            type="button"
            className={appNavIconButtonClass(toolsActive)}
            aria-label="Tools"
            title="Tools"
            onClick={() => {
              setMobileOpen(false);
              openTools();
            }}
          >
            <Wrench className="h-5 w-5" />
          </button>
        )}

        {user && isOwner && (
          <FieldNotificationsBell buttonClassName={appNavIconButtonClass()} />
        )}

        {user ? (
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
                <AppProfileMenu
                  onClose={() => setProfileOpen(false)}
                  showThemeToggle={showThemeToggle}
                  showShareInvite
                  onShareInvite={() => setShareInviteOpen(true)}
                  showSurvey
                  onSurvey={() => setSurveyOpen(true)}
                />
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {isMarketingHost() ? (
              <a
                href={getAppLoginUrl()}
                className={appNavIconButtonClass()}
                aria-label="Sign in"
                title="Sign in"
              >
                <LogIn className="h-5 w-5" />
              </a>
            ) : (
              <Link
                to="/login"
                className={appNavIconButtonClass()}
                aria-label="Sign in"
                title="Sign in"
              >
                <LogIn className="h-5 w-5" />
              </Link>
            )}
            <Button
              variant="accent"
              size="sm"
              className="!h-8 !px-2 !py-1 !text-xs"
              onClick={() => goToAppAuth('/signup', navigate)}
              icon={<UserPlus className="h-3.5 w-3.5" />}
              aria-label="Sign up"
            >
              <span>
                <span className="sr-only sm:hidden">Sign up</span>
                <span className="hidden sm:inline">Sign up</span>
              </span>
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
                  <Link
                    to="/projects"
                    className={mobileLinkClass(isActive('/projects'))}
                    onClick={() => setMobileOpen(false)}
                  >
                    <SquareChartGantt className="h-5 w-5" />
                    Projects
                  </Link>
                  <button
                    type="button"
                    className={mobileLinkClass(toolsActive)}
                    onClick={() => {
                      setMobileOpen(false);
                      openTools();
                    }}
                  >
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
                <>
                  <Link
                    to="/employee/tasks"
                    className={mobileLinkClass(isActive('/employee/tasks'))}
                    onClick={() => setMobileOpen(false)}
                  >
                    <LayoutGrid className="h-5 w-5" />
                    My tasks
                  </Link>
                  <Link
                    to="/projects"
                    className={mobileLinkClass(isActive('/projects'))}
                    onClick={() => setMobileOpen(false)}
                  >
                    <SquareChartGantt className="h-5 w-5" />
                    Projects
                  </Link>
                </>
              )}

              {isOwner && (
                <>
                  <button
                    type="button"
                    className={mobileLinkClass(false)}
                    onClick={() => {
                      setMobileOpen(false);
                      setShareInviteOpen(true);
                    }}
                  >
                    <Share2 className="h-5 w-5 text-cyan-400" />
                    Share / Invite Client
                  </button>

                  <button
                    type="button"
                    className={mobileLinkClass(false)}
                    onClick={() => {
                      setMobileOpen(false);
                      setSurveyOpen(true);
                    }}
                  >
                    <ClipboardList className="h-5 w-5 text-cyan-400" />
                    Survey
                  </button>
                </>
              )}

              <button
                type="button"
                className={`${mobileLinkClass(false)} text-red-300`}
                onClick={() => {
                  setMobileOpen(false);
                  setProfileOpen(true);
                }}
              >
                <User className="h-5 w-5" />
                {isFieldOnly ? 'Account' : 'Account & settings'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ShareInviteModal isOpen={shareInviteOpen} onClose={() => setShareInviteOpen(false)} />
      <PilotSurveyModal isOpen={surveyOpen} onClose={() => setSurveyOpen(false)} />
    </>
  );
};

export default Navbar;
