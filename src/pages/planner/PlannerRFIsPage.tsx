import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePlannerProject } from '../../contexts/PlannerProjectContext';
import { supabase } from '../../lib/supabase';
import type { RfiRequest } from '../../types/fieldPlanner';
import { respondToRfi } from '../../services/rfiService';
import Button from '../../components/ui/Button';
import CreateRfiModal from '../../components/field/CreateRfiModal';
import { PLANNER_MUTED, PLANNER_PAGE_BG, PLANNER_SECTION_TITLE } from '../../components/planner/plannerTheme';

export default function PlannerRFIsPage() {
  const { user } = useAuth();
  const { projectId, isOwner, reload } = usePlannerProject();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('rfi');
  const [rfis, setRfis] = useState<RfiRequest[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [responseText, setResponseText] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await supabase
      .from('rfi_requests')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    setRfis(
      (data ?? []).map((row) => ({
        id: row.id as string,
        projectId: row.project_id as string,
        taskId: (row.task_id as string) ?? null,
        submittedBy: row.submitted_by as string,
        title: row.title as string,
        question: row.question as string,
        suggestedSolution: (row.suggested_solution as string) ?? null,
        urgency: row.urgency as string,
        status: row.status as string,
        ownerResponse: (row.owner_response as string) ?? null,
        respondedBy: (row.responded_by as string) ?? null,
        respondedAt: (row.responded_at as string) ?? null,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      })),
    );
  };

  useEffect(() => {
    void load();
  }, [projectId]);

  const handleRespond = async (rfiId: string) => {
    if (!user || !responseText[rfiId]?.trim()) return;
    await respondToRfi(rfiId, user.id, responseText[rfiId].trim());
    await load();
    void reload();
  };

  return (
    <div className={`${PLANNER_PAGE_BG} flex-1 overflow-y-auto p-4 sm:p-6`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className={PLANNER_SECTION_TITLE}>RFIs</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          New RFI
        </Button>
      </div>

      {rfis.length === 0 && <p className={PLANNER_MUTED}>No RFIs for this project.</p>}

      <ul className="space-y-3">
        {rfis.map((rfi) => (
          <li
            key={rfi.id}
            id={`rfi-${rfi.id}`}
            className={`rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 ${
              highlightId === rfi.id ? 'ring-2 ring-cyan-500' : ''
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">{rfi.title}</h3>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                {rfi.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-700 dark:text-slate-300">{rfi.question}</p>
            {rfi.ownerResponse && (
              <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm dark:bg-slate-800">
                <span className="font-medium">Owner: </span>
                {rfi.ownerResponse}
              </p>
            )}
            {isOwner && rfi.status === 'Open' && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={responseText[rfi.id] ?? ''}
                  onChange={(e) =>
                    setResponseText((prev) => ({ ...prev, [rfi.id]: e.target.value }))
                  }
                  placeholder="Owner response…"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                />
                <Button size="sm" onClick={() => void handleRespond(rfi.id)}>
                  Respond
                </Button>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-slate-500">
              {new Date(rfi.createdAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>

      {user && (
        <CreateRfiModal
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
