import React, { useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import type { DocumentsTabId } from '../planner/documents/documentsTabConfig';
import { plannerDocumentsHref } from '../../utils/plannerRoutes';
import { useProjectStore } from '../../store';
import { formatUSAddress, hasProjectJobsite } from '../../types/address';
import Select from '../ui/Select';
import { CC_PAGE_HERO_SUBTITLE, CC_PAGE_HERO_TITLE } from '../../theme/pageTypography';
import { PREMIUM_PANEL } from '../../theme/appTheme';
import {
  FIELD_TOOL_ICON,
  FIELD_TOOL_ICON_WRAP,
  FIELD_TOOL_MUTED,
  FIELD_TOOL_PAGE_WIDTH,
  FIELD_TOOL_PRINT_ROOT,
} from './fieldToolTheme';

export type FieldToolPlannerReturn = {
  tab: DocumentsTabId;
  label: string;
};

interface FieldToolPageLayoutProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  children: React.ReactNode;
  actions: React.ReactNode;
  onProjectPrefill?: (projectId: string | null) => void;
  maxWidthClassName?: string;
  /** When set, back link targets this Documents sub-tab and hides generic save-location copy. */
  plannerReturn?: FieldToolPlannerReturn;
}

export default function FieldToolPageLayout({
  title,
  subtitle,
  icon: Icon,
  children,
  actions,
  onProjectPrefill,
  maxWidthClassName = FIELD_TOOL_PAGE_WIDTH,
  plannerReturn,
}: FieldToolPageLayoutProps) {
  const [searchParams] = useSearchParams();
  const { projects, currentProject, setCurrentProject } = useProjectStore();
  const plannerProjectId = searchParams.get('project') ?? currentProject?.id ?? null;
  const backHref = plannerProjectId
    ? plannerDocumentsHref(
        plannerProjectId,
        plannerReturn ? { tab: plannerReturn.tab } : undefined,
      )
    : null;

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

      {backHref && (
        <Link
          to={backHref}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-400 print:hidden"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {plannerReturn ? `Back to ${plannerReturn.label}` : 'Back to documents'}
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

      <div className={`mb-6 p-4 ${PREMIUM_PANEL} print:hidden`}>
        <Select
          label="Project"
          helperText={
            plannerReturn
              ? undefined
              : 'Saved documents appear under Planner → Documents.'
          }
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
        {currentProject && hasProjectJobsite(currentProject.jobsiteAddress) && (
          <p className={`mt-2 ${FIELD_TOOL_MUTED}`}>
            Jobsite: {formatUSAddress(currentProject.jobsiteAddress!)}
          </p>
        )}
      </div>

      <div className="space-y-5">{children}</div>
      {actions}
    </div>
  );
}
