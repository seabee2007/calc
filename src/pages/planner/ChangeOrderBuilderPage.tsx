import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePlannerProject } from '../../contexts/PlannerProjectContext';
import {
  ensurePublicChangeOrderLink,
  fetchChangeOrderById,
  markChangeOrderSent,
  resolveChangeOrderNewDraft,
  saveChangeOrder,
} from '../../services/changeOrderService';
import { fetchProjectClientEmail } from '../../services/projectClientEmailService';
import type { ChangeOrder, ChangeOrderLineItem } from '../../types/changeOrder';
import {
  computePricingBreakdown,
  normalizeLineItems,
} from '../../utils/changeOrderFinancials';
import type { PricingParams } from '../../types/pricingParams';
import {
  defaultPricingParams,
  pricingParamsFromChangeOrder,
} from '../../utils/pricingParams';
import PricingParamsEditor from '../../components/pricing/PricingParamsEditor';
import { useProjectStore, useSettingsStore } from '../../store';
import { changeOrderEditHref, plannerChangeOrdersHref } from '../../utils/plannerRoutes';
import { dispatchPlannerRecordsChanged } from '../../utils/plannerRecordsRefresh';
import ChangeOrderLineItemsEditor from '../../components/change-order/ChangeOrderLineItemsEditor';
import ChangeOrderDocument from '../../components/change-order/ChangeOrderDocument';
import ChangeOrderInternalPricingSummary from '../../components/change-order/ChangeOrderInternalPricingSummary';
import ChangeOrderTrackingStrip from '../../components/change-order/ChangeOrderTrackingStrip';
import SignatureBlock from '../../components/change-order/SignatureBlock';
import ChangeOrderSendEmailModal from '../../components/change-order/ChangeOrderSendEmailModal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Toast from '../../components/ui/Toast';
import { generateChangeOrderPDF } from '../../utils/changeOrderPdf';
import { buildChangeOrderDocumentContext } from '../../utils/changeOrderDocumentContext';
import {
  PLANNER_FORM_LABEL,
  PLANNER_FORM_PANEL,
  PLANNER_INPUT,
  PLANNER_PAGE_BG,
  PLANNER_SECTION_TITLE,
} from '../../components/planner/plannerTheme';

