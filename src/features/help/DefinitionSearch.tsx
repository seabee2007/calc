import type { DefinitionCategory, DefinitionCategoryId } from './definitions';
import { DEFINITION_CATEGORIES } from './definitions';

interface Props {
  query: string;
  activeCategory: DefinitionCategoryId | 'all';
  onQueryChange: (value: string) => void;
  onCategoryChange: (category: DefinitionCategoryId | 'all') => void;
  resultCount: number;
}

export default function DefinitionSearch({
  query,
  activeCategory,
  onQueryChange,
  onCategoryChange,
  resultCount,
}: Props) {
  return (
    <div className="space-y-3 border-b border-slate-700 px-5 py-4">
      <label className="block">
        <span className="sr-only">Search definitions</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search terms, acronyms, or topics…"
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {DEFINITION_CATEGORIES.map((category: DefinitionCategory) => {
          const isActive = activeCategory === category.id;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onCategoryChange(category.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {category.label}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-slate-400">
        {resultCount} definition{resultCount === 1 ? '' : 's'} shown
      </p>
    </div>
  );
}
