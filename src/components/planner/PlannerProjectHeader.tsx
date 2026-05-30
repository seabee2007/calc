import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, MoreVertical } from 'lucide-react';
import { usePlannerProject } from '../../contexts/PlannerProjectContext';
import { exportPlannerBoardJson, exportPlannerTasksCsv } from '../../utils/plannerExport';
import Button from '../ui/Button';

export default function PlannerProjectHeader() {
  const { project, bundle, isOwner, projectId } = usePlannerProject();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!project) return null;

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
      <Link
        to={`/projects?project=${projectId}`}
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to project
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {project.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-semibold text-cyan-900 dark:bg-cyan-950/60 dark:text-cyan-200">
              {project.statusLabel}
            </span>
            <span className="text-sm text-gray-600 dark:text-slate-400">{project.locationLabel}</span>
          </div>
        </div>

        {isOwner && bundle && (
          <div className="relative shrink-0">
            <Button
              size="sm"
              variant="outline"
              icon={<MoreVertical className="h-4 w-4" />}
              onClick={() => setMenuOpen((o) => !o)}
            >
              Actions
            </Button>
            {menuOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                    onClick={() => {
                      exportPlannerTasksCsv(bundle, project.name);
                      setMenuOpen(false);
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                    onClick={() => {
                      exportPlannerBoardJson(bundle, project.name);
                      setMenuOpen(false);
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Export JSON
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
