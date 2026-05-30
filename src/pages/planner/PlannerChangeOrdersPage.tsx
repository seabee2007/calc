import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePlannerProject } from '../../contexts/PlannerProjectContext';
import {
  fetchChangeOrdersForProject,
  voidChangeOrder,
} from '../../services/changeOrderService';
import type { ChangeOrder } from '../../types/changeOrder';
import { changeOrderEditHref, openNewChangeOrder } from '../../utils/plannerRoutes';
import Button from '../../components/ui/Button';
import {
  PLANNER_BTN_PRIMARY,
  PLANNER_MUTED,
  PLANNER_PAGE_BG,
  PLANNER_SECTION_TITLE,
} from '../../components/planner/plannerTheme';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  accepted: 'Accepted',
  declined: 'Declined',
  void: 'Void',
};

export default function PlannerChangeOrdersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { projectId, isOwner } = usePlannerProject();
  const [orders, setOrders] = useState<ChangeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchChangeOrdersForProject(projectId);
      setOrders(list);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatMoney = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const handleDelete = async (id: string) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await voidChangeOrder(id);
      setDeleteConfirmId(null);
      await load();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete change order');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={`${PLANNER_PAGE_BG} flex-1 overflow-y-auto p-4 sm:p-6`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className={PLANNER_SECTION_TITLE}>Change orders</h2>
        {isOwner && user && (
          <Button
            size="sm"
            className={PLANNER_BTN_PRIMARY}
            icon={<Plus className="h-4 w-4" />}
            onClick={() => openNewChangeOrder(navigate, projectId)}
          >
            New change order
          </Button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
        </div>
      )}

      {!loading && orders.length === 0 && (
        <p className={PLANNER_MUTED}>No change orders yet. Create one from an approved FAR or manually.</p>
      )}

      {!loading && orders.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-gray-500 dark:border-slate-700 dark:bg-slate-800">
              <tr>
                <th className="px-3 py-2">CO #</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {orders.map((co) => (
                <tr
                  key={co.id}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                >
                  <td className="px-3 py-2 font-mono text-xs">{co.displayNumber ?? '—'}</td>
                  <td className="max-w-[200px] truncate px-3 py-2 font-medium">{co.title}</td>
                  <td className="px-3 py-2">{formatMoney(co.total)}</td>
                  <td className="px-3 py-2 capitalize">
                    {STATUS_LABEL[co.status] ?? co.status}
                  </td>
                  <td className="px-3 py-2">
                    {isOwner && (
                      <div className="flex items-center gap-3">
                        <Link
                          to={changeOrderEditHref(projectId, co.id)}
                          className="text-sm font-medium text-cyan-700 hover:underline dark:text-cyan-400"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteConfirmId(co.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete change order</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
              This will remove the change order from your list. Linked field adjustments will return to
              Approved so you can create a new change order if needed.
            </p>
            {deleteError && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{deleteError}</p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                disabled={deleting}
                onClick={() => {
                  setDeleteConfirmId(null);
                  setDeleteError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                disabled={deleting}
                className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                onClick={() => void handleDelete(deleteConfirmId)}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
