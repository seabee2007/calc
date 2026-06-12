import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Save, Edit, ArrowLeft, Download, Mail, FileText, Plus, Upload, Beaker, CloudSun, SkipForward, Send, Link2 } from 'lucide-react';
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
  markProposalSent,
} from '../lib/proposalTracking';
import ProposalTemplateClassic from '../components/proposals/ProposalTemplateClassic';
import ProposalTemplateModern from '../components/proposals/ProposalTemplateModern';
import ProposalTemplateMinimal from '../components/proposals/ProposalTemplateMinimal';
import ProposalSentLinkModal from '../components/proposals/ProposalSentLinkModal';
import ProposalSendEmailModal from '../components/proposals/ProposalSendEmailModal';
import { sendProposalEmail } from '../services/emailService';
import Button from '../components/ui/Button';
import { generateProposalPDF } from '../utils/pdf';
import { useSettingsStore } from '../store';
import { useProjectStore } from '../store';
import {
  buildProposalLineItemsFromProject,
  countProposalLineItemsFromProject,
  getProjectEstimateSourceLabels,
  projectHasImportablePricing,
} from '../utils/proposalPricingImport';
import ProposalPricingEditor, {
  proposalIndirectFromData,
} from '../components/proposals/ProposalPricingEditor';
import {
  emptyProposalPricingState,
  hydrateProposalPricing,
} from '../utils/proposalPricing';
import Modal from '../components/ui/Modal';
import Toast, { type ToastType } from '../components/ui/Toast';
import { soundService } from '../services/soundService';
import { useConfirm } from '../contexts/ConfirmContext';
import USAddressFields from '../components/address/USAddressFields';
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
import { APP_SECTION_CARD, FORM_TEXTAREA } from '../theme/appTheme';
import { CC_PAGE_SUBTITLE, CC_PAGE_TITLE } from '../theme/pageTypography';

type TemplateType = 'classic' | 'modern' | 'minimal';

/** Matches site pages: header on concrete, content in rounded cards. */
const PAGE_TITLE = CC_PAGE_TITLE;
const PAGE_SUBTITLE = `${CC_PAGE_SUBTITLE} mt-2`;
const SECTION_CARD = APP_SECTION_CARD;
const SECTION_TITLE = 'text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4';

