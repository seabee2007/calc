import React from 'react';
import { Link } from 'react-router-dom';
import { FilePlus } from 'lucide-react';

export default function EmployeeDraftChangeOrderPage() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <FilePlus className="h-8 w-8 shrink-0 text-cyan-400" aria-hidden />
        <h1 className="text-xl font-bold text-white">Draft change order</h1>
      </div>
      <p className="text-sm text-slate-400">
        Draft change orders from the field are coming soon. For now, contact your project manager or
        use the planner change order workflow from an admin account.
      </p>
      <Link
        to="/employee/dashboard"
        className="mt-6 inline-block text-sm font-medium text-cyan-400 hover:text-cyan-300"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
