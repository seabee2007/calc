import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getContractDocument } from '../../features/documents/services/contractDocumentService';
import type { ContractDocumentRow } from '../../features/documents/services/contractDocumentTypes';
import { getProjectDocumentDisplayMeta } from '../../services/projectDocumentDisplay';
import { useEmployeePageTitle } from '../../components/employee/EmployeePageTitleContext';
import Button from '../../components/ui/Button';

export default function EmployeeDocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<ContractDocumentRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEmployeePageTitle(document?.title ?? 'Document');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const loaded = await getContractDocument(id);
      setDocument(loaded.document);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="py-8 text-center text-sm text-slate-500">Loading document…</p>;
  }

  if (!document) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
        <p className="text-sm text-slate-400">Document not found.</p>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => navigate('/employee/documents')}
        >
          Back to documents
        </Button>
      </div>
    );
  }

  const meta = getProjectDocumentDisplayMeta(document);

  return (
    <div className="space-y-4 pb-8">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
          {meta.label}
        </span>
        <h1 className="mt-4 text-lg font-bold text-white">{document.title ?? meta.label}</h1>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Status</dt>
            <dd className="capitalize text-slate-200">{document.status?.replace(/_/g, ' ') ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Updated</dt>
            <dd className="text-slate-200">
              {document.updated_at
                ? new Date(document.updated_at).toLocaleDateString()
                : '—'}
            </dd>
          </div>
        </dl>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <h2 className="text-sm font-semibold text-white">Field access</h2>
        <p className="mt-2 text-sm text-slate-300">
          This document is available for field reference. Contact your project manager for changes
          or approvals.
        </p>
      </section>
    </div>
  );
}
