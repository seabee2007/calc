import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderPlus,
  Wrench,
  FolderKanban,
  MoreHorizontal,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToolsModalStore } from '../../store/toolsModalStore';
import { useMoreMenuStore } from '../../store/moreMenuStore';
import { workflowQuery } from '../../utils/workflow';

const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const openTools = useToolsModalStore((s) => s.open);
  const openMore = useMoreMenuStore((s) => s.open);

  if (!user) return null;

  const startPath = '/projects';

  const linkItems = [
    {
      path: '/',
      label: 'Dashboard',
      icon: LayoutDashboard,
      match: (p: string) => p === '/' || p === '/dispatch' || p === '/qc',
      onClick: undefined as (() => void) | undefined,
    },
    {
      path: startPath,
      label: 'Start',
      icon: FolderPlus,
      match: (p: string) => p.startsWith('/projects'),
      onClick: () => {
        navigate('/projects', { state: { openCreate: true } });
      },
    },
    {
      path: '',
      label: 'Tools',
      icon: Wrench,
      match: () => false,
      onClick: openTools,
    },
    {
      path: '/projects',
      label: 'Projects',
      icon: FolderKanban,
      match: (p: string) => p.startsWith('/projects'),
      onClick: () => {
        navigate('/projects', {
          state: { mode: 'browse', view: 'list' },
        });
      },
    },
    {
      path: '',
      label: 'More',
      icon: MoreHorizontal,
      match: (p: string) => p === '/settings' || p.startsWith('/resources'),
      onClick: openMore,
    },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 border-t border-slate-800 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Operations navigation"
    >
      <div className="flex justify-around items-center h-16 px-1">
        {linkItems.map(({ path, label, icon: Icon, match, onClick }) => {
          const active = match(location.pathname);
          if (onClick) {
            return (
              <button
                key={label}
                type="button"
                onClick={onClick}
                className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 ${
                  active ? 'text-cyan-400' : 'text-slate-500'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? 'scale-110' : ''}`} />
                <span className="text-[10px] mt-0.5 font-medium truncate w-full text-center">
                  {label}
                </span>
              </button>
            );
          }
          return (
            <Link
              key={path + label}
              to={path}
              className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 ${
                active ? 'text-cyan-400' : 'text-slate-500'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'scale-110' : ''}`} />
              <span className="text-[10px] mt-0.5 font-medium truncate w-full text-center">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
