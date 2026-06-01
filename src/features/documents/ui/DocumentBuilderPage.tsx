import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileSignature, Lock } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  assembleDocument,
  buildQuestionnaire,
  evaluateDocumentCompliance,
  evaluateExportPolicy,
  generateDocumentManifest,
  listPacks,
  recommendDocumentClauses,
  resolveVisibleQuestions,
  scoreDocumentRisk,
  type DocumentQuestion,
  type IntakeGroup,
  type QuestionnaireMode,
} from '../index';
import FieldToolPageLayout from '../../../components/tools/FieldToolPageLayout';
import Toast from '../../../components/ui/Toast';
import { useProjectStore, useSettingsStore } from '../../../store';
import { buildDocumentInput, type ContractAnswers } from './contractInput';
import {
  buildContractCompanyPrefill,
  buildContractPrefillFromProject,
  type ContractPrefillResult,
} from './contractPrefill';
import { exportContractDraftPdf } from './contractPdf';
import { buildSaveVersionPayload, restoreBuilderStateFromSnapshot } from './contractVersionState';
import { GROUP_ORDER } from './contractBuilderConstants';
import {
  getContractDocument,
  getPublicContractUrl,
  listContractDocuments,
  saveContractVersion,
  sendContractForSignature,
} from '../services/contractDocumentService';
import type {
  ContractDocumentRow,
  ContractDocumentVersionRow,
} from '../services/contractDocumentTypes';
import DocumentMetaPanel from './panels/DocumentMetaPanel';
import IntakePanel from './panels/IntakePanel';
import SignaturePanel from './panels/SignaturePanel';
import CompliancePanel from './panels/CompliancePanel';
import VersionHistoryPanel from './panels/VersionHistoryPanel';
import ExportPanel from './panels/ExportPanel';
import PreviewPanel from './panels/PreviewPanel';
import { ProposalService, type SavedProposal } from '../../../lib/proposalService';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === '';
}

function validateContractEmails(answers: ContractAnswers): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (!/email/i.test(key) || isBlank(value)) continue;
    if (!EMAIL_RE.test(String(value).trim())) {
      errors[key] = 'Enter a valid email address.';
    }
  }
  return errors;
}

