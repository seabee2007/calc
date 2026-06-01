import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, FileSignature, FileText, Plus, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import { usePlannerProject } from '../../contexts/PlannerProjectContext';
import { listSafetyMeetingsForProject } from '../../services/safetyMeetingService';
import { listConcreteInspectionsForProject } from '../../services/concreteInspectionService';
import { listContractDocuments } from '../../features/documents/services/contractDocumentService';
import type { ContractDocumentRow } from '../../features/documents/services/contractDocumentTypes';
import type { SafetyMeeting } from '../../types/fieldTools';
import type { ConcreteInspectionChecklist } from '../../types/fieldTools';
import {
  concreteInspectionToolHref,
  contractBuilderToolHref,
  safetyMeetingToolHref,
} from '../../utils/plannerRoutes';
import Button from '../../components/ui/Button';
import {
  PLANNER_MUTED,
  PLANNER_PAGE_BG,
  PLANNER_SECTION_TITLE,
  PLANNER_TABLE,
  PLANNER_TABLE_HEAD,
  PLANNER_TABLE_ROW,
  PLANNER_TABLE_ROW_HIGHLIGHT,
  PLANNER_TABLE_WRAPPER,
} from '../../components/planner/plannerTheme';

function formatDocDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso + 'T12:00:00'), 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

function formatSigningMeta(doc: ContractDocumentRow): string {
  const status = doc.signing_status ?? 'draft';
  if (status === 'signed') return 'Signed';
  if (status === 'sent' || status === 'viewed') return 'Awaiting client signature';
  if (status === 'declined') return 'Declined';
  if (status === 'void') return 'Void';
  return `Draft · v${doc.latest_version_number}`;
}

export default function PlannerDocumentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projectId, project } = usePlannerProject();
  const [searchParams] = useSearchParams();
  const highlightSafety = searchParams.get('safety');
  const highlightInspection = searchParams.get('inspection');
  const highlightContract = searchParams.get('contract');

  const [safetyMeetings, setSafetyMeetings] = useState<SafetyMeeting[]>([]);
  const [inspections, setInspections] = useState<ConcreteInspectionChecklist[]>([]);
  const [contracts, setContracts] = useState<ContractDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id || !projectId) return;
    setLoading(true);
    try {
      const [meetings, checklists, contractRows] = await Promise.all([
        listSafetyMeetingsForProject(projectId, user.id),
        listConcreteInspectionsForProject(projectId, user.id),
        listContractDocuments(projectId),
      ]);
      setSafetyMeetings(meetings);
      setInspections(checklists);
      setContracts(contractRows);
    } finally {
      setLoading(false);
    }
  }, [projectId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const renderTable = (
    rows: { id?: string; date: string; title: string; meta: string }[],
    empty: string,
    highlightId: string | null,
    buildHref: (id: string) => string,
  ) => {
    if (rows.length === 0) {
      return <p className={`${PLANNER_MUTED} py-2 text-sm`}>{empty}</p>;
    }
    return (
      <div className={PLANNER_TABLE_WRAPPER}>
        <table className={PLANNER_TABLE}>
          <thead>
            <tr className={PLANNER_TABLE_HEAD}>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Title</th>
              <th className="px-4 py-3 font-semibold">Details</th>
              <th className="px-4 py-3 font-semibold text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (!row.id) return null;
              const highlighted = highlightId === row.id;
              return (
                <tr
                  key={row.id}
                  className={`${PLANNER_TABLE_ROW} ${
                    highlighted ? PLANNER_TABLE_ROW_HIGHLIGHT : ''
                  }`}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-gray-900 dark:text-white">
                    {row.date}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.title}</td>
                  <td className={`px-4 py-3 ${PLANNER_MUTED}`}>{row.meta}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={buildHref(row.id)}
                      className="text-sm font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className={`${PLANNER_PAGE_BG} flex min-h-0 flex-1 flex-col`}>
      <div className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Documents</h2>
            <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>
              Safety meetings, contracts, and concrete inspection checklists saved for{' '}
              {project?.name ?? 'this project'}.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
          </div>
        )}

        {!loading && (
          <>
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileSignature className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  <h3 className={PLANNER_SECTION_TITLE}>Contracts</h3>
                </div>
                <Button
                  variant="accent"
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => navigate(contractBuilderToolHref(projectId))}
                >
                  New contract
                </Button>
              </div>
              {renderTable(
                contracts.map((c) => ({
                  id: c.id,
                  date: formatDocDate(c.updated_at),
                  title: c.title,
                  meta: formatSigningMeta(c),
                })),
                'No contracts saved for this project yet.',
                highlightContract,
                (id) => contractBuilderToolHref(projectId, id),
              )}
            </section>

            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  <h3 className={PLANNER_SECTION_TITLE}>Safety meetings</h3>
                </div>
                <Button
                  variant="accent"
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => navigate(safetyMeetingToolHref(projectId))}
                >
                  New safety meeting
                </Button>
              </div>
              {renderTable(
                safetyMeetings.map((m) => ({
                  id: m.id,
                  date: formatDocDate(m.meetingDate),
                  title: m.projectName || 'Safety meeting',
                  meta: m.supervisor ? `Supervisor: ${m.supervisor}` : m.workActivity || '—',
                })),
                'No safety meetings saved for this project yet.',
                highlightSafety,
                (id) => safetyMeetingToolHref(projectId, id),
              )}
            </section>

            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  <h3 className={PLANNER_SECTION_TITLE}>QC checklists</h3>
                </div>
                <Button
                  variant="accent"
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => navigate(concreteInspectionToolHref(projectId))}
                >
                  New checklist
                </Button>
              </div>
              {renderTable(
                inspections.map((c) => ({
                  id: c.id,
                  date: formatDocDate(c.inspectionDate),
                  title: c.projectName || 'Concrete inspection',
                  meta: c.inspector ? `Inspector: ${c.inspector}` : c.mixDesign || '—',
                })),
                'No inspection checklists saved for this project yet.',
                highlightInspection,
                (id) => concreteInspectionToolHref(projectId, id),
              )}
            </section>

            <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-4 dark:border-slate-600 dark:bg-slate-800/40">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" />
                <p className={`text-sm ${PLANNER_MUTED}`}>
                  Task photos and attachments remain on each task on the Board. Link a project in the
                  field tools when saving so records appear here.
                </p>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