export default function ChangeOrderBuilderPage() {
  const { projectId = '', changeOrderId } = useParams<{
    projectId: string;
    changeOrderId?: string;
  }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isOwner } = useAuth();
  const { project, isOwner: projectOwner, reload } = usePlannerProject();
  const { projects } = useProjectStore();
  const printRef = useRef<HTMLDivElement>(null);
  const persistingRef = useRef(false);
  const [previewAudience, setPreviewAudience] = useState<'client' | 'internal'>('client');

  const isNew = changeOrderId === 'new';
  const [coId, setCoId] = useState<string | null>(isNew ? null : changeOrderId ?? null);
  const [title, setTitle] = useState('');
  const [scope, setScope] = useState('');
  const [reason, setReason] = useState('');
  const [terms, setTerms] = useState('');
  const [scheduleImpact, setScheduleImpact] = useState('');
  const { companySettings } = useSettingsStore();
  const companyTax = {
    taxSystem: companySettings.taxSystem,
    taxRatePercent: companySettings.taxRatePercent,
    taxApplication: companySettings.taxApplication,
  };
  const [pricingParams, setPricingParams] = useState<PricingParams>(() =>
    defaultPricingParams(companyTax),
  );
  const [laborItems, setLaborItems] = useState<ChangeOrderLineItem[]>([]);
  const [materialItems, setMaterialItems] = useState<ChangeOrderLineItem[]>([]);
  const [equipmentItems, setEquipmentItems] = useState<ChangeOrderLineItem[]>([]);
  const [subcontractorItems, setSubcontractorItems] = useState<ChangeOrderLineItem[]>([]);
  const [linkedFarId, setLinkedFarId] = useState<string | null>(null);
  const [linkedRfiId, setLinkedRfiId] = useState<string | null>(null);
  const [linkedTaskId, setLinkedTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<ChangeOrder['status']>('draft');
  const [publicToken, setPublicToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [initDone, setInitDone] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [contractorValidationError, setContractorValidationError] = useState<string | null>(null);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendModalCo, setSendModalCo] = useState<ChangeOrder | null>(null);
  const [sendModalHighlightEmail, setSendModalHighlightEmail] = useState(false);
  const [pageToast, setPageToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const [displayNumber, setDisplayNumber] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [viewedAt, setViewedAt] = useState<string | null>(null);
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [declinedAt, setDeclinedAt] = useState<string | null>(null);
  const [contractorName, setContractorName] = useState('');
  const [contractorSignature, setContractorSignature] = useState('');
  const [contractorSignedAt, setContractorSignedAt] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [clientSignature, setClientSignature] = useState<string | null>(null);
  const [clientSignedAt, setClientSignedAt] = useState<string | null>(null);
  const [clientEmail, setClientEmail] = useState<string | null>(null);
  const [refreshingTracking, setRefreshingTracking] = useState(false);

  const farId = searchParams.get('far');
  const rfiId = searchParams.get('rfi');
  const taskId = searchParams.get('task');

  const applyCoToState = useCallback((co: ChangeOrder) => {
    setCoId(co.id);
    setTitle(co.title);
    setScope(co.scopeDescription);
    setReason(co.reasonForChange);
    setTerms(co.terms);
    setScheduleImpact(co.scheduleImpact ?? '');
    setPricingParams(pricingParamsFromChangeOrder(co));
    setLaborItems(co.laborItems);
    setMaterialItems(co.materialItems);
    setEquipmentItems(co.equipmentItems);
    setSubcontractorItems(co.subcontractorItems ?? []);
    setLinkedFarId(co.linkedFarId);
    setLinkedRfiId(co.linkedRfiId);
    setLinkedTaskId(co.linkedTaskId);
    setStatus(co.status);
    setPublicToken(co.publicToken);
    setDisplayNumber(co.displayNumber);
    setSentAt(co.sentAt);
    setViewedAt(co.viewedAt);
    setOpenedAt(co.openedAt);
    setAcceptedAt(co.acceptedAt);
    setDeclinedAt(co.declinedAt);
    setContractorName(co.contractorName ?? '');
    setContractorSignature(co.contractorSignature ?? '');
    setContractorSignedAt(co.contractorSignedAt);
    setClientName(co.clientName);
    setClientSignature(co.clientSignature);
    setClientSignedAt(co.clientSignedAt);
  }, []);

  const loadOrder = useCallback(
    async (id: string) => {
      const co = await fetchChangeOrderById(id);
      if (!co) return;
      applyCoToState(co);
    },
    [applyCoToState],
  );

  useEffect(() => {
    if (!projectId) return;
    void fetchProjectClientEmail(projectId).then((email) => setClientEmail(email || null));
  }, [projectId]);

  const canManage = Boolean(user && (isOwner || projectOwner));

  // Load an existing change order (separate from create so route transitions are not cancelled).
  useEffect(() => {
    if (!canManage || !projectId || !changeOrderId || changeOrderId === 'new') return;

    let cancelled = false;

    void (async () => {
      setBusy(true);
      setInitError(null);
      setInitDone(false);
      try {
        await loadOrder(changeOrderId);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Could not load change order.';
          setInitError(message);
          console.error('Change order load failed:', err);
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
          setInitDone(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canManage, projectId, changeOrderId, loadOrder]);

  useEffect(() => {
    if (!changeOrderId || changeOrderId === 'new') return;
    setCoId(changeOrderId);
  }, [changeOrderId]);

  // Open /change-orders/new as a local draft — DB insert happens on first save/send only.
  useEffect(() => {
    if (!canManage || !projectId || !isNew || !user) return;

    let cancelled = false;

    void (async () => {
      setBusy(true);
      setInitError(null);
      setInitDone(false);

      try {
        const resolved = await resolveChangeOrderNewDraft({
          projectId,
          farId,
          rfiId,
          taskId,
        });
        if (cancelled) return;

        if (resolved.kind === 'existing') {
          navigate(
            changeOrderEditHref(projectId, resolved.changeOrderId),
            { replace: true },
          );
          return;
        }

        const { prefill } = resolved;
        setTitle(prefill.title);
        setScope(prefill.scopeDescription);
        setReason(prefill.reasonForChange);
        setScheduleImpact(prefill.scheduleImpact ?? '');
        setLinkedFarId(prefill.linkedFarId);
        setLinkedRfiId(prefill.linkedRfiId);
        setLinkedTaskId(prefill.linkedTaskId);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Could not open change order builder.';
          setInitError(message);
          console.error('Change order init failed:', err);
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
          setInitDone(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canManage, projectId, isNew, user, farId, rfiId, taskId, navigate]);

  useEffect(() => {
    if (!coId || (status !== 'sent' && status !== 'viewed')) return;
    const interval = window.setInterval(() => {
      void fetchChangeOrderById(coId).then((co) => {
        if (co) applyCoToState(co);
      });
    }, 30000);
    return () => window.clearInterval(interval);
  }, [coId, status, applyCoToState]);

  const buildSaveInput = useCallback(() => {
    if (!user) throw new Error('Not signed in');
    return {
      projectId,
      userId: user.id,
      title: title.trim() || 'Change order',
      scopeDescription: scope,
      reasonForChange: reason,
      terms,
      scheduleImpact: scheduleImpact || null,
      ...pricingParams,
      laborItems,
      materialItems,
      equipmentItems,
      subcontractorItems,
      linkedFarId,
      linkedRfiId,
      linkedTaskId,
      contractorName: contractorName.trim() || null,
      contractorSignature: contractorSignature.trim() || null,
    };
  }, [
    user,
    projectId,
    title,
    scope,
    reason,
    terms,
    scheduleImpact,
    pricingParams,
    laborItems,
    materialItems,
    equipmentItems,
    subcontractorItems,
    linkedFarId,
    linkedRfiId,
    linkedTaskId,
    contractorName,
    contractorSignature,
  ]);

  const preview = useMemo((): ChangeOrder | null => {
    if (!coId || !user) return null;
    const labor = normalizeLineItems(laborItems, 'labor');
    const material = normalizeLineItems(materialItems, 'material');
    const equipment = normalizeLineItems(equipmentItems, 'equipment');
    const subcontractor = normalizeLineItems(subcontractorItems, 'subcontractor');
    const breakdown = computePricingBreakdown(
      labor,
      material,
      equipment,
      subcontractor,
      pricingParams,
    );
    return {
      id: coId,
      projectId,
      userId: user.id,
      linkedFarId,
      linkedRfiId,
      linkedTaskId,
      displayNumber,
      title,
      scopeDescription: scope,
      reasonForChange: reason,
      terms,
      laborItems: labor,
      materialItems: material,
      equipmentItems: equipment,
      subcontractorItems: subcontractor,
      pricingModel: breakdown.pricingModel,
      wasteFactorPercent: breakdown.wasteFactorPercent,
      wasteCost: breakdown.wasteCost,
      materialCostBase: breakdown.materialCostBase,
      materialCostAdjusted: breakdown.materialCostAdjusted,
      contingencyPercent: breakdown.contingencyPercent,
      contingencyCost: breakdown.contingencyCost,
      taxSystem: breakdown.taxSystem,
      taxRatePercent: breakdown.taxRatePercent,
      taxApplication: breakdown.taxApplication,
      taxCost: breakdown.taxCost,
      targetMarginPercent: breakdown.targetMarginPercent,
      grossProfit: breakdown.grossProfit,
      grossMarginPercent: breakdown.grossMarginPercent,
      markupPercentReporting: breakdown.markupPercentReporting,
      costWithOverhead: breakdown.costWithOverhead,
      totalEstimatedCost: breakdown.totalEstimatedCost,
      markupPercent: breakdown.markupPercent,
      feesAmount: breakdown.feesAmount,
      permitsAmount: breakdown.permitsAmount,
      overheadPercent: breakdown.overheadPercent,
      profitPercent: breakdown.profitPercent,
      overheadAmount: breakdown.overheadAmount,
      profitAmount: breakdown.profitAmount,
      subtotal: breakdown.directCost,
      total: breakdown.totalPrice,
      scheduleImpact: scheduleImpact || null,
      status,
      publicToken,
      sentAt,
      viewedAt,
      openedAt,
      acceptedAt,
      declinedAt,
      contractorName: contractorName.trim() || null,
      contractorSignature: contractorSignature.trim() || null,
      contractorSignedAt,
      clientName,
      clientSignature,
      clientSignedAt,
      createdAt: '',
      updatedAt: '',
    };
  }, [
    coId,
    user,
    projectId,
    linkedFarId,
    linkedRfiId,
    linkedTaskId,
    displayNumber,
    title,
    scope,
    reason,
    terms,
    laborItems,
    materialItems,
    equipmentItems,
    subcontractorItems,
    pricingParams,
    scheduleImpact,
    status,
    publicToken,
    sentAt,
    viewedAt,
    openedAt,
    acceptedAt,
    declinedAt,
    contractorName,
    contractorSignature,
    contractorSignedAt,
    clientName,
    clientSignature,
    clientSignedAt,
  ]);

  const fullProject = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  );

  const documentContext = useMemo(() => {
    if (!preview) return null;
    return buildChangeOrderDocumentContext({
      order: preview,
      project: fullProject,
      companySettings: {
        companyName: companySettings.companyName,
        address: companySettings.address,
        phone: companySettings.phone,
        email: companySettings.email,
        licenseNumber: companySettings.licenseNumber,
        logoUrl: companySettings.logoUrl ?? companySettings.logo ?? null,
        logo: companySettings.logo,
      },
      thisChangeOrderTotal: preview.total,
    });
  }, [preview, fullProject, companySettings]);

  const showPageToast = useCallback((message: string, type: 'success' | 'error') => {
    setPageToast({ message, type });
  }, []);

  useEffect(() => {
    if (!pageToast) return;
    const timer = window.setTimeout(() => setPageToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [pageToast]);

  const persistChangeOrder = useCallback(
    async (options?: { replaceRoute?: boolean; skipReload?: boolean }): Promise<ChangeOrder> => {
      if (!user) throw new Error('Not signed in');
      if (persistingRef.current) {
        throw new Error('Save already in progress');
      }
      persistingRef.current = true;
      try {
        const saved = await saveChangeOrder(coId, buildSaveInput());
        applyCoToState(saved);
        const shouldReplaceRoute = options?.replaceRoute ?? (isNew || !coId);
        if (shouldReplaceRoute) {
          navigate(changeOrderEditHref(projectId, saved.id), { replace: true });
        }
        dispatchPlannerRecordsChanged({ kind: 'change_order', projectId, id: saved.id });
        if (!options?.skipReload) {
          void reload();
        }
        return saved;
      } finally {
        persistingRef.current = false;
      }
    },
    [applyCoToState, buildSaveInput, coId, isNew, navigate, projectId, reload, user],
  );

  const openSendModal = useCallback((changeOrder: ChangeOrder, highlightEmail: boolean) => {
    setSendModalCo(changeOrder);
    setSendModalHighlightEmail(highlightEmail);
    setSendModalOpen(true);
  }, []);

  const handleSend = async () => {
    if (isSending) {
      return;
    }

    if (!contractorName.trim()) {
      const message = 'Enter contractor printed name before sending.';
      setContractorValidationError(message);
      showPageToast(message, 'error');
      return;
    }
    setContractorValidationError(null);

    if (persistingRef.current) {
      showPageToast('Save already in progress. Try again in a moment.', 'error');
      return;
    }

    setIsSending(true);
    setBusy(true);
    try {
      let saved: ChangeOrder;
      try {
        saved = await persistChangeOrder({ replaceRoute: false, skipReload: true });
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('[ChangeOrder] Save before send failed', err);
        }
        showPageToast('Could not save change order before sending.', 'error');
        return;
      }

      let prepared: { changeOrder: ChangeOrder; url: string };
      try {
        prepared = await ensurePublicChangeOrderLink(saved.id);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('[ChangeOrder] Public link preparation failed', err);
        }
        showPageToast('Could not create client review link.', 'error');
        return;
      }

      const highlightEmail = !clientEmail?.trim();
      openSendModal(prepared.changeOrder, highlightEmail);

      const needsRouteUpdate =
        changeOrderId === 'new' || !changeOrderId || changeOrderId !== prepared.changeOrder.id;
      if (needsRouteUpdate) {
        queueMicrotask(() => {
          navigate(changeOrderEditHref(projectId, prepared.changeOrder.id), { replace: true });
        });
      }
    } catch (err) {
      console.error('[ChangeOrder] Send flow failed', err);
      if (import.meta.env.DEV) {
        console.error('[ChangeOrder] Send flow failed details', err);
      }
      showPageToast('Could not prepare change order for sending.', 'error');
    } finally {
      setIsSending(false);
      setBusy(false);
    }
  };

  const handleSendEmailSuccess = async (_recipientEmail: string, _changeOrderUrl: string) => {
    const sentCoId = sendModalCo?.id ?? coId;
    try {
      if (sentCoId) {
        const sig = contractorSignature.trim() || contractorName.trim();
        const sent = await markChangeOrderSent(sentCoId, {
          name: contractorName.trim(),
          signature: sig,
        });
        applyCoToState(sent);
        dispatchPlannerRecordsChanged({ kind: 'change_order', projectId, id: sent.id });
        void reload();
      }
    } catch (err) {
      console.error('[ChangeOrder] Failed to mark change order sent after email', err);
      showPageToast('Email sent, but status could not be updated.', 'error');
    }
    setSendModalOpen(false);
    setSendModalCo(null);
    setSendModalHighlightEmail(false);
    navigate(plannerChangeOrdersHref(projectId));
  };

  const handleSave = async (): Promise<ChangeOrder | null> => {
    if (!user) return null;
    setBusy(true);
    try {
      return await persistChangeOrder();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save change order.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshTracking = async () => {
    if (!coId) return;
    setRefreshingTracking(true);
    try {
      const co = await fetchChangeOrderById(coId);
      if (co) applyCoToState(co);
    } finally {
      setRefreshingTracking(false);
    }
  };

  const handlePdf = async () => {
    setBusy(true);
    try {
      const saved = await persistChangeOrder();
      await generateChangeOrderPDF(
        saved,
        buildChangeOrderDocumentContext({
          order: saved,
          project: fullProject,
          companySettings: {
            companyName: companySettings.companyName,
            address: companySettings.address,
            phone: companySettings.phone,
            email: companySettings.email,
            licenseNumber: companySettings.licenseNumber,
            logoUrl: companySettings.logoUrl ?? companySettings.logo ?? null,
            logo: companySettings.logo,
          },
          thisChangeOrderTotal: saved.total,
        }),
      );
    } catch (err) {
      console.error('Change order PDF failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to generate PDF.');
    } finally {
      setBusy(false);
    }
  };

  if (!isOwner && !projectOwner) {
    return (
      <div className={`${PLANNER_PAGE_BG} p-6`}>
        <p className="text-sm text-gray-600">Only project owners can manage change orders.</p>
      </div>
    );
  }

  return (
    <div className={`${PLANNER_PAGE_BG} flex-1 overflow-y-auto p-4 sm:p-6`}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          to={plannerChangeOrdersHref(projectId)}
          className="inline-flex items-center gap-1 text-sm text-cyan-700 hover:underline dark:text-cyan-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Change orders
        </Link>
        <h2 className={`${PLANNER_SECTION_TITLE} flex-1`}>Change order builder</h2>
      </div>

      {busy && !initDone && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
        </div>
      )}

      {initError && initDone && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <p className="font-medium">Could not open change order</p>
          <p className="mt-1">{initError}</p>
          <p className="mt-2 text-xs opacity-90">
            If this mentions a missing table or column, apply the database migration{' '}
            <code className="rounded bg-red-100 px-1 dark:bg-red-900/50">
              20260603000000_far_documentation_change_orders.sql
            </code>{' '}
            in Supabase, then try again.
          </p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => navigate(plannerChangeOrdersHref(projectId))}
          >
            Back to change orders
          </Button>
        </div>
      )}

      {initDone && !initError && (
        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <div className={PLANNER_FORM_PANEL}>
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
            <div>
              <label className={PLANNER_FORM_LABEL}>Scope of change</label>
              <textarea
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                rows={4}
                className={PLANNER_INPUT}
              />
            </div>
            <Input
              label="Reason for change"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              fullWidth
            />
            <Input
              label="Schedule impact"
              value={scheduleImpact}
              onChange={(e) => setScheduleImpact(e.target.value)}
              fullWidth
            />
            <ChangeOrderLineItemsEditor
              label="Labor"
              category="labor"
              items={laborItems}
              onChange={setLaborItems}
            />
            <ChangeOrderLineItemsEditor
              label="Material"
              category="material"
              items={materialItems}
              onChange={setMaterialItems}
            />
            <ChangeOrderLineItemsEditor
              label="Equipment"
              category="equipment"
              items={equipmentItems}
              onChange={setEquipmentItems}
            />
            <ChangeOrderLineItemsEditor
              label="Subcontractors"
              category="subcontractor"
              items={subcontractorItems}
              onChange={setSubcontractorItems}
            />
            <PricingParamsEditor
              params={pricingParams}
              onChange={setPricingParams}
              showLegacyToggle
            />
            {preview && (
              <div className="rounded-lg border border-dashed border-amber-300/60 bg-amber-50/50 p-1 dark:border-amber-700/50 dark:bg-amber-950/20">
                <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                  Internal pricing (not shown to client)
                </p>
                <div className="p-2">
                  <ChangeOrderInternalPricingSummary order={preview} />
                </div>
              </div>
            )}
            <div>
              <label className={PLANNER_FORM_LABEL}>Terms</label>
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={3}
                className={PLANNER_INPUT}
              />
            </div>
            <SignatureBlock
              title="Contractor signature"
              name={contractorName}
              signature={contractorSignature}
              signedAt={contractorSignedAt}
              onNameChange={(value) => {
                setContractorName(value);
                if (value.trim()) setContractorValidationError(null);
              }}
              onSignatureChange={setContractorSignature}
              helperText="Required before sending to client. Sign in the box or use typed name."
              nameError={contractorValidationError ?? undefined}
            />
            <SignatureBlock
              title="Client signature"
              name={clientName ?? ''}
              signature={clientSignature ?? ''}
              signedAt={clientSignedAt}
              onNameChange={() => {}}
              onSignatureChange={() => {}}
              readOnly
              helperText="Client signs via the public link when accepting."
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleSave()}
                disabled={busy}
              >
                Save draft
              </Button>
              <Button
                variant="accent"
                size="sm"
                icon={<Send className="h-4 w-4" />}
                onClick={() => void handleSend()}
                disabled={busy || isSending}
              >
                Send to client
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handlePdf()}
                disabled={busy}
              >
                Export PDF
              </Button>
            </div>
            {preview && status !== 'draft' && (
              <ChangeOrderTrackingStrip
                order={preview}
                onRefresh={() => void handleRefreshTracking()}
                refreshing={refreshingTracking}
              />
            )}
          </div>

          <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/95">
              <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase text-gray-600 dark:text-slate-400">
                    {previewAudience === 'client' ? 'Client preview' : 'Internal preview'}
                  </p>
                  <div
                    className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs dark:border-slate-600"
                    role="group"
                    aria-label="Preview audience"
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewAudience('client')}
                      className={[
                        'rounded-md px-3 py-1.5 font-medium transition-colors',
                        previewAudience === 'client'
                          ? 'bg-cyan-600 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700',
                      ].join(' ')}
                    >
                      Client view
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewAudience('internal')}
                      className={[
                        'rounded-md px-3 py-1.5 font-medium transition-colors',
                        previewAudience === 'internal'
                          ? 'bg-cyan-600 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700',
                      ].join(' ')}
                    >
                      Internal view
                    </button>
                  </div>
                </div>
              </div>
              <div ref={printRef} className="min-w-0 max-w-full overflow-x-hidden">
                {preview && (
                  <ChangeOrderDocument
                    order={preview}
                    audience={previewAudience}
                    context={documentContext ?? undefined}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {sendModalOpen && sendModalCo ? (
        <ChangeOrderSendEmailModal
          changeOrderId={sendModalCo.id}
          changeOrderToken={sendModalCo.publicToken}
          projectId={projectId}
          projectName={project?.name ?? fullProject?.name ?? 'Project'}
          changeOrderTitle={sendModalCo.title || title || 'Change order'}
          changeOrderNumber={sendModalCo.displayNumber ?? undefined}
          changeOrderTotal={sendModalCo.total}
          clientName={
            clientName?.trim() ||
            fullProject?.clientInfo?.clientName?.trim() ||
            'Client'
          }
          clientEmail={clientEmail ?? undefined}
          highlightEmail={sendModalHighlightEmail}
          onClose={() => {
            setSendModalOpen(false);
            setSendModalCo(null);
            setSendModalHighlightEmail(false);
          }}
          onSentSuccess={(recipientEmail, changeOrderUrl) => {
            void handleSendEmailSuccess(recipientEmail, changeOrderUrl);
          }}
        />
      ) : null}

      {pageToast ? (
        <Toast
          id="change-order-send-toast"
          title={pageToast.type === 'error' ? 'Error' : 'Success'}
          message={pageToast.message}
          type={pageToast.type}
          onClose={() => setPageToast(null)}
        />
      ) : null}
    </div>
  );
}
