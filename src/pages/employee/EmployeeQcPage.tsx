import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchAssignedProjects } from '../../services/employeeService';
import { listConcreteInspectionsForProject } from '../../services/concreteInspectionService';
import type { ConcreteInspectionChecklist } from '../../types/fieldTools';
import EmployeeFilterChips from '../../components/employee/EmployeeFilterChips';
import { useEmployeePageTitle } from '../../components/employee/EmployeePageTitleContext';

type QcFilter = 'open' | 'in_progress' | 'complete';

const FILTER_CHIPS: { id: QcFilter; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'complete', label: 'Complete' },
];

function getCompletionStats(checklist: ConcreteInspectionChecklist) {
  const items = [
    ...checklist.prePourItems,
    ...checklist.duringPlacementItems,
    ...checklist.postPlacementItems,
  ];
  const total = items.length;
  const done = items.filter((item) => item.status === 'pass' || item.status === 'na').length;
  return { total, done };
}

function getQcStatus(checklist: ConcreteInspectionChecklist): QcFilter {
  const { total, done } = getCompletionStats(checklist);
  if (total === 0 || done === 0) return 'open';
  if (done >= total) return 'complete';
  return 'in_progress';
}

export default function EmployeeQcPage() {
  useEmployeePageTitle('QC');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checklists, setChecklists] = useState<ConcreteInspectionChecklist[]>([]);
  const [filter, setFilter] = useState<QcFilter>('open');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const projects = await fetchAssignedProjects(user.id);
      const results = await Promise.all(
        projects.map((p) => listConcreteInspectionsForProject(p.id, user.id)),
      );
      setChecklists(results.flat());
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => checklists.filter((c) => getQcStatus(c) === filter),
    [checklists, filter],
  );

  return (
    <div className="space-y-4">
      <EmployeeFilterChips chips={FILTER_CHIPS} value={filter} onChange={setFilter} />

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading QC checklists…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
          <p className="text-sm text-slate-400">No QC checklists in this view.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((checklist) => {
            const { total, done } = getCompletionStats(checklist);
            return (
              <li key={checklist.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/employee/qc/${checklist.id}`)}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left touch-manipulation"
                >
                  <p className="font-semibold text-white">
                    {checklist.projectName || checklist.pourArea || 'Inspection'}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {checklist.inspectionDate
                      ? new Date(checklist.inspectionDate).toLocaleDateString()
                      : 'No date'}
                  </p>
                  <p className="mt-3 text-xs text-slate-400">
                    Checklist: {done}/{total}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
