import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { ChangeOrder } from '../../../../types/changeOrder';
import type { ProjectDocumentRow } from '../../../../services/projectDocumentService';
import PlannerBuilderDocumentRow from '../../PlannerBuilderDocumentRow';
import ProjectRecordActions from '../../ProjectRecordActions';
import { changeOrderEditHref, openNewChangeOrder } from '../../../../utils/plannerRoutes';
import { voidChangeOrder } from '../../../../services/changeOrderService';
import Button from '../../../ui/Button';
import {
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
  PLANNER_TABLE,
  PLANNER_TABLE_HEAD,
  PLANNER_TABLE_WRAPPER,
} from '../../plannerTheme';
import ProjectDocumentDrawer from '../../ProjectDocumentDrawer';
import { DocumentsPanelFootnote, PanelActionRow } from '../documentsPanelUtils';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  accepted: 'Accepted',
  declined: 'Declined',
  void: 'Void',
};

interface Props {
  projectId: string;
  orders: ChangeOrder[];
  builderCoDrafts: ProjectDocumentRow[];
  isOwner: boolean;
  userId: string | undefined;
  onReload: () => void;
}

export default function ChangeOrdersDocumentsPanel({
  projectId,
  orders,
  builderCoDrafts,
  isOwner,
  userId,
  onReload,
}: Props) {
  const navigate = useNavigate();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [drawerDocId, setDrawerDocId] = useState<string | null>(null);
  const [deleteConfirmDocId, setDeleteConfirmDocId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const formatMoney = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const handleDelete = async (id: string) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await voidChangeOrder(id);
      setDeleteConfirmId(null);
      onReload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete change order');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PanelActionRow
        action={
          isOwner && userId ? (
            <Button
              size="sm"
              variant="accent"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => openNewChangeOrder(navigate, projectId)}
            >
              New change order
            </Button>
          ) : null
        }
      />

      {orders.length === 0 ? (
        <p className={PLANNER_MUTED}>No change orders yet. Create one from an approved FAR or manually.</p>
      ) : (
        <div className={PLANNER_TABLE_WRAPPER}>
          <table className={PLANNER_TABLE}>
            <thead className={PLANNER_TABLE_HEAD}>
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
                  <td className="px-3 py-2">
                    <span className="capitalize">{STATUS_LABEL[co.status] ?? co.status}</span>
                    {co.sentAt && co.status !== 'draft' && (
                      <span className="mt-0.5 block text-xs text-gray-500 dark:text-slate-500">
                        Sent {new Date(co.sentAt).toLocaleDateString()}
                        {co.openedAt && ` · Opened ${new Date(co.openedAt).toLocaleDateString()}`}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isOwner ? (
                      <ProjectRecordActions
                        primary={{
                          label: 'Open / Edit',
                          href: changeOrderEditHref(projectId, co.id),
                        }}
                        danger={{
                          label: 'Delete',
                          onClick: () => {
                            setDeleteError(null);
                            setDeleteConfirmId(co.id);
                          },
                        }}
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {builderCoDrafts.length > 0 ? (
        <section className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-700">
          <h3 className={`mb-1 ${PLANNER_SECTION_TITLE}`}>Document Builder drafts (legacy)</h3>
          <p className={`mb-3 text-sm ${PLANNER_MUTED}`}>
            Standalone document drafts — not official CO-### records. Use{' '}
            <strong className="font-medium text-gray-700 dark:text-slate-300">New change order</strong>{' '}
            for pricing, numbering, and client workflow.
          </p>
          <div className={PLANNER_TABLE_WRAPPER}>
            <table className={PLANNER_TABLE}>
              <thead className={PLANNER_TABLE_HEAD}>
                <tr>
                  <th className="px-4 py-3 font-semibold">Updated</th>
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold">Number / Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {builderCoDrafts.map((doc) => (
                  <PlannerBuilderDocumentRow
                    key={doc.id}
                    doc={doc}
                    projectId={projectId}
                    onDeleted={() => {
                      setDeleteConfirmDocId(null);
                      onReload();
                    }}
                    onOpenDrawer={setDrawerDocId}
                    deleteConfirm={{
                      deleteConfirmActive: deleteConfirmDocId === doc.id,
                      onDeleteRequest: () => setDeleteConfirmDocId(doc.id),
                      onDeleteCancel: () => setDeleteConfirmDocId(null),
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

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

      <DocumentsPanelFootnote />
      <ProjectDocumentDrawer
        documentId={drawerDocId}
        projectId={projectId}
        onClose={() => setDrawerDocId(null)}
        onSaved={onReload}
      />
    </>
  );
}
