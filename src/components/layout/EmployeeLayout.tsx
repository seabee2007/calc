import React, { useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import EmployeeBottomNav from '../employee/EmployeeBottomNav';
import {
  EmployeePageTitleProvider,
  useEmployeePageTitleValue,
} from '../employee/EmployeePageTitleContext';
import FieldNotificationsBell from '../field/FieldNotificationsBell';
import { useAuth } from '../../hooks/useAuth';

function EmployeeLayoutHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const title = useEmployeePageTitleValue();
  const showBack = location.pathname !== '/employee/dashboard';

  return (
    <header
      className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {showBack ? (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : null}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
              Field portal
            </p>
            <p className="truncate text-base font-semibold text-white">{title}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <FieldNotificationsBell buttonClassName="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800" />
          <Link
            to="/employee/profile"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800"
            aria-label="Profile"
          >
            <User className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

const EmployeeLayout: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <EmployeePageTitleProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto flex min-h-screen max-w-lg flex-col">
          <EmployeeLayoutHeader />
          <main className="flex-1 px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom))]">
            <Outlet />
          </main>
          <EmployeeBottomNav />
        </div>
      </div>
    </EmployeePageTitleProvider>
  );
};

export default EmployeeLayout;
