import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileSignature, Lock } from 'lucide-react';
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
  type DocumentType,
  type IntakeGroup,
  type QuestionnaireMode,
} from '../index';
import FieldToolPageLayout from '../../../components/tools/FieldToolPageLayout';
import Button from '../../../components/ui/Button';
import Toast from '../../../components/ui/Toast';
import { useProjectStore, useSettingsStore } from '../../../store';
import { formatUSAddress } from '../../../types/address';
import { buildDocumentInput, type ContractAnswers } from './contractInput';
import {
  buildContractCompanyPrefill,
  buildContractPrefillFromProject,
  jobsitePrefillFingerprint,
  type ContractPrefillResult,
} from './contractPrefill';
import { normalizeContractAnswers } from './contractAnswersUtils';
import { softenPreviewPlaceholders } from './previewDisplay';
import { exportContractDraftPdf } from './contractPdf';
import { generateChangeOrderPDF } from '../../../utils/changeOrderPdf';
import { buildChangeOrderPreviewFromDocumentAnswers } from './adapters/changeOrderPreviewAdapter';
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
import ProjectSummaryPanel from './panels/ProjectSummaryPanel';
import IntakePanel from './panels/IntakePanel';
import SignaturePanel from './panels/SignaturePanel';
import CompliancePanel from './panels/CompliancePanel';
import VersionHistoryPanel from './panels/VersionHistoryPanel';
import ExportPanel from './panels/ExportPanel';
import DocumentPreviewRouter from './panels/DocumentPreviewRouter';
import { ProposalService, type SavedProposal } from '../../../lib/proposalService';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROJECT_TYPE_LABELS: Record<string, string> = {
  remodel: 'Remodel',
  repair: 'Repair',
  concrete: 'Concrete',
  roofing: 'Roofing',
  adu: 'ADU',
  deck: 'Deck',
  fence: 'Fence',
  new_construction: 'New Construction',
  insurance_restoration: 'Insurance Restoration',
};

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

function formatCurrency(value: unknown): string | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n);
}

function templateLabel(packKey: string, fallback: string): string {
  const labels: Record<string, string> = {
    GENERIC_RESIDENTIAL: 'Generic Residential Contract',
    CA_RESIDENTIAL: 'Residential Remodel Contract',
    FL_RESIDENTIAL: 'Residential Remodel Contract',
    NY_RESIDENTIAL: 'Residential Remodel Contract',
    TX_RESIDENTIAL: 'Residential Remodel Contract',
    GA_RESIDENTIAL: 'Residential Remodel Contract',
    GU_RESIDENTIAL: 'Residential Remodel Contract',
  };
  return labels[packKey] ?? fallback.replace(/\bpack\b/gi, '').trim();
}

/**
 * Resolves the document type from the selected pack key.
 * Keeps the questionnaire, assembly, compliance, and export logic in sync
 * when the user switches document types in the builder dropdown.
 */
