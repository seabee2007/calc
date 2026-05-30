import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePlannerAccessibleProjects } from '../../hooks/usePlannerAccessibleProjects';
import {
  fetchChangeOrdersForProjectIds,
  voidChangeOrder,
} from '../../services/changeOrderService';
import type { ChangeOrder } from '../../types/changeOrder';
import { changeOrderEditHref } from '../../utils/plannerRoutes';
import { formatChangeOrderMoney } from '../../utils/changeOrderFinancials';
import Button from '../../components/ui/Button';
import PlannerHubRecordsLayout from '../../components/planner/PlannerHubRecordsLayout';
import { PLANNER_LINK, PLANNER_MUTED } from '../../components/planner/plannerTheme';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  accepted: 'Accepted',
  declined: 'Declined',
  void: 'Void',
};

export default function PlannerAllChangeOrdersPage() {
  const { isOwner } = useAuth();
  const { projectIds, projectNames, loading: projectsLoading } = usePlannerAccessibleProjects();
  const [orders, setOrders] = useState<ChangeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');

  const load = useCallback(async () => {
    if (projectIds.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchChangeOrdersForProjectIds(projectIds);
      setOrders(list);
    } finally {
      setLoading(false);
    }
  }, [projectIds]);

  useEffect(() => {
    if (!projectsLoading) void load();
  }, [load, projectsLoading]);

  const filtered = useMemo(() => {
    return orders.filter((co) => {
      if (projectFilter && co.projectId !== projectFilter) return false;
      if (search && !co.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter && co.status !== statusFilter) return false;
      return true;
    });
  }, [orders, search, statusFilter, projectFilter]);

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

  if (!isOwner) {
    return (
      <PlannerHubRecordsLayout title="All change orders">
        <p className={PLANNER_MUTED}>Only project owners can view change orders.</p>
      </PlannerHubRecordsLayout>
    );
  }

  return (
    <PlannerHubRecordsLayout
      title="All change orders"
      subtitle="Change orders across all your projects."
    >
      {(loading || projectsLoading) && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
        </div>
      )}

      {!loading && !projectsLoading && projectIds.length === 0 && (
        <p className={PLANNER_MUTED}>No projects available.</p>
      )}

      {!loading && !projectsLoading && projectIds.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              type="search"
              placeholder="Search title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-[160px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="max-w-[200px] rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">All projects</option>
              {[...projectNames.entries()].map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <p className={PLANNER_MUTED}>No change orders match your filters.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-gray-500 dark:border-slate-700 dark:bg-slate-800">
                  <tr>
                    <th className="px-3 py-2">CO #</th>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((co) => (
                    <tr
                      key={co.id}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                    >
                      <td className="px-3 py-2 font-mono text-xs">{co.displayNumber ?? '—'}</td>
                      <td className="max-w-[140px] truncate px-3 py-2">
                        <Link
                          to={changeOrderEditHref(co.projectId, co.id)}
                          className={`${PLANNER_LINK} font-medium`}
                        >
                          {projectNames.get(co.projectId) ?? 'Project'}
                        </Link>
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2 font-medium">{co.title}</td>
                      <td className="px-3 py-2">{formatChangeOrderMoney(co.total)}</td>
                      <td className="px-3 py-2">
                        <span className="capitalize">{STATUS_LABEL[co.status] ?? co.status}</span>
                        {co.sentAt && (
                          <span className="mt-0.5 block text-xs text-gray-500 dark:text-slate-500">
                            Sent {new Date(co.sentAt).toLocaleDateString()}
                            {co.openedAt && ` · Opened ${new Date(co.openedAt).toLocaleDateString()}`}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-3">
                          <Link
                            to={changeOrderEditHref(co.projectId, co.id)}
                            className={`${PLANNER_LINK} text-sm font-medium`}
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete change order</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
              This will remove the change order from your list.
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
                className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                onClick={() => void handleDelete(deleteConfirmId)}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PlannerHubRecordsLayout>
  );
}
