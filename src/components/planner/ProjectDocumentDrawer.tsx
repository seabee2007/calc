import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useProjectStore, useSettingsStore } from '../../store';
import {
  getProjectDocument,
  saveProjectDocumentWorkflowAnswers,
} from '../../services/projectDocumentService';
import { restoreBuilderStateFromSnapshot } from '../../features/documents/ui/contractVersionState';
import {
  companySettingsFromDocumentSnapshot,
  extractDocumentNumber,
} from '../../services/projectDocumentSnapshots';
import {
  formatWorkflowStatusLabel,
  getBuilderDocumentWorkflowStatus,
} from '../../services/builderWorkflowStatus';
import {
  getDocumentWorkflowFieldSections,
  getDocumentWorkflowStatusOptions,
  getPlannerDocumentDrawerMeta,
  normalizePlannerDocumentType,
} from '../../services/documentWorkflowConfig';
import { exportProjectDocumentPdf } from '../../services/exportProjectDocumentPdf';
import {
  getProjectDocumentDisplayMeta,
  resolveEffectiveDocumentType,
} from '../../services/projectDocumentDisplay';
import {
  resolveFarDisplayNumber,
  resolveRfiDisplayNumber,
} from '../../services/projectRecordNumbering';
import { contractBuilderToolHref } from '../../utils/plannerRoutes';
import {
  dispatchPlannerRecordsChanged,
  type PlannerRecordKind,
} from '../../utils/plannerRecordsRefresh';
import Button from '../ui/Button';
import Toast from '../ui/Toast';
import FieldRecordStatusBadge from '../field/FieldRecordStatusBadge';
import {
  PLANNER_CLOSE_BTN,
  PLANNER_DRAWER_BACKDROP,
  PLANNER_DRAWER_FOOTER,
  PLANNER_DRAWER_HEADER,
  PLANNER_DRAWER_PANEL,
  PLANNER_DRAWER_TITLE,
  PLANNER_FORM_LABEL,
  PLANNER_INPUT,
  PLANNER_SECTION_TITLE,
} from './plannerTheme';
import {
  answerDisplayValue,
  formatPlannerDisplayValue,
  str,
} from './documents/plannerDocumentFormat';
import { ProjectDocumentDrawerExtraSections } from './documents/projectDocumentDrawerExtras';
import type { WorkflowFieldDef } from '../../services/documentWorkflowConfig';

interface Props {
  documentId: string | null;
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}

const SECTION_CARD =
  'mb-4 rounded-xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/50';

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  if (value === '—' || value === null || value === undefined) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900 dark:text-white">{value}</dd>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={SECTION_CARD}>
      <h3 className={`mb-3 ${PLANNER_SECTION_TITLE}`}>{title}</h3>
      {children}
    </section>
  );
}

function resolveDrawerDocNumber(
  document: { document_number?: string | null; title?: string },
  documentType: string,
  answers: Record<string, unknown>,
): string {
  const t = normalizePlannerDocumentType(documentType);
  if (t === 'rfi') {
    return resolveRfiDisplayNumber(document, answers);
  }
  if (t === 'far') {
    return resolveFarDisplayNumber(document, answers);
  }
  const num = extractDocumentNumber(documentType, answers);
  return num || document.document_number?.trim() || '—';
}

function renderReadonlyFields(
  fields: WorkflowFieldDef[],
  answers: Record<string, unknown>,
) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => (
        <DetailRow
          key={f.key}
          label={f.label}
          value={answerDisplayValue(answers, f.key)}
        />
      ))}
    </dl>
  );
}

