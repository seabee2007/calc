import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePlannerProject } from '../../contexts/PlannerProjectContext';
import { supabase } from '../../lib/supabase';
import type { FieldAdjustmentRequest } from '../../types/fieldPlanner';
import { reviewFieldAdjustment } from '../../services/fieldAdjustmentService';
import Button from '../../components/ui/Button';
import CreateFieldAdjustmentModal from '../../components/field/CreateFieldAdjustmentModal';
import { PLANNER_MUTED, PLANNER_PAGE_BG, PLANNER_SECTION_TITLE } from '../../components/planner/plannerTheme';

export default function PlannerAdjustmentsPage() {
  const { user } = useAuth();
  const { projectId, isOwner, reload } = usePlannerProject();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('adjustment');
  const [items, setItems] = useState<FieldAdjustmentRequest[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('field_adjustment_requests')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    setItems(
      (data ?? []).map((row) => ({
        id: row.id as string,
        projectId: row.project_id as string,
        taskId: (row.task_id as string) ?? null,
        submittedBy: row.submitted_by as string,
        title: row.title as string,
        description: row.description as string,
        reason: (row.reason as string) ?? null,
        laborImpact: row.labor_impact != null ? Number(row.labor_impact) : null,
        materialImpact: row.material_impact != null ? Number(row.material_impact) : null,
        scheduleImpact: (row.schedule_impact as string) ?? null,
        estimatedCost: row.estimated_cost != null ? Number(row.estimated_cost) : null,
        status: row.status as string,
        ownerResponse: (row.owner_response as string) ?? null,
        approvedBy: (row.approved_by as string) ?? null,
        approvedAt: (row.approved_at as string) ?? null,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      })),
    );
  };

  useEffect(() => {
    void load();
  }, [projectId]);

  const handleReview = async (id: string, decision: 'Approved' | 'Rejected') => {
    if (!user) return;
    await reviewFieldAdjustment(id, user.id, decision);
    await load();
    void reload();
  };

  return (
    <div className={`${PLANNER_PAGE_BG} flex-1 overflow-y-auto p-4 sm:p-6`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className={PLANNER_SECTION_TITLE}>Field adjustments</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          New request
        </Button>
      </div>

      {items.length === 0 && <p className={PLANNER_MUTED}>No field adjustment requests.</p>}

      <ul className="space-y-3">
        {items.map((adj) => (
          <li
            key={adj.id}
            className={`rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 ${
              highlightId === adj.id ? 'ring-2 ring-cyan-500' : ''
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">{adj.title}</h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium dark:bg-slate-800">
                {adj.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-700 dark:text-slate-300">{adj.description}</p>
            {isOwner && adj.status === 'Pending' && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => void handleReview(adj.id, 'Approved')}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => void handleReview(adj.id, 'Rejected')}>
                  Reject
                </Button>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500">{new Date(adj.createdAt).toLocaleString()}</p>
          </li>
        ))}
      </ul>

      {user && (
        <CreateFieldAdjustmentModal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          projectId={projectId}
          userId={user.id}
          onCreated={() => void load()}
        />
      )}
    </div>
  );
}
