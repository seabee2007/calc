import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Save, ArrowLeft, FileText, Plus, Upload, Beaker, CloudSun, SkipForward, Send } from 'lucide-react';
import { useWorkflowProgressStore } from '../store/workflowProgressStore';
import { useWorkflowDraftStore } from '../store/workflowDraftStore';
import WorkflowStepHeader from '../components/workflow/WorkflowStepHeader';
import {
  isWorkflowActive,
  getWorkflowProjectId,
  workflowQuery,
  workflowNavigateState,
  workflowConcreteToolQuery,
  navigateToProjectDetail,
  projectHasConcreteWork,
  type WorkflowLocationState,
} from '../utils/workflow';
import { ProposalData } from '../types/proposal';
import { ProposalService, SavedProposal } from '../lib/proposalService';
import {
  getPublicProposalUrl,
} from '../lib/proposalTracking';
import ProposalTemplateClassic from '../components/proposals/ProposalTemplateClassic';
import ProposalTemplateModern from '../components/proposals/ProposalTemplateModern';
import ProposalTemplateMinimal from '../components/proposals/ProposalTemplateMinimal';
import ProposalSentLinkModal from '../components/proposals/ProposalSentLinkModal';
import ProposalSendEmailModal, {
  type ProposalSendEmailMode,
} from '../components/proposals/ProposalSendEmailModal';
import { sendProposalEmail } from '../services/emailService';
import { resolveProposalSendDefaults } from '../utils/resolveProposalSendDefaults';
import type { ProposalEmailSendPayload } from '../utils/proposalEmailRecipient';
import Button from '../components/ui/Button';
import { generateProposalPDF } from '../utils/pdf';
import { useSettingsStore } from '../store';
import { useProjectStore } from '../store';
import {
  buildDefaultProposalTitle,
  importProjectIntoProposal,
  projectClientInfoFromProposalData,
} from '../utils/proposalProjectImport';
import { countProposalLineItemsFromProject } from '../utils/proposalPricingImport';
import {
  getProjectEstimateSourceLabels,
  projectHasImportablePricing,
} from '../utils/proposalPricingImport';
import {
  countProposalImportLineItems,
  projectHasImportablePricingAsync,
  resolveProposalPricingImport,
} from '../utils/proposalCurrentEstimateImport';
import ProposalPricingEditor, {
  proposalIndirectFromData,
} from '../components/proposals/ProposalPricingEditor';
import ProposalSetupPanel from '../components/proposals/ProposalSetupPanel';
import ProposalClientRecipientSection from '../components/proposals/ProposalClientRecipientSection';
import ProposalBusinessInfoCollapsible from '../components/proposals/ProposalBusinessInfoCollapsible';
import ProposalPreviewActionBar from '../components/proposals/ProposalPreviewActionBar';
import AppPage from '../components/ui/AppPage';
import {
  emptyProposalPricingState,
  formatProposalTotal,
  hydrateProposalPricing,
} from '../utils/proposalPricing';
import Modal from '../components/ui/Modal';
import Toast, { type ToastType } from '../components/ui/Toast';
import { soundService } from '../services/soundService';
import { useConfirm } from '../contexts/ConfirmContext';
import {
  EMPTY_US_ADDRESS,
  parseLegacyUSAddress,
  type USAddress,
} from '../types/address';
import {
  displayBusinessAddress,
  displayClientAddress,
  hydrateProposalAddresses,
  mergeProjectIntoProposalFields,
  mergeProjectJobsiteIntoClientAddress,
  syncProposalAddressesForSave,
} from '../utils/proposalAddress';
import { resolveProposalIntroductionForDisplay } from '../utils/proposalIntroText';
import {
  FORM_LABEL,
  FORM_TEXTAREA,
  FOCUS_RING,
  PREMIUM_INNER_PANEL,
  PREMIUM_PANEL,
  TEXT_ACCENT,
  TEXT_BODY,
  TEXT_FOREGROUND,
  TEXT_MUTED,
} from '../theme/appTheme';
import {
  formatProposalPreviewSubtitle,
  normalizeDisplayText,
} from '../utils/normalizeDisplayText';

type TemplateType = 'classic' | 'modern' | 'minimal';

const PROPOSAL_PAGE_BG =
  'bg-slate-50 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_34%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_45%,#f8fafc_100%)] dark:bg-[#020817] dark:bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_34%),linear-gradient(180deg,#020817_0%,#07111f_45%,#020817_100%)]';
const PROPOSAL_PAGE_SHELL =
  'relative min-h-screen w-full overflow-x-hidden text-slate-900 dark:text-slate-100';

const ProposalPageBackground: React.FC = () => (
  <div
    className={`pointer-events-none fixed inset-0 -z-10 ${PROPOSAL_PAGE_BG}`}
    aria-hidden
  />
);
const PAGE_TITLE = `text-3xl font-bold tracking-tight ${TEXT_FOREGROUND} sm:text-4xl`;
const PAGE_SUBTITLE = `mt-2 max-w-3xl text-sm ${TEXT_MUTED} sm:text-base`;
const SECTION_CARD = `${PREMIUM_PANEL} p-5 sm:p-6`;
const SECTION_TITLE = `text-lg font-semibold ${TEXT_FOREGROUND}`;
const SECTION_HELP = `mt-1 text-sm ${TEXT_MUTED}`;
const INPUT_CLASS = FORM_TEXTAREA;
const OUTLINE_BUTTON_CLASS =
  'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800';

