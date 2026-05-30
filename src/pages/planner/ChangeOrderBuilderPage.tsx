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
  markChangeOrderSent,
  saveChangeOrder,
} from '../../services/changeOrderService';
import type { ChangeOrder, ChangeOrderLineItem } from '../../types/changeOrder';
import { computeChangeOrderTotals } from '../../utils/changeOrderFinancials';
import { getPublicChangeOrderUrl } from '../../lib/changeOrderTracking';
import { changeOrderEditHref, plannerChangeOrdersHref } from '../../utils/plannerRoutes';
import ChangeOrderLineItemsEditor from '../../components/change-order/ChangeOrderLineItemsEditor';
import ChangeOrderDocument from '../../components/change-order/ChangeOrderDocument';
import ProposalSentLinkModal from '../../components/proposals/ProposalSentLinkModal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { generateProposalPDF } from '../../utils/pdf';
import {
  PLANNER_BTN_PRIMARY,
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

  const farId = searchParams.get('far');
  const rfiId = searchParams.get('rfi');
  const taskId = searchParams.get('task');

  const loadOrder = useCallback(
    async (id: string) => {
      const co = await fetchChangeOrderById(id);
      if (!co) return;
      setCoId(co.id);
      setTitle(co.title);
      setScope(co.scopeDescription);
      setReason(co.reasonForChange);
      setTerms(co.terms);
      setScheduleImpact(co.scheduleImpact ?? '');
      setMarkupPercent(String(co.markupPercent));
      setLaborItems(co.laborItems);
      setMaterialItems(co.materialItems);
      setEquipmentItems(co.equipmentItems);
      setLinkedFarId(co.linkedFarId);
      setLinkedRfiId(co.linkedRfiId);
      setLinkedTaskId(co.linkedTaskId);
      setStatus(co.status);
      setPublicToken(co.publicToken);
    },
    [],
  );

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

  const preview = useMemo((): ChangeOrder | null => {
    if (!coId || !user) return null;
    const markup = Number(markupPercent) || 0;
    const totals = computeChangeOrderTotals(laborItems, materialItems, equipmentItems, markup);
    return {
      id: coId,
      projectId,
      userId: user.id,
      linkedFarId,
      linkedRfiId,
      linkedTaskId,
      displayNumber: null,
      title,
      scopeDescription: scope,
      reasonForChange: reason,
      terms,
      laborItems,
      materialItems,
      equipmentItems,
      markupPercent: markup,
      subtotal: totals.subtotal,
      total: totals.total,
      scheduleImpact: scheduleImpact || null,
      status,
      publicToken,
      sentAt: null,
      viewedAt: null,
      openedAt: null,
      acceptedAt: null,
      declinedAt: null,
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
    title,
    scope,
    reason,
    terms,
    laborItems,
    materialItems,
    equipmentItems,
    markupPercent,
    scheduleImpact,
    status,
    publicToken,
  ]);

  const handleSave = async () => {
    if (!user || !coId) return;
    setBusy(true);
    try {
      const co = await saveChangeOrder(coId, {
        projectId,
        userId: user.id,
        title: title.trim() || 'Change order',
        scopeDescription: scope,
        reasonForChange: reason,
        terms,
        scheduleImpact: scheduleImpact || null,
        markupPercent: Number(markupPercent) || 0,
        laborItems,
        materialItems,
        equipmentItems,
        linkedFarId,
        linkedRfiId,
        linkedTaskId,
      });
      setStatus(co.status);
      void reload();
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async () => {
    if (!coId) return;
    await handleSave();
    setBusy(true);
    try {
      const co = await markChangeOrderSent(coId);
      setStatus(co.status);
      setPublicToken(co.publicToken);
      setSentUrl(getPublicChangeOrderUrl(co.publicToken));
    } finally {
      setBusy(false);
    }
  };

  const handleEmail = async () => {
    if (!coId || !publicToken) {
      await handleSend();
    }
    const url = publicToken ? getPublicChangeOrderUrl(publicToken) : sentUrl;
    if (!url) return;
    const subject = encodeURIComponent(`Change Order — ${title || project?.name || 'Project'}`);
    const body = encodeURIComponent(`Please review this change order:\n${url}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handlePdf = async () => {
    if (!printRef.current || !preview) return;
    await generateProposalPDF(
      printRef.current.innerHTML,
      `Change Order — ${title}`,
      undefined,
      'classic',
      {
        projectTitle: title,
        businessName: project?.name ?? 'Contractor',
      } as import('../../types/proposal').ProposalData,
    );
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
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
            <div>
              <label className="mb-1 block text-sm font-medium">Scope of change</label>
              <textarea
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
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
              items={laborItems}
              onChange={setLaborItems}
            />
            <ChangeOrderLineItemsEditor
              label="Material"
              items={materialItems}
              onChange={setMaterialItems}
            />
            <ChangeOrderLineItemsEditor
              label="Equipment"
              items={equipmentItems}
              onChange={setEquipmentItems}
            />
            <Input
              label="Markup %"
              type="number"
              min={0}
              value={markupPercent}
              onChange={(e) => setMarkupPercent(e.target.value)}
              fullWidth
            />
            <div>
              <label className="mb-1 block text-sm font-medium">Terms</label>
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void handleSave()} disabled={busy}>
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
              <Button variant="outline" icon={<Mail className="h-4 w-4" />} onClick={() => void handleEmail()}>
                Email link
              </Button>
              <Button variant="outline" onClick={() => void handlePdf()}>
                Export PDF
              </Button>
            </div>
            {status !== 'draft' && publicToken && (
              <p className="text-xs text-gray-500">
                Status: <span className="font-medium">{status}</span>
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800 overflow-hidden">
            <p className="border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase text-gray-500 dark:border-slate-700">
              Preview
            </p>
            <div ref={printRef}>{preview && <ChangeOrderDocument order={preview} />}</div>
          </div>
        </div>
      )}

      <ProposalSentLinkModal
        isOpen={Boolean(sentUrl)}
        onClose={() => setSentUrl(null)}
        proposalUrl={sentUrl ?? ''}
        title="Change order sent"
      />
    </div>
  );
}
