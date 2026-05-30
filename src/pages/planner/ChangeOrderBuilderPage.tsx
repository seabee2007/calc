import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Mail, Send } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePlannerProject } from '../../contexts/PlannerProjectContext';
import {
  createChangeOrderFromFar,
  createChangeOrderFromRfi,
  createChangeOrderManual,
  fetchChangeOrderById,
  fetchProjectClientEmail,
  markChangeOrderSent,
  saveChangeOrder,
} from '../../services/changeOrderService';
import type { ChangeOrder, ChangeOrderLineItem } from '../../types/changeOrder';
import {
  computeChangeOrderBreakdown,
  DEFAULT_OVERHEAD_PERCENT,
  DEFAULT_PROFIT_PERCENT,
  normalizeLineItems,
} from '../../utils/changeOrderFinancials';
import { getPublicChangeOrderUrl } from '../../lib/changeOrderTracking';
import { changeOrderEditHref, plannerChangeOrdersHref } from '../../utils/plannerRoutes';
import ChangeOrderLineItemsEditor from '../../components/change-order/ChangeOrderLineItemsEditor';
import ChangeOrderDocument from '../../components/change-order/ChangeOrderDocument';
import ChangeOrderInternalPricingSummary from '../../components/change-order/ChangeOrderInternalPricingSummary';
import ChangeOrderTrackingStrip from '../../components/change-order/ChangeOrderTrackingStrip';
import SignatureBlock from '../../components/change-order/SignatureBlock';
import ProposalSentLinkModal from '../../components/proposals/ProposalSentLinkModal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { generateChangeOrderPDF } from '../../utils/changeOrderPdf';
import {
  PLANNER_BTN_PRIMARY,
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
  const printRef = useRef<HTMLDivElement>(null);

  const isNew = changeOrderId === 'new';
  const [coId, setCoId] = useState<string | null>(isNew ? null : changeOrderId ?? null);
  const [title, setTitle] = useState('');
  const [scope, setScope] = useState('');
  const [reason, setReason] = useState('');
  const [terms, setTerms] = useState('');
  const [scheduleImpact, setScheduleImpact] = useState('');
  const [markupPercent, setMarkupPercent] = useState('0');
  const [feesAmount, setFeesAmount] = useState('0');
  const [permitsAmount, setPermitsAmount] = useState('0');
  const [overheadPercent, setOverheadPercent] = useState(String(DEFAULT_OVERHEAD_PERCENT));
  const [profitPercent, setProfitPercent] = useState(String(DEFAULT_PROFIT_PERCENT));
  const [laborItems, setLaborItems] = useState<ChangeOrderLineItem[]>([]);
  const [materialItems, setMaterialItems] = useState<ChangeOrderLineItem[]>([]);
  const [equipmentItems, setEquipmentItems] = useState<ChangeOrderLineItem[]>([]);
  const [linkedFarId, setLinkedFarId] = useState<string | null>(null);
  const [linkedRfiId, setLinkedRfiId] = useState<string | null>(null);
  const [linkedTaskId, setLinkedTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<ChangeOrder['status']>('draft');
  const [publicToken, setPublicToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [initDone, setInitDone] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [sentUrl, setSentUrl] = useState<string | null>(null);
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
    setMarkupPercent(String(co.markupPercent));
    setFeesAmount(String(co.feesAmount));
    setPermitsAmount(String(co.permitsAmount));
    setOverheadPercent(String(co.overheadPercent));
    setProfitPercent(String(co.profitPercent));
    setLaborItems(co.laborItems);
    setMaterialItems(co.materialItems);
    setEquipmentItems(co.equipmentItems);
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
    void fetchProjectClientEmail(projectId).then(setClientEmail);
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

  // Create draft from /change-orders/new, then replace URL with the new id (no lingering ?task= params).
  useEffect(() => {
    if (!canManage || !projectId || !isNew || !user) return;

    let cancelled = false;

    void (async () => {
      setBusy(true);
      setInitError(null);
      setInitDone(false);

      try {
        let co;
        if (farId) {
          co = await createChangeOrderFromFar(farId, user.id);
        } else if (rfiId) {
          co = await createChangeOrderFromRfi(rfiId, user.id);
        } else {
          co = await createChangeOrderManual(projectId, user.id, taskId);
        }
        if (cancelled) return;

        navigate(changeOrderEditHref(projectId, co.id), { replace: true });
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Could not open change order builder.';
          setInitError(message);
          console.error('Change order init failed:', err);
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
      markupPercent: Number(markupPercent) || 0,
      feesAmount: Number(feesAmount) || 0,
      permitsAmount: Number(permitsAmount) || 0,
      overheadPercent: Number(overheadPercent) || 0,
      profitPercent: Number(profitPercent) || 0,
      laborItems,
      materialItems,
      equipmentItems,
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
    markupPercent,
    feesAmount,
    permitsAmount,
    overheadPercent,
    profitPercent,
    laborItems,
    materialItems,
    equipmentItems,
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
    const markup = Number(markupPercent) || 0;
    const breakdown = computeChangeOrderBreakdown(labor, material, equipment, {
      feesAmount: Number(feesAmount) || 0,
      permitsAmount: Number(permitsAmount) || 0,
      overheadPercent: Number(overheadPercent) || 0,
      profitPercent: Number(profitPercent) || 0,
      markupPercent: markup,
    });
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
      markupPercent: markup,
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
    markupPercent,
    feesAmount,
    permitsAmount,
    overheadPercent,
    profitPercent,
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

  const openMailto = useCallback(
    (url: string) => {
      const subject = encodeURIComponent(
        `Change Order — ${title || project?.name || 'Project'}`,
      );
      const body = encodeURIComponent(
        `Please review this change order online:\n\n${url}\n\nProject: ${project?.name ?? 'Project'}\n\nThank you.`,
      );
      const to = clientEmail?.trim() ? encodeURIComponent(clientEmail.trim()) : '';
      window.location.href = to
        ? `mailto:${to}?subject=${subject}&body=${body}`
        : `mailto:?subject=${subject}&body=${body}`;
    },
    [title, project?.name, clientEmail],
  );

  const ensureSent = async (): Promise<ChangeOrder> => {
    if (!coId || !user) throw new Error('Change order not ready');
    if (!contractorName.trim()) {
      throw new Error('Enter contractor printed name before sending.');
    }
    const sig = contractorSignature.trim() || contractorName.trim();
    const saved = await saveChangeOrder(coId, buildSaveInput());
    applyCoToState(saved);
    if (saved.status === 'draft') {
      const sent = await markChangeOrderSent(coId, {
        name: contractorName.trim(),
        signature: sig,
      });
      applyCoToState(sent);
      return sent;
    }
    return saved;
  };

  const handleSave = async (): Promise<ChangeOrder | null> => {
    if (!user || !coId) return null;
    setBusy(true);
    try {
      const co = await saveChangeOrder(coId, buildSaveInput());
      applyCoToState(co);
      void reload();
      return co;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save change order.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async () => {
    if (!coId) return;
    setBusy(true);
    try {
      const co = await ensureSent();
      const url = getPublicChangeOrderUrl(co.publicToken);
      setSentUrl(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send change order.');
    } finally {
      setBusy(false);
    }
  };

  const handleEmail = async () => {
    setBusy(true);
    try {
      const co = await ensureSent();
      openMailto(getPublicChangeOrderUrl(co.publicToken));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to prepare email.');
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
    if (!preview) {
      alert('Save the change order first.');
      return;
    }
    setBusy(true);
    try {
      if (coId) {
        const saved = await saveChangeOrder(coId, buildSaveInput());
        applyCoToState(saved);
        await generateChangeOrderPDF(saved);
      } else {
        await generateChangeOrderPDF(preview);
      }
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Fees ($)"
                type="number"
                min={0}
                step={0.01}
                value={feesAmount}
                onChange={(e) => setFeesAmount(e.target.value)}
                fullWidth
              />
              <Input
                label="Permits ($)"
                type="number"
                min={0}
                step={0.01}
                value={permitsAmount}
                onChange={(e) => setPermitsAmount(e.target.value)}
                fullWidth
              />
              <Input
                label="Overhead % (of direct cost)"
                type="number"
                min={0}
                step={1}
                value={overheadPercent}
                onChange={(e) => setOverheadPercent(e.target.value)}
                fullWidth
              />
              <Input
                label="Profit % (of direct cost)"
                type="number"
                min={0}
                step={1}
                value={profitPercent}
                onChange={(e) => setProfitPercent(e.target.value)}
                fullWidth
              />
            </div>
            <Input
              label="Markup % (applied to material cost only)"
              type="number"
              min={0}
              value={markupPercent}
              onChange={(e) => setMarkupPercent(e.target.value)}
              fullWidth
            />
            {preview && <ChangeOrderInternalPricingSummary order={preview} />}
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
              onNameChange={setContractorName}
              onSignatureChange={setContractorSignature}
              helperText="Required before sending to client. Sign in the box or use typed name."
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
                className="border-slate-300 bg-white text-gray-900 hover:bg-slate-50 dark:border-slate-600 dark:bg-transparent dark:text-gray-100 dark:hover:bg-slate-800"
                onClick={() => void handleSave()}
                disabled={busy}
              >
                Save draft
              </Button>
              <Button
                className={PLANNER_BTN_PRIMARY}
                icon={<Send className="h-4 w-4" />}
                onClick={() => void handleSend()}
                disabled={busy}
              >
                Send to client
              </Button>
              <Button
                variant="outline"
                className="border-slate-300 bg-white text-gray-900 hover:bg-slate-50 dark:border-slate-600 dark:bg-transparent dark:text-gray-100 dark:hover:bg-slate-800"
                icon={<Mail className="h-4 w-4" />}
                onClick={() => void handleEmail()}
              >
                Email link
              </Button>
              <Button
                variant="outline"
                className="border-slate-300 bg-white text-gray-900 hover:bg-slate-50 dark:border-slate-600 dark:bg-transparent dark:text-gray-100 dark:hover:bg-slate-800"
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

          <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/95">
            <p className="border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase text-gray-600 dark:border-slate-700 dark:text-slate-400">
              Client preview
            </p>
            <div ref={printRef} className="min-w-0 max-w-full overflow-x-hidden">
              {preview && <ChangeOrderDocument order={preview} audience="client" />}
            </div>
          </div>
        </div>
      )}

      <ProposalSentLinkModal
        isOpen={Boolean(sentUrl)}
        onClose={() => setSentUrl(null)}
        shareUrl={sentUrl ?? ''}
        title="Change order sent"
        shareTitle="Change Order"
        onEmailClient={() => {
          if (sentUrl) openMailto(sentUrl);
        }}
      />
    </div>
  );
}
