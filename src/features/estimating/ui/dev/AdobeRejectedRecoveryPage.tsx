/**
 * /dev/adobe-rejected-recovery — Review and recover quarantined Adobe Chapter 5 rows.
 *
 * DEV-ONLY. Edits write to rejected/adobe-chapter5.review-fixed.json, never approved.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AdobeFinalReviewedRow } from '../../data/productionRates/adobeProductionRateRowTypes';
import {
  LOCKED_FIELDS,
  RECOVERABLE_EDITABLE_FIELDS,
  applyRecoveryPatch,
  type AdobeRejectedFile,
  type AdobeRejectedRecoveryFix,
  type AdobeRejectedReviewFixedFile,
  type RecoverableEditableField,
  type RejectedAdobeRecord,
} from '../../data/productionRates/adobeRejectedProductionRateRecovery.shared';

const API_BASE = '/dev-api/adobe-rejected-recovery';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Request failed: ${path}`);
  }
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Request failed: ${path}`);
  }
  return (await res.json()) as T;
}

export default function AdobeRejectedRecoveryPage(): React.ReactElement {
  const [rejectedFile, setRejectedFile] = useState<AdobeRejectedFile | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [draftFixes, setDraftFixes] = useState<Record<string, AdobeRejectedRecoveryFix>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const [rejected, fixed] = await Promise.all([
        fetchJson<AdobeRejectedFile>('/rejected'),
        fetchJson<AdobeRejectedReviewFixedFile | null>('/review-fixed'),
      ]);
      setRejectedFile(rejected);
      const fixMap: Record<string, AdobeRejectedRecoveryFix> = {};
      fixed?.records.forEach((fix) => {
        fixMap[fix.sourceRejectedId] = fix;
      });
      setDraftFixes(fixMap);
      if (!selectedId && rejected.records[0]?.id) {
        setSelectedId(rejected.records[0].id ?? '');
      }
    } catch (error) {
      setMessage(String(error));
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const selectedRecord = useMemo(
    () => rejectedFile?.records.find((record) => record.id === selectedId) ?? null,
    [rejectedFile, selectedId],
  );

  const selectedFix = selectedRecord ? draftFixes[selectedRecord.id ?? ''] : undefined;

  const workingRow: AdobeFinalReviewedRow | null = useMemo(() => {
    if (!selectedRecord) return null;
    if (selectedFix?.correctedRow) return selectedFix.correctedRow;
    const { rejectionReasons: _r, ...rest } = selectedRecord;
    return rest;
  }, [selectedRecord, selectedFix]);

  const updateEditableField = (field: RecoverableEditableField, value: string) => {
    if (!selectedRecord || !workingRow) return;
    const numericFields: RecoverableEditableField[] = ['sourcePageNumberApprox', 'sourceAdobePageIndex'];
    const parsed = numericFields.includes(field)
      ? value === ''
        ? null
        : Number(value)
      : value;
    const { row, changedFields } = applyRecoveryPatch(workingRow, {
      [field]: parsed,
    } as Partial<AdobeFinalReviewedRow>);
    const nextFix: AdobeRejectedRecoveryFix = {
      sourceRejectedId: selectedRecord.id ?? '',
      originalRejectionReasons: selectedRecord.rejectionReasons,
      recoveryStatus: 'still_rejected',
      recoveryNotes: ['Manual edit in dev recovery UI'],
      correctedRow: row,
      changedFields: [
        ...new Set([...(selectedFix?.changedFields ?? []), ...changedFields]),
      ],
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'dev-ui',
    };
    setDraftFixes((current) => ({ ...current, [nextFix.sourceRejectedId]: nextFix }));
  };

  const validateAndSave = async () => {
    const payload: AdobeRejectedReviewFixedFile = {
      schemaVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      sourceRejectedFile: 'data/estimating/production-rates/rejected/adobe-chapter5.rejected.json',
      fixCount: Object.keys(draftFixes).length,
      records: Object.values(draftFixes),
    };

    const result = await postJson<{ ok: boolean; errors: string[]; validatedFixCount: number }>(
      '/review-fixed/validate',
      payload,
    );
    if (result.errors.length > 0) {
      setMessage(`Validation failed:\n${result.errors.slice(0, 8).join('\n')}`);
      return;
    }

    await postJson('/review-fixed', payload);
    setMessage(`Saved ${payload.fixCount} recovery fix(es) to review-fixed file. Run npm run recover:adobe-production-rates.`);
    await loadAll();
  };

  const autoSuggestSelected = async () => {
    if (!selectedRecord) return;
    const result = await postJson<{ fix: AdobeRejectedRecoveryFix | null }>('/suggest-fix', {
      rejectedId: selectedRecord.id,
    });
    if (!result.fix) {
      setMessage('No deterministic suggestion available for this row.');
      return;
    }
    setDraftFixes((current) => ({ ...current, [result.fix!.sourceRejectedId]: result.fix! }));
    setMessage(`Applied suggestion for ${selectedRecord.id}.`);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-cyan-300">Adobe Rejected Production Rate Recovery</h1>
          <p className="text-sm text-gray-400 mt-1">
            Review quarantined Adobe Chapter 5 rows. Fixes save to review-fixed JSON only — approved output
            stays gated by import validation.
          </p>
        </header>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void loadAll()}
            className="px-4 py-2 rounded bg-gray-800 border border-gray-600 hover:border-cyan-500"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={() => void autoSuggestSelected()}
            disabled={!selectedRecord}
            className="px-4 py-2 rounded bg-gray-800 border border-gray-600 hover:border-cyan-500 disabled:opacity-40"
          >
            Auto-suggest Selected
          </button>
          <button
            type="button"
            onClick={() => void validateAndSave()}
            disabled={Object.keys(draftFixes).length === 0}
            className="px-4 py-2 rounded bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40"
          >
            Validate &amp; Save Review-Fixed
          </button>
        </div>

        {loading && <p className="text-gray-400">Loading…</p>}
        {message && (
          <pre className="text-sm whitespace-pre-wrap bg-gray-900 border border-gray-700 rounded p-3 text-amber-200">
            {message}
          </pre>
        )}

        {rejectedFile && (
          <div className="grid lg:grid-cols-[320px_1fr] gap-6">
            <aside className="space-y-2 max-h-[70vh] overflow-y-auto border border-gray-800 rounded-lg p-3 bg-gray-900/40">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                Rejected rows ({rejectedFile.rejectedRowCount})
              </p>
              {rejectedFile.records.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => setSelectedId(record.id ?? '')}
                  className={`w-full text-left rounded px-3 py-2 text-sm border ${
                    selectedId === record.id
                      ? 'border-cyan-500 bg-cyan-950/30'
                      : 'border-gray-800 hover:border-gray-600'
                  }`}
                >
                  <div className="font-medium truncate">{record.workElementDescription}</div>
                  <div className="text-[11px] text-gray-400 truncate">{record.id}</div>
                  <div className="text-[11px] text-amber-300 mt-1">{record.rejectionReasons.join(' · ')}</div>
                </button>
              ))}
            </aside>

            {selectedRecord && workingRow && (
              <section className="space-y-4 border border-gray-800 rounded-lg p-4 bg-gray-900/40">
                <div>
                  <h2 className="text-lg font-medium text-white">{selectedRecord.workElementDescription}</h2>
                  <p className="text-xs text-gray-400 mt-1">{selectedRecord.id}</p>
                </div>

                <div className="rounded border border-amber-800/60 bg-amber-950/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-amber-400 mb-1">Rejection reasons</p>
                  <ul className="text-sm text-amber-100 list-disc pl-5">
                    {selectedRecord.rejectionReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded border border-gray-800 p-3">
                    <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Original extracted data</h3>
                    <dl className="space-y-2 text-sm">
                      {[
                        'sectionCode',
                        'sectionTitle',
                        'itemCode',
                        'workElementDescription',
                        'unit',
                        'unitOriginal',
                        'manHoursPerUnit',
                        'sourceTableFile',
                        'sourcePageNumberApprox',
                      ].map((field) => (
                        <div key={field}>
                          <dt className="text-gray-500">{field}</dt>
                          <dd className="break-words">
                            {String(selectedRecord[field as keyof RejectedAdobeRecord] ?? '—')}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {selectedRecord.rawRow ? (
                      <pre className="mt-3 text-xs bg-gray-950 border border-gray-800 rounded p-2 overflow-x-auto">
                        {JSON.stringify(selectedRecord.rawRow, null, 2)}
                      </pre>
                    ) : null}
                  </div>

                  <div className="rounded border border-gray-800 p-3">
                    <h3 className="text-xs uppercase tracking-wide text-cyan-400 mb-2">Recovery corrections</h3>
                    <p className="text-[11px] text-gray-500 mb-3">
                      Locked: {LOCKED_FIELDS.join(', ')} (man-hours cannot be edited)
                    </p>
                    <dl className="space-y-3 text-sm">
                      {RECOVERABLE_EDITABLE_FIELDS.map((field) => (
                        <div key={field}>
                          <dt className="text-gray-500 mb-1">{field}</dt>
                          <dd>
                            <input
                              value={String(workingRow[field] ?? '')}
                              onChange={(e) => updateEditableField(field, e.target.value)}
                              className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1"
                            />
                          </dd>
                        </div>
                      ))}
                      <div>
                        <dt className="text-gray-500">manHoursPerUnit (locked)</dt>
                        <dd className="text-gray-300">{workingRow.manHoursPerUnit ?? '—'}</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {selectedFix && (
                  <div className="rounded border border-gray-800 p-3 text-sm text-gray-300">
                    <p>
                      Draft status: <strong>{selectedFix.recoveryStatus}</strong>
                    </p>
                    {selectedFix.recoveryNotes.length > 0 && (
                      <ul className="mt-2 list-disc pl-5">
                        {selectedFix.recoveryNotes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
