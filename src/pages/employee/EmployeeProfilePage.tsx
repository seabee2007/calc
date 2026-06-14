import React from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function EmployeeProfilePage() {
  const { user, profile } = useAuth();

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-white">Profile</h1>
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
    </div>
  );
}
