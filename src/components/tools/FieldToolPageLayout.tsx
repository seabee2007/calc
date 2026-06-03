import React, { useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { plannerDocumentsHref } from '../../utils/plannerRoutes';
import { useProjectStore } from '../../store';
import { formatUSAddress, hasProjectJobsite } from '../../types/address';
import Select from '../ui/Select';
import { CC_PAGE_HERO_SUBTITLE, CC_PAGE_HERO_TITLE } from '../../theme/pageTypography';
import {
  FIELD_TOOL_ICON,
  FIELD_TOOL_ICON_WRAP,
  FIELD_TOOL_MUTED,
  FIELD_TOOL_PRINT_ROOT,
} from './fieldToolTheme';

interface FieldToolPageLayoutProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  children: React.ReactNode;
  actions: React.ReactNode;
  onProjectPrefill?: (projectId: string | null) => void;
  maxWidthClassName?: string;
}

export default function FieldToolPageLayout({
  title,
  subtitle,
  icon: Icon,
  children,
  actions,
  onProjectPrefill,
  maxWidthClassName = 'max-w-5xl',
}: FieldToolPageLayoutProps) {
  const [searchParams] = useSearchParams();
  const { projects, currentProject, setCurrentProject } = useProjectStore();
  const plannerProjectId = searchParams.get('project') ?? currentProject?.id ?? null;

  useEffect(() => {
    const projectId = searchParams.get('project');
    if (projectId) setCurrentProject(projectId);
  }, [searchParams, setCurrentProject]);

  useEffect(() => {
    onProjectPrefill?.(currentProject?.id ?? null);
  }, [currentProject?.id, onProjectPrefill]);

  return (
    <div className={`${maxWidthClassName} mx-auto pb-8 ${FIELD_TOOL_PRINT_ROOT}`}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .${FIELD_TOOL_PRINT_ROOT}, .${FIELD_TOOL_PRINT_ROOT} * { visibility: visible; }
          .${FIELD_TOOL_PRINT_ROOT} { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>

      {plannerProjectId && (
        <Link
          to={plannerDocumentsHref(plannerProjectId)}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-400 print:hidden"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to documents
        </Link>
      )}

      <header className="mb-6 flex gap-4 items-start print:hidden">
        <span className={FIELD_TOOL_ICON_WRAP}>
          <Icon className={FIELD_TOOL_ICON} aria-hidden />
        </span>
        <div>
          <h1 className={CC_PAGE_HERO_TITLE}>{title}</h1>
          <p className={CC_PAGE_HERO_SUBTITLE}>{subtitle}</p>
        </div>
      </header>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white/90 p-4 shadow-lg dark:border-slate-600 dark:bg-gray-800/90 print:hidden">
        <Select
          label="Project (saved to Planner → Documents)"
          options={[
            { value: '', label: 'Select a project…' },
            ...projects.map((p) => ({ value: p.id, label: p.name })),
          ]}
          value={currentProject?.id || ''}
          onChange={(id) => {
            setCurrentProject(id || null);
            onProjectPrefill?.(id || null);
          }}
          fullWidth
        />
        {currentProject && (
          <>
            <p className="mt-2 text-sm text-cyan-700 dark:text-cyan-300">
              Saves appear under{' '}
              <Link
                to={plannerDocumentsHref(currentProject.id)}
                className="font-medium underline hover:text-cyan-800 dark:hover:text-cyan-200"
              >
                Planner → Documents
              </Link>{' '}
              for {currentProject.name}.
            </p>
            {hasProjectJobsite(currentProject.jobsiteAddress) && (
              <p className={`mt-1 ${FIELD_TOOL_MUTED}`}>
                Jobsite: {formatUSAddress(currentProject.jobsiteAddress!)}
              </p>
            )}
          </>
        )}
      </div>

      <div className="space-y-5">{children}</div>
      {actions}
    </div>
  );
}
