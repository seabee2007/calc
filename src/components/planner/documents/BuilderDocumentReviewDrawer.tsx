import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useProjectStore, useSettingsStore } from '../../../store';
import {
  getProjectDocument,
  saveProjectDocumentWorkflowAnswers,
} from '../../../services/projectDocumentService';
import { restoreBuilderStateFromSnapshot } from '../../../features/documents/ui/contractVersionState';
import { buildRfiPreviewFromDocumentAnswers } from '../../../features/documents/ui/adapters/rfiPreviewAdapter';
import { buildFarPreviewFromDocumentAnswers } from '../../../features/documents/ui/adapters/farPreviewAdapter';
import { generateRfiPDF } from '../../../features/documents/ui/pdf/rfiPdf';
import { generateFarPDF } from '../../../features/documents/ui/pdf/farPdf';
import { companySettingsFromDocumentSnapshot } from '../../../services/projectDocumentSnapshots';
import {
  formatWorkflowStatusLabel,
  workflowStatusesForKind,
} from '../../../services/builderWorkflowStatus';
import { contractBuilderToolHref } from '../../../utils/plannerRoutes';
import Button from '../../ui/Button';
import Toast from '../../ui/Toast';
import FieldRecordStatusBadge from '../../field/FieldRecordStatusBadge';
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
} from '../plannerTheme';

interface Props {
  documentId: string | null;
  projectId: string;
  kind: 'rfi' | 'far';
  onClose: () => void;
  onSaved: () => void;
}

const SECTION_CARD =
  'mb-4 rounded-xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/50';

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function formatDisplayValue(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t || t === 'undefined' || t === 'null') return '—';
    if (t.startsWith('{') || t.startsWith('[')) return '—';
    return t;
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '—';
}

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

