import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  Calculator,
  ClipboardCheck,
  Truck,
  MoreHorizontal,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const navItems = [
  { path: '/', label: 'Home', icon: LayoutDashboard, match: (p: string) => p === '/' },
  { path: '/projects', label: 'Projects', icon: FolderKanban, match: (p: string) => p.startsWith('/projects') },
  { path: '/calculator', label: 'Calc', icon: Calculator, match: (p: string) => p.startsWith('/calculator') },
  { path: '/qc', label: 'QC', icon: ClipboardCheck, match: (p: string) => p.startsWith('/qc') },
  { path: '/dispatch', label: 'Dispatch', icon: Truck, match: (p: string) => p.startsWith('/dispatch') },
  { path: '/settings', label: 'More', icon: MoreHorizontal, match: (p: string) => p === '/settings' },
];

const BottomNav: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  if (!user) return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 border-t border-slate-800 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Operations navigation"
    >
      <div className="flex justify-around items-center h-16 px-1">
        {navItems.map(({ path, label, icon: Icon, match }) => {
          const active = match(location.pathname);
          return (
            <Link
              key={path}
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