export default function ProjectDocumentDrawer({
  documentId,
  projectId,
  onClose,
  onSaved,
}: Props) {
  const projects = useProjectStore((s) => s.projects);
  const settingsCompany = useSettingsStore((s) => s.companySettings);

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [docNumber, setDocNumber] = useState('—');
  const [status, setStatus] = useState('Draft');
  const [documentType, setDocumentType] = useState('residential_contract');
  const [packKey, setPackKey] = useState<string | undefined>();
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [editable, setEditable] = useState<Record<string, string>>({});
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [versionLabel, setVersionLabel] = useState('—');
  const [savedContractStatus, setSavedContractStatus] = useState('—');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; message?: string } | null>(null);

  const selectedProject = projects.find((p) => p.id === projectId) ?? null;
  const projectName = selectedProject?.name ?? '';
  const displayMeta = getProjectDocumentDisplayMeta({
    document_type: documentType,
    pack_key: packKey ?? '',
  });
  const drawerMeta = getPlannerDocumentDrawerMeta(documentType);
  const fieldSections = getDocumentWorkflowFieldSections(documentType);
  const statusOptions = getDocumentWorkflowStatusOptions(documentType);

  const load = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    setError(null);
    try {
      const { document, versions } = await getProjectDocument(documentId);
      const effectiveType = resolveEffectiveDocumentType(document);
      setTitle(document.title);
      setDocumentType(effectiveType);
      setPackKey(document.pack_key);
      setUpdatedAt(document.updated_at ?? null);
      setSavedContractStatus(formatPlannerDisplayValue(document.status));

      const current =
        versions.find((v) => v.id === document.current_version_id) ?? versions[0];
      if (!current) return;

      const state = restoreBuilderStateFromSnapshot(current.input_snapshot);
      const a = state.answers;
      setAnswers(a);

      setDocNumber(resolveDrawerDocNumber(document, effectiveType, a));
      setVersionLabel(
        versions.length > 0
          ? `${versions.length} version${versions.length === 1 ? '' : 's'}`
          : '—',
      );

      const workflowStatus = getBuilderDocumentWorkflowStatus(
        document,
        str(a.status) || undefined,
      );
      setStatus(formatWorkflowStatusLabel(workflowStatus));

      const sections = getDocumentWorkflowFieldSections(effectiveType);
      const editState: Record<string, string> = {};
      for (const f of sections.editableKeys) {
        editState[f.key] = str(a[f.key]);
      }
      setEditable(editState);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load document');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const buildPartialAnswers = (): Record<string, unknown> => {
    const partial: Record<string, unknown> = { status };
    for (const [key, value] of Object.entries(editable)) {
      partial[key] = value;
    }
    return partial;
  };

  const handleSave = async () => {
    if (!documentId) return;
    setBusy(true);
    setError(null);
    try {
      const partial = buildPartialAnswers();
      const { document } = await getProjectDocument(documentId);
      const company = companySettingsFromDocumentSnapshot(document.company_snapshot);
      await saveProjectDocumentWorkflowAnswers(documentId, partial, {
        companySettings: { ...settingsCompany, ...company },
        selectedProject,
      });
      setToast({
        title: 'Saved',
        message: drawerMeta.saveLabel + ' — workflow updated in a new document version.',
      });
      const kindMap: Record<string, PlannerRecordKind | undefined> = {
        rfi: 'rfi',
        far: 'far',
        change_order: 'change_order',
      };
      const kind = kindMap[normalizePlannerDocumentType(documentType)];
      if (kind) {
        console.log(`[${kind.toUpperCase()} Save] refresh planner side panels`);
        dispatchPlannerRecordsChanged({ kind, projectId, id: documentId });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const handleExportPdf = async () => {
    if (!documentId) return;
    setBusy(true);
    try {
      const { document } = await getProjectDocument(documentId);
      const company = companySettingsFromDocumentSnapshot(document.company_snapshot);
      await exportProjectDocumentPdf({
        documentId,
        mergedAnswers: buildPartialAnswers(),
        selectedProject,
        companySettings: { ...settingsCompany, ...company },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  if (!documentId) return null;

  const builderHref = contractBuilderToolHref(projectId, documentId, {
    packKey: packKey ?? undefined,
    documentType,
  });

  const preparedBy =
    answerDisplayValue(answers, 'preparedBy') !== '—'
      ? answerDisplayValue(answers, 'preparedBy')
      : answerDisplayValue(answers, 'submittedBy');

  return createPortal(
    <>
      <AnimatePresence>
        <motion.div
          className={PLANNER_DRAWER_BACKDROP}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            className={`${PLANNER_DRAWER_PANEL} h-full max-w-xl`}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className={PLANNER_DRAWER_HEADER}>
              <div className="min-w-0 flex-1 pr-2">
                <h2 className={PLANNER_DRAWER_TITLE}>{displayMeta.label}</h2>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-mono text-xs text-cyan-700 dark:text-cyan-400">
                    {docNumber}
                  </span>
                  <span className="text-slate-400">·</span>
                  <FieldRecordStatusBadge status={status} />
                </p>
                {projectName ? (
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {status} · {projectName}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className={PLANNER_CLOSE_BTN}
                onClick={onClose}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : (
                <>
                  {error ? (
                    <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                      {error}
                    </p>
                  ) : null}

                  <SectionCard title="Document Summary">
                    <dl className="grid gap-3 sm:grid-cols-2">
                      <DetailRow label="Title" value={formatPlannerDisplayValue(title)} />
                      <DetailRow label="Number" value={docNumber} />
                      <DetailRow
                        label="Last updated"
                        value={
                          updatedAt ? new Date(updatedAt).toLocaleString() : '—'
                        }
                      />
                      <DetailRow label="Prepared / submitted by" value={preparedBy} />
                    </dl>
                  </SectionCard>

                  {fieldSections.summaryKeys.length > 0 ? (
                    <SectionCard title="Summary details">
                      {renderReadonlyFields(fieldSections.summaryKeys, answers)}
                    </SectionCard>
                  ) : null}

                  <ProjectDocumentDrawerExtraSections
                    documentType={documentType}
                    answers={answers}
                    title={title}
                  />

                  {fieldSections.detailKeys.length > 0 ? (
                    <SectionCard title="Key details">
                      {renderReadonlyFields(fieldSections.detailKeys, answers)}
                    </SectionCard>
                  ) : null}

                  <SectionCard title="Workflow status">
                    <label className="block">
                      <span className={PLANNER_FORM_LABEL}>Status</span>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className={`${PLANNER_INPUT} mt-1 w-full`}
                      >
                        {statusOptions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                  </SectionCard>

                  <SectionCard title={drawerMeta.notesSectionTitle}>
                    <div className="space-y-3">
                      {fieldSections.editableKeys.map((f) =>
                        f.kind === 'editable-textarea' ? (
                          <label key={f.key} className="block">
                            <span className={PLANNER_FORM_LABEL}>{f.label}</span>
                            <textarea
                              value={editable[f.key] ?? ''}
                              onChange={(e) =>
                                setEditable((prev) => ({ ...prev, [f.key]: e.target.value }))
                              }
                              rows={4}
                              className={`${PLANNER_INPUT} mt-1 w-full`}
                            />
                          </label>
                        ) : (
                          <label key={f.key} className="block">
                            <span className={PLANNER_FORM_LABEL}>{f.label}</span>
                            <input
                              value={editable[f.key] ?? ''}
                              onChange={(e) =>
                                setEditable((prev) => ({ ...prev, [f.key]: e.target.value }))
                              }
                              className={`${PLANNER_INPUT} mt-1 w-full`}
                            />
                          </label>
                        ),
                      )}
                    </div>
                  </SectionCard>

                  <SectionCard title="Version / Activity">
                    <dl className="grid gap-3 sm:grid-cols-2">
                      <DetailRow label="Document versions" value={versionLabel} />
                      <DetailRow label="Saved contract status" value={savedContractStatus} />
                    </dl>
                  </SectionCard>
                </>
              )}
            </div>

            <footer className={`${PLANNER_DRAWER_FOOTER} shrink-0`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  size="sm"
                  variant="accent"
                  className="w-full sm:flex-1"
                  onClick={() => void handleSave()}
                  isLoading={busy}
                >
                  {drawerMeta.saveLabel}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => void handleExportPdf()}
                  disabled={busy || loading}
                >
                  Export PDF
                </Button>
                <Link
                  to={builderHref}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-cyan-700 hover:bg-slate-50 dark:border-slate-600 dark:text-cyan-400 dark:hover:bg-slate-800 sm:w-auto"
                >
                  Open in Document Builder
                </Link>
                <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={onClose}>
                  Close
                </Button>
              </div>
            </footer>
          </motion.aside>
        </motion.div>
      </AnimatePresence>

      {toast ? (
        <Toast
          id="project-document-drawer-toast"
          title={toast.title}
          message={toast.message}
          type="success"
          onClose={() => setToast(null)}
        />
      ) : null}
    </>,
    document.body,
  );
}
