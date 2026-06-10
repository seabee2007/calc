/**
 * /dev/production-rate-review — Internal AI-assisted production rate review UI.
 *
 * DEV-ONLY. Side-by-side raw vs AI-reviewed comparison with human approval gate.
 * Only approved records may feed the estimator (via promote script + generator).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  NormalizedProductionRateFile,
  NormalizedProductionRateRecord,
} from '../../data/productionRates/productionRateTypes';
import { validateProductionRateRecord } from '../../data/productionRates/validateExtractedProductionRates';

const API_BASE = '/dev-api/production-rates';
const COMPARE_FIELDS: Array<keyof NormalizedProductionRateRecord> = [
  'figureTitle',
  'category',
  'subcategory',
  'activityName',
  'description',
  'unitOfMeasure',
  'manHoursPerUnit',
  'sourcePdfPage',
  'workElementNumber',
  'workElementLineNumber',
];

interface FigureOption {
  stem: string;
  division: string;
  figure: string;
  figureTitle: string;
}

function statusBadge(status: string): string {
  switch (status) {
    case 'ai_reviewed':
      return 'AI Reviewed';
    case 'needs_review':
      return 'Needs Review';
    case 'reviewed':
      return 'Reviewed';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    default:
      return status;
  }
}

function productionRateRecordKey(
  record: NormalizedProductionRateRecord,
  index: number,
): string {
  if (record.id) return `${record.id}::${index}`;
  return [
    record.figure,
    record.sourcePage,
    record.workElementNumber,
    record.workElementLineNumber,
    record.activityName,
    index,
  ]
    .filter(Boolean)
    .join('|');
}

async function fetchFigureList(division: string): Promise<FigureOption[]> {
  const params = division ? `?division=${encodeURIComponent(division)}` : '';
  const res = await fetch(`${API_BASE}/figures${params}`);
  if (!res.ok) throw new Error('Failed to load figure list');
  const payload = (await res.json()) as { figures: FigureOption[] };
  return payload.figures;
}

async function fetchStageFile(
  stage: 'raw' | 'ai-reviewed' | 'reviewed' | 'approved' | 'rejected',
  fileName: string,
): Promise<NormalizedProductionRateFile | null> {
  const res = await fetch(`${API_BASE}/${stage}/${fileName}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load ${stage}/${fileName}`);
  return (await res.json()) as NormalizedProductionRateFile;
}

async function writeStageFile(
  stage: 'ai-reviewed' | 'reviewed' | 'approved' | 'rejected',
  fileName: string,
  content: NormalizedProductionRateFile,
): Promise<void> {
  const res = await fetch(`${API_BASE}/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage, fileName, content }),
  });
  if (!res.ok) {
    const payload = (await res.json()) as { error?: string };
    throw new Error(payload.error ?? 'Write failed');
  }
}

function canApproveRecord(record: NormalizedProductionRateRecord): string[] {
  const result = validateProductionRateRecord(
    { ...record, qaStatus: 'approved', extractionWarnings: [] },
    0,
    { expectedQaStatus: 'approved' },
  );
  return result.errors.map((e) => e.message);
}

export default function ProductionRateReviewPage(): React.ReactElement {
  const [division, setDivision] = useState('03');
  const [figures, setFigures] = useState<FigureOption[]>([]);
  const [selectedStem, setSelectedStem] = useState('');
  const [rawFile, setRawFile] = useState<NormalizedProductionRateFile | null>(null);
  const [aiFile, setAiFile] = useState<NormalizedProductionRateFile | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, NormalizedProductionRateRecord>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFigureList(division)
      .then(setFigures)
      .catch((error: Error) => setMessage(error.message));
  }, [division]);

  const loadFigure = useCallback(async (stem: string) => {
    setLoading(true);
    setMessage('');
    setSelectedIds(new Set());
    setEdits({});
    try {
      const [raw, ai] = await Promise.all([
        fetchStageFile('raw', `${stem}.json`),
        fetchStageFile('ai-reviewed', `${stem}.ai_reviewed.json`),
      ]);
      setRawFile(raw);
      setAiFile(ai);
      if (!raw) setMessage('Raw figure file not found.');
      if (!ai) setMessage((prev) => `${prev} AI-reviewed file not found — run ai-review first.`.trim());
    } catch (error) {
      setMessage(String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStem) void loadFigure(selectedStem);
  }, [selectedStem, loadFigure]);

  const aiRecords = useMemo(() => {
    if (!aiFile) return [];
    return aiFile.records.map((record) => edits[record.id] ?? record);
  }, [aiFile, edits]);

  const rawById = useMemo(() => {
    const map = new Map<string, NormalizedProductionRateRecord>();
    rawFile?.records.forEach((record) => map.set(record.id, record));
    return map;
  }, [rawFile]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateField = (id: string, field: keyof NormalizedProductionRateRecord, value: string) => {
    setEdits((prev) => {
      const base = prev[id] ?? aiRecords.find((r) => r.id === id);
      if (!base) return prev;
      return { ...prev, [id]: { ...base, [field]: value } };
    });
  };

  const saveEditsToAiReviewed = async () => {
    if (!aiFile || !selectedStem) return;
    const payload: NormalizedProductionRateFile = {
      ...aiFile,
      records: aiRecords.map((record) => ({
        ...record,
        qaStatus: 'ai_reviewed' as const,
        updatedAt: new Date().toISOString(),
      })),
    };
    await writeStageFile('ai-reviewed', `${selectedStem}.ai_reviewed.json`, payload);
    setAiFile(payload);
    setEdits({});
    setMessage('Saved edits to ai-reviewed.');
  };

  const approveSelected = async () => {
    if (!aiFile || !selectedStem || selectedIds.size === 0) return;
    const selected = aiRecords.filter((r) => selectedIds.has(r.id));
    const blockers = selected.flatMap((record) => {
      const issues = canApproveRecord(record);
      return issues.map((issue) => `${record.id}: ${issue}`);
    });
    if (blockers.length > 0) {
      setMessage(`Cannot approve:\n${blockers.slice(0, 5).join('\n')}`);
      return;
    }

    const now = new Date().toISOString();
    const approvedRecords = selected.map((record) => ({
      ...record,
      qaStatus: 'approved' as const,
      extractionWarnings: [],
      updatedAt: now,
    }));

    const existingApproved = await fetchStageFile('approved', `${selectedStem}.approved.json`);
    const mergedById = new Map<string, NormalizedProductionRateRecord>();
    existingApproved?.records.forEach((record) => mergedById.set(record.id, record));
    approvedRecords.forEach((record) => mergedById.set(record.id, record));

    const payload: NormalizedProductionRateFile = {
      batchMeta: {
        ...(aiFile.batchMeta ?? rawFile?.batchMeta ?? {}),
        approvedAt: now.slice(0, 10),
        approvedBy: 'dev-ui',
      },
      records: [...mergedById.values()],
    };

    await writeStageFile('approved', `${selectedStem}.approved.json`, payload);
    setMessage(`Approved ${selected.length} record(s). Run npm run generate:production-rates.`);
    setSelectedIds(new Set());
  };

  const rejectSelected = async () => {
    if (!aiFile || !selectedStem || selectedIds.size === 0) return;
    const now = new Date().toISOString();
    const rejected = aiRecords
      .filter((r) => selectedIds.has(r.id))
      .map((record) => ({ ...record, qaStatus: 'rejected' as const, updatedAt: now }));
    const payload: NormalizedProductionRateFile = {
      batchMeta: { ...(aiFile.batchMeta ?? {}), rejectedAt: now.slice(0, 10) },
      records: rejected,
    };
    await writeStageFile('rejected', `${selectedStem}.rejected.json`, payload);
    setMessage(`Rejected ${rejected.length} record(s).`);
    setSelectedIds(new Set());
  };

  const sendBackToReview = async () => {
    if (!aiFile || !selectedStem) return;
    const now = new Date().toISOString();
    const payload: NormalizedProductionRateFile = {
      ...aiFile,
      records: aiRecords.map((record) => ({
        ...record,
        qaStatus: 'reviewed' as const,
        updatedAt: now,
      })),
    };
    await writeStageFile('reviewed', `${selectedStem}.reviewed.json`, payload);
    setMessage('Moved figure to reviewed stage.');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-cyan-300">Production Rate Review</h1>
          <p className="text-sm text-gray-400 mt-1">
            AI-assisted cleaning with human approval gate. Only Approved records feed the estimator.
          </p>
        </header>

        <div className="flex flex-wrap gap-4 items-end">
          <label className="flex flex-col gap-1 text-sm">
            Division
            <select
              value={division}
              onChange={(e) => {
                setDivision(e.target.value);
                setSelectedStem('');
              }}
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2"
            >
              <option value="03">03 — Concrete</option>
              <option value="31">31 — Earthwork</option>
              <option value="06">06 — Wood</option>
              <option value="32">32 — Exterior Improvements</option>
              <option value="26">26 — Electrical</option>
              <option value="22">22 — Plumbing</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm min-w-[320px]">
            Source Figure
            <select
              value={selectedStem}
              onChange={(e) => setSelectedStem(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2"
            >
              <option value="">Select figure…</option>
              {figures.map((figure) => (
                <option key={figure.stem} value={figure.stem}>
                  {figure.figure} — {figure.figureTitle}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void saveEditsToAiReviewed()}
              disabled={Object.keys(edits).length === 0}
              className="px-4 py-2 rounded bg-gray-800 border border-gray-600 hover:border-cyan-500 disabled:opacity-40"
            >
              Save Edits
            </button>
            <button
              type="button"
              onClick={() => void approveSelected()}
              disabled={selectedIds.size === 0}
              className="px-4 py-2 rounded bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40"
            >
              Approve Selected
            </button>
            <button
              type="button"
              onClick={() => void sendBackToReview()}
              disabled={!aiFile}
              className="px-4 py-2 rounded bg-gray-800 border border-gray-600 hover:border-cyan-500 disabled:opacity-40"
            >
              Send Back to Review
            </button>
            <button
              type="button"
              onClick={() => void rejectSelected()}
              disabled={selectedIds.size === 0}
              className="px-4 py-2 rounded bg-red-900/60 border border-red-700 hover:border-red-500 disabled:opacity-40"
            >
              Reject
            </button>
          </div>
        </div>

        {loading && <p className="text-gray-400">Loading…</p>}
        {message && (
          <pre className="text-sm whitespace-pre-wrap bg-gray-900 border border-gray-700 rounded p-3 text-amber-200">
            {message}
          </pre>
        )}

        {aiRecords.length > 0 && (
          <div className="space-y-4">
            {aiRecords.map((aiRecord, index) => {
              const rawRecord = rawById.get(aiRecord.id);
              const warnings = aiRecord.extractionWarnings ?? [];
              const recordKey = productionRateRecordKey(aiRecord, index);
              const changedFields = COMPARE_FIELDS.filter(
                (field) => rawRecord && rawRecord[field] !== aiRecord[field],
              );

              return (
                <article
                  key={recordKey}
                  className="border border-gray-800 rounded-lg overflow-hidden bg-gray-900/50"
                >
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(aiRecord.id)}
                      onChange={() => toggleSelect(aiRecord.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{aiRecord.activityName}</div>
                      <div className="text-xs text-gray-400">
                        {aiRecord.id} · Source Page {aiRecord.sourcePage} · PDF p.
                        {aiRecord.sourcePdfPage ?? '—'} · {statusBadge(aiRecord.qaStatus)}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-cyan-300">Production Rate</div>
                      <div>
                        {aiRecord.manHoursPerUnit ?? '—'} MH / {aiRecord.unitOfMeasure}
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-800">
                    <section className="p-4">
                      <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Raw Extract</h3>
                      {rawRecord ? (
                        <dl className="space-y-2 text-sm">
                          {COMPARE_FIELDS.map((field) => (
                            <div key={field}>
                              <dt className="text-gray-500">{field}</dt>
                              <dd className="break-words">{String(rawRecord[field] ?? '—')}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <p className="text-gray-500 text-sm">No matching raw record.</p>
                      )}
                    </section>

                    <section className="p-4">
                      <h3 className="text-xs uppercase tracking-wide text-cyan-500 mb-2">AI Reviewed</h3>
                      <dl className="space-y-2 text-sm">
                        {COMPARE_FIELDS.map((field) => {
                          const changed = changedFields.includes(field);
                          const value = aiRecord[field];
                          const editable =
                            field === 'activityName' ||
                            field === 'category' ||
                            field === 'subcategory' ||
                            field === 'description' ||
                            field === 'unitOfMeasure';

                          return (
                            <div key={field}>
                              <dt className={changed ? 'text-amber-400' : 'text-gray-500'}>
                                {field}
                                {changed ? ' (changed)' : ''}
                              </dt>
                              <dd className="break-words">
                                {editable ? (
                                  <input
                                    value={String(value ?? '')}
                                    onChange={(e) => updateField(aiRecord.id, field, e.target.value)}
                                    className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1"
                                  />
                                ) : (
                                  String(value ?? '—')
                                )}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                    </section>
                  </div>

                  {warnings.length > 0 && (
                    <div className="px-4 py-3 border-t border-gray-800 bg-amber-950/20">
                      <div className="text-xs uppercase text-amber-400 mb-1">Warnings</div>
                      <ul className="text-sm text-amber-200 list-disc pl-5">
                        {warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
