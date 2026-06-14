import React from 'react';
import { Info, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export type CalculatorToolKind = 'helper' | 'legacy';

interface Props {
  kind: CalculatorToolKind;
  projectId?: string | null;
  className?: string;
}

function estimateWorkspaceHref(projectId?: string | null): string {
  if (projectId) {
    return `/projects/${projectId}/planner/estimate`;
  }
  return '/projects';
}

const noticeShell =
  'mb-6 rounded-lg border p-4 text-sm leading-relaxed text-slate-700 dark:text-slate-200';

export default function CalculatorToolNotice({ kind, projectId, className = '' }: Props) {
  const workspaceLink = (
    <Link
      to={estimateWorkspaceHref(projectId)}
      className="font-medium text-cyan-700 underline underline-offset-2 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200"
    >
      Estimate Workspace
    </Link>
  );

  if (kind === 'legacy') {
    return (
      <div
        className={`${noticeShell} border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 ${className}`}
        role="status"
      >
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p>
            This tool is being replaced by Estimate Workspace activity line items. For full project
            estimates, use the {workspaceLink}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${noticeShell} border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40 ${className}`}
      role="status"
    >
      <div className="flex gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <p>Quick calculator only. For proposal-ready pricing, use the {workspaceLink}.</p>
      </div>
    </div>
  );
}