const ProposalGenerator: React.FC = () => {
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editId = searchParams.get('edit');
  const previewId = searchParams.get('preview');
  const isEditing = !!editId;
  const isPreviewMode = !!previewId;
  const { companySettings } = useSettingsStore();
  const { projects, loadProjects, updateProject } = useProjectStore();
  const location = useLocation();
  const workflowState = location.state as WorkflowLocationState | null;
  const inWorkflow = isWorkflowActive(location.search, workflowState);
  const workflowProjectId = getWorkflowProjectId(location.search, workflowState);
  const importedPricingRef = useRef<string | null>(null);
  const proposalDraftRestoredRef = useRef(false);
  const recordVisit = useWorkflowProgressStore((s) => s.recordVisit);
  const getProposalDraft = useWorkflowDraftStore((s) => s.getProposalDraft);
  const saveProposalDraft = useWorkflowDraftStore((s) => s.saveProposalDraft);
  const [workflowStepReady, setWorkflowStepReady] = useState(false);
  const [sentProposalUrl, setSentProposalUrl] = useState<string | null>(null);
  const [sendEmailModal, setSendEmailModal] = useState<{
    proposalId: string;
    proposalTitle: string;
    defaultRecipientEmail?: string;
    mode?: ProposalSendEmailMode;
  } | null>(null);
  const [sendEmailError, setSendEmailError] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('classic');
  const [showPreview, setShowPreview] = useState(isPreviewMode);
  const [currentProposal, setCurrentProposal] = useState<SavedProposal | null>(null);
  const [proposalTitle, setProposalTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [importToast, setImportToast] = useState<{
    title: string;
    message?: string;
    type: ToastType;
  } | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [businessInfoExpanded, setBusinessInfoExpanded] = useState(false);
  const [updatingProjectClient, setUpdatingProjectClient] = useState(false);
  const [selectedProjectImportable, setSelectedProjectImportable] = useState<boolean | null>(null);
  const [projectImportability, setProjectImportability] = useState<Record<string, boolean>>({});
  const [importingPricing, setImportingPricing] = useState(false);
  const projectImportInitializedRef = useRef(false);

  const [proposalData, setProposalData] = useState<ProposalData>(() =>
    hydrateProposalAddresses({
    businessName: companySettings.companyName || '',
    businessLogoUrl: companySettings.logo || '',
    businessAddress: companySettings.address || '',
    businessAddressParts: parseLegacyUSAddress(companySettings.address || ''),
    businessPhone: companySettings.phone || '',
    businessEmail: companySettings.email || '',
    businessLicenseNumber: companySettings.licenseNumber || '',
    businessSlogan: companySettings.motto || '',
    clientName: '',
    clientCompany: '',
    clientEmail: '',
    clientPhone: '',
    clientAddress: '',
    clientAddressParts: { ...EMPTY_US_ADDRESS },
    projectTitle: '',
    date: new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    introduction: '',
    scope: '',
    timeline: [
      { phase: '', start: '', end: '' },
    ],
    ...emptyProposalPricingState(),
    terms: '',
    preparedBy: '',
    preparedByTitle: '',
  }),
  );
  // Load proposal data when editing or previewing
  useEffect(() => {
    const loadProposal = async () => {
      const id = editId || previewId;
      if (!id) return;

      try {
        setLoading(true);
        const proposal = await ProposalService.getById(id);
        setCurrentProposal(proposal);
        setProposalData(
          hydrateProposalPricing(hydrateProposalAddresses(proposal.data)),
        );
        setSelectedTemplate(proposal.template_type);
        setProposalTitle(proposal.title);
        if (proposal.project_id) {
          setSelectedProjectId(proposal.project_id);
        }
        
        if (previewId) {
          setShowPreview(true);
        }
      } catch (error) {
        console.error('Failed to load proposal:', error);
        navigate('/proposals');
      } finally {
        setLoading(false);
      }
    };

    loadProposal();
  }, [editId, previewId, navigate]);

  useEffect(() => {
    if (previewId) {
      setShowPreview(true);
      return;
    }
    if (editId) {
      setShowPreview(false);
    }
  }, [editId, previewId]);

  useEffect(() => {
    void loadProjects().catch((err) => {
      console.error('Failed to load projects for proposal generator:', err);
    });
  }, [loadProjects]);

  const companyTaxSettings = {
    taxSystem: companySettings.taxSystem,
    taxRatePercent: companySettings.taxRatePercent,
    taxApplication: companySettings.taxApplication,
  };

  const showImportFeedback = (
    title: string,
    type: ToastType,
    message?: string,
    options?: { silent?: boolean },
  ) => {
    if (options?.silent) return;
    setImportToast({ title, message, type });
  };

  const applyProjectImport = async (
    projectId: string,
    options?: { overwrite?: boolean; importPricing?: boolean; setTitle?: boolean; silent?: boolean },
  ) => {
    const project = projects.find((entry) => entry.id === projectId);
    if (!project) {
      showImportFeedback('Import failed', 'error', 'Project not found.', {
        silent: options?.silent,
      });
      return;
    }

    const shouldImportPricing = options?.importPricing !== false;
    const pricingImport = shouldImportPricing
      ? await resolveProposalPricingImport(projectId, project, companyTaxSettings)
      : null;

    setSelectedProjectId(projectId);
    setProposalData((prev) =>
      importProjectIntoProposal(prev, project, {
        overwriteEmptyOnly: options?.overwrite !== true,
        importPricing: shouldImportPricing,
        companySettings: companyTaxSettings,
        currentEstimateImport: pricingImport?.currentEstimateImport ?? null,
      }),
    );

    if (options?.setTitle !== false) {
      setProposalTitle((prev) => prev.trim() || buildDefaultProposalTitle(project.name));
    }

    if (shouldImportPricing && pricingImport) {
      importedPricingRef.current = projectId;
      if (!options?.silent) {
        if (pricingImport.source === 'current-estimate') {
          const summary = pricingImport.currentEstimateImport!.importedEstimateSummary;
          const lineCount = countProposalImportLineItems(pricingImport.currentEstimateImport!);
          showImportFeedback(
            'Project imported',
            'success',
            `Loaded details and current estimate from "${project.name}" (${lineCount} line${lineCount === 1 ? '' : 's'}, total ${formatProposalTotal({ importedEstimateSummary: summary } as ProposalData)}).`,
          );
        } else {
          const lineCount = countProposalLineItemsFromProject(project);
          const sources = getProjectEstimateSourceLabels(project);
          if (lineCount > 0) {
            showImportFeedback(
              'Project imported',
              'success',
              `Loaded details from "${project.name}"${sources.length ? ` (${sources.join(', ')})` : ''}.`,
            );
          } else {
            showImportFeedback(
              'Project imported',
              'success',
              `Loaded client and project details from "${project.name}".`,
            );
          }
        }
      }
    } else if (!options?.silent) {
      showImportFeedback(
        'Project imported',
        'success',
        `Loaded client and project details from "${project.name}".`,
      );
    }
  };

  // Auto-select project from workflow / project context and import details.
  useEffect(() => {
    if (isEditing || isPreviewMode || projectImportInitializedRef.current) return;

    const contextProjectId =
      workflowProjectId ?? workflowState?.projectId ?? null;
    if (!contextProjectId) {
      projectImportInitializedRef.current = true;
      return;
    }

    if (projects.length === 0) return;

    const project = projects.find((entry) => entry.id === contextProjectId);
    if (!project) {
      projectImportInitializedRef.current = true;
      return;
    }

    const draft = getProposalDraft(contextProjectId);
    if (draft && !proposalDraftRestoredRef.current) {
      setProposalData(
        hydrateProposalPricing(
          mergeProjectIntoProposalFields(draft.proposalData, project),
        ),
      );
      setProposalTitle(draft.proposalTitle);
      setSelectedTemplate(draft.selectedTemplate);
      setShowPreview(draft.showPreview);
      setSelectedProjectId(contextProjectId);
      proposalDraftRestoredRef.current = true;
      importedPricingRef.current = contextProjectId;
      projectImportInitializedRef.current = true;
      return;
    }

    proposalDraftRestoredRef.current = true;
    setSelectedProjectId(contextProjectId);
    void applyProjectImport(contextProjectId, { overwrite: true, silent: true }).finally(() => {
      projectImportInitializedRef.current = true;
    });
  }, [
    isEditing,
    isPreviewMode,
    workflowProjectId,
    workflowState?.projectId,
    projects,
    getProposalDraft,
  ]);

  useEffect(() => {
    if (!inWorkflow || !workflowProjectId || isEditing || isPreviewMode) return;
    saveProposalDraft(workflowProjectId, {
      proposalData,
      proposalTitle,
      selectedTemplate,
      showPreview,
    });
  }, [
    inWorkflow,
    workflowProjectId,
    proposalData,
    proposalTitle,
    selectedTemplate,
    showPreview,
    isEditing,
    isPreviewMode,
    saveProposalDraft,
  ]);

  // Jobsite may load after projects fetch — fill client address when it arrives.
  useEffect(() => {
    if (isEditing || isPreviewMode) return;
    const projectId = selectedProjectId ?? workflowState?.projectId ?? workflowProjectId;
    if (!projectId) return;
    const project = projects.find((p) => p.id === projectId);
    if (!project?.jobsiteAddress) return;
    setProposalData((prev) =>
      mergeProjectJobsiteIntoClientAddress(prev, project.jobsiteAddress),
    );
  }, [
    selectedProjectId,
    workflowProjectId,
    workflowState?.projectId,
    projects,
    isEditing,
    isPreviewMode,
  ]);

  const importPricingFromProject = async (
    projectId: string,
    options?: { silent?: boolean },
  ) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      showImportFeedback('Import failed', 'error', 'Project not found.', options);
      return;
    }

    setImportingPricing(true);
    try {
      const pricingImport = await resolveProposalPricingImport(
        projectId,
        project,
        companyTaxSettings,
      );

      if (!pricingImport) {
        showImportFeedback(
          'No estimates to import',
          'warning',
          'Save a current estimate in the estimate workspace, or save at least one legacy estimate on step 2, to this project.',
          options,
        );
        return;
      }

      if (pricingImport.source === 'current-estimate') {
        const currentEstimateImport = pricingImport.currentEstimateImport!;
        const lineCount = countProposalImportLineItems(currentEstimateImport);
        const finalTotal = currentEstimateImport.importedEstimateSummary.finalSellPrice;
        if (lineCount === 0 && finalTotal <= 0) {
          showImportFeedback(
            'Import failed',
            'error',
            'No pricing data could be extracted from the current estimate.',
            options,
          );
          return;
        }

        setProposalData((prev) =>
          hydrateProposalPricing(
            mergeProjectJobsiteIntoClientAddress(
              hydrateProposalAddresses({
                ...prev,
                laborItems: currentEstimateImport.laborItems,
                materialItems: currentEstimateImport.materialItems,
                equipmentItems: currentEstimateImport.equipmentItems,
                subcontractorItems: currentEstimateImport.subcontractorItems,
                importedEstimateSummary: currentEstimateImport.importedEstimateSummary,
                projectTitle: prev.projectTitle || `${project.name} Concrete Work`,
                pricingIndirect: {
                  ...proposalIndirectFromData(prev, companyTaxSettings),
                  ...currentEstimateImport.pricingIndirect,
                },
              }),
              project.jobsiteAddress,
            ),
            companyTaxSettings,
          ),
        );
        importedPricingRef.current = projectId;

        setShowProjectPicker(false);
        showImportFeedback(
          'Pricing imported',
          'success',
          `Imported current estimate from "${project.name}" (${lineCount} line${lineCount === 1 ? '' : 's'}, total ${formatProposalTotal({ importedEstimateSummary: currentEstimateImport.importedEstimateSummary } as ProposalData)}).`,
          options,
        );
        return;
      }

      const lineItems = pricingImport.legacyLineItems!;
      const lineCount =
        lineItems.laborItems.length +
        lineItems.materialItems.length +
        lineItems.equipmentItems.length;
      if (lineCount === 0) {
        showImportFeedback(
          'Import failed',
          'error',
          'No pricing data could be extracted from this project.',
          options,
        );
        return;
      }

      setProposalData((prev) =>
        hydrateProposalPricing(
          mergeProjectJobsiteIntoClientAddress(
            hydrateProposalAddresses({
              ...prev,
              ...lineItems,
              importedEstimateSummary: undefined,
              projectTitle: prev.projectTitle || `${project.name} Concrete Work`,
              pricingIndirect: {
                ...proposalIndirectFromData(prev, companyTaxSettings),
                wasteFactorPercent: project.wasteFactor ?? 10,
              },
            }),
            project.jobsiteAddress,
          ),
          companyTaxSettings,
        ),
      );
      importedPricingRef.current = projectId;

      setShowProjectPicker(false);
      const sources = getProjectEstimateSourceLabels(project);
      const sourcesLabel = sources.length > 0 ? sources.join(', ') : 'saved estimates';
      showImportFeedback(
        'Pricing imported',
        'success',
        `Added ${lineCount} line(s) from "${project.name}" (${sourcesLabel}).`,
        options,
      );
    } finally {
      setImportingPricing(false);
    }
  };

  const openProjectPicker = () => {
    setShowProjectPicker(true);
    void loadProjects().catch((err) => {
      console.error('Failed to refresh projects for import:', err);
    });
  };

  const handleSelectProject = (projectId: string | null) => {
    if (!projectId) {
      handleClearSelectedProject();
      return;
    }
    void applyProjectImport(projectId, { overwrite: true });
  };

  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedProjectImportable(null);
      return;
    }
    const project = projects.find((entry) => entry.id === selectedProjectId);
    if (!project) {
      setSelectedProjectImportable(null);
      return;
    }
    let cancelled = false;
    void projectHasImportablePricingAsync(selectedProjectId, project).then((importable) => {
      if (!cancelled) setSelectedProjectImportable(importable);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, projects]);

  useEffect(() => {
    if (!showProjectPicker || projects.length === 0) return;
    let cancelled = false;
    void Promise.all(
      projects.map(async (project) => {
        const importable = await projectHasImportablePricingAsync(project.id, project);
        return [project.id, importable] as const;
      }),
    ).then((entries) => {
      if (!cancelled) {
        setProjectImportability(Object.fromEntries(entries));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [showProjectPicker, projects]);

  const handleClearSelectedProject = () => {
    setSelectedProjectId(null);
  };

  const handleUpdateProjectClientInfo = async () => {
    if (!selectedProjectId || !proposalData.clientName.trim()) {
      showImportFeedback(
        'Client name required',
        'warning',
        'Enter a client name before updating the project record.',
      );
      return;
    }

    try {
      setUpdatingProjectClient(true);
      await updateProject(selectedProjectId, {
        clientInfo: projectClientInfoFromProposalData(proposalData),
      });
      showImportFeedback(
        'Project updated',
        'success',
        'Project client information was updated from this proposal.',
      );
    } catch (error) {
      console.error('Failed to update project client info:', error);
      showImportFeedback(
        'Update failed',
        'error',
        'Could not update project client information.',
      );
    } finally {
      setUpdatingProjectClient(false);
    }
  };

  const hasPricingLines =
    (proposalData.laborItems?.length ?? 0) +
      (proposalData.materialItems?.length ?? 0) +
      (proposalData.equipmentItems?.length ?? 0) +
      (proposalData.subcontractorItems?.length ?? 0) >
    0;

  const showPricingWarning =
    Boolean(selectedProjectId) &&
    !hasPricingLines &&
    selectedProjectImportable === false;

  const workflowProject = workflowProjectId
    ? projects.find((p) => p.id === workflowProjectId)
    : undefined;

  const resolveLinkedProjectId = (data: ProposalData): string | null | undefined => {
    if (selectedProjectId) return selectedProjectId;
    if (workflowProjectId) return workflowProjectId;
    if (currentProposal?.project_id) return currentProposal.project_id;
    const title = data.projectTitle?.trim() || proposalTitle.trim();
    if (!title) return undefined;
    const matched = projects.find((p) => {
      const name = p.name?.trim();
      if (!name) return false;
      const lowerTitle = title.toLowerCase();
      const lowerName = name.toLowerCase();
      return title === name || lowerTitle.includes(lowerName) || lowerName.includes(lowerTitle);
    });
    return matched?.id;
  };

  const showConcreteToolActions = projectHasConcreteWork(workflowProject);

  const finishWorkflowToProject = () => {
    if (!workflowProjectId) return;
    recordVisit(workflowProjectId, 'proposal');
    navigateToProjectDetail(navigate, workflowProjectId);
  };

  const goToMixDesign = () => {
    if (!workflowProjectId) return;
    navigate(
      {
        pathname: '/mix-design-advisor',
        search: workflowConcreteToolQuery(workflowProjectId, workflowState?.calculationId),
      },
      {
        state: workflowNavigateState(workflowProjectId, {
          calculationId: workflowState?.calculationId,
        }),
      },
    );
  };

  const goToPlacementPlanner = () => {
    if (!workflowProjectId) return;
    navigate(
      {
        pathname: '/pour-planner',
        search: workflowConcreteToolQuery(workflowProjectId, workflowState?.calculationId),
      },
      {
        state: workflowNavigateState(workflowProjectId, {
          calculationId: workflowState?.calculationId,
        }),
      },
    );
  };

  const skipProposal = () => {
    finishWorkflowToProject();
  };

  // Update proposal data when company settings change (for new proposals)
  useEffect(() => {
    if (!isEditing) {
      const businessParts = parseLegacyUSAddress(companySettings.address || '');
      setProposalData((prev) =>
        hydrateProposalAddresses({
          ...prev,
          businessName: companySettings.companyName || prev.businessName,
          businessLogoUrl: companySettings.logo || prev.businessLogoUrl,
          businessAddress: companySettings.address || prev.businessAddress,
          businessAddressParts: businessParts,
          businessPhone: companySettings.phone || prev.businessPhone,
          businessEmail: companySettings.email || prev.businessEmail,
          businessLicenseNumber: companySettings.licenseNumber || prev.businessLicenseNumber,
          businessSlogan: companySettings.motto || prev.businessSlogan,
        }),
      );
    }
  }, [companySettings, isEditing]);

  // Save proposal function
  const handleSave = async () => {
    if (!proposalTitle.trim()) {
      showImportFeedback('Proposal title required', 'warning', 'Please enter a proposal title.');
      return;
    }

    try {
      setSaving(true);
      
      const dataToSave = syncProposalAddressesForSave(proposalData);
      setProposalData(dataToSave);

      if (isEditing && currentProposal) {
        const linkedProjectId = resolveLinkedProjectId(dataToSave);
        await ProposalService.update(currentProposal.id, {
          title: proposalTitle,
          template_type: selectedTemplate,
          data: dataToSave,
          ...(linkedProjectId ? { project_id: linkedProjectId } : {}),
        });
        if (!inWorkflow) {
          showImportFeedback('Proposal updated', 'success', 'Your changes were saved successfully.');
        } else {
          setWorkflowStepReady(true);
          showImportFeedback('Proposal saved', 'success', 'Proposal saved successfully.');
        }
      } else {
        const linkedProjectId = resolveLinkedProjectId(dataToSave);
        const savedProposal = await ProposalService.create({
          title: proposalTitle,
          template_type: selectedTemplate,
          data: dataToSave,
          ...(linkedProjectId ? { project_id: linkedProjectId } : {}),
        });
        setCurrentProposal(savedProposal);
        if (inWorkflow) {
          setWorkflowStepReady(true);
          showImportFeedback('Proposal saved', 'success', 'Proposal saved successfully.');
          navigate(
            {
              pathname: '/proposal-generator',
              search: workflowQuery(workflowProjectId),
            },
            {
              replace: true,
              state: {
                ...workflowNavigateState(workflowProjectId),
                projectName: proposalData.projectTitle,
              },
            },
          );
        } else {
          showImportFeedback('Proposal saved', 'success', 'Your proposal was saved successfully.');
          navigate(`/proposal-generator?edit=${savedProposal.id}`, { replace: true });
        }
      }
    } catch (error) {
      console.error('Failed to save proposal:', error);
      showImportFeedback(
        'Save failed',
        'error',
        error instanceof Error && import.meta.env.DEV
          ? error.message
          : 'Could not save proposal',
      );
    } finally {
      setSaving(false);
    }
  };

  // Auto-generate title from project data
  const generateTitle = () => {
    if (selectedProjectId) {
      const project = projects.find((item) => item.id === selectedProjectId);
      if (project) {
        setProposalTitle(buildDefaultProposalTitle(project.name));
        return;
      }
    }

    const parts = [];
    if (proposalData.projectTitle) parts.push(proposalData.projectTitle);
    if (proposalData.clientName) parts.push(`for ${proposalData.clientName}`);

    const generated =
      parts.length > 0
        ? parts.join(' ')
        : `Proposal - ${new Date().toLocaleDateString()}`;

    setProposalTitle(generated);
  };

  const handleInputChange = (field: keyof ProposalData, value: string) => {
    setProposalData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleBusinessAddressPartsChange = (parts: USAddress) => {
    setProposalData((prev) =>
      hydrateProposalAddresses({
        ...prev,
        businessAddressParts: parts,
      }),
    );
  };

  const handleClientAddressPartsChange = (parts: USAddress) => {
    setProposalData((prev) =>
      hydrateProposalAddresses({
        ...prev,
        clientAddressParts: parts,
      }),
    );
  };

  const handleTimelineChange = (index: number, field: keyof ProposalData['timeline'][0], value: string) => {
    setProposalData(prev => ({
      ...prev,
      timeline: prev.timeline.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };


  const handlePhoneChange = (value: string) => {
    // Remove all non-numeric characters
    const numericValue = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    let formattedValue = numericValue;
    if (numericValue.length >= 6) {
      formattedValue = `(${numericValue.slice(0, 3)}) ${numericValue.slice(3, 6)}-${numericValue.slice(6, 10)}`;
    } else if (numericValue.length >= 3) {
      formattedValue = `(${numericValue.slice(0, 3)}) ${numericValue.slice(3)}`;
    }
    
    handleInputChange('businessPhone', formattedValue);
  };

  const addTimelineItem = () => {
    setProposalData(prev => ({
      ...prev,
      timeline: [...prev.timeline, { phase: '', start: '', end: '' }]
    }));
  };


  const removeTimelineItem = (index: number) => {
    soundService.play('trash');
    setProposalData(prev => ({
      ...prev,
      timeline: prev.timeline.filter((_, i) => i !== index)
    }));
  };


  const handleBackToEditor = () => {
    if (isPreviewMode && previewId) {
      navigate(`/proposal-generator?edit=${previewId}`, { replace: true });
    }
    setShowPreview(false);
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) {
      showImportFeedback(
        'Download failed',
        'error',
        'Preview not ready for download. Please try again.',
      );
      return;
    }

    try {
      const title = normalizeDisplayText(
        `${proposalData.projectTitle || 'Proposal'} - ${proposalData.businessName || 'Concrete Proposal'}`,
      );
      const htmlContent = printRef.current.innerHTML;

      await generateProposalPDF(htmlContent, title, undefined, selectedTemplate, {
        ...proposalData,
        introduction: resolveProposalIntroductionForDisplay(
          proposalData.introduction,
          proposalData.scope,
          proposalData.projectTitle,
        ),
      });
      showImportFeedback('Proposal PDF downloaded.', 'success');
    } catch (error) {
      console.error('Error generating proposal PDF:', error);
      showImportFeedback(
        'Download failed',
        'error',
        'Could not download proposal PDF. Please try again.',
      );
    }
  };

  const persistProposal = async (): Promise<SavedProposal> => {
    if (!proposalTitle.trim()) {
      throw new Error('Please enter a proposal title');
    }
    const dataToSave = syncProposalAddressesForSave(proposalData);
    setProposalData(dataToSave);

    const linkedProjectId = resolveLinkedProjectId(dataToSave);

    if (isEditing && currentProposal) {
      return ProposalService.update(currentProposal.id, {
        title: proposalTitle,
        template_type: selectedTemplate,
        data: dataToSave,
        ...(linkedProjectId ? { project_id: linkedProjectId } : {}),
      });
    }

    const saved = await ProposalService.create({
      title: proposalTitle,
      template_type: selectedTemplate,
      data: dataToSave,
      ...(linkedProjectId ? { project_id: linkedProjectId } : {}),
    });
    setCurrentProposal(saved);
    if (!inWorkflow) {
      navigate(`/proposal-generator?edit=${saved.id}`, { replace: true });
    }
    return saved;
  };

  const handleSendProposal = async () => {
    try {
      setSaving(true);
      const saved = await persistProposal();
      const linkedProject = saved.project_id
        ? projects.find((entry) => entry.id === saved.project_id)
        : null;
      setSendEmailError(null);
      const defaultRecipientEmail = await resolveProposalSendDefaults(
        saved,
        linkedProject?.clientInfo?.clientEmail,
      );
      setSendEmailModal({
        proposalId: saved.id,
        proposalTitle: normalizeDisplayText(
          saved.data?.projectTitle?.trim() || saved.title?.trim() || 'Proposal',
        ),
        defaultRecipientEmail,
        mode: 'send',
      });
    } catch (error) {
      console.error('Send proposal failed:', error);
      showImportFeedback(
        'Could not send proposal. Please try again.',
        'error',
        error instanceof Error && import.meta.env.DEV
          ? error.message
          : undefined,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSendProposalEmail = async ({ to, cc, messageNote }: ProposalEmailSendPayload) => {
    if (!sendEmailModal) return;
    setSendingEmail(true);
    setSendEmailError(null);
    try {
      await sendProposalEmail({
        proposalId: sendEmailModal.proposalId,
        recipientEmail: to,
        ccEmails: cc,
        messageNote,
        followUp: sendEmailModal.mode === 'followUp',
        senderName: proposalData.businessName || proposalData.preparedBy || undefined,
      });
      const refreshed = await ProposalService.getById(sendEmailModal.proposalId);
      setCurrentProposal(refreshed);
      setSendEmailModal(null);
      setSentProposalUrl(getPublicProposalUrl(refreshed.public_token));
      showImportFeedback('Proposal sent to client.', 'success');
    } catch (error) {
      console.error('Send proposal email failed:', error);
      setSendEmailError('Could not send proposal. Please try again.');
      showImportFeedback('Could not send proposal. Please try again.', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  const proposalFeedbackModals = (
    <>
      {importToast && (
        <Toast
          id="proposal-import-toast"
          title={importToast.title}
          message={importToast.message}
          type={importToast.type}
          onClose={() => setImportToast(null)}
        />
      )}

      <ProposalSentLinkModal
        isOpen={Boolean(sentProposalUrl)}
        onClose={() => setSentProposalUrl(null)}
        proposalUrl={sentProposalUrl ?? ''}
        title="Proposal sent by email"
      />

      <ProposalSendEmailModal
        isOpen={Boolean(sendEmailModal)}
        onClose={() => {
          if (!sendingEmail) setSendEmailModal(null);
        }}
        proposalTitle={sendEmailModal?.proposalTitle ?? 'Proposal'}
        mode={sendEmailModal?.mode}
        defaultRecipientEmail={sendEmailModal?.defaultRecipientEmail}
        sending={sendingEmail}
        error={sendEmailError}
        onSend={handleSendProposalEmail}
      />
    </>
  );

  const getDisplayValue = (value: string | undefined, placeholder: string): string => {
    return normalizeDisplayText(value || placeholder);
  };

  const renderTemplate = () => {
    const displayData: ProposalData = hydrateProposalPricing({
      ...proposalData,
      businessName: getDisplayValue(proposalData.businessName, 'Your Business Name'),
      businessAddress: getDisplayValue(
        displayBusinessAddress(proposalData),
        '123 Main St, Your City, ST 12345, United States',
      ),
      clientName: getDisplayValue(proposalData.clientName, 'Client Name'),
      clientCompany: getDisplayValue(proposalData.clientCompany, 'Client Company'),
      clientAddress: getDisplayValue(
        displayClientAddress(proposalData),
        '456 Client St, Client City, ST 12345, United States',
      ),
      projectTitle: getDisplayValue(proposalData.projectTitle, 'Project Title'),
      introduction: resolveProposalIntroductionForDisplay(
        getDisplayValue(
          proposalData.introduction,
          'Thank you for considering our team for your project. This proposal outlines the scope, schedule, pricing, and assumptions needed for a clear client-ready decision.',
        ),
        proposalData.scope,
        proposalData.projectTitle,
      ),
      scope: getDisplayValue(proposalData.scope, 'Complete the project scope described in the estimate, including labor, materials, equipment, coordination, quality control, and closeout requirements.'),
      timeline: proposalData.timeline.map(item => ({
        phase: getDisplayValue(item.phase, 'Project Phase'),
        start: getDisplayValue(item.start, 'Start Date'),
        end: getDisplayValue(item.end, 'End Date'),
      })),
      terms: getDisplayValue(proposalData.terms, 'A 50% deposit is due upon acceptance of this proposal. Final payment is due upon completion. All work will be performed in accordance with the approved scope, project requirements, and applicable codes. Warranty: 1 year against workmanship defects.'),
      preparedBy: getDisplayValue(proposalData.preparedBy, 'Your Name'),
      preparedByTitle: getDisplayValue(proposalData.preparedByTitle, 'Project Manager'),
    });

    const templateProps = {
      data: displayData,
      audience: 'client' as const,
    };

    switch (selectedTemplate) {
      case 'classic':
        return <ProposalTemplateClassic {...templateProps} />;
      case 'modern':
        return <ProposalTemplateModern {...templateProps} />;
      case 'minimal':
        return <ProposalTemplateMinimal {...templateProps} />;
      default:
        return <ProposalTemplateClassic {...templateProps} />;
    }
  };

  const templatePreviews = {
    classic: {
      name: 'Classic Professional',
      description: 'Formal multi-section proposal with detailed tables.',
      bestFor: 'Best for commercial and government-style submissions.',
    },
    modern: {
      name: 'Modern One-Pager',
      description: 'Condensed proposal with scope, price, and schedule highlights.',
      bestFor: 'Best for residential and quick-turn client review.',
    },
    minimal: {
      name: 'Minimalist Executive',
      description: 'Clean summary-first proposal focused on decision-ready totals.',
      bestFor: 'Best for owners who want a simple, polished view.',
    }
  };

  if (showPreview) {
    return (
      <>
      <ProposalPageBackground />
      <div className={PROPOSAL_PAGE_SHELL}>
      <AppPage data-testid="proposal-preview-page" className="pt-0">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-8"
        >
          <div>
            <h1 className={PAGE_TITLE}>Proposal Preview</h1>
            <p className={PAGE_SUBTITLE}>
              {formatProposalPreviewSubtitle(new Date())}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {templatePreviews[selectedTemplate].name} template
            </p>
            <ProposalPreviewActionBar
              saving={saving}
              onBackToEditor={handleBackToEditor}
              onBackToProposals={
                isPreviewMode && previewId ? () => navigate('/proposals') : undefined
              }
              onSend={handleSendProposal}
              onDownload={handleDownloadPDF}
            />
          </div>

          <div
            ref={printRef}
            data-testid="proposal-preview-shell"
            className={`${SECTION_CARD} w-full min-w-0 overflow-x-auto print:shadow-none print:rounded-none print:border-0 print:bg-white`}
          >
            {renderTemplate()}
          </div>
        </motion.div>
      </AppPage>
      </div>
      {proposalFeedbackModals}
      </>
    );
  }

  // Loading state
  if (loading) {
    return (
      <>
        <ProposalPageBackground />
        <div className={PROPOSAL_PAGE_SHELL}>
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-center py-24">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-400" />
            <p className={`mt-4 ${TEXT_MUTED}`}>Loading proposal...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
    <ProposalPageBackground />
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={PROPOSAL_PAGE_SHELL}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <WorkflowStepHeader />
        {inWorkflow && !workflowStepReady && (
          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/90 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-600/80 dark:bg-slate-900/90">
            <p className={`text-sm ${TEXT_BODY}`}>
              Skip this step if you do not need a formal proposal {'\u2014'} you can return to the project
              and use concrete tools from Tools when needed.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={skipProposal}
              icon={<SkipForward size={16} />}
              className="shrink-0"
            >
              Skip to project
            </Button>
          </div>
        )}
        {inWorkflow && workflowStepReady && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex flex-col flex-wrap gap-3 rounded-xl border border-cyan-200 bg-cyan-50/80 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-cyan-700/40 dark:bg-slate-900/90"
          >
            <p className="text-sm text-cyan-900 dark:text-cyan-100/90">
              {showConcreteToolActions
                ? 'Proposal saved. Open the project to continue, or use optional concrete tools first.'
                : 'Proposal saved. Open the project to continue managing this job.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {showConcreteToolActions && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToMixDesign}
                    icon={<Beaker size={16} />}
                  >
                    Mix design
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPlacementPlanner}
                    icon={<CloudSun size={16} />}
                  >
                    Placement planner
                  </Button>
                </>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={finishWorkflowToProject}
                icon={<FileText size={16} />}
              >
                Open project
              </Button>
            </div>
          </motion.div>
        )}
        <div className="mb-8 flex flex-col gap-5 rounded-3xl border border-cyan-200/80 bg-white/90 p-5 shadow-xl shadow-slate-200/60 backdrop-blur-xl dark:border-cyan-500/20 dark:bg-slate-950/70 dark:shadow-2xl dark:shadow-cyan-950/20 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <nav className={`mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] ${TEXT_ACCENT}`}>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="hover:text-cyan-800 dark:hover:text-cyan-200"
              >
                Dashboard
              </button>
              <span className="text-slate-400 dark:text-slate-600" aria-hidden>
                /
              </span>
              <button
                type="button"
                onClick={() => navigate('/proposals')}
                className="hover:text-cyan-800 dark:hover:text-cyan-200"
              >
                Proposals
              </button>
            </nav>
            <h1 className={PAGE_TITLE}>{isEditing ? 'Edit Proposal' : 'Proposal Builder'}</h1>
            <p className={PAGE_SUBTITLE}>
              {normalizeDisplayText(
                isEditing
                  ? `Editing: ${currentProposal?.title || 'Untitled Proposal'}`
                  : 'Create client-ready proposals from your project estimate, scope, pricing, and schedule.',
              )}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void (async () => {
                  if (isEditing) {
                    navigate('/proposals');
                    return;
                  }

                  const hasChanges =
                    proposalData.businessName ||
                    proposalData.clientName ||
                    proposalData.projectTitle ||
                    proposalData.introduction ||
                    proposalData.scope ||
                    proposalTitle;

                  if (hasChanges) {
                    const ok = await confirm({
                      title: 'Confirm Cancel',
                      message:
                        'You have unsaved changes.\n\nIf you leave this page now, your changes will be lost.',
                      cancelLabel: 'Stay Here',
                      confirmLabel: 'Discard Changes',
                      confirmVariant: 'danger',
                      showWarningIcon: true,
                    });
                    if (!ok) return;
                  }

                  navigate('/proposals');
                })();
              }}
              icon={<ArrowLeft size={16} />}
              className={OUTLINE_BUTTON_CLASS}
            >
              {isEditing ? 'Back' : 'Cancel'}
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={handleSave}
              disabled={saving || !proposalTitle.trim()}
              isLoading={saving}
              icon={<Save size={16} />}
            >
              Save Draft
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(true)}
              icon={<FileText size={16} />}
              className={OUTLINE_BUTTON_CLASS}
            >
              Preview
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendProposal}
              disabled={saving || !proposalTitle.trim()}
              icon={<Send size={16} />}
              className={OUTLINE_BUTTON_CLASS}
            >
              Send to Client
            </Button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-6xl space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <ProposalSetupPanel
                projects={projects}
                selectedProjectId={selectedProjectId}
                onSelectProject={handleSelectProject}
                showProjectImport={!isEditing}
                proposalTitle={proposalTitle}
                onProposalTitleChange={setProposalTitle}
                onAutoGenerateTitle={generateTitle}
              />
            </motion.div>

            {/* Template Selection */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className={SECTION_CARD}
            >
              <h2 className={SECTION_TITLE}>Choose Template</h2>
              <p className={SECTION_HELP}>
                Pick the client-facing proposal format that best matches the submission.
              </p>
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                {Object.entries(templatePreviews).map(([key, template]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedTemplate(key as TemplateType)}
                    aria-selected={selectedTemplate === key}
                    className={[
                      'rounded-2xl border p-4 text-left transition-all',
                      selectedTemplate === key
                        ? 'border-cyan-500 bg-cyan-50 shadow-lg shadow-cyan-200/50 dark:border-cyan-400 dark:bg-cyan-500/10 dark:shadow-cyan-950/30'
                        : 'border-slate-200 bg-white hover:border-cyan-400 hover:bg-cyan-50/50 dark:border-slate-700/70 dark:bg-slate-950/40 dark:hover:border-cyan-500/60 dark:hover:bg-slate-900/80',
                      FOCUS_RING,
                    ].join(' ')}
                  >
                    <div className="mb-4 h-20 rounded-xl border border-slate-200 bg-slate-100 p-3 dark:border-slate-700/70 dark:bg-slate-900/70">
                      <div className="mb-2 h-2 w-20 rounded-full bg-cyan-500/70 dark:bg-cyan-400/70" />
                      <div className="mb-2 h-2 w-full rounded-full bg-slate-300 dark:bg-slate-700" />
                      <div className="h-2 w-2/3 rounded-full bg-slate-300 dark:bg-slate-700" />
                    </div>
                    <h3 className={`font-semibold ${TEXT_FOREGROUND}`}>{template.name}</h3>
                    <p className={`mt-2 text-sm ${TEXT_BODY}`}>{template.description}</p>
                    <p className={`mt-3 text-xs font-medium ${TEXT_ACCENT}`}>{template.bestFor}</p>
                  </button>
                ))}
              </div>
            </motion.div>

            <ProposalClientRecipientSection
              data={proposalData}
              selectedProjectId={selectedProjectId}
              onFieldChange={handleInputChange}
              onAddressChange={handleClientAddressPartsChange}
              onUpdateProjectClientInfo={
                selectedProjectId ? handleUpdateProjectClientInfo : undefined
              }
              updatingProjectClient={updatingProjectClient}
            />

            {/* Project Details */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className={SECTION_CARD}
            >
              <h2 className={SECTION_TITLE}>Project Details</h2>
              <p className={SECTION_HELP}>
                Define the client-facing scope, date, and schedule narrative for this proposal.
              </p>
              <div className="space-y-4">
                <div>
                  <label className={FORM_LABEL}>Project Title</label>
                  <input
                    type="text"
                    placeholder="Project Title"
                    value={proposalData.projectTitle}
                    onChange={(e) => handleInputChange('projectTitle', e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className={FORM_LABEL}>Date</label>
                  <input
                    type="text"
                    placeholder="Today's Date"
                    value={proposalData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className={FORM_LABEL}>Introduction</label>
                  <textarea
                    placeholder="Thank you for considering our team for your project. This proposal outlines the scope, schedule, pricing, and assumptions needed for a clear client-ready decision."
                    value={proposalData.introduction}
                    onChange={(e) => handleInputChange('introduction', e.target.value)}
                    rows={3}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className={FORM_LABEL}>Scope of Work</label>
                  <textarea
                    placeholder="Complete the project scope described in the estimate, including labor, materials, equipment, coordination, quality control, and closeout requirements."
                    value={proposalData.scope}
                    onChange={(e) => handleInputChange('scope', e.target.value)}
                    rows={4}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            </motion.div>

            {/* Timeline */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className={SECTION_CARD}
            >
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className={SECTION_TITLE}>Project Timeline</h2>
                  <p className={SECTION_HELP}>
                    Add schedule phases clients can understand at a glance.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTimelineItem}
                  icon={<Plus size={16} />}
                >
                  Add Phase
                </Button>
              </div>
              <div className="space-y-3">
                {proposalData.timeline.map((item, index) => (
                  <div key={index} className={`${PREMIUM_INNER_PANEL} grid grid-cols-1 gap-3 p-4 md:grid-cols-4 md:items-end`}>
                    <div>
                      <label className={FORM_LABEL}>Phase</label>
                      <input
                        type="text"
                        placeholder="Project Phase"
                        value={item.phase}
                        onChange={(e) => handleTimelineChange(index, 'phase', e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className={FORM_LABEL}>Start Date</label>
                      <input
                        type="date"
                        placeholder="Start Date"
                        value={item.start}
                        onChange={(e) => handleTimelineChange(index, 'start', e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className={FORM_LABEL}>End Date</label>
                      <input
                        type="date"
                        placeholder="End Date"
                        value={item.end}
                        onChange={(e) => handleTimelineChange(index, 'end', e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => removeTimelineItem(index)}
                      className="w-full md:w-auto"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Pricing */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className={SECTION_CARD}
            >
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className={SECTION_TITLE}>Estimate / Pricing Summary</h2>
                  <p className={SECTION_HELP}>
                    Review imported estimate lines, pricing controls, internal cost, and final sale price.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="accent"
                    size="sm"
                    onClick={openProjectPicker}
                    icon={<Upload size={14} />}
                  >
                    <span className="hidden sm:inline">Import Current Estimate</span>
                    <span className="sm:hidden">Import</span>
                  </Button>
                </div>
              </div>

              {showPricingWarning && (
                <p
                  className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200"
                  data-testid="proposal-pricing-warning"
                >
                  No estimate totals were found on the selected project. Add estimates in the
                  estimate workspace or enter pricing manually below.
                </p>
              )}

              <ProposalPricingEditor
                laborItems={proposalData.laborItems ?? []}
                materialItems={proposalData.materialItems ?? []}
                equipmentItems={proposalData.equipmentItems ?? []}
                subcontractorItems={proposalData.subcontractorItems ?? []}
                indirect={proposalIndirectFromData(proposalData, {
                  taxSystem: companySettings.taxSystem,
                  taxRatePercent: companySettings.taxRatePercent,
                  taxApplication: companySettings.taxApplication,
                })}
                companyTax={{
                  taxSystem: companySettings.taxSystem,
                  taxRatePercent: companySettings.taxRatePercent,
                  taxApplication: companySettings.taxApplication,
                }}
                onLaborChange={(laborItems) =>
                  setProposalData((prev) => ({ ...prev, laborItems }))
                }
                onMaterialChange={(materialItems) =>
                  setProposalData((prev) => ({ ...prev, materialItems }))
                }
                onEquipmentChange={(equipmentItems) =>
                  setProposalData((prev) => ({ ...prev, equipmentItems }))
                }
                onSubcontractorChange={(subcontractorItems) =>
                  setProposalData((prev) => ({ ...prev, subcontractorItems }))
                }
                onIndirectChange={(pricingIndirect) =>
                  setProposalData((prev) => ({ ...prev, pricingIndirect }))
                }
              />
            </motion.div>

            {/* Terms & Footer */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              className={SECTION_CARD}
            >
              <h2 className={SECTION_TITLE}>Terms & Footer</h2>
              <p className={SECTION_HELP}>
                Set proposal terms and the sender details shown in the client-facing document.
              </p>
              <div className="space-y-4">
                <div>
                  <label className={FORM_LABEL}>Terms & Conditions</label>
                  <textarea
                    placeholder="A 50% deposit is due upon acceptance of this proposal. Final payment is due upon completion. All work will be performed in accordance with the approved scope, project requirements, and applicable codes."
                    value={proposalData.terms}
                    onChange={(e) => handleInputChange('terms', e.target.value)}
                    rows={4}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={FORM_LABEL}>Prepared By</label>
                    <input
                      type="text"
                      placeholder="Your Name"
                      value={proposalData.preparedBy}
                      onChange={(e) => handleInputChange('preparedBy', e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className={FORM_LABEL}>Title (optional)</label>
                    <input
                      type="text"
                      placeholder="Project Manager"
                      value={proposalData.preparedByTitle || ''}
                      onChange={(e) => handleInputChange('preparedByTitle', e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            <ProposalBusinessInfoCollapsible
              data={proposalData}
              expanded={businessInfoExpanded}
              onToggleExpanded={() => setBusinessInfoExpanded((prev) => !prev)}
              onFieldChange={handleInputChange}
              onAddressChange={handleBusinessAddressPartsChange}
              onPhoneChange={handlePhoneChange}
            />
        </div>

      <Modal
        isOpen={showProjectPicker}
        onClose={() => setShowProjectPicker(false)}
        title="Import current estimate"
        size="md"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Select a project to import pricing from the current estimate workspace or saved legacy
          estimates into this proposal.
        </p>

        {projects.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No projects found</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Create a project and save at least one estimate on step 2 to import pricing.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {projects.map((project) => {
              const sources = getProjectEstimateSourceLabels(project);
              const canImport =
                projectImportability[project.id] ?? projectHasImportablePricing(project);
              const legacyLineCount = canImport
                ? countProposalLineItemsFromProject(project)
                : 0;
              return (
                <button
                  key={project.id}
                  type="button"
                  disabled={!canImport || importingPricing}
                  className={`w-full text-left border rounded-lg p-3 transition-colors ${
                    canImport
                      ? 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 cursor-pointer'
                      : 'border-gray-200/80 dark:border-gray-700 opacity-60 cursor-not-allowed'
                  }`}
                  onClick={() => void importPricingFromProject(project.id)}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {project.name}
                      </h4>
                      {project.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                          {project.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {canImport ? (
                          <>
                            {sources.length > 0 ? (
                              <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                {sources.join(' · ')}
                              </span>
                            ) : (
                              <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                Current estimate
                              </span>
                            )}
                            <span>
                              {legacyLineCount > 0
                                ? `${legacyLineCount} legacy pricing line${legacyLineCount === 1 ? '' : 's'}`
                                : 'Estimate totals available'}
                            </span>
                          </>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-400">
                            No saved estimates — add an estimate first
                          </span>
                        )}
                        <span>
                          {project.createdAt
                            ? new Date(project.createdAt).toLocaleDateString()
                            : 'No date'}
                        </span>
                      </div>
                    </div>
                    {canImport && (
                      <span className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden>
                        <Upload size={16} />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={() => setShowProjectPicker(false)}
          >
            Cancel
          </Button>
        </div>
      </Modal>

      {proposalFeedbackModals}
      </div>
    </motion.div>
    </>
  );
};

export default ProposalGenerator; 