export default function BuilderDocumentReviewDrawer({
  documentId,
  projectId,
  kind,
  onClose,
  onSaved,
}: Props) {
  const projects = useProjectStore((s) => s.projects);
  const settingsCompany = useSettingsStore((s) => s.companySettings);

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [status, setStatus] = useState('Draft');
  const [response, setResponse] = useState('');
  const [respondedBy, setRespondedBy] = useState('');
  const [responseDate, setResponseDate] = useState('');
  const [reviewerResponse, setReviewerResponse] = useState('');
  const [reviewedBy, setReviewedBy] = useState('');
  const [approvalDecision, setApprovalDecision] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; message?: string } | null>(null);

  const [packKey, setPackKey] = useState<string | undefined>();
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [versionLabel, setVersionLabel] = useState('—');
  const [savedContractStatus, setSavedContractStatus] = useState('—');

  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [submittedBy, setSubmittedBy] = useState('');
  const [requestedBy, setRequestedBy] = useState('');
  const [submittedTo, setSubmittedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('');
  const [location, setLocation] = useState('');
  const [drawingRef, setDrawingRef] = useState('');
  const [specRef, setSpecRef] = useState('');
  const [costImpact, setCostImpact] = useState('');
  const [scheduleImpact, setScheduleImpact] = useState('');
  const [relatedRfi, setRelatedRfi] = useState('');
  const [relatedFar, setRelatedFar] = useState('');
  const [relatedChangeOrder, setRelatedChangeOrder] = useState('');

  const selectedProject = projects.find((p) => p.id === projectId) ?? null;
  const projectName = selectedProject?.name ?? '';

  const load = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    setError(null);
    try {
      const { document, versions } = await getProjectDocument(documentId);
      setTitle(document.title);
      setDocNumber(formatDisplayValue(document.document_number));
      setPackKey(document.pack_key ?? (kind === 'rfi' ? 'GENERIC_RFI' : 'GENERIC_FAR'));
      setUpdatedAt(document.updated_at ?? null);
      setSavedContractStatus(formatDisplayValue(document.status));
      setVersionLabel(
        versions.length > 0
          ? `${versions.length} version${versions.length === 1 ? '' : 's'}`
          : '—',
      );

      const current =
        versions.find((v) => v.id === document.current_version_id) ?? versions[0];
      if (!current) return;
      const state = restoreBuilderStateFromSnapshot(current.input_snapshot);
      const a = state.answers;

      setStatus(
        formatWorkflowStatusLabel(
          str(a.status) || document.builder_workflow_status || 'Draft',
        ),
      );

      setSubmittedBy(formatDisplayValue(a.submittedBy));
      setSubmittedTo(formatDisplayValue(a.submittedTo));
      setRequestedBy(formatDisplayValue(a.requestedBy));
      setDueDate(formatDisplayValue(a.dueDate));
      setPriority(formatDisplayValue(a.priority));
      setLocation(formatDisplayValue(a.location));
      setCostImpact(formatDisplayValue(a.costImpact));
      setScheduleImpact(formatDisplayValue(a.scheduleImpact));
      setRelatedRfi(formatDisplayValue(a.relatedRfi));
      setRelatedFar(formatDisplayValue(a.relatedFar));
      setRelatedChangeOrder(formatDisplayValue(a.relatedChangeOrder));
      setDrawingRef(
        formatDisplayValue(a.drawingSpecReference) ||
          formatDisplayValue(a.drawingReference),
      );
      setSpecRef(formatDisplayValue(a.specReference));

      if (kind === 'rfi') {
        setQuestion(formatDisplayValue(a.question) || formatDisplayValue(a.rfiTitle));
        setResponse(str(a.response));
        setRespondedBy(str(a.respondedBy));
        setResponseDate(str(a.responseDate));
      } else {
        setDescription(formatDisplayValue(a.description) || formatDisplayValue(a.title));
        setReviewerResponse(str(a.reviewerResponse));
        setReviewedBy(str(a.reviewedBy));
        setResponseDate(str(a.responseDate));
        setApprovalDecision(str(a.approvalDecision));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load document');
    } finally {
      setLoading(false);
    }
  }, [documentId, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (!documentId) return;
    setBusy(true);
    setError(null);
    try {
      const partial: Record<string, unknown> = { status };
      if (kind === 'rfi') {
        partial.response = response;
        partial.respondedBy = respondedBy;
        partial.responseDate = responseDate;
      } else {
        partial.reviewerResponse = reviewerResponse;
        partial.reviewedBy = reviewedBy;
        partial.responseDate = responseDate;
        partial.approvalDecision = approvalDecision;
      }
      const { document } = await getProjectDocument(documentId);
      const company = companySettingsFromDocumentSnapshot(document.company_snapshot);
      await saveProjectDocumentWorkflowAnswers(documentId, partial, {
        companySettings: { ...settingsCompany, ...company },
        selectedProject,
      });
      setToast({
        title: kind === 'rfi' ? 'Response saved' : 'Review saved',
        message: 'Workflow status and response were saved to a new document version.',
      });
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
      const { document, versions } = await getProjectDocument(documentId);
      const current =
        versions.find((v) => v.id === document.current_version_id) ?? versions[0];
      if (!current) return;
      const state = restoreBuilderStateFromSnapshot(current.input_snapshot);
      const merged = {
        ...state.answers,
        status,
        ...(kind === 'rfi'
          ? { response, respondedBy, responseDate }
          : { reviewerResponse, reviewedBy, responseDate, approvalDecision }),
      };
      const company = {
        ...settingsCompany,
        ...companySettingsFromDocumentSnapshot(document.company_snapshot),
      };
      if (kind === 'rfi') {
        const view = buildRfiPreviewFromDocumentAnswers({
          answers: merged,
          selectedProject,
          companySettings: company,
          title: document.title,
        });
        await generateRfiPDF(view);
      } else {
        const view = buildFarPreviewFromDocumentAnswers({
          answers: merged,
          selectedProject,
          companySettings: company,
          title: document.title,
        });
        await generateFarPDF(view);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  if (!documentId) return null;

  const statusOptions = workflowStatusesForKind(kind);
  const drawerTitle = kind === 'rfi' ? 'RFI Document Draft' : 'FAR Document Draft';
  const saveLabel = kind === 'rfi' ? 'Save response' : 'Save review';
  const pack = packKey ?? (kind === 'rfi' ? 'GENERIC_RFI' : 'GENERIC_FAR');
  const builderHref = contractBuilderToolHref(projectId, documentId, {
    packKey: pack,
    documentType: kind,
  });

  const requestByLabel = kind === 'rfi' ? 'Submitted by' : 'Requested by';
  const requestByValue = kind === 'rfi' ? submittedBy : requestedBy;

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
                <h2 className={PLANNER_DRAWER_TITLE}>{drawerTitle}</h2>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-mono text-xs text-cyan-700 dark:text-cyan-400">
                    {docNumber}
                  </span>
                  <span className="text-slate-400">·</span>
                  <FieldRecordStatusBadge status={status} />
                </p>
                {projectName ? (
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {projectName}
                  </p>
                ) : null}
              </div>
              <button type="button" className={PLANNER_CLOSE_BTN} onClick={onClose} aria-label="Close">
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

                  <SectionCard title="Summary">
                    <dl className="grid gap-3 sm:grid-cols-2">
                      <DetailRow label="Title / Subject" value={formatDisplayValue(title)} />
                      <DetailRow label="Number" value={docNumber} />
                      <DetailRow label={requestByLabel} value={requestByValue} />
                      <DetailRow label="Submitted to" value={submittedTo} />
                      <DetailRow label="Date" value={dueDate} />
                      <DetailRow label="Priority" value={priority} />
                    </dl>
                  </SectionCard>

                  <SectionCard title={kind === 'rfi' ? 'Request / Question' : 'Request / Description'}>
                    <p className="whitespace-pre-wrap text-sm text-gray-900 dark:text-white">
                      {kind === 'rfi' ? question || '—' : description || '—'}
                    </p>
                    <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                      <DetailRow label="Drawing reference" value={drawingRef} />
                      <DetailRow label="Specification" value={specRef} />
                      <DetailRow label="Location" value={location} />
                    </dl>
                  </SectionCard>

                  <SectionCard title="Impact / References">
                    <dl className="grid gap-3 sm:grid-cols-2">
                      <DetailRow label="Cost impact" value={costImpact} />
                      <DetailRow label="Schedule impact" value={scheduleImpact} />
                      <DetailRow label="Related RFI" value={relatedRfi} />
                      <DetailRow label="Related FAR" value={relatedFar} />
                      <DetailRow label="Related change order" value={relatedChangeOrder} />
                    </dl>
                  </SectionCard>

                  <SectionCard title="Response">
                    {kind === 'rfi' ? (
                      <div className="space-y-3">
                        <label className="block">
                          <span className={PLANNER_FORM_LABEL}>Response</span>
                          <textarea
                            value={response}
                            onChange={(e) => setResponse(e.target.value)}
                            rows={4}
                            className={`${PLANNER_INPUT} mt-1 w-full`}
                            placeholder="Enter response…"
                          />
                        </label>
                        <label className="block">
                          <span className={PLANNER_FORM_LABEL}>Responded by</span>
                          <input
                            value={respondedBy}
                            onChange={(e) => setRespondedBy(e.target.value)}
                            className={`${PLANNER_INPUT} mt-1 w-full`}
                          />
                        </label>
                        <label className="block">
                          <span className={PLANNER_FORM_LABEL}>Response date</span>
                          <input
                            value={responseDate}
                            onChange={(e) => setResponseDate(e.target.value)}
                            className={`${PLANNER_INPUT} mt-1 w-full`}
                            placeholder="YYYY-MM-DD"
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <label className="block">
                          <span className={PLANNER_FORM_LABEL}>Reviewer response</span>
                          <textarea
                            value={reviewerResponse}
                            onChange={(e) => setReviewerResponse(e.target.value)}
                            rows={4}
                            className={`${PLANNER_INPUT} mt-1 w-full`}
                            placeholder="Enter review…"
                          />
                        </label>
                        <label className="block">
                          <span className={PLANNER_FORM_LABEL}>Reviewed by</span>
                          <input
                            value={reviewedBy}
                            onChange={(e) => setReviewedBy(e.target.value)}
                            className={`${PLANNER_INPUT} mt-1 w-full`}
                          />
                        </label>
                        <label className="block">
                          <span className={PLANNER_FORM_LABEL}>Response date</span>
                          <input
                            value={responseDate}
                            onChange={(e) => setResponseDate(e.target.value)}
                            className={`${PLANNER_INPUT} mt-1 w-full`}
                          />
                        </label>
                        <label className="block">
                          <span className={PLANNER_FORM_LABEL}>Approval decision</span>
                          <input
                            value={approvalDecision}
                            onChange={(e) => setApprovalDecision(e.target.value)}
                            className={`${PLANNER_INPUT} mt-1 w-full`}
                          />
                        </label>
                      </div>
                    )}
                    <label className="mt-3 block">
                      <span className={PLANNER_FORM_LABEL}>Workflow status</span>
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

                  <SectionCard title="Activity / Version">
                    <dl className="grid gap-3 sm:grid-cols-2">
                      <DetailRow
                        label="Last updated"
                        value={
                          updatedAt
                            ? new Date(updatedAt).toLocaleString()
                            : '—'
                        }
                      />
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
                  {saveLabel}
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
          id="builder-review-toast"
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