const ProposalGenerator: React.FC = () => {
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editId = searchParams.get('edit');
  const previewId = searchParams.get('preview');
  const isEditing = !!editId;
  const isPreviewMode = !!previewId;
  const { companySettings } = useSettingsStore();
  const { projects, loadProjects } = useProjectStore();
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

  // Handle project data from navigation state (guided workflow)
  useEffect(() => {
    const state = workflowState;
    if (isEditing || isPreviewMode) return;

    const projectId = state?.projectId ?? workflowProjectId;
    const project = projectId ? projects.find((p) => p.id === projectId) : undefined;
    const draft = projectId ? getProposalDraft(projectId) : undefined;
    if (draft && !proposalDraftRestoredRef.current) {
      setProposalData(
        hydrateProposalPricing(
          mergeProjectIntoProposalFields(draft.proposalData, project),
        ),
      );
      setProposalTitle(draft.proposalTitle);
      setSelectedTemplate(draft.selectedTemplate);
      setShowPreview(draft.showPreview);
      proposalDraftRestoredRef.current = true;
      if (projectId) importedPricingRef.current = projectId;
      return;
    }
    proposalDraftRestoredRef.current = true;

    const projectName = state?.projectName ?? project?.name;
    const projectDescription = state?.projectDescription ?? project?.description;

    if (projectName) {
      setProposalTitle((prev) => prev || `${projectName} - Concrete Proposal`);
      setProposalData((prev) =>
        mergeProjectIntoProposalFields(
          {
            ...prev,
            projectTitle: projectName,
            introduction: projectDescription
              ? `We are pleased to submit this proposal for your ${projectName} project. ${projectDescription}`
              : `We are pleased to submit this proposal for your ${projectName || 'concrete'} project.`,
            scope: `This proposal covers all concrete work required for the ${projectName || 'concrete'} project, including materials, labor, and related services.`,
          },
          project,
        ),
      );
    } else if (project) {
      setProposalData((prev) => mergeProjectIntoProposalFields(prev, project));
    }

    const hasImportablePricing = project ? projectHasImportablePricing(project) : false;

    if (
      projectId &&
      importedPricingRef.current !== projectId &&
      hasImportablePricing
    ) {
      importedPricingRef.current = projectId;
      importPricingFromProject(projectId, { silent: true });
    }
  }, [
    workflowState,
    workflowProjectId,
    isEditing,
    isPreviewMode,
    projects,
    getProposalDraft,
  ]);

  // Jobsite may load after projects fetch â€” fill client address when it arrives.
  useEffect(() => {
    if (isEditing || isPreviewMode) return;
    const projectId = workflowState?.projectId ?? workflowProjectId;
    if (!projectId) return;
    const project = projects.find((p) => p.id === projectId);
    if (!project?.jobsiteAddress) return;
    setProposalData((prev) =>
      mergeProjectJobsiteIntoClientAddress(prev, project.jobsiteAddress),
    );
  }, [
    workflowProjectId,
    workflowState?.projectId,
    projects,
    isEditing,
    isPreviewMode,
  ]);

  const showImportFeedback = (
    title: string,
    type: ToastType,
    message?: string,
    options?: { silent?: boolean },
  ) => {
    if (options?.silent) return;
    setImportToast({ title, message, type });
  };

  const importPricingFromProject = (
    projectId: string,
    options?: { silent?: boolean },
  ) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      showImportFeedback('Import failed', 'error', 'Project not found.', options);
      return;
    }

    if (!projectHasImportablePricing(project)) {
      showImportFeedback(
        'No estimates to import',
        'warning',
        'Save at least one estimate on step 2 (concrete, reinforcement, labor, or custom) to this project.',
        options,
      );
      return;
    }

    const lineItems = buildProposalLineItemsFromProject(project);
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
            projectTitle: prev.projectTitle || `${project.name} Concrete Work`,
            pricingIndirect: {
              ...proposalIndirectFromData(prev, {
                taxSystem: companySettings.taxSystem,
                taxRatePercent: companySettings.taxRatePercent,
                taxApplication: companySettings.taxApplication,
              }),
              wasteFactorPercent: project.wasteFactor ?? 10,
            },
          }),
          project.jobsiteAddress,
        ),
        {
          taxSystem: companySettings.taxSystem,
          taxRatePercent: companySettings.taxRatePercent,
          taxApplication: companySettings.taxApplication,
        },
      ),
    );

    setShowProjectPicker(false);
    const sources = getProjectEstimateSourceLabels(project);
    const sourcesLabel = sources.length > 0 ? sources.join(', ') : 'saved estimates';
    showImportFeedback(
      'Pricing imported',
      'success',
      `Added ${lineCount} line(s) from "${project.name}" (${sourcesLabel}).`,
      options,
    );
  };

  const openProjectPicker = () => {
    setShowProjectPicker(true);
    void loadProjects().catch((err) => {
      console.error('Failed to refresh projects for import:', err);
    });
  };

  const workflowProject = workflowProjectId
    ? projects.find((p) => p.id === workflowProjectId)
    : undefined;

  const resolveLinkedProjectId = (data: ProposalData): string | null | undefined => {
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
        'Could not save proposal',
      );
    } finally {
      setSaving(false);
    }
  };

  // Auto-generate title from project data
  const generateTitle = () => {
    const parts = [];
    if (proposalData.projectTitle) parts.push(proposalData.projectTitle);
    if (proposalData.clientName) parts.push(`for ${proposalData.clientName}`);
    
    const generated = parts.length > 0 
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


  const handleDownloadPDF = async () => {
    if (!printRef.current) {
      alert('Preview not ready for download. Please try again in a moment.');
      return;
    }

    try {
      const title = `${proposalData.projectTitle || 'Proposal'} - ${proposalData.businessName || 'Concrete Proposal'}`;
      const htmlContent = printRef.current.innerHTML;
      
      await generateProposalPDF(htmlContent, title, undefined, selectedTemplate, proposalData);
      console.log('Proposal PDF generated successfully');
    } catch (error) {
      console.error('Error generating proposal PDF:', error);
      alert('Failed to generate PDF. Please try again.');
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
      setSendEmailModal({
        proposalId: saved.id,
        proposalTitle:
          saved.data?.projectTitle?.trim() || saved.title?.trim() || 'Proposal',
        defaultRecipientEmail: linkedProject?.clientInfo?.clientEmail?.trim() ?? '',
      });
    } catch (error) {
      console.error('Send proposal failed:', error);
      alert(
        error instanceof Error ? error.message : 'Failed to send proposal.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSendProposalEmail = async (recipientEmail: string) => {
    if (!sendEmailModal) return;
    setSendingEmail(true);
    setSendEmailError(null);
    try {
      await sendProposalEmail({
        proposalId: sendEmailModal.proposalId,
        recipientEmail,
        senderName: proposalData.businessName || proposalData.preparedBy || undefined,
      });
      const refreshed = await ProposalService.getById(sendEmailModal.proposalId);
      setSendEmailModal(null);
      setSentProposalUrl(getPublicProposalUrl(refreshed.public_token));
    } catch (error) {
      setSendEmailError(
        error instanceof Error ? error.message : 'Failed to send proposal email.',
      );
    } finally {
      setSendingEmail(false);
    }
  };

  const handleEmailProposal = async () => {
    if (!printRef.current) {
      alert('Preview not ready for email. Please try again in a moment.');
      return;
    }

    try {
      setSaving(true);
      const saved = await persistProposal();
      const sent = await markProposalSent(saved.id);
      const proposalUrl = getPublicProposalUrl(sent.public_token);

      const title = `${proposalData.projectTitle || 'Proposal'} - ${proposalData.businessName || 'Concrete Proposal'}`;
      const htmlContent = printRef.current.innerHTML;

      await generateProposalPDF(htmlContent, title, undefined, selectedTemplate, proposalData);

      if (!('Capacitor' in window)) {
        const subject = encodeURIComponent(
          `Concrete Proposal - ${proposalData.projectTitle || 'Project'}`,
        );
        const body = encodeURIComponent(
          `Please review our proposal online:\n${proposalUrl}\n\nProject: ${proposalData.projectTitle || 'Project'}\nClient: ${proposalData.clientName || 'Client'}\n\n${proposalData.introduction || ''}\n\nBest regards,\n${proposalData.preparedBy || ''}\n${proposalData.preparedByTitle || ''}`,
        );
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
      }
    } catch (error) {
      console.error('Error preparing proposal for email:', error);
      alert('Failed to prepare proposal for email. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getDisplayValue = (value: string | undefined, placeholder: string): string => {
    return value || placeholder;
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
      introduction: getDisplayValue(proposalData.introduction, 'Thank you for considering our concrete services for your project. We specialize in high-strength, durable mixes designed for commercial and residential applications.'),
      scope: getDisplayValue(proposalData.scope, 'Supply and place ready-mix concrete, including all forms, vapor barriers, reinforcement placement, slump testing, and finishing to ACI standards.'),
      timeline: proposalData.timeline.map(item => ({
        phase: getDisplayValue(item.phase, 'Project Phase'),
        start: getDisplayValue(item.start, 'Start Date'),
        end: getDisplayValue(item.end, 'End Date'),
      })),
      terms: getDisplayValue(proposalData.terms, 'A 50% deposit is due upon acceptance of this proposal. Final payment is due upon completion. All work performed in accordance with ACI standards and local building codes. Warranty: 1 year against workmanship defects.'),
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
      description: 'Traditional business proposal with formal tables and clean layout',
      color: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
    },
    modern: {
      name: 'Modern One-Pager',
      description: 'Contemporary design with cards and two-column layout',
      color: 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800'
    },
    minimal: {
      name: 'Minimalist Executive',
      description: 'Clean, simple design focused on essential information',
      color: 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
    }
  };

  const proposalPreviewShellClass =
    'w-full max-w-5xl mx-auto min-w-0 [&>div]:mx-0 [&>div]:w-full [&>div]:max-w-none';

  if (showPreview) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"
      >
        <div className="mb-8">
          <h1 className={PAGE_TITLE}>Proposal Preview</h1>
          <p className={PAGE_SUBTITLE}>
            Proposal â€”{' '}
            {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {templatePreviews[selectedTemplate].name} template
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
              {isPreviewMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/proposals')}
                  icon={<ArrowLeft size={18} />}
                >
                  <span className="hidden md:inline">Back to Proposals</span>
                </Button>
              )}
              {isPreviewMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/proposal-generator?edit=${previewId}`)}
                  icon={<Edit size={18} />}
                >
                  <span className="hidden md:inline">Edit</span>
                </Button>
              )}
              {!isPreviewMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(false)}
                  icon={<ArrowLeft size={18} />}
                >
                  <span className="hidden md:inline">Back to Editor</span>
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={handleSendProposal}
                disabled={saving}
                isLoading={saving}
                icon={<Send size={18} />}
              >
                <span className="hidden md:inline">Send to Client</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEmailProposal}
                disabled={saving}
                icon={<Mail size={18} />}
              >
                <span className="hidden md:inline">Email</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleDownloadPDF}
                icon={<Download size={18} />}
              >
                <span className="hidden md:inline">Download PDF</span>
              </Button>
            </div>
        </div>

        <div className="flex w-full justify-center">
          <div
            ref={printRef}
            className={`${SECTION_CARD} ${proposalPreviewShellClass} overflow-hidden print:shadow-none print:rounded-none print:border-0 print:bg-white`}
          >
            {renderTemplate()}
          </div>
        </div>
      </motion.div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto flex flex-col items-center justify-center py-24">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-600 dark:border-cyan-400" />
        <p className="mt-4 text-slate-600 dark:text-slate-300">Loading proposal...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"
    >
        <WorkflowStepHeader />
        {inWorkflow && !workflowStepReady && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-600/80 bg-slate-900/90 p-4">
            <p className="text-sm text-slate-300">
              Skip this step if you do not need a formal proposal â€” you can return to the project
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
            className="mb-6 rounded-xl border border-cyan-700/40 bg-slate-900/90 p-4 flex flex-col sm:flex-row flex-wrap gap-3 sm:items-center sm:justify-between"
          >
            <p className="text-sm text-cyan-100/90">
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
        <div className="mb-8">
          <h1 className={PAGE_TITLE}>
            {isEditing ? 'Edit Proposal' : 'Proposal Generator'}
          </h1>
          <p className={PAGE_SUBTITLE}>
            {isEditing
              ? `Editing: ${currentProposal?.title || 'Untitled Proposal'}`
              : 'Create professional concrete project proposals with customizable templates'}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {isEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/proposals')}
                icon={<ArrowLeft size={18} />}
              >
                Back to Proposals
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void (async () => {
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
                icon={<ArrowLeft size={18} />}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>

        <div className="mx-auto w-full max-w-6xl space-y-6">
            {/* Proposal Title & Save */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={SECTION_CARD}
            >
              <h2 className={SECTION_TITLE}>Proposal Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proposal Title</label>
                  <input
                    type="text"
                    placeholder="Enter proposal title"
                    value={proposalTitle}
                    onChange={(e) => setProposalTitle(e.target.value)}
                    className={FORM_TEXTAREA}
                  />
                </div>
                <div className="md:col-span-1 flex flex-wrap items-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateTitle}
                    className="whitespace-nowrap"
                  >
                    Auto Generate
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSave}
                    disabled={saving || !proposalTitle.trim()}
                    isLoading={saving}
                    icon={<Save size={18} />}
                    className="whitespace-nowrap"
                  >
                    {isEditing ? 'Update' : 'Save'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPreview(true)}
                    icon={<FileText size={18} />}
                    className="whitespace-nowrap"
                  >
                    Preview
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSendProposal}
                    disabled={saving || !proposalTitle.trim()}
                    icon={<Link2 size={18} />}
                    className="whitespace-nowrap"
                  >
                    Send
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* Template Selection */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className={SECTION_CARD}
            >
              <h2 className={SECTION_TITLE}>Choose Template</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(templatePreviews).map(([key, template]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedTemplate(key as TemplateType)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedTemplate === key
                        ? `${template.color} border-current`
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <h3 className="font-semibold text-sm mb-1 text-gray-900 dark:text-white">{template.name}</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-300">{template.description}</p>
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Business Information */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className={SECTION_CARD}
            >
              <h2 className={SECTION_TITLE}>Business Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Business Name</label>
                  <input
                    type="text"
                    placeholder="Your Business Name"
                    value={proposalData.businessName}
                    onChange={(e) => handleInputChange('businessName', e.target.value)}
                    className={FORM_TEXTAREA}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Logo URL (optional)</label>
                  <input
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={proposalData.businessLogoUrl || ''}
                    onChange={(e) => handleInputChange('businessLogoUrl', e.target.value)}
                    className={FORM_TEXTAREA}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Business address
                  </label>
                  <USAddressFields
                    value={proposalData.businessAddressParts ?? { ...EMPTY_US_ADDRESS }}
                    onChange={handleBusinessAddressPartsChange}
                    showStreet2
                    idPrefix="proposal-business"
                  />
                  {displayBusinessAddress(proposalData) && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Formatted: {displayBusinessAddress(proposalData)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={proposalData.businessPhone || ''}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className={FORM_TEXTAREA}
                    inputMode="numeric"
                    pattern="[0-9\s\(\)\-]*"
                    maxLength={14}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="contact@company.com"
                    value={proposalData.businessEmail || ''}
                    onChange={(e) => handleInputChange('businessEmail', e.target.value)}
                    className={FORM_TEXTAREA}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">License Number</label>
                  <input
                    type="text"
                    placeholder="License #12345"
                    value={proposalData.businessLicenseNumber || ''}
                    onChange={(e) => handleInputChange('businessLicenseNumber', e.target.value)}
                    className={FORM_TEXTAREA}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Slogan</label>
                  <input
                    type="text"
                    placeholder="Building Excellence, One Project at a Time"
                    value={proposalData.businessSlogan || ''}
                    onChange={(e) => handleInputChange('businessSlogan', e.target.value)}
                    className={FORM_TEXTAREA}
                  />
                </div>
              </div>
            </motion.div>

            {/* Client Information */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className={SECTION_CARD}
            >
              <h2 className={SECTION_TITLE}>Client Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client Name</label>
                  <input
                    type="text"
                    placeholder="Client Name"
                    value={proposalData.clientName}
                    onChange={(e) => handleInputChange('clientName', e.target.value)}
                    className={FORM_TEXTAREA}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client Company (optional)</label>
                  <input
                    type="text"
                    placeholder="Client Company"
                    value={proposalData.clientCompany || ''}
                    onChange={(e) => handleInputChange('clientCompany', e.target.value)}
                    className={FORM_TEXTAREA}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Client address <span className="font-normal text-gray-500">(optional)</span>
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Leave blank if not needed on the proposal. When entered, use street, city, and
                    state/territory (ZIP optional).
                  </p>
                  <USAddressFields
                    value={proposalData.clientAddressParts ?? { ...EMPTY_US_ADDRESS }}
                    onChange={handleClientAddressPartsChange}
                    showStreet2
                    idPrefix="proposal-client"
                  />
                  {displayClientAddress(proposalData) && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Formatted: {displayClientAddress(proposalData)}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Project Details */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className={SECTION_CARD}
            >
              <h2 className={SECTION_TITLE}>Project Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Title</label>
                  <input
                    type="text"
                    placeholder="Project Title"
                    value={proposalData.projectTitle}
                    onChange={(e) => handleInputChange('projectTitle', e.target.value)}
                    className={FORM_TEXTAREA}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                  <input
                    type="text"
                    placeholder="Today's Date"
                    value={proposalData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    className={FORM_TEXTAREA}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Introduction</label>
                  <textarea
                    placeholder="Thank you for considering our concrete services for your project. We specialize in high-strength, durable mixes designed for commercial and residential applications."
                    value={proposalData.introduction}
                    onChange={(e) => handleInputChange('introduction', e.target.value)}
                    rows={3}
                    className={FORM_TEXTAREA}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scope of Work</label>
                  <textarea
                    placeholder="Supply and place ready-mix concrete, including all forms, vapor barriers, reinforcement placement, slump testing, and finishing to ACI standards."
                    value={proposalData.scope}
                    onChange={(e) => handleInputChange('scope', e.target.value)}
                    rows={4}
                    className={FORM_TEXTAREA}
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
              <div className="flex justify-between items-center mb-4">
                <h2 className={SECTION_TITLE}>Project Timeline</h2>
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
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phase</label>
                      <input
                        type="text"
                        placeholder="Project Phase"
                        value={item.phase}
                        onChange={(e) => handleTimelineChange(index, 'phase', e.target.value)}
                        className={FORM_TEXTAREA}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                      <input
                        type="date"
                        placeholder="Start Date"
                        value={item.start}
                        onChange={(e) => handleTimelineChange(index, 'start', e.target.value)}
                        className={FORM_TEXTAREA}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                      <input
                        type="date"
                        placeholder="End Date"
                        value={item.end}
                        onChange={(e) => handleTimelineChange(index, 'end', e.target.value)}
                        className={FORM_TEXTAREA}
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
              <div className="flex justify-between items-center mb-4">
                <h2 className={SECTION_TITLE}>Pricing</h2>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openProjectPicker}
                    icon={<Upload size={14} />}
                  >
                    <span className="hidden sm:inline">Import from Project</span>
                    <span className="sm:hidden">Import</span>
                  </Button>
                </div>
              </div>

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
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Terms & Conditions</label>
                  <textarea
                    placeholder="A 50% deposit is due upon acceptance of this proposal. Final payment is due upon completion. All work performed in accordance with ACI standards and local building codes. Warranty: 1 year against workmanship defects."
                    value={proposalData.terms}
                    onChange={(e) => handleInputChange('terms', e.target.value)}
                    rows={4}
                    className={FORM_TEXTAREA}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prepared By</label>
                    <input
                      type="text"
                      placeholder="Your Name"
                      value={proposalData.preparedBy}
                      onChange={(e) => handleInputChange('preparedBy', e.target.value)}
                      className={FORM_TEXTAREA}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title (optional)</label>
                    <input
                      type="text"
                      placeholder="Project Manager"
                      value={proposalData.preparedByTitle || ''}
                      onChange={(e) => handleInputChange('preparedByTitle', e.target.value)}
                      className={FORM_TEXTAREA}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
        </div>

      <Modal
        isOpen={showProjectPicker}
        onClose={() => setShowProjectPicker(false)}
        title="Import pricing from project"
        size="md"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Select a project to import saved estimates (concrete, reinforcement, labor, and/or custom)
          into this proposal.
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
              const canImport = projectHasImportablePricing(project);
              const lineCount = canImport
                ? countProposalLineItemsFromProject(project)
                : 0;
              return (
                <button
                  key={project.id}
                  type="button"
                  disabled={!canImport}
                  className={`w-full text-left border rounded-lg p-3 transition-colors ${
                    canImport
                      ? 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 cursor-pointer'
                      : 'border-gray-200/80 dark:border-gray-700 opacity-60 cursor-not-allowed'
                  }`}
                  onClick={() => importPricingFromProject(project.id)}
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
                            <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                              {sources.join(' Â· ')}
                            </span>
                            <span>
                              {lineCount} pricing line{lineCount === 1 ? '' : 's'}
                            </span>
                          </>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-400">
                            No saved estimates â€” complete step 2 first
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
        defaultRecipientEmail={sendEmailModal?.defaultRecipientEmail}
        sending={sendingEmail}
        error={sendEmailError}
        onSend={handleSendProposalEmail}
      />
    </motion.div>
  );
};

export default ProposalGenerator; 