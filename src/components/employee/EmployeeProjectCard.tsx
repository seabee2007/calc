import React from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, ChevronRight } from 'lucide-react';

interface EmployeeProjectCardProps {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
}

export default function EmployeeProjectCard({
  id,
  name,
  city,
  state,
}: EmployeeProjectCardProps) {
  const location = [city, state].filter(Boolean).join(', ');

  return (
    <Link
      to={`/projects/${id}/planner/board`}
      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-cyan-500/50 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-center gap-3 min-w-0">
        <FolderKanban className="h-8 w-8 shrink-0 text-cyan-400" />
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate dark:text-white">{name}</p>
          {location && <p className="text-xs text-slate-400">{location}</p>}
        </div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-slate-500" />
    </Link>
  );
}
