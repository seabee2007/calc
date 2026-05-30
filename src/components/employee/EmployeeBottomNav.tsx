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
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-950/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Employee navigation"
    >
      <div className="flex justify-around items-center h-16">
        {items.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path || location.pathname.startsWith(`${path}/`);
          return (
            <Link
              key={path}
              to={path}
              className={`flex min-w-[56px] flex-col items-center justify-center gap-0.5 px-1 py-2 text-xs ${
                active ? 'text-cyan-400' : 'text-slate-500'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
