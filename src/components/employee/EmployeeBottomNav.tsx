import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  ListTodo,
  Upload,
  MoreHorizontal,
  MessageSquare,
  FolderKanban,
  FileQuestion,
  AlertTriangle,
  ClipboardCheck,
  FolderOpen,
  User,
  X,
} from 'lucide-react';

const primaryItems = [
  { path: '/employee/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/employee/planner', label: 'Planner', icon: CalendarDays },
  { path: '/employee/tasks', label: 'Tasks', icon: ListTodo },
  { path: '/employee/uploads', label: 'Upload', icon: Upload },
] as const;

const moreItems = [
  { path: '/employee/schedule', label: 'Schedule', icon: CalendarDays },
  { path: '/employee/rfi', label: 'RFI', icon: FileQuestion },
  { path: '/employee/far', label: 'FAR', icon: AlertTriangle },
  { path: '/employee/qc', label: 'QC', icon: ClipboardCheck },
  { path: '/employee/documents', label: 'Documents', icon: FolderOpen },
  { path: '/employee/projects', label: 'Projects', icon: FolderKanban },
  { path: '/employee/messages', label: 'Messages', icon: MessageSquare },
  { path: '/employee/profile', label: 'Profile', icon: User },
] as const;

const MORE_ROUTE_PREFIXES = [
  '/employee/schedule',
  '/employee/rfi',
  '/employee/far',
  '/employee/qc',
  '/employee/documents',
  '/employee/projects',
  '/employee/messages',
  '/employee/profile',
  '/employee/more',
  '/employee/calculator',
  '/employee/safety-meeting',
  '/employee/draft-change-order',
];

function isActivePath(pathname: string, path: string): boolean {
  if (path === '/employee/tasks') {
    return pathname === path || pathname.startsWith('/employee/tasks/');
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

function isMoreRoute(pathname: string): boolean {
  return MORE_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default function EmployeeBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreActive = isMoreRoute(location.pathname);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moreOpen]);

  return (
    <>
      {moreOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px]"
          onClick={() => setMoreOpen(false)}
        />
      ) : null}

      {moreOpen ? (
        <div
          role="dialog"
          aria-label="More navigation"
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] left-4 right-4 z-50 mx-auto max-w-lg overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <p className="text-sm font-semibold text-white">More</p>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            {moreItems.map(({ path, label, icon: Icon }) => {
              const active = isActivePath(location.pathname, path);
              return (
                <button
                  key={path}
                  type="button"
                  onClick={() => navigate(path)}
                  className={`flex min-h-[72px] flex-col items-center justify-center gap-2 rounded-xl px-3 py-3 text-center text-sm font-medium touch-manipulation ${
                    active
                      ? 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/40'
                      : 'bg-slate-800/80 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Icon className={`h-6 w-6 ${active ? 'text-cyan-400' : 'text-slate-400'}`} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-950/95 backdrop-blur-md pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
        aria-label="Employee navigation"
      >
        <div className="mx-auto flex min-h-16 max-w-lg items-stretch justify-around">
          {primaryItems.map(({ path, label, icon: Icon }) => {
            const active = isActivePath(location.pathname, path);
            return (
              <Link
                key={path}
                to={path}
                className={`flex min-h-[56px] min-w-[64px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium touch-manipulation ${
                  active
                    ? 'text-cyan-400'
                    : 'text-slate-500 hover:text-slate-300 active:text-cyan-300'
                }`}
              >
                <Icon className={`h-6 w-6 ${active ? 'text-cyan-400' : ''}`} aria-hidden />
                <span className="leading-tight">{label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className={`flex min-h-[56px] min-w-[64px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium touch-manipulation ${
              moreActive || moreOpen
                ? 'text-cyan-400'
                : 'text-slate-500 hover:text-slate-300 active:text-cyan-300'
            }`}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
          >
            <MoreHorizontal
              className={`h-6 w-6 ${moreActive || moreOpen ? 'text-cyan-400' : ''}`}
              aria-hidden
            />
            <span className="leading-tight">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
