import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { usePlannerProject } from '../../contexts/PlannerProjectContext';
import { PLANNER_MUTED, PLANNER_PAGE_BG } from '../../components/planner/plannerTheme';

export default function PlannerDocumentsPage() {
  const { project } = usePlannerProject();
  const [searchParams] = useSearchParams();
  const fileId = searchParams.get('file');

  return (
    <div className={`${PLANNER_PAGE_BG} flex flex-1 items-center justify-center p-6`}>
      <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <FileText className="mx-auto h-12 w-12 text-cyan-600 dark:text-cyan-400" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Documents</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
          Project document library and truck tickets will be organized here. Task photos and files
          are available on each task card on the Board.
        </p>
        {fileId && (
          <p className="mt-3 text-xs text-gray-500 dark:text-slate-500">File reference: {fileId}</p>
        )}
        {project && (
          <p className="mt-4 text-sm text-gray-700 dark:text-slate-300">{project.name}</p>
        )}
      </div>
    </div>
  );
}
