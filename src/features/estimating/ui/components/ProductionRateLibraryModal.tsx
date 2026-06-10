import React, { useMemo, useState } from 'react';
import { BookOpen, Search, X } from 'lucide-react';
import {
  getProductionRateLibraryCategoryOptions,
  getProductionRateLibraryDivisionOptions,
  getProductionRateLibraryUnitOptions,
  searchProductionRateLibrary,
} from '../../data/productionRates/productionRateLibrary';
import { PRODUCTION_RATE_REFERENCE_NOTE } from '../../data/productionRates/mapToLibraryEntry';
import type { ProductionRateLibraryEntry } from '../../data/productionRates/productionRateTypes';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (entry: ProductionRateLibraryEntry) => void;
  initialDivisionCode?: string;
}

export default function ProductionRateLibraryModal({
  isOpen,
  onClose,
  onSelect,
  initialDivisionCode,
}: Props) {
  const [query, setQuery] = useState('');
  const [divisionCode, setDivisionCode] = useState(initialDivisionCode ?? '');
  const [category, setCategory] = useState('');
  const [unitOfMeasure, setUnitOfMeasure] = useState('');

  const divisionOptions = useMemo(() => getProductionRateLibraryDivisionOptions(), []);
  const categoryOptions = useMemo(
    () => getProductionRateLibraryCategoryOptions(divisionCode || undefined),
    [divisionCode],
  );
  const unitOptions = useMemo(
    () => getProductionRateLibraryUnitOptions(divisionCode || undefined),
    [divisionCode],
  );

  const results = useMemo(
    () =>
      searchProductionRateLibrary({
        query,
        divisionCode: divisionCode || undefined,
        category: category || undefined,
        unitOfMeasure: unitOfMeasure || undefined,
      }),
    [query, divisionCode, category, unitOfMeasure],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10100] flex items-end justify-center bg-slate-950/80 p-4 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Production Rate Library</h2>
              <p className="text-sm text-slate-400">NTRP/MCRP reference rates — approved only</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Close production rate library"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 border-b border-white/10 px-5 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search activity, category, figure, keyword…"
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 py-3 pl-10 pr-4 text-white placeholder:text-slate-500 outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select
              value={divisionCode}
              onChange={(event) => {
                setDivisionCode(event.target.value);
                setCategory('');
                setUnitOfMeasure('');
              }}
              className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60"
            >
              <option value="">All divisions</option>
              {divisionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60"
            >
              <option value="">All categories</option>
              {categoryOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={unitOfMeasure}
              onChange={(event) => setUnitOfMeasure(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60"
            >
              <option value="">All units</option>
              {unitOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-cyan-300/90">{PRODUCTION_RATE_REFERENCE_NOTE}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {results.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No approved production rates match your filters.</p>
          ) : (
            <ul className="space-y-3">
              {results.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-cyan-400/30 hover:bg-cyan-400/5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium text-white">{entry.activityName}</p>
                      {entry.category ? (
                        <p className="text-sm text-slate-300">
                          {entry.category}
                          {entry.subcategory ? ` · ${entry.subcategory}` : ''}
                        </p>
                      ) : null}
                      <p className="text-xs text-slate-400">
                        {entry.figure} · p. {entry.sourcePage} · Div {entry.divisionCode} {entry.divisionName}
                      </p>
                      {entry.figureNotes?.length ? (
                        <p className="text-xs text-slate-500">{entry.figureNotes[0]}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-cyan-300">
                          {entry.manHoursPerUnit != null ? entry.manHoursPerUnit.toFixed(4) : '—'} MH/{entry.unitOfMeasure}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(entry);
                          onClose();
                        }}
                        className="rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:from-cyan-300 hover:to-sky-400"
                      >
                        Apply rate
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
