import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { logoutAndRedirect } from '../../services/appLogout';
import { useAuth } from '../../hooks/useAuth';
import { useEmployeePageTitle } from '../../components/employee/EmployeePageTitleContext';
import Button from '../../components/ui/Button';

export default function EmployeeProfilePage() {
  useEmployeePageTitle('Profile');
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  const handleSignOut = () => {
    void logoutAndRedirect(signOut, navigate);
  };

  return (
    <div className="space-y-6">
      <dl className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Name</dt>
          <dd className="mt-1 text-sm text-white">{profile?.displayName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Email</dt>
          <dd className="mt-1 text-sm text-white">{user?.email ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Phone</dt>
          <dd className="mt-1 text-sm text-white">{profile?.phone ?? '—'}</dd>
        </div>
      </dl>

      <Button
        type="button"
        variant="outline"
        fullWidth
        className="min-h-[48px] border-red-500/40 text-red-300 hover:border-red-500/60 hover:bg-red-950/30"
        icon={<LogOut className="h-4 w-4" />}
        onClick={handleSignOut}
      >
        Sign out
      </Button>
    </div>
  );
}