function resolveDocumentType(pk: string): DocumentType {
  if (pk === 'GENERIC_CHANGE_ORDER') return 'change_order';
  // All residential packs (GENERIC_RESIDENTIAL, CA_RESIDENTIAL, etc.)
  return 'residential_contract';
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
  const [showValidation, setShowValidation] = useState(false);
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
  const [isPreviewOpen, setIsPreviewOpen] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  const [shouldRenderPreview, setShouldRenderPreview] = useState(isPreviewOpen);
  const builderColumnRef = useRef<HTMLElement | null>(null);
  const newContractCardRef = useRef<HTMLDivElement | null>(null);
  const previewPanelRef = useRef<HTMLDivElement | null>(null);
  const [toggleLeft, setToggleLeft] = useState<number | null>(null);
  const [toggleTop, setToggleTop] = useState<number | null>(null);
  const [toggleReady, setToggleReady] = useState(false);

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

  useEffect(() => {
    if (isPreviewOpen) {
      setShouldRenderPreview(true);
      return;
    }

    const closeTimer = window.setTimeout(() => {
      setShouldRenderPreview(false);
      const maxScrollTop = Math.max(0, document.body.scrollHeight - window.innerHeight);
      if (window.scrollY > maxScrollTop) {
        window.scrollTo({
          top: maxScrollTop,
          behavior: 'smooth',
        });
      }
    }, 300);

    return () => window.clearTimeout(closeTimer);
  }, [isPreviewOpen]);

  useLayoutEffect(() => {
    let frameId: number | null = null;
    let settleTimer: number | null = null;
    let transitionTimer: number | null = null;
    setToggleReady(false);

    const updateTogglePosition = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const builderRect = builderColumnRef.current?.getBoundingClientRect();
        const cardRect = newContractCardRef.current?.getBoundingClientRect();
        if (!builderRect || !cardRect) {
          setToggleLeft(null);
          setToggleTop(null);
          setToggleReady(false);
          return;
        }

        const stickyTop = 112; // top-28: keep the toggle below the page header area.
        const cardTopAnchor = cardRect.top + 24;
        setToggleLeft(builderRect.right);
        setToggleTop(Math.max(stickyTop, cardTopAnchor));
        setToggleReady(true);
      });
    };

    updateTogglePosition();
    settleTimer = window.setTimeout(updateTogglePosition, 0);
    transitionTimer = window.setTimeout(updateTogglePosition, 350);

    const column = builderColumnRef.current;
    const card = newContractCardRef.current;
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && column
        ? new ResizeObserver(updateTogglePosition)
        : null;
    resizeObserver?.observe(column);
    if (card && card !== column) resizeObserver?.observe(card);

    window.addEventListener('resize', updateTogglePosition);
    window.addEventListener('scroll', updateTogglePosition, { passive: true });

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      if (transitionTimer !== null) window.clearTimeout(transitionTimer);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateTogglePosition);
      window.removeEventListener('scroll', updateTogglePosition);
    };
  }, [documentId, isPreviewOpen, projectId]);

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
        setCurrentProject(document.project_id);
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
          setAnswers(normalizeContractAnswers(state.answers));
          setDirtyFields(new Set());
          setFieldSources({});
          setFieldNotes({});
          setFieldErrors({});
          setShowValidation(false);
          setAccepted(new Set(state.accepted));
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [queryDocumentId, setCurrentProject]);

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
    () => projects.find((project) => project.id === projectId) ?? null,
    [projectId, projects],
  );

  const proposalTotal = useMemo(() => {
    const acceptedProposal = [...projectProposals]
      .filter((proposal) => proposal.status === 'accepted' || Boolean(proposal.accepted_at))
      .sort((a, b) => {
        const aTime = new Date(a.accepted_at ?? a.updated_at).getTime();
        const bTime = new Date(b.accepted_at ?? b.updated_at).getTime();
        return bTime - aTime;
      })[0];
    const latestProposal = [...projectProposals].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )[0];
    return formatCurrency(acceptedProposal?.total_amount ?? latestProposal?.total_amount);
  }, [projectProposals]);

  const projectSummary = useMemo(() => {
    if (!selectedProject) return null;
    const projectType = typeof answers.projectType === 'string' ? answers.projectType : '';
    return {
      projectName: selectedProject.name || 'Untitled project',
      client: selectedProject.clientInfo?.clientName || 'Not available',
      jobsiteAddress: selectedProject.jobsiteAddress
        ? formatUSAddress(selectedProject.jobsiteAddress) || 'Not available'
        : 'Not available',
      proposalTotal: proposalTotal ?? 'Not available',
      contractValue:
        formatCurrency(selectedProject.currentContractValue ?? selectedProject.baseContractValue) ??
        'Not available',
      projectType: projectType ? PROJECT_TYPE_LABELS[projectType] ?? projectType : 'Not available',
    };
  }, [answers.projectType, proposalTotal, selectedProject]);

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
    prefillRunKeyRef.current = null;
  }, [projectId]);

  useEffect(() => {
    if (!selectedProject) return;
    const latestProposalKey = projectProposals.map((proposal) => proposal.id).join('|');
    const jobsiteKey = jobsitePrefillFingerprint(selectedProject);
    const runKey = `${selectedProject.id}:${jobsiteKey}:${latestProposalKey}`;
    if (prefillRunKeyRef.current === runKey) return;
    prefillRunKeyRef.current = runKey;
    applyPrefill(false);
  }, [applyPrefill, projectProposals, selectedProject]);

  const currentDocumentType = useMemo(() => resolveDocumentType(packKey), [packKey]);
  const questionnaire = useMemo(
    () => buildQuestionnaire(currentDocumentType, mode),
    [currentDocumentType, mode],
  );
  const visibleQuestions = useMemo(
    () => resolveVisibleQuestions(questionnaire, answers),
    [questionnaire, answers],
  );

  const packOptions = useMemo(
    () =>
      listPacks().map((p) => ({
        value: p.packKey,
        label: templateLabel(p.packKey, p.label),
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

  const isChangeOrderDocument =
    input.documentType === 'change_order' || packKey === 'GENERIC_CHANGE_ORDER';

  const handleExport = async () => {
    setShowValidation(true);
    setExporting(true);
    try {
      if (isChangeOrderDocument) {
        const preview = buildChangeOrderPreviewFromDocumentAnswers({
          answers,
          selectedProject,
          companySettings,
          title,
        });
        await generateChangeOrderPDF(preview.order, preview.context);
        setToast({ title: 'Change order exported', message: 'Your change order PDF was generated.', type: 'success' });
      } else {
        await exportContractDraftPdf(assembly, risk, {
          companyName: company.legalName || 'Concrete Calc',
          address: company.address || '',
          phone: company.phone || '',
          email: company.email,
        });
        setToast({ title: 'Draft exported', message: 'Your draft contract PDF was generated.', type: 'success' });
      }
    } catch (e) {
      console.error(e);
      setToast({ title: 'Export failed', message: 'Could not generate the PDF. Try again.', type: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadManifest = useCallback(() => {
    setShowValidation(true);
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
    setShowValidation(true);
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
      setCurrentProject(document.project_id);
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
    setAnswers(normalizeContractAnswers(state.answers));
    setDirtyFields(new Set());
    setFieldSources({});
    setFieldNotes({});
    setFieldErrors({});
    setShowValidation(false);
    setAccepted(new Set(state.accepted));
  }, []);

  const handleLoadDocument = async (id: string) => {
    try {
      const { document, versions: docVersions } = await getContractDocument(id);
      setDocumentId(document.id);
      setTitle(document.title);
      setProjectId(document.project_id);
      setCurrentProject(document.project_id);
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
    setShowValidation(false);
    setAccepted(new Set());
    prefillRunKeyRef.current = null;
  };

  const handleSendForSignature = async () => {
    if (!documentId) return;
    setShowValidation(true);
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

  const handlePreviewContract = () => {
    setPreviewVersion(null);
    setShowValidation(true);
    setIsPreviewOpen(true);
    window.requestAnimationFrame(() => {
      previewPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleProjectPrefill = useCallback(
    (id: string | null) => {
      setProjectId(id);
      setShowValidation(false);
    },
    [],
  );

  const previewSectionsRaw = previewVersion ? previewVersion.sections : assembly.sections;
  const previewSections = useMemo(
    () =>
      previewSectionsRaw.map((section) => ({
        ...section,
        body: softenPreviewPlaceholders(section.body),
      })),
    [previewSectionsRaw],
  );
  const previewHeading = previewVersion
    ? `${title || assembly.title} - version ${previewVersion.version_number} (read-only)`
    : assembly.title || 'Contract preview';

  return (
    <>
      <FieldToolPageLayout
        title="Contract Builder"
        subtitle={
          selectedProject
            ? `Create, review, and manage construction contracts linked to your projects. Selected Project: ${selectedProject.name}`
            : 'Create, review, and manage construction contracts linked to your projects.'
        }
        icon={FileSignature}
        maxWidthClassName="max-w-7xl"
        onProjectPrefill={handleProjectPrefill}
        actions={null}
      >
        <ProjectSummaryPanel
          summary={projectSummary}
          onRefreshFromProject={() => applyPrefill(true)}
        />

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-800 dark:text-amber-200">
          <span className="inline-flex items-center gap-2">
            <Lock className="h-4 w-4" aria-hidden />
            Draft document only. Have a qualified attorney review before use.
          </span>
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-in-out motion-reduce:transition-none">
            <section
              ref={builderColumnRef}
              className={`relative min-w-0 space-y-4 motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-in-out motion-reduce:transition-none ${
                isPreviewOpen
                  ? 'lg:basis-[calc(42%_-_0.75rem)] lg:shrink-0 lg:grow-0'
                  : 'lg:mx-auto lg:w-full lg:max-w-5xl lg:basis-full'
              }`}
            >
              <div ref={newContractCardRef}>
                <DocumentMetaPanel
                  documentId={documentId}
                  title={title}
                  savedDocs={savedDocs}
                  onTitleChange={setTitle}
                  onNewContract={handleNewContract}
                  onLoadDocument={handleLoadDocument}
                />
              </div>
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
              <CompliancePanel
                packKey={packKey}
                risk={risk}
                recommendations={recommendations}
                complianceIssues={compliance.issues}
                accepted={accepted}
                showValidation={showValidation}
                onRunValidation={() => setShowValidation(true)}
                onToggleRecommendation={toggleRecommendation}
              />
              <ExportPanel
                exportPolicy={exportPolicy}
                exporting={exporting}
                onExport={handleExport}
                onDownloadManifest={handleDownloadManifest}
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
            </section>

            {toggleReady && toggleLeft !== null && toggleTop !== null && (
              <button
                type="button"
                onClick={() => setIsPreviewOpen((open) => !open)}
                aria-label={isPreviewOpen ? 'Hide contract preview' : 'Show contract preview'}
                title={isPreviewOpen ? 'Hide preview' : 'Show preview'}
                style={{
                  left: `${toggleLeft}px`,
                  top: `${toggleTop}px`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="fixed z-50 hidden h-12 w-12 items-center justify-center rounded-full border border-cyan-400/40 bg-slate-950/60 text-cyan-300 shadow-md backdrop-blur-sm motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-in-out hover:scale-105 hover:border-cyan-300/70 hover:bg-slate-900/80 hover:text-cyan-100 active:scale-95 motion-reduce:transition-none lg:flex print:hidden"
              >
                <ChevronRight
                  className={`h-5 w-5 motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-in-out motion-reduce:transition-none ${
                    isPreviewOpen ? '' : 'rotate-180'
                  }`}
                  aria-hidden
                />
                <span className="sr-only">
                  {isPreviewOpen ? 'Hide contract preview' : 'Show contract preview'}
                </span>
              </button>
            )}

            {/* Mobile preview toggle — between builder and preview */}
            <button
              type="button"
              onClick={() => setIsPreviewOpen((open) => !open)}
              aria-label={isPreviewOpen ? 'Hide contract preview' : 'Show contract preview'}
              title={isPreviewOpen ? 'Hide preview' : 'Show preview'}
              className="flex w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-slate-900 px-4 py-2.5 text-sm font-medium text-cyan-300 shadow-md transition-all duration-300 ease-in-out hover:border-cyan-400 hover:shadow-cyan-500/20 lg:hidden print:hidden"
            >
              {isPreviewOpen ? (
                <>
                  <ChevronRight
                    className="h-4 w-4 rotate-90 transition-transform duration-300 ease-in-out"
                    aria-hidden
                  />
                  Hide Contract Preview
                </>
              ) : (
                <>
                  <ChevronLeft
                    className="h-4 w-4 -rotate-90 transition-transform duration-300 ease-in-out"
                    aria-hidden
                  />
                  Show Contract Preview
                </>
              )}
            </button>

            {shouldRenderPreview && (
              <section
                className={`min-w-0 space-y-4 overflow-hidden motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-in-out motion-reduce:transition-none print:block ${
                  isPreviewOpen
                    ? 'max-h-[10000px] translate-y-0 opacity-100 lg:basis-[calc(58%_-_0.75rem)] lg:translate-x-0'
                    : 'max-h-0 translate-y-3 opacity-0 pointer-events-none lg:max-h-[10000px] lg:basis-0 lg:translate-x-4'
                }`}
                aria-hidden={!isPreviewOpen}
              >
                <div className="sticky top-4 z-10 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95 print:hidden">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="accent" onClick={handleSaveVersion} isLoading={saving} fullWidth>
                      Save Draft
                    </Button>
                    <Button variant="outline" onClick={() => setShowValidation(true)} fullWidth>
                      Run Compliance
                    </Button>
                    <Button variant="outline" onClick={handlePreviewContract} fullWidth>
                      Preview Contract
                    </Button>
                  </div>
                </div>
                <VersionHistoryPanel
                  versions={versions}
                  previewVersion={previewVersion}
                  onSelectVersion={setPreviewVersion}
                  onClearPreview={() => setPreviewVersion(null)}
                />
                <div ref={previewPanelRef}>
                  <DocumentPreviewRouter
                    documentType={assembly.documentType}
                    packKey={packKey}
                    answers={answers}
                    selectedProject={selectedProject}
                    companySettings={companySettings}
                    title={title}
                    previewVersion={previewVersion}
                    previewHeading={previewHeading}
                    previewSections={previewSections}
                  />
                </div>
              </section>
            )}
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