export default function DocumentBuilderPage() {
  const [searchParams] = useSearchParams();
  const companySettings = useSettingsStore((s) => s.companySettings);
  const projects = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);

  const [mode, setMode] = useState<QuestionnaireMode>('standard');
  const [packKey, setPackKey] = useState('GENERIC_RESIDENTIAL');
  const [answers, setAnswers] = useState<ContractAnswers>({});
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
  const [fieldSources, setFieldSources] = useState<ContractPrefillResult['sources']>({});
  const [fieldNotes, setFieldNotes] = useState<ContractPrefillResult['notes']>({});
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [projectProposals, setProjectProposals] = useState<SavedProposal[]>([]);
  const prefillRunKeyRef = useRef<string | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<
    { title: string; message: string; type: 'success' | 'error' } | null
  >(null);

  const [documentId, setDocumentId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [savedDocs, setSavedDocs] = useState<ContractDocumentRow[]>([]);
  const [versions, setVersions] = useState<ContractDocumentVersionRow[]>([]);
  const [previewVersion, setPreviewVersion] = useState<ContractDocumentVersionRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [loadedDoc, setLoadedDoc] = useState<ContractDocumentRow | null>(null);
  const [contractorName, setContractorName] = useState('');
  const [contractorSignature, setContractorSignature] = useState('');
  const [sending, setSending] = useState(false);

  const refreshSavedDocs = useCallback(async (scopedProjectId?: string | null) => {
    try {
      setSavedDocs(await listContractDocuments(scopedProjectId ?? undefined));
    } catch (e) {
      console.error('Failed to load saved contracts', e);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    void refreshSavedDocs(projectId);
  }, [projectId, refreshSavedDocs]);

  const queryProjectId = searchParams.get('project');
  const queryDocumentId = searchParams.get('id');

  useEffect(() => {
    if (queryProjectId) {
      setProjectId(queryProjectId);
      setCurrentProject(queryProjectId);
    }
  }, [queryProjectId, setCurrentProject]);

  useEffect(() => {
    if (!queryDocumentId) return;
    void (async () => {
      try {
        const { document, versions: docVersions } = await getContractDocument(queryDocumentId);
        setDocumentId(document.id);
        setTitle(document.title);
        setProjectId(document.project_id);
        setLoadedDoc(document);
        setContractorName(document.contractor_signer_name ?? '');
        setContractorSignature(document.contractor_signature ?? '');
        setVersions(docVersions);
        setPreviewVersion(null);
        const current =
          docVersions.find((v) => v.id === document.current_version_id) ?? docVersions[0];
        if (current) {
          const state = restoreBuilderStateFromSnapshot(current.input_snapshot);
          setPackKey(state.packKey);
          setMode(state.mode);
          setAnswers(state.answers);
          setDirtyFields(new Set());
          setFieldSources({});
          setFieldNotes({});
          setFieldErrors({});
          setAccepted(new Set(state.accepted));
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [queryDocumentId]);

  const setAnswer = useCallback((key: string, value: unknown) => {
    setDirtyFields((prev) => new Set(prev).add(key));
    setFieldErrors((prev) => {
      if (!/email/i.test(key)) return prev;
      const next = { ...prev };
      if (isBlank(value) || EMAIL_RE.test(String(value).trim())) delete next[key];
      else next[key] = 'Enter a valid email address.';
      return next;
    });
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleRecommendation = useCallback((clauseKey: string) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(clauseKey)) next.delete(clauseKey);
      else next.add(clauseKey);
      return next;
    });
  }, []);

  const company = useMemo(
    () => ({
      legalName: companySettings.companyName,
      address: companySettings.address,
      phone: companySettings.phone,
      email: companySettings.email,
      licenseNumber: companySettings.licenseNumber,
    }),
    [companySettings],
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId),
    [projectId, projects],
  );

  useEffect(() => {
    if (!projectId) {
      setProjectProposals([]);
      prefillRunKeyRef.current = null;
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const proposals = await ProposalService.getAll();
        if (!cancelled) {
          setProjectProposals(proposals.filter((proposal) => proposal.project_id === projectId));
        }
      } catch (e) {
        console.error('Failed to load project proposals for contract prefill', e);
        if (!cancelled) setProjectProposals([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const applyPrefill = useCallback(
    (overwriteDirty = false) => {
      if (!selectedProject) return;
      const projectPrefill = buildContractPrefillFromProject(selectedProject, projectProposals);
      const companyPrefill = buildContractCompanyPrefill(company);
      const values = { ...companyPrefill.values, ...projectPrefill.values };
      const sources = { ...companyPrefill.sources, ...projectPrefill.sources };
      const notes = { ...companyPrefill.notes, ...projectPrefill.notes };
      const appliedKeys = Object.keys(values).filter((key) => {
        const value = values[key];
        if (isBlank(value)) return false;
        return overwriteDirty || (!dirtyFields.has(key) && isBlank(answers[key]));
      });
      if (appliedKeys.length === 0) return;

      setAnswers((prev) => {
        const next = { ...prev };
        for (const key of appliedKeys) {
          next[key] = values[key];
        }
        return next;
      });

      setFieldSources((prev) => {
        const next = { ...prev };
        for (const key of appliedKeys) next[key] = sources[key];
        return next;
      });
      setFieldNotes((prev) => {
        const next = { ...prev };
        for (const key of appliedKeys) {
          if (notes[key]) next[key] = notes[key];
        }
        return next;
      });
      if (overwriteDirty) {
        setDirtyFields((prev) => {
          const next = new Set(prev);
          for (const key of appliedKeys) next.delete(key);
          return next;
        });
      }
    },
    [answers, company, dirtyFields, projectProposals, selectedProject],
  );

  useEffect(() => {
    if (!selectedProject) return;
    const latestProposalKey = projectProposals.map((proposal) => proposal.id).join('|');
    const runKey = `${selectedProject.id}:${latestProposalKey}`;
    if (prefillRunKeyRef.current === runKey) return;
    prefillRunKeyRef.current = runKey;
    applyPrefill(false);
  }, [applyPrefill, projectProposals, selectedProject]);

  const questionnaire = useMemo(() => buildQuestionnaire('residential_contract', mode), [mode]);
  const visibleQuestions = useMemo(
    () => resolveVisibleQuestions(questionnaire, answers),
    [questionnaire, answers],
  );

  const packOptions = useMemo(
    () =>
      listPacks().map((p) => ({
        value: p.packKey,
        label:
          p.status === 'attorney_review_required'
            ? `${p.label} - attorney review required`
            : `${p.label} - draft only`,
      })),
    [],
  );

  const input = useMemo(
    () => buildDocumentInput(answers, [...accepted], { company, packKey, mode }),
    [answers, accepted, company, packKey, mode],
  );

  const assembly = useMemo(() => assembleDocument(input), [input]);
  const compliance = useMemo(() => evaluateDocumentCompliance(input), [input]);
  const risk = useMemo(() => scoreDocumentRisk(input), [input]);
  const recommendations = useMemo(() => recommendDocumentClauses(input), [input]);
  const exportPolicy = useMemo(
    () => evaluateExportPolicy(input, !compliance.compliant),
    [input, compliance.compliant],
  );

  const recommendationDecisions = useMemo(
    () =>
      recommendations.map((rec) => ({
        clauseKey: rec.clauseKey,
        accepted: accepted.has(rec.clauseKey),
      })),
    [recommendations, accepted],
  );

  const groupedQuestions = useMemo(() => {
    const map = new Map<IntakeGroup, DocumentQuestion[]>();
    for (const q of visibleQuestions) {
      const list = map.get(q.group) ?? [];
      list.push(q);
      map.set(q.group, list);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      group: g,
      questions: map.get(g) as DocumentQuestion[],
    }));
  }, [visibleQuestions]);

  useEffect(() => {
    if (answers.depositRequired !== true) return;
    const patch: ContractAnswers = {};
    if (!answers.depositDueType) patch.depositDueType = 'upon_signing';

    const price = Number(answers.contractPrice);
    const percent = Number(answers.depositPercent);
    if (
      Number.isFinite(price) &&
      price > 0 &&
      Number.isFinite(percent) &&
      percent >= 0 &&
      !dirtyFields.has('depositAmount')
    ) {
      patch.depositAmount = Math.round(price * (percent / 100) * 100) / 100;
    }

    if (Object.keys(patch).length > 0) {
      setAnswers((prev) => ({ ...prev, ...patch }));
    }
  }, [
    answers.contractPrice,
    answers.depositDueType,
    answers.depositPercent,
    answers.depositRequired,
    dirtyFields,
  ]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportContractDraftPdf(assembly, risk, {
        companyName: company.legalName || 'Concrete Calc',
        address: company.address || '',
        phone: company.phone || '',
        email: company.email,
      });
      setToast({ title: 'Draft exported', message: 'Your draft contract PDF was generated.', type: 'success' });
    } catch (e) {
      console.error(e);
      setToast({ title: 'Export failed', message: 'Could not generate the PDF. Try again.', type: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadManifest = useCallback(() => {
    const manifestInput = buildDocumentInput(answers, [...accepted], {
      company,
      packKey,
      mode,
      recommendationDecisions,
    });
    const manifest = { ...generateDocumentManifest(manifestInput), exportPolicy };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contract-manifest-${manifest.outputHash}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setToast({
      title: 'Manifest downloaded',
      message: 'The reproducible JSON manifest was saved.',
      type: 'success',
    });
  }, [answers, accepted, company, packKey, mode, recommendationDecisions, exportPolicy]);

  const handleSaveVersion = async () => {
    const emailErrors = validateContractEmails(answers);
    setFieldErrors(emailErrors);
    if (Object.keys(emailErrors).length > 0) {
      setToast({
        title: 'Check email fields',
        message: 'Enter a valid email address before saving.',
        type: 'error',
      });
      return;
    }
    setSaving(true);
    try {
      const payload = buildSaveVersionPayload(assembly, risk, {
        documentId,
        title: title.trim() || assembly.title || 'Untitled contract',
        projectId,
        status: 'draft',
      });
      const { document } = await saveContractVersion(payload);
      setDocumentId(document.id);
      setTitle(document.title);
      setProjectId(document.project_id);
      setLoadedDoc(document);
      setPreviewVersion(null);
      const { versions: latestVersions } = await getContractDocument(document.id);
      setVersions(latestVersions);
      await refreshSavedDocs(document.project_id);
      setToast({
        title: 'Contract saved',
        message: `Saved as version ${document.latest_version_number}.`,
        type: 'success',
      });
    } catch (e) {
      console.error(e);
      setToast({
        title: 'Save failed',
        message: e instanceof Error ? e.message : 'Could not save the contract.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const applySnapshot = useCallback((version: ContractDocumentVersionRow) => {
    const state = restoreBuilderStateFromSnapshot(version.input_snapshot);
    setPackKey(state.packKey);
    setMode(state.mode);
    setAnswers(state.answers);
    setDirtyFields(new Set());
    setFieldSources({});
    setFieldNotes({});
    setFieldErrors({});
    setAccepted(new Set(state.accepted));
  }, []);

  const handleLoadDocument = async (id: string) => {
    try {
      const { document, versions: docVersions } = await getContractDocument(id);
      setDocumentId(document.id);
      setTitle(document.title);
      setProjectId(document.project_id);
      setLoadedDoc(document);
      setContractorName(document.contractor_signer_name ?? '');
      setContractorSignature(document.contractor_signature ?? '');
      setVersions(docVersions);
      setPreviewVersion(null);
      const current =
        docVersions.find((v) => v.id === document.current_version_id) ?? docVersions[0];
      if (current) applySnapshot(current);
    } catch (e) {
      console.error(e);
      setToast({
        title: 'Load failed',
        message: e instanceof Error ? e.message : 'Could not open that contract.',
        type: 'error',
      });
    }
  };

  const handleNewContract = () => {
    setDocumentId(null);
    setTitle('');
    setProjectId(queryProjectId ?? null);
    setLoadedDoc(null);
    setContractorName('');
    setContractorSignature('');
    setVersions([]);
    setPreviewVersion(null);
    setAnswers({});
    setDirtyFields(new Set());
    setFieldSources({});
    setFieldNotes({});
    setFieldErrors({});
    setAccepted(new Set());
    prefillRunKeyRef.current = null;
  };

  const handleSendForSignature = async () => {
    if (!documentId) return;
    const emailErrors = validateContractEmails(answers);
    setFieldErrors(emailErrors);
    if (Object.keys(emailErrors).length > 0) {
      setToast({
        title: 'Check email fields',
        message: 'Enter a valid email address before creating the signing link.',
        type: 'error',
      });
      return;
    }
    setSending(true);
    try {
      const updated = await sendContractForSignature({
        documentId,
        contractorName: contractorName.trim() || undefined,
        contractorSignature: contractorSignature.trim() || undefined,
      });
      setLoadedDoc(updated);
      await refreshSavedDocs(updated.project_id);
      setToast({
        title: 'Ready for signature',
        message: 'Share the contract link with your client to collect their signature.',
        type: 'success',
      });
    } catch (e) {
      console.error(e);
      setToast({
        title: 'Could not send',
        message: e instanceof Error ? e.message : 'Failed to prepare the contract for signing.',
        type: 'error',
      });
    } finally {
      setSending(false);
    }
  };

  const handleCopyContractLink = async () => {
    if (!loadedDoc?.public_token) return;
    try {
      await navigator.clipboard.writeText(getPublicContractUrl(loadedDoc.public_token));
      setToast({ title: 'Link copied', message: 'Client signing link copied to clipboard.', type: 'success' });
    } catch {
      setToast({ title: 'Copy failed', message: 'Could not copy the link.', type: 'error' });
    }
  };

  const handleProjectPrefill = useCallback(
    (id: string | null) => {
      if (id) setProjectId(id);
    },
    [],
  );

  const projectOptions = useMemo(
    () => [
      { value: '', label: 'No project (standalone)' },
      ...projects.map((p) => ({ value: p.id, label: p.name })),
    ],
    [projects],
  );

  const previewSections = previewVersion ? previewVersion.sections : assembly.sections;
  const previewHeading = previewVersion
    ? `${title || assembly.title} - version ${previewVersion.version_number} (read-only)`
    : assembly.title || 'Contract preview';

  return (
    <>
      <FieldToolPageLayout
        title="Contract Builder"
        subtitle="Generate a draft residential construction agreement. Draft only — have a qualified attorney review before use."
        icon={FileSignature}
        onProjectPrefill={handleProjectPrefill}
        actions={
          <div className="mt-6 flex justify-end print:hidden">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-sm font-semibold text-amber-700 dark:text-amber-300">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              Draft Only
            </span>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="lg:col-span-1 space-y-4">
            <DocumentMetaPanel
              documentId={documentId}
              title={title}
              projectId={projectId}
              projectOptions={projectOptions}
              savedDocs={savedDocs}
              saving={saving}
              onTitleChange={setTitle}
              onProjectChange={setProjectId}
              onSave={handleSaveVersion}
              onNewContract={handleNewContract}
              onLoadDocument={handleLoadDocument}
            />
            <SignaturePanel
              documentId={documentId ?? ''}
              loadedDoc={loadedDoc}
              contractorName={contractorName}
              contractorSignature={contractorSignature}
              sending={sending}
              onContractorNameChange={setContractorName}
              onContractorSignatureChange={setContractorSignature}
              onSendForSignature={handleSendForSignature}
              onCopyContractLink={handleCopyContractLink}
            />
            <IntakePanel
              packOptions={packOptions}
              packKey={packKey}
              mode={mode}
              groupedQuestions={groupedQuestions}
              answers={answers}
              fieldSources={fieldSources}
              fieldNotes={fieldNotes}
              fieldErrors={fieldErrors}
              hasSelectedProject={Boolean(selectedProject)}
              onPackChange={setPackKey}
              onModeChange={setMode}
              onAnswerChange={setAnswer}
              onRefreshFromProject={() => applyPrefill(true)}
            />
          </section>

          <section className="lg:col-span-2 space-y-4">
            <CompliancePanel
              risk={risk}
              recommendations={recommendations}
              complianceIssues={compliance.issues}
              accepted={accepted}
              onToggleRecommendation={toggleRecommendation}
            />
            <ExportPanel
              complianceIssues={compliance.issues}
              exportPolicy={exportPolicy}
              exporting={exporting}
              onExport={handleExport}
              onDownloadManifest={handleDownloadManifest}
            />
            <VersionHistoryPanel
              versions={versions}
              previewVersion={previewVersion}
              onSelectVersion={setPreviewVersion}
              onClearPreview={() => setPreviewVersion(null)}
            />
            <PreviewPanel
              previewHeading={previewHeading}
              previewSections={previewSections}
              disclaimer={assembly.disclaimer}
            />
          </section>
        </div>
      </FieldToolPageLayout>

      {toast && (
        <Toast
          id="contract-builder-toast"
          title={toast.title}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
