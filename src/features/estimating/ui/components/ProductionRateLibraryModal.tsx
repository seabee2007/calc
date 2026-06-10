import React, { useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, Loader2, Search, X } from 'lucide-react';
import {
  EMPTY_PRODUCTION_RATE_LIBRARY_FILTERS,
  hasActiveProductionRateFilters,
  type ProductionRateLibraryFilters,
} from '../../data/productionRates/productionRateLibraryQueries';
import { PRODUCTION_RATE_REFERENCE_NOTE } from '../../data/productionRates/mapToLibraryEntry';
import type { ProductionRateLibraryEntry } from '../../data/productionRates/productionRateTypes';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useProductionRateLibrary } from '../hooks/useProductionRateLibrary';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (entry: ProductionRateLibraryEntry) => void;
  initialDivisionCode?: string;
}

function formatRateSummary(entry: ProductionRateLibraryEntry): string {
  const parts: string[] = [];
  if (entry.manHoursPerUnit != null) {
    parts.push(`${entry.manHoursPerUnit.toFixed(3)} MH/${entry.unitOfMeasure}`);
  }
  if (entry.crewSize != null) {
    parts.push(`Crew ${entry.crewSize}`);
  }
  parts.push(`${entry.figure} · Page ${entry.sourcePage}`);
  if (entry.workElementNumber) {
    parts.push(entry.workElementNumber);
  }
  return parts.join(' · ');
}

function ProductionRateCard({
  entry,
  onSelect,
}: {
  entry: ProductionRateLibraryEntry;
  onSelect: (entry: ProductionRateLibraryEntry) => void;
}) {
  const title = entry.description?.trim() || entry.activityName;
  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-cyan-400/30 hover:bg-cyan-400/5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
              Approved
            </span>
          </div>
          <p className="font-medium text-white">{title}</p>
          {entry.activityName !== title ? (
            <p className="text-sm text-slate-400">{entry.activityName}</p>
          ) : null}
          <p className="text-sm text-cyan-200/90">{formatRateSummary(entry)}</p>
        </div>
        <button
          type="button"
          onClick={() => onSelect(entry)}
          className="shrink-0 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:from-cyan-300 hover:to-sky-400"
        >
          Use rate
        </button>
      </div>
    </li>
  );
}

export default function ProductionRateLibraryModal({
  isOpen,
  onClose,
  onSelect,
  initialDivisionCode,
}: Props) {
  const [filters, setFilters] = useState<ProductionRateLibraryFilters>(() => ({
    ...EMPTY_PRODUCTION_RATE_LIBRARY_FILTERS,
    divisionCode: initialDivisionCode || undefined,
  }));
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const {
    totalCount,
    loading,
    error,
    reload,
    filterRates,
    groupFilteredRates,
    divisionOptions,
    categoryOptions,
    unitOptions,
    figureOptions,
  } = useProductionRateLibrary(isOpen);

  const activeFilters = useMemo(
    (): ProductionRateLibraryFilters => ({
      ...filters,
      searchText: debouncedSearch,
    }),
    [filters, debouncedSearch],
  );

  const filteredRates = useMemo(
    () => filterRates(activeFilters),
    [filterRates, activeFilters],
  );

  const groupedResults = useMemo(
    () => groupFilteredRates(activeFilters),
    [groupFilteredRates, activeFilters],
  );

  const divisions = useMemo(
    () => divisionOptions(activeFilters),
    [divisionOptions, activeFilters],
  );
  const categories = useMemo(
    () => categoryOptions(activeFilters),
    [categoryOptions, activeFilters],
  );
  const units = useMemo(() => unitOptions(activeFilters), [unitOptions, activeFilters]);
  const figures = useMemo(() => figureOptions(activeFilters), [figureOptions, activeFilters]);

  const clearFilters = () => {
    setSearchInput('');
    setFilters({ ...EMPTY_PRODUCTION_RATE_LIBRARY_FILTERS });
  };

  const handleSelect = (entry: ProductionRateLibraryEntry) => {
    onSelect(entry);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10100] flex items-end justify-center bg-slate-950/80 p-4 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Production Rate Library</h2>
              <p className="text-sm text-slate-400">Browse approved reference rates by division and activity</p>
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

        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-slate-300">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
            <p className="text-sm">Loading approved production rates…</p>
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-16 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
            <p className="max-w-md text-sm text-slate-300">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white hover:border-cyan-400/40"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3 border-b border-white/10 px-5 py-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search activity, description, keywords, work element…"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 py-3 pl-10 pr-4 text-white placeholder:text-slate-500 outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <select
                  value={filters.divisionCode ?? ''}
                  onChange={(event) => {
                    const divisionCode = event.target.value || undefined;
                    setFilters((current) => ({
                      ...current,
                      divisionCode,
                      category: undefined,
                      unitOfMeasure: undefined,
                      figure: undefined,
                      workElementNumber: undefined,
                    }));
                  }}
                  className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60"
                >
                  <option value="">All divisions</option>
                  {divisions.map((option) => (
                    <option key={option.divisionCode} value={option.divisionCode}>
                      Division {option.divisionCode} — {option.divisionName} ({option.count})
                    </option>
                  ))}
                </select>

                <select
                  value={filters.category ?? ''}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      category: event.target.value || undefined,
                    }))
                  }
                  className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60"
                >
                  <option value="">All categories</option>
                  {categories.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>

                <select
                  value={filters.unitOfMeasure ?? ''}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      unitOfMeasure: event.target.value || undefined,
                    }))
                  }
                  className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60"
                >
                  <option value="">All units</option>
                  {units.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>

                <select
                  value={filters.figure ?? ''}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      figure: event.target.value || undefined,
                    }))
                  }
                  className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60"
                >
                  <option value="">All figures</option>
                  {figures.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-300">
                  Showing <span className="font-semibold text-white">{filteredRates.length}</span> of{' '}
                  <span className="font-semibold text-white">{totalCount}</span> approved rates
                </p>
                {hasActiveProductionRateFilters({ ...activeFilters }) ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 transition hover:border-cyan-400/40 hover:text-white"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>

              <p className="text-xs text-cyan-300/90">{PRODUCTION_RATE_REFERENCE_NOTE}</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {filteredRates.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  No approved production rates match these filters.
                </p>
              ) : (
                <div className="space-y-8">
                  {groupedResults.map((divisionGroup) => (
                    <section key={divisionGroup.divisionCode} className="space-y-4">
                      <header className="border-b border-white/10 pb-2">
                        <h3 className="text-base font-semibold text-white">
                          Division {divisionGroup.divisionCode} — {divisionGroup.divisionName}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {divisionGroup.rateCount} matching rate
                          {divisionGroup.rateCount === 1 ? '' : 's'}
                        </p>
                      </header>

                      {divisionGroup.categories.map((categoryGroup) => (
                        <div key={`${divisionGroup.divisionCode}-${categoryGroup.category}`} className="space-y-3">
                          <h4 className="text-sm font-medium text-cyan-200/90">
                            {categoryGroup.category}
                            <span className="ml-2 text-xs font-normal text-slate-500">
                              ({categoryGroup.rates.length})
                            </span>
                          </h4>
                          <ul className="space-y-2">
                            {categoryGroup.rates.map((entry) => (
                              <ProductionRateCard
                                key={entry.id}
                                entry={entry}
                                onSelect={handleSelect}
                              />
                            ))}
                          </ul>
                        </div>
                      ))}
                    </section>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
