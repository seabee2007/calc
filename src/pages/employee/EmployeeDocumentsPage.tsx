import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { fetchAssignedProjects } from '../../services/employeeService';
import { listProjectDocuments, type ProjectDocumentRow } from '../../services/projectDocumentService';
import { getProjectDocumentDisplayMeta } from '../../services/projectDocumentDisplay';
import EmployeeFilterChips from '../../components/employee/EmployeeFilterChips';
import { useEmployeePageTitle } from '../../components/employee/EmployeePageTitleContext';
import Input from '../../components/ui/Input';

type DocFilter = 'all' | 'rfi' | 'far' | 'qc_report' | 'daily_report' | 'other';

const FILTER_CHIPS: { id: DocFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'rfi', label: 'RFI' },
  { id: 'far', label: 'FAR' },
  { id: 'qc_report', label: 'QC' },
  { id: 'daily_report', label: 'Daily' },
  { id: 'other', label: 'Other' },
];

function matchesDocFilter(doc: ProjectDocumentRow, filter: DocFilter): boolean {
  if (filter === 'all') return true;
  const meta = getProjectDocumentDisplayMeta(doc);
  const type = doc.document_type ?? meta.subtitleLabel.toLowerCase();
  if (filter === 'other') {
    return !['rfi', 'far', 'qc_report', 'daily_report'].some((t) => type.includes(t));
  }
  return type.includes(filter);
}

export default function EmployeeDocumentsPage() {
  useEmployeePageTitle('Documents');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<ProjectDocumentRow[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [filter, setFilter] = useState<DocFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const assigned = await fetchAssignedProjects(user.id);
      setProjects(assigned as { id: string; name: string }[]);
      const results = await Promise.all(
        assigned.map((p) => listProjectDocuments(p.id)),
      );
      setDocuments(results.flat());
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.name);
    return map;
  }, [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((doc) => {
      if (!matchesDocFilter(doc, filter)) return false;
      if (!q) return true;
      const title = (doc.title ?? '').toLowerCase();
      const projectName = (projectMap.get(doc.project_id ?? '') ?? '').toLowerCase();
      return title.includes(q) || projectName.includes(q);
    });
  }, [documents, filter, search, projectMap]);

  return (
    <div className="space-y-4">
      <Input
        label="Search documents"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or project"
        icon={<Search className="h-4 w-4" />}
      />

      <EmployeeFilterChips chips={FILTER_CHIPS} value={filter} onChange={setFilter} />

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading documents…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
          <p className="text-sm text-slate-400">No documents found.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((doc) => {
            const meta = getProjectDocumentDisplayMeta(doc);
            return (
              <li key={doc.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/employee/documents/${doc.id}`)}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left touch-manipulation"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white">{doc.title ?? meta.label}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {projectMap.get(doc.project_id ?? '') ?? 'Project'}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-2 text-xs capitalize text-slate-500">
                    {doc.status?.replace(/_/g, ' ') ?? 'Draft'}
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
