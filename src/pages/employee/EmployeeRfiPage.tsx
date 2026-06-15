import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { fetchAssignedProjects } from '../../services/employeeService';
import { fetchRfisForEmployee } from '../../services/rfiService';
import type { RfiRequest } from '../../types/fieldPlanner';
import CreateRfiModal from '../../components/field/CreateRfiModal';
import FieldRecordStatusBadge from '../../components/field/FieldRecordStatusBadge';
import EmployeeFilterChips from '../../components/employee/EmployeeFilterChips';
import { useEmployeePageTitle } from '../../components/employee/EmployeePageTitleContext';
import { subscribePlannerRecordsChanged } from '../../utils/plannerRecordsRefresh';
import Button from '../../components/ui/Button';

type RfiFilter = 'open' | 'submitted' | 'answered' | 'closed';

const FILTER_CHIPS: { id: RfiFilter; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'answered', label: 'Answered' },
  { id: 'closed', label: 'Closed' },
];

function matchesFilter(rfi: RfiRequest, filter: RfiFilter): boolean {
  switch (filter) {
    case 'open':
      return rfi.status === 'Open' || rfi.status === 'Pending Response';
    case 'submitted':
      return rfi.status === 'Open' || rfi.status === 'Pending Response';
    case 'answered':
      return rfi.status === 'Answered' || rfi.status === 'Need More Information';
    case 'closed':
      return rfi.status === 'Closed' || rfi.status === 'Rejected';
    default:
      return true;
  }
}

export default function EmployeeRfiPage() {
  useEmployeePageTitle('RFI');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rfis, setRfis] = useState<RfiRequest[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [filter, setFilter] = useState<RfiFilter>('open');
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [loadedRfis, loadedProjects] = await Promise.all([
        fetchRfisForEmployee(user.id),
        fetchAssignedProjects(user.id),
      ]);
      setRfis(loadedRfis);
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

  const filteredRfis = useMemo(
    () => rfis.filter((r) => matchesFilter(r, filter)),
    [rfis, filter],
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
        Create RFI
      </Button>

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading RFIs…</p>
      ) : filteredRfis.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
          <p className="text-sm text-slate-400">No RFIs in this view.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredRfis.map((rfi) => (
            <li key={rfi.id}>
              <button
                type="button"
                onClick={() => navigate(`/employee/rfi/${rfi.id}`)}
                className="w-full rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left touch-manipulation"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white">{rfi.title}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {projectMap.get(rfi.projectId) ?? 'Project'}
                    </p>
                  </div>
                  <FieldRecordStatusBadge status={rfi.status} />
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-300">{rfi.question}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {new Date(rfi.createdAt).toLocaleDateString()}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {defaultProjectId && user ? (
        <CreateRfiModal
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
