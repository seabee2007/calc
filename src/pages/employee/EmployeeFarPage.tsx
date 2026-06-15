import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { fetchAssignedProjects } from '../../services/employeeService';
import { fetchAdjustmentsForEmployee } from '../../services/fieldAdjustmentService';
import type { FieldAdjustmentRequest } from '../../types/fieldPlanner';
import CreateFieldAdjustmentModal from '../../components/field/CreateFieldAdjustmentModal';
import FieldRecordStatusBadge from '../../components/field/FieldRecordStatusBadge';
import EmployeeFilterChips from '../../components/employee/EmployeeFilterChips';
import { useEmployeePageTitle } from '../../components/employee/EmployeePageTitleContext';
import { subscribePlannerRecordsChanged } from '../../utils/plannerRecordsRefresh';
import Button from '../../components/ui/Button';

type FarFilter = 'pending' | 'review' | 'approved' | 'rejected';

const FILTER_CHIPS: { id: FarFilter; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'review', label: 'Under Review' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

function matchesFilter(adj: FieldAdjustmentRequest, filter: FarFilter): boolean {
  switch (filter) {
    case 'pending':
      return adj.status === 'Pending';
    case 'review':
      return adj.status === 'Needs More Information';
    case 'approved':
      return adj.status === 'Approved' || adj.status === 'Convert to Change Order';
    case 'rejected':
      return adj.status === 'Rejected';
    default:
      return true;
  }
}

export default function EmployeeFarPage() {
  useEmployeePageTitle('FAR');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [adjustments, setAdjustments] = useState<FieldAdjustmentRequest[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [filter, setFilter] = useState<FarFilter>('pending');
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [loaded, loadedProjects] = await Promise.all([
        fetchAdjustmentsForEmployee(user.id),
        fetchAssignedProjects(user.id),
      ]);
      setAdjustments(loaded);
      setProjects(loadedProjects as { id: string; name: string }[]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => subscribePlannerRecordsChanged(() => void load()), [load]);

  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.name);
    return map;
  }, [projects]);

  const filtered = useMemo(
    () => adjustments.filter((a) => matchesFilter(a, filter)),
    [adjustments, filter],
  );

  const defaultProjectId = projects[0]?.id;

  return (
    <div className="space-y-4">
      <EmployeeFilterChips chips={FILTER_CHIPS} value={filter} onChange={setFilter} />

      <Button
        type="button"
        variant="accent"
        fullWidth
        className="min-h-[48px]"
        icon={<Plus className="h-4 w-4" />}
        onClick={() => setCreateOpen(true)}
        disabled={!defaultProjectId}
      >
        Create FAR
      </Button>

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading FARs…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
          <p className="text-sm text-slate-400">No field adjustments in this view.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((adj) => (
            <li key={adj.id}>
              <button
                type="button"
                onClick={() => navigate(`/employee/far/${adj.id}`)}
                className="w-full rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left touch-manipulation"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white">{adj.title}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {projectMap.get(adj.projectId) ?? 'Project'}
                    </p>
                  </div>
                  <FieldRecordStatusBadge status={adj.status} />
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-300">{adj.description}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {new Date(adj.createdAt).toLocaleDateString()}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {defaultProjectId && user ? (
        <CreateFieldAdjustmentModal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          projectId={defaultProjectId}
          userId={user.id}
          onCreated={() => void load()}
        />
      ) : null}
    </div>
  );
}
