import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePlannerProject } from '../../contexts/PlannerProjectContext';
import { fetchChangeOrdersForProject } from '../../services/changeOrderService';
import { listProjectChangeOrderBuilderDocuments } from '../../services/projectDocumentService';
import type { ProjectDocumentRow } from '../../services/projectDocumentService';
import type { ChangeOrder } from '../../types/changeOrder';
import ChangeOrdersDocumentsPanel from '../../components/planner/documents/panels/ChangeOrdersDocumentsPanel';
import { PLANNER_PAGE_BG, PLANNER_SECTION_TITLE } from '../../components/planner/plannerTheme';

export default function PlannerChangeOrdersPage() {
  const { user } = useAuth();
  const { projectId, isOwner } = usePlannerProject();
  const [orders, setOrders] = useState<ChangeOrder[]>([]);
  const [builderCoDrafts, setBuilderCoDrafts] = useState<ProjectDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, drafts] = await Promise.all([
        fetchChangeOrdersForProject(projectId),
        listProjectChangeOrderBuilderDocuments(projectId),
      ]);
      setOrders(list);
      setBuilderCoDrafts(drafts);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={`${PLANNER_PAGE_BG} flex-1 overflow-y-auto p-4 sm:p-6`}>
      <h2 className={`mb-4 ${PLANNER_SECTION_TITLE}`}>Change orders</h2>
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
        </div>
      ) : (
        <ChangeOrdersDocumentsPanel
          projectId={projectId}
          orders={orders}
          builderCoDrafts={builderCoDrafts}
          isOwner={isOwner}
          userId={user?.id}
          onReload={() => void load()}
        />
      )}
    </div>
  );
}
