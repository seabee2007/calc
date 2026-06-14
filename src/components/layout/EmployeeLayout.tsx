import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import EmployeeBottomNav from '../employee/EmployeeBottomNav';
import { useAuth } from '../../hooks/useAuth';

const EmployeeLayout: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header
        className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
          Field portal
        </p>
        <p className="text-sm text-slate-400 truncate">{user?.email}</p>
      </header>
      <main className="mx-auto max-w-lg px-4 py-4 pb-24 pb-[calc(env(safe-area-inset-bottom)+6rem)]">
        <Outlet />
      </main>
      <EmployeeBottomNav />
    </div>
  );
};

export default EmployeeLayout;
