/**
 * Reusable sub-component for displaying company cost library items.
 * Used inside the resource picker modal "My Library" tab.
 */
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { TEXT_MUTED, TEXT_FOREGROUND, TEXT_SUBTLE } from '../../../../theme/appTheme';
import type { CompanyCostLibraryItem, ActivityResourceProvider } from '../../domain/constructionActivityTypes';
import { getCompanyCostLibraryItems } from '../../application/companyCostLibraryService';

interface Props {
  type: 'material' | 'equipment';
  query: string;
  onSelect: (item: CompanyCostLibraryItem) => void;
  onEdit?: (item: CompanyCostLibraryItem) => void;
  onDelete?: (item: CompanyCostLibraryItem) => void;
}

function SourceChip({ provider }: { provider: ActivityResourceProvider }) {
  const config: Record<ActivityResourceProvider, { label: string; cls: string }> = {
    manual: { label: 'Manual', cls: 'bg-slate-700 text-slate-200' },
    arden_starter: { label: 'Starter', cls: 'bg-cyan-900/60 text-cyan-300' },
    arden_design_builder: { label: 'Design Builder', cls: 'bg-emerald-900/60 text-emerald-300' },
    company_library: { label: 'My Library', cls: 'bg-violet-900/60 text-violet-300' },
  };
  const { label, cls } = config[provider] ?? config.manual;
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function formatMoney(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

export function CompanyCostLibrarySection({ type, query, onSelect, onEdit, onDelete }: Props) {
  const [items, setItems] = useState<CompanyCostLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCompanyCostLibraryItems(type).then(({ items: data, error: err }) => {
      if (cancelled) return;
      setItems(data);
      setError(err);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [type]);

  const filtered =
    query.trim()
      ? items.filter(
          (item) =>
            item.name.toLowerCase().includes(query.toLowerCase()) ||
            (item.category ?? '').toLowerCase().includes(query.toLowerCase()) ||
            (item.subcategory ?? '').toLowerCase().includes(query.toLowerCase()),
        )
      : items;

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <p className="px-4 py-4 text-xs text-red-400">{error}</p>;
  }

  if (filtered.length === 0) {
    return (
    <div className="py-8 text-center">
      <Search className="mx-auto mb-2 h-8 w-8 text-slate-600" />
        <p className={`text-sm ${TEXT_SUBTLE}`}>
          {items.length === 0 ? 'Your library is empty.' : 'No items match your search.'}
        </p>
        {items.length === 0 && (
          <p className={`mt-1 text-xs ${TEXT_SUBTLE}`}>
            Add items from the Starter Library or manual entry, then save to My Library.
          </p>
        )}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-700/40">
      {filtered.map((item) => (
        <li key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/30">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${TEXT_FOREGROUND} truncate`}>{item.name}</span>
              <SourceChip provider={item.sourceProvider} />
            </div>
            <div className={`flex items-center gap-2 text-xs ${TEXT_MUTED} mt-0.5`}>
              <span>{item.unit}</span>
              {item.category && <span>· {item.category}</span>}
              <span className="ml-auto font-medium text-slate-300">
                {item.defaultUnitCost > 0
                  ? formatMoney(item.defaultUnitCost) + ' / ' + item.unit
                  : <span className="text-amber-400">Price required</span>}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(item)}
                className={`text-xs ${TEXT_MUTED} hover:text-cyan-400 transition-colors px-1.5 py-0.5 rounded`}
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(item)}
                className="text-xs text-slate-500 hover:text-red-400 transition-colors px-1.5 py-0.5 rounded"
              >
                Remove
              </button>
            )}
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="rounded bg-cyan-700/70 px-2.5 py-1 text-xs font-medium text-cyan-100 hover:bg-cyan-700 transition-colors"
            >
              Use this
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
