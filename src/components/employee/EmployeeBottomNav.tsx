import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ListTodo, Upload, MessageSquare, FolderKanban } from 'lucide-react';

const items = [
  { path: '/employee/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/employee/tasks', label: 'Tasks', icon: ListTodo },
  { path: '/employee/uploads', label: 'Upload', icon: Upload },
  { path: '/employee/messages', label: 'Messages', icon: MessageSquare },
  { path: '/employee/projects', label: 'Projects', icon: FolderKanban },
];

export default function EmployeeBottomNav() {
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-950/95 backdrop-blur-md pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
      aria-label="Employee navigation"
    >
      <div className="flex items-stretch justify-around min-h-16">
        {items.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path || location.pathname.startsWith(`${path}/`);
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
      </div>
    </nav>
  );
}
